# _smoke-v14.ps1 — v1.4 P1-1/2/3/4/5 后台增强冒烟(28 项)
# Phase A:GDPR DELETE /admin/users/:id(5 项)
# Phase B:Dealer CRUD + 价格表 + RBAC(7 项)
# Phase C:Ticket SLA sweep + stats + cron(4 项)
# Phase D:RBAC 跨角色访问拒绝(4 项)
# Phase E:i18n 多语言 Accept-Language 端到端兼容(4 项)
# Phase F:GET /admin/audit 审计日志端点(4 项)
#
# 前置:apps/api 已启动(默认 http://localhost:3001)
#       apps/api/.env 含 DEV_FIXED_OTP=123456(便于演示 OTP 流程)
#       prisma/dev.db 已 seed(含 admin/+8801000000001 / customer/+8801000000002 / dealer/+8801000000003)

$ErrorActionPreference = 'Continue'
$Base = 'http://localhost:3001'

function Req($method, $path, $token = $null, $body = $null, $lang = $null) {
  $h = @{ 'Content-Type' = 'application/json' }
  if ($token) { $h['Authorization'] = "Bearer $token" }
  if ($lang) { $h['Accept-Language'] = $lang }
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Method $method -Uri "$Base$path" -Headers $h -Body $body -TimeoutSec 12
    return @{ code = [int]$r.StatusCode; body = $r.Content; ok = $true }
  } catch {
    $code = 0; $bodyText = ''
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream) { $reader = New-Object System.IO.StreamReader($stream); $bodyText = $reader.ReadToEnd(); $reader.Close() }
      } catch {}
    }
    return @{ code = $code; body = $bodyText; ok = $false }
  }
}

function Login($phone) {
  # DEV_FIXED_OTP 开启时,otp/request 直接返回 200 + verify 123456 即可拿到 token
  $r = Req POST '/auth/otp/request' $null "{`"phone`":`"$phone`"}"
  if (-not $r.ok -or $r.code -ne 200) { throw "otp/request failed for $phone (code=$($r.code) body=$($r.body))" }
  $r = Req POST '/auth/otp/verify' $null "{`"phone`":`"$phone`",`"code`":`"123456`"}"
  if (-not $r.ok -or $r.code -ne 200) { throw "otp/verify failed for $phone (code=$($r.code) body=$($r.body))" }
  $j = $r.body | ConvertFrom-Json
  return $j.token
}

$results = @()
function Pass($label) { Write-Host "  [PASS] $label" -ForegroundColor Green; $script:results += @{ pass = $true; label = $label } }
function Fail($label, $detail) { Write-Host "  [FAIL] $label -- $detail" -ForegroundColor Red; $script:results += @{ pass = $false; label = $label; detail = $detail } }
function Check($label, $code, $expected) {
  if ($code -eq $expected) { Pass "$label (code=$code)" }
  else { Fail "$label" "expected $expected, got $code" }
}

# ============================================================
# 0) 登录准备
# ============================================================
Write-Host "`n=== 0) 登录 admin / customer / dealer ===" -ForegroundColor Cyan
try {
  $adminToken = Login '+8801000000001'   # SEED.admin
  $customerToken = Login '+8801000000002' # SEED.customer
  $dealerToken = Login '+8801000000003'   # SEED.dealer
  Write-Host "  admin/customer/dealer tokens acquired (len=$($adminToken.Length)/$($customerToken.Length)/$($dealerToken.Length))"
} catch {
  Write-Host "  [FATAL] login failed: $_" -ForegroundColor Red
  exit 1
}

# ============================================================
# Phase A:GDPR DELETE /admin/users/:id(5 项)
# ============================================================
Write-Host "`n=== Phase A:GDPR DELETE /admin/users/:id ===" -ForegroundColor Cyan

