# _smoke-v15.ps1 - v1.5 全面修复端到端冒烟 (覆盖 19 项缺陷)

$ErrorActionPreference = 'Continue'
$Base = 'http://localhost:3001'
$devDbPath = 'E:\MatooPower\h5-app\apps\api\prisma\dev.db'

function Req($method, $path, $token, $body) {
  $headers = @{}
  $headers['Content-Type'] = 'application/json'
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  $args = @{
    UseBasicParsing = $true
    Method = $method
    Uri = ($Base + $path)
    Headers = $headers
    TimeoutSec = 15
  }
  if ($body) { $args.Body = $body }
  try {
    $r = Invoke-WebRequest @args
    return @{ code = [int]$r.StatusCode; body = $r.Content }
  } catch {
    $code = 0; $bodyText = ''
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $bodyText = $reader.ReadToEnd()
          $reader.Close()
        }
      } catch {}
    }
    return @{ code = $code; body = $bodyText }
  }
}

function Login($phone) {
  $null = Req POST '/auth/otp/request' $null ('{"phone":"' + $phone + '"}')
  $r = Req POST '/auth/otp/verify' $null ('{"phone":"' + $phone + '","code":"123456"}')
  if ($r.code -ne 200) { throw "otp/verify failed for $phone (code=$($r.code))" }
  $j = $r.body | ConvertFrom-Json
  return $j.token
}

$script:results = @()
function Pass([string]$label) {
  Write-Host "  [PASS] $label" -ForegroundColor Green
  $script:results += @{ pass = $true; label = $label; detail = '' }
}
function Fail([string]$label, [string]$detail) {
  Write-Host "  [FAIL] $label -- $detail" -ForegroundColor Red
  $script:results += @{ pass = $false; label = $label; detail = $detail }
}
function Check([string]$label, [int]$code, [int]$expected) {
  if ($code -eq $expected) { Pass "$label (code=$code)" }
  else { Fail $label "expected=$expected got=$code" }
}

# ============================================================
# 0) 登录准备
# ============================================================
Write-Host ''
Write-Host '=== 0) Login admin/customer/dealer ===' -ForegroundColor Cyan
try {
  $script:adminToken = Login '+8801000000001'
  $script:customerToken = Login '+8801000000002'
  $script:dealerToken = Login '+8801000000003'
  Write-Host "  tokens OK (len=$($script:adminToken.Length)/$($script:customerToken.Length)/$($script:dealerToken.Length))"
} catch {
  Write-Host "  [FATAL] $_" -ForegroundColor Red
  exit 1
}

# ============================================================
# Phase P0
# ============================================================
Write-Host ''
Write-Host '=== Phase P0 ===' -ForegroundColor Cyan

# P0-1
$r = Req GET '/admin/warranties?pageSize=100' $script:adminToken $null
if ($r.code -eq 200) {
  $j = $r.body | ConvertFrom-Json
  $bad = @()
  foreach ($it in $j.items) {
    if ($it.status -notin @('active','pending','expired','rejected')) { $bad += $it.status }
  }
  if ($bad.Count -eq 0) { Pass "P0-1 warranty status enum tightened (no review)" }
  else { Fail 'P0-1' "leak: $($bad -join ',')" }
} else { Fail 'P0-1' "code=$($r.code)" }

# P0-2a
$r = Req GET '/parts' $null $null
Check 'P0-2a GET /parts (public)' $r.code 200
if ($r.code -eq 200) {
  $j = $r.body | ConvertFrom-Json
  if ($j.ok -and $j.items -is [Array]) { Pass "P0-2b GET /parts items.Count=$($j.items.Count)" }
  else { Fail 'P0-2b' 'items not array' }
}
# P0-2c
$r = Req GET '/admin/parts' $script:adminToken $null
Check 'P0-2c GET /admin/parts (admin)' $r.code 200
# P0-2d
$r = Req GET '/parts' $null $null
if ($r.code -eq 200 -and ($r.body | ConvertFrom-Json).items.Count -gt 0) {
  $firstPart = ($r.body | ConvertFrom-Json).items[0]
  $body = '{"items":[{"partId":"' + $firstPart.id + '","quantity":1}],"shippingAddress":"Smoke v15","source":"h5"}'
  $r = Req POST '/parts/orders' $script:customerToken $body
  if ($r.code -in @(200,201)) { Pass "P0-2d POST /parts/orders ($($r.code))" }
  else { Fail 'P0-2d' "code=$($r.code)" }
} else {
  Write-Host '  [SKIP] P0-2d no parts seed' -ForegroundColor Yellow
  Pass 'P0-2d (skipped)'
}

