# h5-app 管理后台冒烟脚本（PowerShell）
# 从 api 日志解析 OTP（演示期后端 console 输出）→ 13+ admin / 5 dealer / RBAC 401·403 / Swagger / CSV

$ErrorActionPreference = 'Continue'
$LogFile = 'E:\MatooPower\h5-app\apps\api\_smoke-api.log'
$Base = 'http://localhost:3001'

function Req($method, $path, $token = $null, $body = $null) {
  $h = @{ 'Content-Type' = 'application/json' }
  if ($token) { $h['Authorization'] = "Bearer $token" }
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Method $method -Uri "$Base$path" -Headers $h -Body $body -TimeoutSec 8
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

function Get-OtpFromLog($phone) {
  # 从文件末尾向前找最近的 phone=$phone 行,提取 code=NNNNNN
  $lines = Get-Content $LogFile -ErrorAction SilentlyContinue
  if (-not $lines) { return $null }
  for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    if ($lines[$i] -like "*phone=$phone*") {
      $m = [regex]::Match($lines[$i], 'code=(\d{6})')
      if ($m.Success) { return $m.Groups[1].Value }
    }
  }
  return $null
}

function Login($phone) {
  $r = Req POST '/auth/otp/request' $null "{`"phone`":`"$phone`"}"
  if (-not $r.ok -or $r.code -ne 200) { throw "otp/request failed for $phone (code=$($r.code))" }
  Start-Sleep -Milliseconds 600
  $otp = Get-OtpFromLog $phone
  if (-not $otp) { throw "could not parse OTP for $phone from log" }
  $r = Req POST '/auth/otp/verify' $null "{`"phone`":`"$phone`",`"code`":`"$otp`"}"
  if (-not $r.ok -or $r.code -ne 200) { throw "otp/verify failed for $phone (otp=$otp code=$($r.code))" }
  $j = $r.body | ConvertFrom-Json
  return $j.token
}

$results = @()
function Pass($label) { Write-Host "  [PASS] $label" -ForegroundColor Green; $script:results += @{ pass = $true; label = $label } }
function Fail($label, $detail) { Write-Host "  [FAIL] $label -- $detail" -ForegroundColor Red; $script:results += @{ pass = $false; label = $label; detail = $detail } }
function Check($label, $code, $expected) {
  if ($code -eq $expected) { Pass "$label (code=$code)" } else { Fail "$label" "expected $expected, got $code" }
}

Write-Host "`n=== 1) Swagger / OpenAPI ===" -ForegroundColor Cyan
$r = Req GET '/api-json'
Check 'GET /api-json returns 200' $r.code 200
$j = $r.body | ConvertFrom-Json
$paths = $j.paths.PSObject.Properties.Name | Sort-Object
Write-Host "  OpenAPI paths count: $($paths.Count)"
$adminPaths = $paths | Where-Object { $_ -like '/admin*' }
$dealerPaths = $paths | Where-Object { $_ -like '/dealer*' }
Write-Host "  /admin* paths: $($adminPaths.Count) -> $($adminPaths -join ', ')"
Write-Host "  /dealer* paths: $($dealerPaths.Count) -> $($dealerPaths -join ', ')"

Write-Host "`n=== 2) RBAC: 未授权 401 ===" -ForegroundColor Cyan
Check 'GET /admin/overview (no token) -> 401' (Req GET '/admin/overview').code 401
Check 'GET /admin/sku (no token) -> 401' (Req GET '/admin/sku').code 401
Check 'GET /dealer/me (no token) -> 401' (Req GET '/dealer/me').code 401
Check 'GET /dealer/warranties (no token) -> 401' (Req GET '/dealer/warranties').code 401

Write-Host "`n=== 3) Login 3 roles ===" -ForegroundColor Cyan
$adminToken = Login '+8801000000001'
Write-Host "  admin token len=$($adminToken.Length)"
$customerToken = Login '+8801000000002'
Write-Host "  customer token len=$($customerToken.Length)"
$dealerToken = Login '+8801000000003'
Write-Host "  dealer token len=$($dealerToken.Length)"

Write-Host "`n=== 4) RBAC: 错误角色 403 ===" -ForegroundColor Cyan
Check 'customer -> /admin/overview -> 403' (Req GET '/admin/overview' $customerToken).code 403
Check 'customer -> /admin/sku -> 403' (Req GET '/admin/sku' $customerToken).code 403
Check 'customer -> /dealer/me -> 403' (Req GET '/dealer/me' $customerToken).code 403
Check 'dealer -> /admin/overview -> 403' (Req GET '/admin/overview' $dealerToken).code 403
Check 'dealer -> /admin/sku -> 403' (Req GET '/admin/sku' $dealerToken).code 403