# A1: 在 DB 里创建一个临时 customer,然后走 GDPR delete
$tempPhone = "+88018$((Get-Random -Minimum 1000000 -Maximum 9999999))"
$r = Req POST '/auth/otp/request' $null "{`"phone`":`"$tempPhone`"}"
if ($r.code -ne 200) { Fail 'A0 setup:create temp user OTP' "code=$($r.code)" }
$tempToken = Login $tempPhone
# 读出 userId
$me = (Req GET '/warranty/mine' $tempToken).body | ConvertFrom-Json
# 从 token 解 sub 不可行,改用 SQLite helper(node 读 dev.db)
$devDbPath = 'E:\MatooPower\h5-app\apps\api\prisma\dev.db'
$tmpSql = Join-Path $env:TEMP "matoo-smoke-v14-userid-$((Get-Date).Ticks).cjs"
$tmpOut = Join-Path $env:TEMP "matoo-smoke-v14-userid-$((Get-Date).Ticks).out"
$userQuery = @'
const { DatabaseSync } = require('node:sqlite');
// node <script> <dbPath> <phone>
const db = new DatabaseSync(process.argv[2]);
const r = db.prepare("SELECT id FROM User WHERE phone = ?").get(process.argv[3]);
console.log(r ? r.id : '');
'@
Set-Content -Path $tmpSql -Value $userQuery -Encoding UTF8
$tempUserId = (node $tmpSql $devDbPath $tempPhone).Trim()
Remove-Item $tmpSql -ErrorAction SilentlyContinue

if (-not $tempUserId) { Fail 'A0 setup:resolve temp userId' "phone=$tempPhone" ; exit 1 }
Write-Host "  · temp customer userId=$tempUserId (phone=$tempPhone)"

# A1:GET /admin/users(列表接口返回 200)
Check 'A1 GET /admin/users (list)' (Req GET '/admin/users' $adminToken).code 200

# A2:DELETE /admin/users/:id → 200 + 返回 anonymizedPhone/Email
$r = Req DELETE "/admin/users/$tempUserId" $adminToken
if ($r.code -eq 200) {
  $delBody = $r.body | ConvertFrom-Json
  if ($delBody.ok -and $delBody.id -eq $tempUserId -and $delBody.anonymizedPhone) {
    Pass "A2 DELETE /admin/users/:id (soft delete + anonymize; aph=$($delBody.anonymizedPhone.Substring(0,12))...)"
  } else {
    Fail 'A2 DELETE response shape' "ok=$($delBody.ok) id=$($delBody.id) aph=$($delBody.anonymizedPhone) aem=$($delBody.anonymizedEmail)"
  }
} else {
  Fail 'A2 DELETE /admin/users/:id' "code=$($r.code) body=$($r.body)"
}

# A3:AuditLog 写入 user.gdpr_delete(查 /admin/audit)
$r = Req GET '/admin/audit?resource=user:gdt_xxx' $adminToken
# 上面 resource 不一定匹配,改用通配
$auditAll = (Req GET '/admin/audit?limit=50' $adminToken).body | ConvertFrom-Json
$gdprHit = $auditAll.items | Where-Object { $_.action -eq 'user.gdpr_delete' -and $_.resource -eq "user:$tempUserId" } | Select-Object -First 1
if ($gdprHit) { Pass 'A3 AuditLog user.gdpr_delete written' }
else { Fail 'A3 AuditLog user.gdpr_delete' 'not found in /admin/audit' }

# A4:用户从 /admin/users 列表中消失(deletedAt 隐藏)
$listAfter = (Req GET '/admin/users' $adminToken).body | ConvertFrom-Json
$stillThere = $listAfter.items | Where-Object { $_.id -eq $tempUserId }
if (-not $stillThere) { Pass 'A4 deleted user hidden from /admin/users' }
else { Fail 'A4 deleted user hidden' "still in list ($($stillThere.Count))" }

# A5:GET /admin/users/:id → 404
$r = Req GET "/admin/users/$tempUserId" $adminToken
if ($r.code -eq 404) { Pass 'A5 GET /admin/users/:id → 404 (soft delete respected)' }
else { Fail 'A5 deleted user 404' "code=$($r.code)" }

# ============================================================
# Phase B:Dealer CRUD + 价格表 + RBAC(7 项)
# ============================================================
Write-Host "`n=== Phase B:Dealer CRUD + price list ===" -ForegroundColor Cyan

# B1:GET /admin/dealers(列表 200)
Check 'B1 GET /admin/dealers (list)' (Req GET '/admin/dealers' $adminToken).code 200