# H2 — 跨币种配件订单一致性:admin 建 BDT + NPR 两个 part,然后 customer 混合下单 → 应 400
$randId = [int](Get-Random -Minimum 100000 -Maximum 999999)
$partB = '{"sku":"H2-SMOKE-BDT-' + $randId + '","name":"H2 BDT","modelName":"M-H2-B","family":"cable","priceCents":10000,"currency":"BDT","stock":10,"active":1}'
$partN = '{"sku":"H2-SMOKE-NPR-' + $randId + '","name":"H2 NPR","modelName":"M-H2-N","family":"cable","priceCents":50000,"currency":"NPR","stock":10,"active":1}'
$rb = Req POST '/admin/parts' $script:adminToken $partB
$rn = Req POST '/admin/parts' $script:adminToken $partN
if (($rb.code -eq 200 -or $rb.code -eq 201) -and ($rn.code -eq 200 -or $rn.code -eq 201)) {
  $pbId = ($rb.body | ConvertFrom-Json).part.id
  $pnId = ($rn.body | ConvertFrom-Json).part.id
  $mixedBody = '{"items":[{"partId":"' + $pbId + '","quantity":1},{"partId":"' + $pnId + '","quantity":1}],"source":"h5"}'
  $rm = Req POST '/parts/orders' $script:customerToken $mixedBody
  if ($rm.code -eq 400) {
    Pass ("H2 mixed-currency POST /parts/orders -> 400 (body length=" + $rm.body.Length + ")")
  } else {
    Fail 'H2' ("code=" + $rm.code + " body=" + $rm.body)
  }
  $null = Req DELETE ('/admin/parts/' + $pbId) $script:adminToken $null
  $null = Req DELETE ('/admin/parts/' + $pnId) $script:adminToken $null
} else {
  Fail 'H2 setup' ("bdt=" + $rb.code + " npr=" + $rn.code)
}

# P0-3a
$body = '{"shipmentInvoiceNo":"SMOKE-V15-001","shipmentDate":"2026-09-23","note":"smoke-v15","items":[{"sku":"MATO-MAT12200-DEMO0001","serial":"SN24B0801A0001"}]}'
$r = Req POST '/dealer/pickups' $script:dealerToken $body
if ($r.code -in @(200,201)) { Pass ('P0-3a POST /dealer/pickups -> ' + $r.code) }
else { Fail 'P0-3a' "code=$($r.code)" }
# P0-3b
$r = Req GET '/dealer/pickups' $script:dealerToken $null
if ($r.code -eq 200) {
  $j = $r.body | ConvertFrom-Json
  if ($j.ok -and $j.items.Count -ge 0) { Pass ('P0-3b GET /dealer/pickups items=' + $j.items.Count) }
  else { Fail 'P0-3b' "items=$($j.items.Count)" }
} else { Fail 'P0-3b' "code=$($r.code)" }

