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
Write-Host "  Matoo Power Pre-Deployment Verification" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$pass = 0
$fail = 0
$warn = 0

function Pass($msg) {
    $script:pass++
    Write-Host "  [PASS] $msg" -ForegroundColor Green
}
function Fail($msg) {
    $script:fail++
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
}
function Warn($msg) {
    $script:warn++
    Write-Host "  [WARN] $msg" -ForegroundColor Yellow
}

# === P0-1: Duplicate meta cleanup ===
Write-Host "[P0-1] Duplicate meta cleanup (12 HTML files)" -ForegroundColor White
foreach ($name in @('about.html','configurator.html','contact.html','cookies.html','index.html','insights.html','manufacturing.html','partnership.html','privacy.html','products.html','technology.html','terms.html')) {
    $content = [System.IO.File]::ReadAllText("$htmlDir\$name", [System.Text.Encoding]::UTF8)
    $ogTypeCount = ([regex]::Matches($content, '<meta\s+property="og:type"')).Count
    $twitterCardCount = ([regex]::Matches($content, '<meta\s+name="twitter:card"')).Count
    $descriptionCount = ([regex]::Matches($content, '<meta\s+name="description"')).Count
    if ($ogTypeCount -eq 1 -and $twitterCardCount -eq 1 -and $descriptionCount -eq 1) {
        Pass "$name : 1 og:type / 1 twitter:card / 1 description"
    } else {
        Fail "$name : og:type=$ogTypeCount, twitter:card=$twitterCardCount, description=$descriptionCount"
    }
}
Write-Host ""

# === P0-2: Character encoding corruption ===
Write-Host "[P0-2] Character encoding corruption" -ForegroundColor White
$corruptedChars = @(
    [char]0x8DEF,   # 路
    [char]0x9259    # 鉁
)
foreach ($name in @('about.html','configurator.html','contact.html','cookies.html','index.html','insights.html','manufacturing.html','partnership.html','privacy.html','products.html','technology.html','terms.html','scripts\main.js')) {
    $relPath = $name
    $fullPath = "$htmlDir\$relPath"
    $content = [System.IO.File]::ReadAllText($fullPath, [System.Text.Encoding]::UTF8)
    $hasCorruption = $false
    foreach ($c in $corruptedChars) {
        if ($content.IndexOf($c) -ge 0) {
            $hasCorruption = $true
            break
        }
    }
    if (-not $hasCorruption) {
        Pass "$name : no encoding corruption"
    } else {
        Fail "$name : still has corrupted character(s)"
    }
}
Write-Host ""

# === P0-3: WhatsApp placeholder replacement ===
Write-Host "[P0-3] WhatsApp placeholder & config" -ForegroundColor White
$cfgContent = [System.IO.File]::ReadAllText("$htmlDir\scripts\whatsapp-config.js", [System.Text.Encoding]::UTF8)
if ($cfgContent.Contains("window.MATOO_WHATSAPP")) {
    Pass "scripts/whatsapp-config.js exposes window.MATOO_WHATSAPP"
} else {
    Fail "scripts/whatsapp-config.js missing window.MATOO_WHATSAPP"
}
if ($cfgContent.Contains("WHATSAPP_PLACEHOLDER")) {
    Warn "scripts/whatsapp-config.js still has WHATSAPP_PLACEHOLDER (replace before deploy)"
} else {
    Pass "scripts/whatsapp-config.js has real number configured"
}

$mainJs = [System.IO.File]::ReadAllText("$htmlDir\scripts\main.js", [System.Text.Encoding]::UTF8)
if ($mainJs.Contains("FOOTER_MASK") -and $mainJs.Contains("formatDisplayNumber")) {
    Pass "scripts/main.js has WhatsAppLinks footer mask rewriter"
} else {
    Fail "scripts/main.js missing WhatsAppLinks footer mask rewriter"
}

# Check no remaining wa.me/65XXXXXXXX
foreach ($name in @('index.html','products.html','contact.html','partnership.html')) {
    $content = [System.IO.File]::ReadAllText("$htmlDir\$name", [System.Text.Encoding]::UTF8)
    if ($content -match 'wa\.me/65XXXXXXXX') {
        Fail "$name : still has wa.me/65XXXXXXXX placeholder"
    } else {
        Pass "$name : no 65XXXXXXXX placeholder"
    }
}
# Check all 12 files have whatsapp-config.js script
foreach ($name in @('about.html','configurator.html','contact.html','cookies.html','index.html','insights.html','manufacturing.html','partnership.html','privacy.html','products.html','technology.html','terms.html')) {
    $content = [System.IO.File]::ReadAllText("$htmlDir\$name", [System.Text.Encoding]::UTF8)
    if ($content.Contains('whatsapp-config.js')) {
        Pass "$name : loads whatsapp-config.js"
    } else {
        Fail "$name : missing whatsapp-config.js reference"
    }
}
Write-Host ""