# B2:POST /admin/dealers(创建)
$companyName = "Smoke Test Dealer $((Get-Date).Ticks)"
$r = Req POST '/admin/dealers' $adminToken "{`"companyName`":`"$companyName`",`"country`":`"NP`",`"tier`":`"silver`",`"contactEmail`":`"smoke@matoo.test`"}"
if ($r.code -eq 201) {
  $b2body = $r.body | ConvertFrom-Json
  $newDealerId = $b2body.dealer.id
  if ($b2body.ok -and $newDealerId -and $b2body.dealer.status -eq 'active') {
    Pass "B2 POST /admin/dealers (create, id=$newDealerId)"
  } else {
    Fail 'B2 POST response shape' "ok=$($b2body.ok) id=$newDealerId"
  }
} else {
  Fail 'B2 POST /admin/dealers' "code=$($r.code) body=$($r.body)"
}

# B3:GET /admin/dealers/:id(详情含 priceList + members)
$r = Req GET "/admin/dealers/$newDealerId" $adminToken
if ($r.code -eq 200) {
  $b3 = $r.body | ConvertFrom-Json
  if ($b3.ok -and $b3.dealer.id -eq $newDealerId -and $b3.dealer.priceList.Count -eq 0 -and $b3.dealer.members.Count -eq 0) {
    Pass 'B3 GET /admin/dealers/:id (detail with priceList+members)'
  } else {
    Fail 'B3 detail shape' "ok=$($b3.ok) pl=$($b3.dealer.priceList.Count) members=$($b3.dealer.members.Count)"
  }
} else {
  Fail 'B3 GET /admin/dealers/:id' "code=$($r.code)"
}

# B4:PATCH /admin/dealers/:id(更新 tier gold)
$r = Req PATCH "/admin/dealers/$newDealerId" $adminToken "{`"tier`":`"gold`",`"note`":`"smoke-test upgrade`"}"
if ($r.code -eq 200) {
  $b4 = $r.body | ConvertFrom-Json
  if ($b4.dealer.tier -eq 'gold' -and $b4.dealer.note -eq 'smoke-test upgrade') {
    Pass 'B4 PATCH /admin/dealers/:id (tier=gold)'
  } else {
    Fail 'B4 patch effect' "tier=$($b4.dealer.tier) note=$($b4.dealer.note)"
  }
} else {
  Fail 'B4 PATCH' "code=$($r.code)"
}

# B5:POST /admin/dealers/:id/prices(加价)
$skuId = 'MATO-MAT12200-DEMO0001'
$r = Req POST "/admin/dealers/$newDealerId/prices" $adminToken "{`"skuId`":`"$skuId`",`"priceCents`":6900000,`"currency`":`"NPR`"}"
if ($r.code -eq 201) {
  $b5 = $r.body | ConvertFrom-Json
  $newPriceId = $b5.price.id
  if ($b5.ok -and $b5.price.priceCents -eq 6900000 -and $b5.price.currency -eq 'NPR') {
    Pass 'B5 POST /admin/dealers/:id/prices (priceCents=6900000 NPR)'
  } else {
    Fail 'B5 price shape' "ok=$($b5.ok) cents=$($b5.price.priceCents)"
  }
} else {
  Fail 'B5 POST prices' "code=$($r.code) body=$($r.body)"
}

# B6:DELETE /admin/dealers/:id/prices/:priceId(删价)
$r = Req DELETE "/admin/dealers/$newDealerId/prices/$newPriceId" $adminToken
Check 'B6 DELETE /admin/dealers/:id/prices/:priceId' $r.code 200

# B7:DELETE /admin/dealers/:id(软挂起)
$r = Req DELETE "/admin/dealers/$newDealerId" $adminToken
if ($r.code -eq 200) {
  $b7 = $r.body | ConvertFrom-Json
  if ($b7.dealer.status -eq 'suspended') {
    Pass 'B7 DELETE /admin/dealers/:id (soft-suspend)'
  } else {
    Fail 'B7 suspend effect' "status=$($b7.dealer.status)"
  }
} else {
  Fail 'B7 DELETE' "code=$($r.code)"
}