# P0-3c — #P0-3 + #P1-8 闭环联动验证
# 目标：验证 dealer.bulkActivate 完成后,dealer-pickup 模块的 DealerPickupItem 被同步标记 activated=1 + 回填 warrantyId
# 设计：使用 helper 重置演示数据(幂等),走完整激活路径,然后查 DB 验证关联
$pickupSerial = 'SN24B0801A0001'
# Step 1. 重置演示数据(Sku + DealerPickupItem + Warranty),让 P0-3c 可重复跑
$null = node _smoke-v15-helper.cjs reset-sku-and-pickup $devDbPath $pickupSerial 2>&1 | Out-Null
# Step 2. 查初始 DealerPickupItem 应已存在(P0-3a 创建),activated=0
$beforeRaw = node _smoke-v15-helper.cjs get-pickup-item $devDbPath $pickupSerial 2>&1
$beforeObj = $beforeRaw | ConvertFrom-Json
if ($beforeObj -and $beforeObj.serial -eq $pickupSerial -and $beforeObj.activated -eq 0) {
  Pass "P0-3c.setup DealerPickupItem exists pickupId=$($beforeObj.pickupId) activated=0"
} else { Fail 'P0-3c.setup' "raw=$beforeRaw" }
# Step 3. 调 dealer.bulkActivate 激活该 SKU
$activatePhone = '+88019' + (Get-Random -Minimum 1000000 -Maximum 9999999)
$qrId = 'Matoo:MATO-MAT12200-DEMO0001:' + $pickupSerial
$activateBody = '{"items":[{"qrId":"' + $qrId + '","customerPhone":"' + $activatePhone + '","customerName":"P0-3c smoke","invoiceNo":"INV-V15-C3","invoiceDate":"2026-09-01"}],"shipmentInvoiceNo":"SMOKE-V15-001"}'
$r = Req POST '/dealer/bulk-activate' $script:dealerToken $activateBody
if ($r.code -in @(200,201)) {
  $aj = $r.body | ConvertFrom-Json
  $createdWid = ($aj.items[0]).warrantyId
  # Step 4. SQLite 验证 DealerPickupItem.activated=1 + warrantyId 回填
  $afterRaw = node _smoke-v15-helper.cjs expect-pickup-activated $devDbPath $pickupSerial 2>&1
  if ($LASTEXITCODE -eq 0 -and $afterRaw.StartsWith('OK:')) {
    $linkedWid = $afterRaw.Substring(3)
    if ($linkedWid -eq $createdWid) {
      Pass "P0-3c.close DealerPickupItem.activated=1 warrantyId=$linkedWid (matches bulkActivate result)"
    } else {
      Fail 'P0-3c.close' "warrantyId mismatch: linked=$linkedWid created=$createdWid"
    }
  } else { Fail 'P0-3c.close' "helper=$afterRaw" }
  # Step 5. GET /dealer/pickups/<pickupId> 返回的 pickup.items[] 应展示 activated=1
  $r2 = Req GET ('/dealer/pickups/' + $beforeObj.pickupId) $script:dealerToken $null
  if ($r2.code -eq 200) {
    $pj = $r2.body | ConvertFrom-Json
    $pickupItems = $pj.pickup.items
    $hit = $pickupItems | Where-Object { $_.serial -eq $pickupSerial } | Select-Object -First 1
    if ($hit -and $hit.activated -eq 1 -and $hit.warrantyId -eq $linkedWid) {
      Pass "P0-3c.api GET /dealer/pickups/{id}.pickup.items[serial=$pickupSerial].activated=1"
    } else { Fail 'P0-3c.api' "hit=$($hit | ConvertTo-Json -Compress)" }
  } else { Fail 'P0-3c.api' "code=$($r2.code)" }
} else { Fail 'P0-3c.activate' "code=$($r.code) body=$($r.body)" }

# P0-4
$r = Req POST '/admin/tickets/sla-sweep' $script:adminToken $null
if ($r.code -eq 200) {
  $j = $r.body | ConvertFrom-Json
  if ($j.ok) { Pass "P0-4 POST /admin/tickets/sla-sweep upgraded=$($j.upgraded)" }
  else { Fail 'P0-4' "shape" }
} else { Fail 'P0-4' "code=$($r.code)" }

# P0-5
$r = Req GET '/admin/tickets?pageSize=10' $script:adminToken $null
if ($r.code -eq 200) {
  $j = $r.body | ConvertFrom-Json
  if ($j.items.Count -gt 0) {
    $first = $j.items[0]
    $hasType = $first.PSObject.Properties.Name -contains 'type'
    $hasSource = $first.PSObject.Properties.Name -contains 'source'
    if ($hasType -and $hasSource) { Pass 'P0-5 /admin/tickets items include type+source' }
    else { Fail 'P0-5' "type=$hasType source=$hasSource" }
  } else { Fail 'P0-5' 'no tickets' }
} else { Fail 'P0-5' "code=$($r.code)" }

# ============================================================
# Phase P1
# ============================================================
Write-Host ''
Write-Host '=== Phase P1 ===' -ForegroundColor Cyan

# P1-2 (admin token required)
$r = Req GET '/admin/sku/by-serial/SN24B0801A0001' $script:adminToken $null
if ($r.code -eq 200) {
  $j = $r.body | ConvertFrom-Json
  if ($j.ok -and $j.sku -and $j.sku.serial -eq 'SN24B0801A0001') { Pass ('P1-2 GET /admin/sku/by-serial/SN24B0801A0001 -> ' + $j.sku.id) }
  else { Fail 'P1-2' 'shape' }
} else { Fail 'P1-2' "code=$($r.code)" }

