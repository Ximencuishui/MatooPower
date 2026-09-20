$ErrorActionPreference = 'Stop'

$path = $PSCommandPath
$bytes = [System.IO.File]::ReadAllBytes($path)
if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
    $newBytes = New-Object byte[] ($bytes.Length + 3)
    $newBytes[0] = 0xEF; $newBytes[1] = 0xBB; $newBytes[2] = 0xBF
    [Array]::Copy($bytes, 0, $newBytes, 3, $bytes.Length)
    [System.IO.File]::WriteAllBytes($path, $newBytes)
}

$htmlDir = "e:\MatooPower\website"
$h5Dir   = "e:\MatooPower\h5-app\prototype"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Matoo Power Audit v2 - Extended Health Check" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$pass = 0
$fail = 0
$warn = 0

function Pass($msg) { $script:pass++; Write-Host "  [PASS] $msg" -ForegroundColor Green }
function Fail($msg) { $script:fail++; Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Warn($msg) { $script:warn++; Write-Host "  [WARN] $msg" -ForegroundColor Yellow }

$files = Get-ChildItem "$htmlDir\*.html"
$total = $files.Count
Write-Host "[Scope] $total HTML files in $htmlDir" -ForegroundColor White
Write-Host ""

# === Extended meta audit ===
Write-Host "[Extended Meta Audit]" -ForegroundColor White
foreach ($file in $files) {
    $name = $file.Name
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $ogType = ([regex]::Matches($content, '<meta\s+property="og:type"')).Count
    $twCard = ([regex]::Matches($content, '<meta\s+name="twitter:card"')).Count
    $desc = ([regex]::Matches($content, '<meta\s+name="description"')).Count
    $canonical = ([regex]::Matches($content, '<link\s+rel="canonical"')).Count
    $theme = ([regex]::Matches($content, '<meta\s+name="theme-color"')).Count
    $robots = ([regex]::Matches($content, '<meta\s+name="robots"')).Count
    $ogUrl = ([regex]::Matches($content, '<meta\s+property="og:url"')).Count
    $ogImg = ([regex]::Matches($content, '<meta\s+property="og:image"')).Count
    $twImg = ([regex]::Matches($content, '<meta\s+name="twitter:image"')).Count

    $issues = @()
    if ($ogType -ne 1) { $issues += "og:type=$ogType" }
    if ($twCard -ne 1) { $issues += "twitter:card=$twCard" }
    if ($desc -ne 1) { $issues += "description=$desc" }
    if ($canonical -ne 1) { $issues += "canonical=$canonical" }
    if ($theme -ne 1) { $issues += "theme-color=$theme" }
    if ($robots -ne 1) { $issues += "robots=$robots" }
    if ($ogUrl -ne 1) { $issues += "og:url=$ogUrl" }
    if ($ogImg -ne 1) { $issues += "og:image=$ogImg" }
    if ($twImg -ne 1) { $issues += "twitter:image=$twImg" }

    if ($issues.Count -eq 0) {
        Pass "$name : all 9 meta tags unique"
    } else {
        Fail "$name : $($issues -join ', ')"
    }
}
Write-Host ""

# === Image srcset coverage ===
Write-Host "[Image srcset Coverage]" -ForegroundColor White
foreach ($file in $files) {
    $name = $file.Name
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $imgs = [regex]::Matches($content, '<img\s+[^>]*src="([^"]+)"[^>]*>')
    $noSrcset = @()
    foreach ($m in $imgs) {
        $tag = $m.Value
        $src = $m.Groups[1].Value
        if ($src -match '^data:') { continue }
        if ($src -match '\.svg$') { continue }
        if ($src -match '/icon-') { continue }
        if ($tag -notmatch 'srcset=') {
            $noSrcset += $src
        }
    }
    if ($noSrcset.Count -eq 0) {
        Pass "$name : all $($imgs.Count) img tags have srcset"
    } else {
        Warn "$name : $($noSrcset.Count) img without srcset (first: $($noSrcset[0]))"
    }
}
Write-Host ""

# === Script tag balance ===
Write-Host "[Script Tag Balance]" -ForegroundColor White
foreach ($file in $files) {
    $name = $file.Name
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $openScripts = ([regex]::Matches($content, '<script[ >]')).Count
    $closeScripts = ([regex]::Matches($content, '</script>')).Count
    if ($openScripts -eq $closeScripts) {
        Pass "$name : $openScripts open / $closeScripts close"
    } else {
        Fail "$name : $openScripts open / $closeScripts close (UNBALANCED)"
    }
}
Write-Host ""

# === Inline script TODO/alert check ===
Write-Host "[Inline Script TODO/alert/console Heuristic]" -ForegroundColor White
foreach ($file in $files) {
    $name = $file.Name
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $todos = ([regex]::Matches($content, '(TODO|FIXME|XXX|HACK)\b')).Count
    $alerts = ([regex]::Matches($content, '\balert\(')).Count
    $logs = ([regex]::Matches($content, 'console\.log')).Count
    $debugs = ([regex]::Matches($content, '\bdebugger\b')).Count

    $issues = @()
    if ($todos -gt 0) { $issues += "TODO=$todos" }
    if ($alerts -gt 0) { $issues += "alert()=$alerts" }
    if ($logs -gt 0) { $issues += "console.log=$logs" }
    if ($debugs -gt 0) { $issues += "debugger=$debugs" }

    if ($issues.Count -eq 0) {
        Pass "$name : clean"
    } else {
        Warn "$name : $($issues -join ', ')"
    }
}
Write-Host ""

# === Asset reference audit ===
Write-Host "[Asset Reference Audit]" -ForegroundColor White
foreach ($file in $files) {
    $name = $file.Name
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $refs = [regex]::Matches($content, '(?:href|src)="([^"]+)"')
    $bad = @()
    foreach ($m in $refs) {
        $url = $m.Groups[1].Value
        if ($url -match '^(https?:|mailto:|#|tel:|data:|javascript:)') { continue }
        if ($url.StartsWith('/')) { continue }
        if ($url.StartsWith('?') -or $url.StartsWith('.')) { continue }
        $bad += $url
    }
    if ($bad.Count -eq 0) {
        Pass "$name : all references are absolute or protocol-prefixed"
    } else {
        Warn "$name : $($bad.Count) ambiguous ref (first: $($bad[0]))"
    }
}
Write-Host ""

# === H5-App health ===
Write-Host "[H5-App Health]" -ForegroundColor White
$pkgRaw = Get-Content "$h5Dir\package.json" -Raw
$pkg = $pkgRaw | ConvertFrom-Json
Write-Host "  next: $($pkg.dependencies.next)" -ForegroundColor Gray
Write-Host "  react: $($pkg.dependencies.react)" -ForegroundColor Gray

$layoutPath = "$h5Dir\src\app\layout.tsx"
if (Test-Path $layoutPath) {
    $layout = Get-Content $layoutPath -Raw
    if ($layout -match 'manifest\.webmanifest') {
        Pass "h5-app layout.tsx references manifest"
    } else {
        Warn "h5-app layout.tsx does not reference manifest"
    }
    if ($layout -match 'icon\.svg') {
        Pass "h5-app layout.tsx references icon"
    } else {
        Warn "h5-app layout.tsx does not reference icon"
    }
    if ($layout -match 'sw\.js|serviceWorker') {
        Pass "h5-app layout.tsx registers Service Worker"
    } else {
        Warn "h5-app layout.tsx does not register Service Worker"
    }
} else {
    Warn "h5-app src/app/layout.tsx not found"
}

$pages = @('home', 'scan', 'auth', 'activate', 'warranty', 'devices', 'device', 'shop', 'profile')
foreach ($p in $pages) {
    $path = "$h5Dir\src\app\$p"
    if (Test-Path $path) {
        Pass "h5-app page: $p"
    } else {
        Warn "h5-app page: $p NOT FOUND"
    }
}
Write-Host ""

# === Summary ===
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Audit v2 Summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Passed:   $pass" -ForegroundColor Green
Write-Host "  Failed:   $fail" -ForegroundColor Red
Write-Host "  Warnings: $warn" -ForegroundColor Yellow
Write-Host ""

if ($fail -gt 0) {
    Write-Host "AUDIT FAILED" -ForegroundColor Red
    exit 1
} else {
    Write-Host "AUDIT v2 PASSED" -ForegroundColor Green
    if ($warn -gt 0) {
        Write-Host "  ($warn warning(s) to review)" -ForegroundColor Yellow
    }
}
