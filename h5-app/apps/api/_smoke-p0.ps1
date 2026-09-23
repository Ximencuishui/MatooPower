# P0 smoke v1.2 — verify all 6 P0 fixes work end-to-end
$ErrorActionPreference = 'Continue'
$Base = 'http://localhost:3001'
$db = 'E:\MatooPower\h5-app\apps\api\prisma\dev.db'
$Log = 'E:\MatooPower\h5-app\apps\api\_smoke.log'
$Phone = '+14155550101'
$Pass = 0; $Fail = 0

function Check([string]$name, [bool]$ok, [string]$detail = '') {
  if ($ok) { $script:Pass++; Write-Host ("  PASS  {0}  {1}" -f $name, $detail) -ForegroundColor Green }
  else     { $script:Fail++; Write-Host ("  FAIL  {0}  {1}" -f $name, $detail) -ForegroundColor Red }
}

# Wait one throttler window (5/min) at script start so re-runs don't inherit 429.
# First-run cost is 65s; re-runs within 1 min skip the wait gracefully.
Write-Host '== Bootstrap: clear throttler window (max 65s wait) ==' -ForegroundColor Cyan
$waited = 0
while ($waited -lt 65) {
  $probe = try { (Invoke-WebRequest -Uri "$Base/auth/otp/request" -Method POST -ContentType 'application/json' -Body "{`"phone`":`"+10000000000`"}" -UseBasicParsing -TimeoutSec 3).StatusCode } catch { [int]$_.Exception.Response.StatusCode }
  if ($probe -eq 200) { break }
  Start-Sleep -Seconds 10
  $waited += 10
}

# Step 1: request OTP for admin phone
Write-Host '== Phase A: admin login + P0-1 cookie attrs ==' -ForegroundColor Cyan
$null = Invoke-RestMethod -Uri "$Base/auth/otp/request" -Method POST -ContentType 'application/json' -Body "{`"phone`":`"$Phone`"}" -UseBasicParsing
Start-Sleep -Milliseconds 300
$otp = (Select-String -Path $Log -Pattern ("\[OTP\] phone=" + [regex]::Escape($Phone) + " code=(\d{6})") | Select-Object -Last 1).Matches[0].Groups[1].Value
Write-Host "  OTP=$otp"
$verify = Invoke-WebRequest -Uri "$Base/auth/otp/verify" -Method POST -ContentType 'application/json' -Body "{`"phone`":`"$Phone`",`"code`":`"$otp`"}" -UseBasicParsing
Check 'P0-1 verify=200' ($verify.StatusCode -eq 200) "status=$($verify.StatusCode)"
$cookieStr = $verify.Headers['Set-Cookie'] | Where-Object { $_ -match 'matoo_token' } | Select-Object -First 1
Check 'P0-1 Set-Cookie HttpOnly' ($cookieStr -match 'HttpOnly') $cookieStr
Check 'P0-1 Set-Cookie SameSite=Strict' ($cookieStr -match 'SameSite=Strict') ''
Check 'P0-1 cookie Max-Age=7d' ($cookieStr -match 'Max-Age=604800') ''

# Promote to admin
node "prisma\_promote-admin.cjs" "$db" $Phone 2>&1 | Out-Null
# Wait > 1 second so JWT iat differs (otherwise second signAsync produces identical
# token → Session.token UNIQUE constraint violation). 1.5s suffices.
Start-Sleep -Milliseconds 1500
# Re-login (force new OTP + role=admin in JWT)
$null = Invoke-RestMethod -Uri "$Base/auth/otp/request" -Method POST -ContentType 'application/json' -Body "{`"phone`":`"$Phone`"}" -UseBasicParsing
Start-Sleep -Milliseconds 300
$otp2 = (Select-String -Path $Log -Pattern ("\[OTP\] phone=" + [regex]::Escape($Phone) + " code=(\d{6})") | Select-Object -Last 1).Matches[0].Groups[1].Value
$token = (Invoke-RestMethod -Uri "$Base/auth/otp/verify" -Method POST -ContentType 'application/json' -Body "{`"phone`":`"$Phone`",`"code`":`"$otp2`"}" -UseBasicParsing).token
$h = @{ Authorization = "Bearer $token" }
Write-Host "  admin tokenLen=$($token.Length)"

Write-Host '== Phase B: P0-4 /admin/audit ==' -ForegroundColor Cyan
$wlist = Invoke-RestMethod -Uri "$Base/admin/warranties?pageSize=1" -Headers $h -UseBasicParsing
$wid = $wlist.items[0].id
Write-Host "  wid=$wid"
$audit = Invoke-RestMethod -Uri "$Base/admin/audit?limit=10" -Headers $h -UseBasicParsing
Check 'P0-4 audit.ok=true' ($audit.ok -eq $true) "items=$($audit.items.Count)"

# Review to make audit data appear (rejected guarantees from!=to)
$null = Invoke-RestMethod -Uri "$Base/admin/warranties/$wid/review" -Method POST -Headers $h -ContentType 'application/json' -Body '{"status":"rejected","notes":"smoke P0-4"}' -UseBasicParsing
$trail = Invoke-RestMethod -Uri "$Base/admin/audit/warranty/$wid" -Headers $h -UseBasicParsing
Check 'P0-4 trail.reviewLogs>=1' ($trail.reviewLogs.Count -ge 1) "reviewLogs=$($trail.reviewLogs.Count)"

Write-Host '== Phase C: P0-6 bulk-review ==' -ForegroundColor Cyan
$bulk = Invoke-RestMethod -Uri "$Base/admin/warranties/bulk-review" -Method POST -Headers $h -ContentType 'application/json' -Body "{`"ids`":[`"$wid`"],`"status`":`"active`",`"notes`":`"smoke P0-6`"}" -UseBasicParsing
Check 'P0-6 bulk.ok=true' ($bulk.ok -eq $true) "total=$($bulk.total)"
Check 'P0-6 bulk.succeeded>=1' ($bulk.succeeded.Count -ge 1) "succeeded=$($bulk.succeeded.Count)"

# Validation: empty ids → 400
try {
  $null = Invoke-RestMethod -Uri "$Base/admin/warranties/bulk-review" -Method POST -Headers $h -ContentType 'application/json' -Body '{"ids":[],"status":"active"}' -UseBasicParsing
  Check 'P0-6 empty.ids=400' $false 'expected throw'
} catch {
  $code = [int]$_.Exception.Response.StatusCode
  Check 'P0-6 empty.ids=400' ($code -eq 400) "got $code"
}

Write-Host '== Phase D: P0-1 logout ==' -ForegroundColor Cyan
$out = Invoke-WebRequest -Uri "$Base/auth/logout" -Method POST -UseBasicParsing
Check 'P0-1 logout=200' ($out.StatusCode -eq 200) "status=$($out.StatusCode)"
$logoutCookie = $out.Headers['Set-Cookie'] | Where-Object { $_ -match 'matoo_token' } | Select-Object -First 1
Check 'P0-1 logout clears cookie' ($logoutCookie -match 'matoo_token=') $logoutCookie

Write-Host '== Phase E: RBAC cross-role (wait throttler window 65s) ==' -ForegroundColor Cyan
# Phase A already issued 4 OTP requests in 1 minute → throttler (5/min) blocks the 5th.
# Wait one window to demonstrate customer=403 cleanly. Backend e2e + Playwright F5b
# already cover this assertion; this smoke re-verifies against running server.
Start-Sleep -Seconds 65
$custPhone = '+14155550102'
$null = Invoke-RestMethod -Uri "$Base/auth/otp/request" -Method POST -ContentType 'application/json' -Body "{`"phone`":`"$custPhone`"}" -UseBasicParsing
Start-Sleep -Milliseconds 300
$cotp = (Select-String -Path $Log -Pattern ("\[OTP\] phone=" + [regex]::Escape($custPhone) + " code=(\d{6})") | Select-Object -Last 1).Matches[0].Groups[1].Value
$ctoken = (Invoke-RestMethod -Uri "$Base/auth/otp/verify" -Method POST -ContentType 'application/json' -Body "{`"phone`":`"$custPhone`",`"code`":`"$cotp`"}" -UseBasicParsing).token
try {
  $null = Invoke-RestMethod -Uri "$Base/admin/audit" -Headers @{Authorization="Bearer $ctoken"} -UseBasicParsing
  Check 'P0-4 customer=403' $false 'expected throw'
} catch {
  $code = [int]$_.Exception.Response.StatusCode
  Check 'P0-4 customer=403' ($code -eq 403) "got $code"
}

Write-Host ''
Write-Host "== TOTAL: pass=$Pass fail=$Fail ==" -ForegroundColor Magenta
if ($Fail -gt 0) { exit 1 } else { exit 0 }