Write-Host "`n=== 5) admin 19 端点（含 v1.1 CSV 导出） ===" -ForegroundColor Cyan
$endpoints = @(
  @{ m='GET'; p='/admin/sku' },
  @{ m='GET'; p='/admin/warranties' },
  @{ m='GET'; p='/admin/devices' },
  @{ m='GET'; p='/admin/users' },
  @{ m='GET'; p='/admin/tickets' },
  @{ m='GET'; p='/admin/tickets/stats' },
  @{ m='GET'; p='/admin/overview' },
  @{ m='GET'; p='/admin/analytics/trends?days=7' },
  @{ m='GET'; p='/admin/analytics/breakdown?type=warranty&groupBy=sku' },
  @{ m='GET'; p='/admin/analytics/breakdown?type=warranty&groupBy=country' },
  @{ m='GET'; p='/admin/analytics/breakdown?type=device&groupBy=sku' },
  @{ m='GET'; p='/admin/analytics/breakdown?type=device&groupBy=role' },
  @{ m='GET'; p='/admin/analytics/breakdown?type=ticket&groupBy=severity' },
  @{ m='GET'; p='/admin/analytics/breakdown?type=ticket&groupBy=status' },
  @{ m='GET'; p='/admin/sku.csv' },
  @{ m='GET'; p='/admin/warranties.csv' },
  @{ m='GET'; p='/admin/devices.csv' },
  @{ m='GET'; p='/admin/users.csv' },
  @{ m='GET'; p='/admin/tickets.csv' }
)
foreach ($e in $endpoints) {
  $r = Req $e.m $e.p $adminToken
  if ($r.code -ge 200 -and $r.code -lt 300) { Pass "$($e.m) $($e.p)" }
  else { Fail "$($e.m) $($e.p)" "code=$($r.code) body=$($r.body.Substring(0, [Math]::Min(120, $r.body.Length)))" }
}

Write-Host "`n=== 6) admin POST review (写操作) ===" -ForegroundColor Cyan
$w = (Req GET '/admin/warranties' $adminToken).body | ConvertFrom-Json
$wid = $w.items[0].id
$r = Req POST "/admin/warranties/$wid/review" $adminToken '{"status":"active","notes":"smoke-verify"}'
Check "POST /admin/warranties/$wid/review -> 200" $r.code 200

Write-Host "`n=== 7) dealer 端点 (admin + dealer) ===" -ForegroundColor Cyan
$deEndpoints = @('/dealer/me','/dealer/warranties','/dealer/devices')
foreach ($p in $deEndpoints) {
  $r = Req GET $p $adminToken
  if ($r.code -eq 200) { Pass "GET $p (admin)" } else { Fail "GET $p (admin)" "code=$($r.code)" }
}
foreach ($p in $deEndpoints) {
  $r = Req GET $p $dealerToken
  if ($r.code -eq 200) { Pass "GET $p (dealer)" } else { Fail "GET $p (dealer)" "code=$($r.code)" }
}

Write-Host "`n=== 8) overview 响应结构 ===" -ForegroundColor Cyan
$o = (Req GET '/admin/overview' $adminToken).body | ConvertFrom-Json
$expected = @('sku','user','warranty','device','ticket')
$ok = $true
foreach ($k in $expected) {
  if (-not $o.overview.PSObject.Properties.Name -contains $k) { $ok = $false; Write-Host "  [WARN] overview missing: $k" -ForegroundColor Yellow }
}
if ($ok) { Pass 'overview contains 5 top-level keys' } else { Fail 'overview keys incomplete' '' }

Write-Host "`n=== 9) trends 补齐日期 ===" -ForegroundColor Cyan
$t = (Req GET '/admin/analytics/trends?days=7' $adminToken).body | ConvertFrom-Json
if ($t.warranty.Count -eq 7 -and $t.device.Count -eq 7 -and $t.ticket.Count -eq 7) {
  Pass 'trends fills 7 days'
} else {
  Fail 'trends fill days' "warranty=$($t.warranty.Count) device=$($t.device.Count) ticket=$($t.ticket.Count)"
}

Write-Host "`n=== 10) CSV 头与 BOM ===" -ForegroundColor Cyan
$r = Req GET '/admin/sku.csv' $adminToken
$first = if ($r.body.Length -gt 0) { $r.body[0] } else { '' }
if ($first -eq [char]0xFEFF -or $r.body.StartsWith('id,') -or $r.body.StartsWith('"id",')) {
  Pass "CSV starts with BOM/header (first char='$first')"
} else {
  Fail 'CSV format' "first 20 chars: $($r.body.Substring(0, [Math]::Min(20, $r.body.Length)))"
}

Write-Host "`n=== 11) WarrantyReviewLog 审计落地 (v1.1) ===" -ForegroundColor Cyan
$r = Req POST "/admin/warranties/$wid/review" $adminToken '{"status":"rejected","notes":"smoke-audit-2"}'
Check "POST /admin/warranties/$wid/review (rejected) -> 200" $r.code 200

Write-Host "`n=== 12) audit module 端点（如有） ===" -ForegroundColor Cyan
$auditPaths = $paths | Where-Object { $_ -like '*audit*' -or $_ -like '*review*' }
Write-Host "  audit/review paths: $($auditPaths -join ', ')"
if ($auditPaths) {
  foreach ($p in $auditPaths) {
    $r = Req GET $p $adminToken
    if ($r.code -eq 200 -or $r.code -eq 201) { Pass "GET $p (admin)" } else { Write-Host "  [INFO] GET $p -> code=$($r.code)" }
  }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$pass = ($results | Where-Object { $_.pass }).Count
$fail = ($results | Where-Object { -not $_.pass }).Count
Write-Host "Total: $($results.Count)  PASS: $pass  FAIL: $fail"
if ($fail -gt 0) {
  Write-Host "`nFailures:" -ForegroundColor Red
  $results | Where-Object { -not $_.pass } | ForEach-Object { Write-Host "  - $($_.label): $($_.detail)" }
  exit 1
}
exit 0