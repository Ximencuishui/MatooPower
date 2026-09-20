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
Write-Host "  Investigating Audit v2 Warnings" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# === 1. insights.html srcset check ===
Write-Host "[1] insights.html srcset gaps" -ForegroundColor White
$content = [System.IO.File]::ReadAllText("$htmlDir\insights.html", [System.Text.Encoding]::UTF8)
$lines = $content -split "`r?`n"
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '<img\s+' -and $lines[$i] -notmatch 'srcset=') {
        Write-Host ("  L{0}: {1}" -f ($i + 1), $lines[$i].Trim()) -ForegroundColor Gray
    }
}
Write-Host ""

# === 2. TODO comments - context ===
Write-Host "[2] TODO comment context (per file, max 5)" -ForegroundColor White
$files = Get-ChildItem "$htmlDir\*.html"
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $lines = $content -split "`r?`n"
    $found = 0
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match '(TODO|FIXME|XXX|HACK)\b') {
            Write-Host ("  {0} L{1}: {2}" -f $file.Name, ($i + 1), $lines[$i].Trim()) -ForegroundColor Gray
            $found++
            if ($found -ge 5) { break }
        }
    }
}
Write-Host ""

# === 3. alert() calls - context ===
Write-Host "[3] alert() call context" -ForegroundColor White
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $lines = $content -split "`r?`n"
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match '\balert\(') {
            Write-Host ("  {0} L{1}: {2}" -f $file.Name, ($i + 1), $lines[$i].Trim()) -ForegroundColor Gray
        }
    }
}
Write-Host ""

# === 4. h5-app layout.tsx manifest/icon/sw check ===
Write-Host "[4] h5-app layout.tsx metadata" -ForegroundColor White
$layout = Get-Content "$h5Dir\src\app\layout.tsx" -Raw
Write-Host "  Total length: $($layout.Length) chars" -ForegroundColor Gray
$lines = $layout -split "`r?`n"
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '(manifest|icon|sw\.|serviceWorker|favicon|apple-touch)') {
        Write-Host ("  L{0}: {1}" -f ($i + 1), $lines[$i].Trim()) -ForegroundColor Gray
    }
}
Write-Host ""

# === 5. manifest.webmanifest sanity check ===
Write-Host "[5] h5-app webmanifest sanity" -ForegroundColor White
$manifestPath = "$h5Dir\public\manifest.webmanifest"
if (Test-Path $manifestPath) {
    Write-Host "  [OK] $manifestPath exists" -ForegroundColor Green
    $manifest = Get-Content $manifestPath -Raw
    try {
        $parsed = $manifest | ConvertFrom-Json
        Write-Host "  name: $($parsed.name)" -ForegroundColor Gray
        Write-Host "  start_url: $($parsed.start_url)" -ForegroundColor Gray
        Write-Host "  display: $($parsed.display)" -ForegroundColor Gray
        $iconCount = @($parsed.icons).Count
        Write-Host "  icons: $iconCount entries" -ForegroundColor Gray
        if ($iconCount -gt 0) {
            foreach ($i in $parsed.icons) {
                Write-Host "    - $($i.src) $($i.sizes) $($i.type)" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "  [WARN] manifest is not valid JSON" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [FAIL] manifest.webmanifest missing" -ForegroundColor Red
}
Write-Host ""

# === 6. sw.js registered in any client code? ===
Write-Host "[6] Service Worker registration search" -ForegroundColor White
Get-ChildItem "$h5Dir\src" -Recurse -Filter "*.tsx" | ForEach-Object {
    $src = Get-Content $_.FullName -Raw
    if ($src -match "navigator\.serviceWorker\.register|sw\.js") {
        Write-Host "  [OK] $($_.FullName.Replace($h5Dir, '')) registers SW" -ForegroundColor Green
    }
}
Write-Host ""

# === 7. console.log in production HTML ===
Write-Host "[7] console.log in main.js (informational)" -ForegroundColor White
$mainJs = Get-Content "$htmlDir\scripts\main.js" -Raw
$logCount = ([regex]::Matches($mainJs, 'console\.')).Count
Write-Host "  console.* calls in main.js: $logCount" -ForegroundColor Gray
foreach ($m in [regex]::Matches($mainJs, 'console\.\w+\([^)]*\)')) {
    Write-Host "    $($m.Value)" -ForegroundColor Gray
}
Write-Host ""

# === 8. Check for any remaining 65XXXXXXXX or hardcoded WhatsApp numbers ===
Write-Host "[8] WhatsApp placeholder / hardcoded numbers" -ForegroundColor White
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    if ($content -match 'wa\.me/65XXXXXXXX') {
        Write-Host "  [FAIL] $($file.Name): still has wa.me/65XXXXXXXX" -ForegroundColor Red
    }
    # Look for +65 patterns that aren't the masked one
    $hardNumbers = [regex]::Matches($content, '\+65\s*[0-9]{4,}')
    foreach ($m in $hardNumbers) {
        Write-Host "  [NOTE] $($file.Name): hardcoded +65 number: $($m.Value)" -ForegroundColor Yellow
    }
}