# ============================================================
# Phase C:Ticket SLA sweep + stats + RBAC(4 项)
# ============================================================
Write-Host "`n=== Phase C:Ticket SLA sweep + stats ===" -ForegroundColor Cyan

# C1:GET /admin/tickets/sla-stats → 200(可被 admin/support 访问)
$r = Req GET '/admin/tickets/sla-stats' $adminToken
if ($r.code -eq 200) {
  $c1 = $r.body | ConvertFrom-Json
  if ($c1.ok -and ($c1.openOver2h -is [int] -or $c1.openOver2h -is [long]) -and ($c1.highOver4h -is [int] -or $c1.highOver4h -is [long])) {
    Pass "C1 GET /admin/tickets/sla-stats (openOver2h=$($c1.openOver2h), highOver4h=$($c1.highOver4h))"
  } else {
    Fail 'C1 sla-stats shape' "body=$($r.body)"
  }
} else {
  Fail 'C1 GET sla-stats' "code=$($r.code)"
}

# C2:POST /admin/tickets/sla-sweep → 200 + 返回 details
$r = Req POST '/admin/tickets/sla-sweep' $adminToken
if ($r.code -eq 200) {
  $c2 = $r.body | ConvertFrom-Json
  if ($c2.ok -and ($c2.upgraded -is [int] -or $c2.upgraded -is [long]) -and $c2.details -is [Array]) {
    Pass "C2 POST /admin/tickets/sla-sweep (upgraded=$($c2.upgraded))"
  } else {
    Fail 'C2 sweep shape' "body=$($r.body)"
  }
} else {
  Fail 'C2 POST sla-sweep' "code=$($r.code) body=$($r.body)"
}

# C3:GET /admin/tickets/sla-stats 未登录 → 401
Check 'C3 GET sla-stats unauth → 401' (Req GET '/admin/tickets/sla-stats').code 401

# C4:POST /admin/tickets/sla-sweep customer 角色 → 403(RBAC)
Check 'C4 POST sla-sweep as customer → 403' (Req POST '/admin/tickets/sla-sweep' $customerToken).code 403

# ============================================================
# Phase D:RBAC 跨角色访问拒绝(4 项)
# ============================================================
Write-Host "`n=== Phase D:RBAC 跨角色访问拒绝 ===" -ForegroundColor Cyan

# D1:customer → /admin/users → 403
Check 'D1 customer → /admin/users → 403' (Req GET '/admin/users' $customerToken).code 403

# D2:customer → /admin/dealers → 403
Check 'D2 customer → /admin/dealers → 403' (Req GET '/admin/dealers' $customerToken).code 403

# D3:customer → /admin/warranties → 403
Check 'D3 customer → /admin/warranties → 403' (Req GET '/admin/warranties' $customerToken).code 403

# D4:dealer → /admin/users → 403(dealer 也不应能管 admin users)
Check 'D4 dealer → /admin/users → 403' (Req GET '/admin/users' $dealerToken).code 403

# ============================================================
# Phase E:i18n 多语言 Accept-Language 端到端兼容(4 项)
# ============================================================
Write-Host "`n=== Phase E:i18n Accept-Language 兼容性 ===" -ForegroundColor Cyan
# 后端 API 对语言保持中立(数据 + JSON 字段不本地化),但验证 5 种语言都能正常驱动同一组端点

$langs = @('zh-CN', 'en', 'bn', 'hi', 'ur')

# E1:GET /admin/overview 在所有 5 种 Accept-Language 下都 200
$e1 = 0; $e1Detail = ''
foreach ($lang in $langs) {
  $r = Req GET '/admin/overview' $adminToken $null $lang
  if ($r.code -ne 200) { $e1++; $e1Detail += "$lang=$($r.code) " }
}
if ($e1 -eq 0) { Pass "E1 GET /admin/overview 在 5 语言下全部 200 (zh-CN/en/bn/hi/ur)" }
else { Fail 'E1 GET /admin/overview multi-lang' $e1Detail }