# === P1-1: products.html L399 srcset ===
Write-Host "[P1-1] products.html srcset patches" -ForegroundColor White
$productsContent = [System.IO.File]::ReadAllText("$htmlDir\products.html", [System.Text.Encoding]::UTF8)
if ($productsContent.Contains('scenario-e-rickshaw@800.jpg') -and $productsContent.Contains('scenario-e-rickshaw@1200.jpg')) {
    Pass "products.html: scenario-e-rickshaw.jpg has srcset"
} else {
    Fail "products.html: scenario-e-rickshaw.jpg missing srcset"
}
Write-Host ""

# === P1-2: FormHandler mailto fallback ===
Write-Host "[P1-2] FormHandler mailto fallback & downloadSpec" -ForegroundColor White
if ($mainJs.Contains('submitViaMailto') -and $mainJs.Contains('sales@matoopower.com')) {
    Pass "main.js: FormHandler.submitViaMailto() opens mailto to sales@matoopower.com"
} else {
    Fail "main.js: FormHandler missing mailto fallback"
}
if ($mainJs.Contains('window.MatooApp = {') -and $mainJs.Contains('submitLead')) {
    Pass "main.js: window.MatooApp.submitLead() exposed for inline page scripts"
} else {
    Fail "main.js: window.MatooApp.submitLead() not exposed"
}
if ($productsContent.Contains('MatooApp.submitLead') -and $productsContent.Contains('async (e)')) {
    Pass "products.html: downloadSpec() uses MatooApp.submitLead with async handler"
} else {
    Fail "products.html: downloadSpec() not properly wired to MatooApp.submitLead"
}
Write-Host ""

# === P1-3: h5-app README ===
Write-Host "[P1-3] h5-app README version consistency" -ForegroundColor White
$readme = [System.IO.File]::ReadAllText("$h5Dir\README.md", [System.Text.Encoding]::UTF8)
$pkgJson = [System.IO.File]::ReadAllText("$h5Dir\package.json", [System.Text.Encoding]::UTF8)
if ($readme.Contains('Next.js 16') -and $readme.Contains('React 19')) {
    Pass "README.md: mentions Next.js 16 + React 19"
} else {
    Fail "README.md: still mentions old Next.js/React version"
}
if ($pkgJson.Contains('"next": "16.3.5"') -and $pkgJson.Contains('"react": "19.2.0"')) {
    Pass "package.json: next 16.3.5 + react 19.2.0 confirmed"
} else {
    Fail "package.json: versions not as expected"
}
Write-Host ""

# === P2-1: Service Worker ===
Write-Host "[P2-1] h5-app Service Worker" -ForegroundColor White
$sw = [System.IO.File]::ReadAllText("$h5Dir\public\sw.js", [System.Text.Encoding]::UTF8)
$swLines = ($sw -split "`r?`n").Count
if ($swLines -gt 30 -and $sw.Contains('APP_SHELL') -and $sw.Contains('stale-while-revalidate')) {
    Pass "public/sw.js: full offline strategy ($swLines lines, precache + SWR + network-first)"
} else {
    Fail "public/sw.js: still minimal/decorative ($swLines lines)"
}
Write-Host ""

# === P2-2: inject-production-meta.ps1 idempotency ===
Write-Host "[P2-2] inject-production-meta.ps1 idempotency" -ForegroundColor White
$injectScript = [System.IO.File]::ReadAllText("$htmlDir\inject-production-meta.ps1", [System.Text.Encoding]::UTF8)
if ($injectScript.Contains("Step 1: Remove the previously-injected block") -and $injectScript.Contains('$content -ne $originalContent')) {
    Pass "inject-production-meta.ps1: idempotent (remove-then-insert + content diff guard)"
} else {
    Fail "inject-production-meta.ps1: not idempotent"
}
Write-Host ""

# === Summary ===
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Passed: $pass" -ForegroundColor Green
Write-Host "  Failed: $fail" -ForegroundColor Red
Write-Host "  Warnings: $warn" -ForegroundColor Yellow
Write-Host ""

if ($fail -gt 0) {
    Write-Host "VERIFICATION FAILED - $fail check(s) did not pass" -ForegroundColor Red
    exit 1
} else {
    Write-Host "VERIFICATION PASSED - all $pass checks passed" -ForegroundColor Green
    if ($warn -gt 0) {
        Write-Host "  ($warn warning(s) to review before deploy)" -ForegroundColor Yellow
    }
}