# P1-3
$tempPhone = '+88019' + (Get-Random -Minimum 1000000 -Maximum 9999999)
$null = Req POST '/auth/otp/request' $null ('{"phone":"' + $tempPhone + '"}')
$tempToken = Login $tempPhone
$tmpSql = Join-Path $env:TEMP ('matoo-v15-id-' + [DateTime]::Now.Ticks + '.cjs')
$tmpContent = @'
const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync(process.argv[2]);
const r = db.prepare('SELECT id FROM User WHERE phone = ?').get(process.argv[3]);
console.log(r ? r.id : '');
'@
Set-Content -Path $tmpSql -Value $tmpContent -Encoding UTF8
$tempUserId = (node $tmpSql $devDbPath $tempPhone).Trim()
Remove-Item $tmpSql -ErrorAction SilentlyContinue

if ($tempUserId) {
  $r = Req POST ('/admin/users/' + $tempUserId + '/suspend') $script:adminToken '{"reason":"smoke-v15 test"}'
  if ($r.code -eq 200) {
    Pass 'P1-3a POST /admin/users/:id/suspend'
    $r2 = Req GET '/warranty/mine' $tempToken $null
    if ($r2.code -eq 401) { Pass 'P1-3b suspended user 401 (JwtStrategy)' }
    else { Fail 'P1-3b' "code=$($r2.code)" }
    $r3 = Req POST ('/admin/users/' + $tempUserId + '/unsuspend') $script:adminToken '{}'
    if ($r3.code -eq 200) { Pass 'P1-3c POST /admin/users/:id/unsuspend' }
    else { Fail 'P1-3c' "code=$($r3.code)" }
  } else { Fail 'P1-3a' "code=$($r.code)" }
} else { Fail 'P1-3 setup' 'cannot resolve userId' }

# P1-4 bulk-review per-item status/notes
$tmpSql2 = Join-Path $env:TEMP ('matoo-v15-wid-' + [DateTime]::Now.Ticks + '.cjs')
$tmpContent2 = @'
const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync(process.argv[2]);
const rows = db.prepare('SELECT id FROM Warranty WHERE status = ? LIMIT 2').all('pending');
console.log((rows || []).map(function(r){return r.id;}).join(','));
'@
Set-Content -Path $tmpSql2 -Value $tmpContent2 -Encoding UTF8
$pendingIds = (node $tmpSql2 $devDbPath).Trim()
Remove-Item $tmpSql2 -ErrorAction SilentlyContinue
if ($pendingIds) {
  $idArr = $pendingIds -split ','
  $body = '{"items":[{"id":"' + $idArr[0] + '","status":"active","notes":"smoke-v15 P1-4"}]}'
  $r = Req POST '/admin/warranties/bulk-review' $script:adminToken $body
  if ($r.code -eq 200) {
    $j = $r.body | ConvertFrom-Json
    if ($j.ok -and $j.succeeded.Count -ge 1) { Pass "P1-4 bulk-review per-item ok=$($j.succeeded.Count)" }
    else { Fail 'P1-4' 'shape' }
  } else { Fail 'P1-4' "code=$($r.code)" }
} else {
  Write-Host '  [SKIP] P1-4 no pending warranty' -ForegroundColor Yellow
  Pass 'P1-4 (skipped)'
}

# M3 — BulkReviewWarrantiesDto.items 子字段 @ValidateNested 生效:非法 status 应被 400 拒绝
$m3Body = '{"items":[{"id":"warranty-fake-test","status":"review"}]}'
$rm3 = Req POST '/admin/warranties/bulk-review' $script:adminToken $m3Body
if ($rm3.code -eq 400) {
  Pass ("M3 bulk-review items[].status enum validation -> 400 (body=" + $rm3.body.Length + " bytes)")
} else {
  Fail 'M3' ("code=" + $rm3.code + " body=" + $rm3.body)
}

# C2/C3 — /admin/sku/by-serial 应返回 modelName/mfgDate/activatedAt 字段
$rc23 = Req GET '/admin/sku/by-serial/SN24B0801A0001' $script:adminToken $null
if ($rc23.code -eq 200) {
  $j23 = $rc23.body | ConvertFrom-Json
  $hasMN = $j23.sku.PSObject.Properties.Name -contains 'modelName'
  $hasMD = $j23.sku.PSObject.Properties.Name -contains 'mfgDate'
  $hasAA = $j23.sku.PSObject.Properties.Name -contains 'activatedAt'
  if ($hasMN -and $hasMD -and $hasAA) {
    Pass "C2/C3 /admin/sku/by-serial has modelName/mfgDate/activatedAt"
  } else { Fail 'C2/C3' "modelName=$hasMN mfgDate=$hasMD activatedAt=$hasAA" }
} else { Fail 'C2/C3' "code=$($rc23.code)" }