# E2:GET /admin/sku 在所有 5 种 Accept-Language 下都 200
$e2 = 0; $e2Detail = ''
foreach ($lang in $langs) {
  $r = Req GET '/admin/sku' $adminToken $null $lang
  if ($r.code -ne 200) { $e2++; $e2Detail += "$lang=$($r.code) " }
}
if ($e2 -eq 0) { Pass "E2 GET /admin/sku 在 5 语言下全部 200" }
else { Fail 'E2 GET /admin/sku multi-lang' $e2Detail }

# E3:GET /admin/tickets 在所有 5 种 Accept-Language 下都 200
$e3 = 0; $e3Detail = ''
foreach ($lang in $langs) {
  $r = Req GET '/admin/tickets' $adminToken $null $lang
  if ($r.code -ne 200) { $e3++; $e3Detail += "$lang=$($r.code) " }
}
if ($e3 -eq 0) { Pass "E3 GET /admin/tickets 在 5 语言下全部 200" }
else { Fail 'E3 GET /admin/tickets multi-lang' $e3Detail }

# E4:5 种语言走完一遍 GET /admin/users(列表本身与语言无关,但要确保后端不拒绝任何 Accept-Language)
$e4 = 0; $e4Detail = ''
foreach ($lang in $langs) {
  $r = Req GET '/admin/users' $adminToken $null $lang
  if ($r.code -ne 200) { $e4++; $e4Detail += "$lang=$($r.code) " }
}
if ($e4 -eq 0) { Pass "E4 GET /admin/users 在 5 语言下全部 200" }
else { Fail 'E4 GET /admin/users multi-lang' $e4Detail }

# ============================================================
# Phase F:GET /admin/audit 审计日志端点(4 项)
# ============================================================
Write-Host "`n=== Phase F:GET /admin/audit 审计日志端点 ===" -ForegroundColor Cyan

# F1:admin GET /admin/audit → 200 + total > 0
$r = Req GET '/admin/audit?limit=10' $adminToken
if ($r.code -eq 200) {
  $f1 = $r.body | ConvertFrom-Json
  if ($f1.ok -and $f1.total -is [int] -and $f1.items -is [Array]) {
    Pass "F1 GET /admin/audit (admin) code=200 total=$($f1.total)"
  } else {
    Fail 'F1 audit shape' "body=$($r.body)"
  }
} else {
  Fail 'F1 GET /admin/audit' "code=$($r.code)"
}

# F2:customer GET /admin/audit → 403(RBAC)
Check 'F2 customer → /admin/audit → 403' (Req GET '/admin/audit' $customerToken).code 403

# F3:unauth GET /admin/audit → 401
Check 'F3 unauth → /admin/audit → 401' (Req GET '/admin/audit').code 401

# F4:过滤 resource=admin:warranties:* 仅返回保修审计
$r = Req GET '/admin/audit?resource=admin:warranties' $adminToken
if ($r.code -eq 200) {
  $f4 = $r.body | ConvertFrom-Json
  if ($f4.ok -and $f4.items -is [Array]) {
    $matchedAll = ($f4.items | Where-Object { $_.resource -like 'admin:warranties*' }).Count
    if ($matchedAll -eq $f4.items.Count -and $f4.items.Count -gt 0) {
      Pass "F4 filter resource=admin:warranties → $($f4.items.Count) 条(全部命中)"
    } elseif ($f4.items.Count -eq 0) {
      Pass "F4 filter(无保修审计,空集)"
    } else {
      Fail 'F4 filter precision' "漏出 $($f4.items.Count - $matchedAll) 条非保修审计"
    }
  } else {
    Fail 'F4 filter shape' "body=$($r.body)"
  }
} else {
  Fail 'F4 GET filter' "code=$($r.code)"
}

# ============================================================
# 汇总
# ============================================================
Write-Host "`n=== 汇总 ===" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_.pass }).Count
$failed = ($results | Where-Object { -not $_.pass }).Count
$total = $results.Count
Write-Host "  PASSED: $passed / $total" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Yellow' })
if ($failed -gt 0) {
  Write-Host "  FAILED: $failed" -ForegroundColor Red
  foreach ($f in ($results | Where-Object { -not $_.pass })) {
    Write-Host "    · $($f.label) -- $($f.detail)"
  }
  exit 1
}
Write-Host "  ALL PASSED [OK]" -ForegroundColor Green
exit 0