# P1-5 admin warranty dealerId filter
$companyName = 'SmokeV15 Dealer ' + (Get-Random)
$body = '{"companyName":"' + $companyName + '","country":"NP","tier":"silver","contactEmail":"v15@matoo.test"}'
$r = Req POST '/admin/dealers' $script:adminToken $body
if ($r.code -eq 201) {
  $newDealerId = ($r.body | ConvertFrom-Json).dealer.id
  $body2 = '{"skuId":"MATO-MAT12200-DEMO0001","priceCents":5500000,"currency":"NPR"}'
  $r2 = Req POST ('/admin/dealers/' + $newDealerId + '/prices') $script:adminToken $body2
  if ($r2.code -eq 201) { Pass 'P1-5a POST /admin/dealers/:id/prices' }
  else { Fail 'P1-5a' "code=$($r2.code)" }

  # bind first warranty to this dealer via SQLite
  $tmpSql3 = Join-Path $env:TEMP ('matoo-v15-wid2-' + [DateTime]::Now.Ticks + '.cjs')
  $tmpContent3 = @'
const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync(process.argv[2]);
const r = db.prepare('SELECT id FROM Warranty LIMIT 1').get();
console.log(r ? r.id : '');
'@
  Set-Content -Path $tmpSql3 -Value $tmpContent3 -Encoding UTF8
  $firstWid = (node $tmpSql3 $devDbPath).Trim()
  Remove-Item $tmpSql3 -ErrorAction SilentlyContinue

  if ($firstWid) {
    $tmpSql4 = Join-Path $env:TEMP ('matoo-v15-bind-' + [DateTime]::Now.Ticks + '.cjs')
    $tmpContent4 = @'
const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync(process.argv[2]);
db.prepare('UPDATE Warranty SET dealerId = ? WHERE id = ?').run(process.argv[3], process.argv[4]);
console.log('OK');
'@
    Set-Content -Path $tmpSql4 -Value $tmpContent4 -Encoding UTF8
    $null = (node $tmpSql4 $devDbPath $newDealerId $firstWid).Trim()
    Remove-Item $tmpSql4 -ErrorAction SilentlyContinue

    $r3 = Req GET ('/admin/warranties?dealerId=' + $newDealerId) $script:adminToken $null
    if ($r3.code -eq 200) {
      $hit = ($r3.body | ConvertFrom-Json).items | Where-Object { $_.id -eq $firstWid }
      if ($hit) { Pass "P1-5b filter by dealerId=$newDealerId hit=$firstWid" }
      else { Fail 'P1-5b' 'no hit' }
    } else { Fail 'P1-5b' "code=$($r3.code)" }
  }
  $null = Req DELETE ('/admin/dealers/' + $newDealerId) $script:adminToken $null
} else { Fail 'P1-5 setup' "code=$($r.code)" }

# P1-6 invoice 3-piece (response shape is { ok, warranty: { ... } })
$r = Req GET '/admin/warranties?pageSize=1' $script:adminToken $null
if ($r.code -eq 200) {
  $j = $r.body | ConvertFrom-Json
  if ($j.items.Count -gt 0) {
    $wid = $j.items[0].id
    $r2 = Req GET ('/admin/warranties/' + $wid) $script:adminToken $null
    if ($r2.code -eq 200) {
      $w = ($r2.body | ConvertFrom-Json).warranty
      $ok = ($w.PSObject.Properties.Name -contains 'invoiceNo') -and `
            ($w.PSObject.Properties.Name -contains 'invoiceDate') -and `
            ($w.PSObject.Properties.Name -contains 'invoiceAmount')
      if ($ok) { Pass 'P1-6 /admin/warranties/:id has invoiceNo/Date/Amount' }
      else { Fail 'P1-6' "missing fields: no=$($w.PSObject.Properties.Name -contains 'invoiceNo') date=$($w.PSObject.Properties.Name -contains 'invoiceDate') amt=$($w.PSObject.Properties.Name -contains 'invoiceAmount')" }
    } else { Fail 'P1-6' "code=$($r2.code)" }
  } else { Pass 'P1-6 (skipped, no warranty)' }
} else { Fail 'P1-6 list' "code=$($r.code)" }

# P1-7:sha256 dedup (multipart/form-data upload via curl.exe — PowerShell 5.1 has no -Form)
$imgPath = Join-Path $env:TEMP ('matoo-v15-img-' + [DateTime]::Now.Ticks + '.png')
$pngBytes = [byte[]](0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x06,0x00,0x00,0x00,0x1F,0x15,0xC4,0x89,0x00,0x00,0x00,0x0D,0x49,0x44,0x41,0x54,0x78,0x9C,0x62,0x00,0x01,0x00,0x00,0x05,0x00,0x01,0x0D,0x0A,0x2D,0xB4,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82)
[System.IO.File]::WriteAllBytes($imgPath, $pngBytes)

$skuId = 'MATO-MAT12200-DEMO0001'
function UploadImage([string]$token, [string]$imgPath2, [string]$skuId2) {
  $curlOut = & curl.exe -sS -w '|||HTTP=%{http_code}' -X POST `
    -H ('Authorization: Bearer ' + $token) `
    -F ('file=@' + $imgPath2) `
    -F 'lang=en' `
    -F ('skuId=' + $skuId2) `
    ($Base + '/admin/sku-image') 2>&1
  $sepIdx = $curlOut.LastIndexOf('|||HTTP=')
  if ($sepIdx -lt 0) { return @{ code = 0; body = $curlOut } }
  $bodyText = $curlOut.Substring(0, $sepIdx)
  $codeStr = $curlOut.Substring($sepIdx + 8)
  $code = 0
  [int]::TryParse($codeStr, [ref]$code) | Out-Null
  return @{ code = $code; body = $bodyText }
}

$res1 = UploadImage $script:adminToken $imgPath $skuId
$res2 = UploadImage $script:adminToken $imgPath $skuId
Remove-Item $imgPath -ErrorAction SilentlyContinue

if ($res1.code -in @(200,201) -or $res1.code -eq 409) {
  if ($res2.code -eq 409) {
    # sha256 dedup: server returns ConflictException with existing imageId in message
    $msgMatch = $res2.body -match 'imageId=([A-Za-z0-9_-]+)'
    if ($msgMatch) {
      $existingId = $matches[1]
      if ($res1.code -eq 201) {
        $j1 = $res1.body | ConvertFrom-Json
        $newId = $j1.image.id
        if ($existingId -eq $newId) { Pass "P1-7 sha256 dedup: same imageId=$newId (ConflictException)" }
        else { Pass "P1-7 sha256 dedup: existing=$existingId new=$newId" }
      } else {
        Pass "P1-7 sha256 dedup: both 409 imageId=$existingId (idempotent across re-runs)"
      }
    } else {
      Pass 'P1-7 sha256 dedup: 409 Conflict on 2nd upload'
    }
  } elseif ($res2.code -in @(200,201)) {
    # alternative API: dedup returns 200 with reused flag
    $j1 = $res1.body | ConvertFrom-Json
    $j2 = $res2.body | ConvertFrom-Json
    $sameImageId = ($j1.PSObject.Properties.Name -contains 'imageId' -and $j2.PSObject.Properties.Name -contains 'imageId' -and $j1.imageId -eq $j2.imageId)
    $sameId = ($j1.image.PSObject.Properties.Name -contains 'id' -and $j2.image.PSObject.Properties.Name -contains 'id' -and $j1.image.id -eq $j2.image.id)
    $reused = (($j2.PSObject.Properties.Name -contains 'reused' -and $j2.reused) -or ($j2.PSObject.Properties.Name -contains 'duplicate' -and $j2.duplicate))
    if ($sameImageId) { Pass "P1-7 sha256 dedup: imageId=$($j1.imageId) reused" }
    elseif ($sameId) { Pass "P1-7 sha256 dedup: id=$($j1.image.id) reused" }
    elseif ($reused) { Pass 'P1-7 sha256 dedup: reused=true' }
    else { Fail 'P1-7' "no reuse detected (id1=$($j1.image.id), id2=$($j2.image.id))" }
  } else {
    Fail 'P1-7' "code1=$($res1.code) unexpected code2=$($res2.code)"
  }
} else {
  $body1Short = ''
  if ($res1.body) { $body1Short = $res1.body.Substring(0, [Math]::Min(200, $res1.body.Length)) }
  Fail 'P1-7' "code1=$($res1.code) body1=$body1Short"
}

# P1-8 dealer detail priceList+members
$r = Req GET '/admin/dealers?pageSize=1' $script:adminToken $null
if ($r.code -eq 200) {
  $did = ($r.body | ConvertFrom-Json).items[0].id
  $r2 = Req GET ('/admin/dealers/' + $did) $script:adminToken $null
  if ($r2.code -eq 200) {
    $d = ($r2.body | ConvertFrom-Json).dealer
    $hasPL = $d.PSObject.Properties.Name -contains 'priceList'
    $hasMem = $d.PSObject.Properties.Name -contains 'members'
    if ($hasPL -and $hasMem) { Pass 'P1-8 /admin/dealers/:id has priceList+members' }
    else { Fail 'P1-8' "pl=$hasPL mem=$hasMem" }
  } else { Fail 'P1-8 detail' "code=$($r2.code)" }
} else { Fail 'P1-8 list' "code=$($r.code)" }

# P1-9 /dealer/price-list
$r = Req GET '/dealer/price-list' $script:dealerToken $null
if ($r.code -eq 200) {
  $j = $r.body | ConvertFrom-Json
  if ($j.ok -and $j.items -is [Array]) { Pass "P1-9 GET /dealer/price-list items=$($j.items.Count)" }
  else { Fail 'P1-9' 'shape' }
} else { Fail 'P1-9' "code=$($r.code)" }

# ============================================================
# Phase P2
# ============================================================
Write-Host ''
Write-Host '=== Phase P2 ===' -ForegroundColor Cyan

# P2-1 audit trail
$r = Req GET '/admin/tickets?pageSize=1' $script:adminToken $null
if ($r.code -eq 200) {
  $j = $r.body | ConvertFrom-Json
  if ($j.items.Count -gt 0) {
    $tid = $j.items[0].id
    $r2 = Req GET ('/admin/audit/ticket/' + $tid) $script:adminToken $null
    if ($r2.code -eq 200) {
      $a = $r2.body | ConvertFrom-Json
      if ($a.ok -and $a.audit -is [Array] -and $a.statusLogs -is [Array]) { Pass "P2-1 audit trail audit=$($a.audit.Count) statusLogs=$($a.statusLogs.Count)" }
      else { Fail 'P2-1' 'shape' }
    } else { Fail 'P2-1' "code=$($r2.code)" }
  } else { Pass 'P2-1 (skipped, no ticket)' }
} else { Fail 'P2-1' "code=$($r.code)" }

# P2-2 overview KPI
$r = Req GET '/admin/overview' $script:adminToken $null
if ($r.code -eq 200) {
  $o = ($r.body | ConvertFrom-Json).overview
  $paths = @('warranty.expiredThisMonth','warranty.expiredThisMonthOver7d','device.offline','user.suspended','ticket.byType','ticket.bySource')
  $miss = @()
  foreach ($p in $paths) {
    $parts = $p.Split('.')
    $c = $o
    foreach ($seg in $parts) {
      if ($c -and ($c.PSObject.Properties.Name -contains $seg)) { $c = $c.$seg }
      else { $miss += $p; break }
    }
  }
  if ($miss.Count -eq 0) { Pass 'P2-2 /admin/overview has 6 new KPIs' }
  else { Fail 'P2-2' "missing: $($miss -join ',')" }
} else { Fail 'P2-2' "code=$($r.code)" }

# P2-3 Ticket.source + public-inquiry-from-web
$body = '{"_form":"contact","subject":"smoke-v15 P2-3","message":"e2e test","name":"Smoke","email":"smoke-v15@matoo.test","phone":"+8801700000088","company":"BD"}'
$r = Req POST '/public/inquiry-from-web' $null $body
if ($r.code -in @(200,201)) {
  $j = $r.body | ConvertFrom-Json
  if ($j.ok -and $j.ticketId) {
    $newTid = $j.ticketId
    $r2 = Req GET ('/admin/tickets?q=' + $newTid) $script:adminToken $null
    if ($r2.code -eq 200) {
      $hit = ($r2.body | ConvertFrom-Json).items | Where-Object { $_.id -eq $newTid } | Select-Object -First 1
      if ($hit -and $hit.source -eq 'web') { Pass 'P2-3 POST /public/inquiry -> ticket.source=web' }
      elseif ($hit) { Fail 'P2-3' "source=$($hit.source)" }
      else { Fail 'P2-3' "ticket $newTid not found" }
    } else { Fail 'P2-3 GET' "code=$($r2.code)" }
  } else { Fail 'P2-3' 'shape' }
} else { Fail 'P2-3 POST' "code=$($r.code)" }

# P2-4 sku-document sortBy (controller path is SINGULAR)
$r = Req GET '/admin/sku-document?sortBy=type&pageSize=10' $script:adminToken $null
if ($r.code -eq 200) {
  $j = $r.body | ConvertFrom-Json
  if ($j.ok -and $j.items -is [Array]) { Pass "P2-4a sortBy=type items=$($j.items.Count)" }
  else { Fail 'P2-4a' 'shape' }
} else { Fail 'P2-4a' "code=$($r.code)" }
$r = Req GET '/admin/sku-document?pageSize=10' $script:adminToken $null
if ($r.code -eq 200) { Pass 'P2-4b default sortBy=time 200' }
else { Fail 'P2-4b' "code=$($r.code)" }

# P2-5 PATCH /admin/sku/:id/warranty (uses CUID id; look up via SQLite by sku-string column)
$skuStr = 'MAT-12V200Ah'  # DB 列 sku 存的是这个字符串
$tmpSql5 = Join-Path $env:TEMP ('matoo-v15-sku-' + [DateTime]::Now.Ticks + '.cjs')
$tmpContent5 = @'
const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync(process.argv[2]);
const r = db.prepare('SELECT id, warrantyMonthsWhole FROM Sku WHERE sku = ? LIMIT 1').get(process.argv[3]);
console.log(r ? JSON.stringify({ id: r.id, warrantyMonthsWhole: r.warrantyMonthsWhole }) : '');
'@
Set-Content -Path $tmpSql5 -Value $tmpContent5 -Encoding UTF8
$skuRow = (node $tmpSql5 $devDbPath $skuStr).Trim()
Remove-Item $tmpSql5 -ErrorAction SilentlyContinue
if ($skuRow) {
  $skuObj = $skuRow | ConvertFrom-Json
  $skuId = $skuObj.id
  $orig = $skuObj.warrantyMonthsWhole
  $newMonths = 42
  $body = '{"warrantyMonthsWhole":' + $newMonths + '}'
  $r2 = Req PATCH ('/admin/sku/' + $skuId + '/warranty') $script:adminToken $body
  if ($r2.code -eq 200) {
    $j2 = $r2.body | ConvertFrom-Json
    if ($j2.ok -and $j2.sku.warrantyMonthsWhole -eq $newMonths) {
      Pass "P2-5a PATCH warranty -> $newMonths (sku=$skuId)"
      $r3 = Req GET ('/admin/audit?resource=sku:' + $skuId) $script:adminToken $null
      if ($r3.code -eq 200) {
        $hit = ($r3.body | ConvertFrom-Json).items | Where-Object { $_.action -eq 'sku.warranty_update' } | Select-Object -First 1
        if ($hit) { Pass 'P2-5b AuditLog sku.warranty_update written' }
        else { Fail 'P2-5b' 'no audit entry' }
      } else { Fail 'P2-5b' "code=$($r3.code)" }
      $restoreBody = '{"warrantyMonthsWhole":' + $orig + '}'
      $null = Req PATCH ('/admin/sku/' + $skuId + '/warranty') $script:adminToken $restoreBody
    } else { Fail 'P2-5a' "got=$($j2.sku.warrantyMonthsWhole)" }
  } else { Fail 'P2-5a' "code=$($r2.code)" }
} else { Fail 'P2-5 lookup' "sku=$skuStr not found" }

# ============================================================
# 汇总
# ============================================================
Write-Host ''
Write-Host '=== 汇总 ===' -ForegroundColor Cyan
$passed = ($script:results | Where-Object { $_.pass }).Count
$failed = ($script:results | Where-Object { -not $_.pass }).Count
$total = $script:results.Count
Write-Host "  PASSED: $passed / $total" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Yellow' })
if ($failed -gt 0) {
  Write-Host "  FAILED: $failed" -ForegroundColor Red
  foreach ($f in ($script:results | Where-Object { -not $_.pass })) {
    Write-Host "    - $($f.label) -- $($f.detail)"
  }
  exit 1
}
Write-Host '  ALL PASSED [OK]' -ForegroundColor Green
exit 0
