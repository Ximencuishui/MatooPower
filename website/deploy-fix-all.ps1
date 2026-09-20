# Matoo Power - Pre-deploy Bulk Fix Script
# Fixes P0 blockers: duplicate meta tags / charset corruption / WhatsApp placeholder
# Run: powershell -ExecutionPolicy Bypass -File .\deploy-fix-all.ps1

$ErrorActionPreference = 'Stop'
$htmlDir = "e:\MatooPower\website"
$utf8NoBom = New-Object System.Text.UTF8Encoding($False)

function Log-Step($msg) {
    Write-Host ""
    Write-Host "=== $msg ===" -ForegroundColor Cyan
}

# ============================================================
# Step 1: Fix character encoding corruption
#   - "路" (U+8DEF wrong position) -> "·" (U+00B7 middle dot)
#   - "鈥?" (CP1252 corruption)   -> "—" (U+2014 em dash)
# ============================================================
Log-Step "Step 1/3: Fix character encoding corruption"
$files = Get-ChildItem "$htmlDir\*.html"
$encodingFixed = 0
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName)
    $original = $c
    $c = $c -replace '路', ([char]0x00B7)
    $c = $c -replace '鈥\?', ([char]0x2014)
    if ($c -ne $original) {
        [System.IO.File]::WriteAllText($f.FullName, $c, $utf8NoBom)
        Write-Host "    [FIX] $($f.Name)" -ForegroundColor Green
        $encodingFixed++
    }
}
Write-Host "Encoding fix done: $encodingFixed file(s)" -ForegroundColor Green

# ============================================================
# Step 2: Remove duplicate meta tags
# Strategy: keep "Production SEO Meta" block (good), remove legacy duplicate block
# ============================================================
Log-Step "Step 2/3: Clean up duplicate meta tags"
$dupRemoved = 0
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName)
    $original = $c
    if ($c -notmatch 'Production SEO Meta') { continue }

    # 找到第一个 </head> 之前的所有内容
    $headEndMatch = [regex]::Match($c, '</head>')
    if (-not $headEndMatch.Success) { continue }
    $headContent = $c.Substring(0, $headEndMatch.Index)
    $headEnd = $headEndMatch.Index
    $afterHead = $c.Substring($headEnd)

    $prodMetaStart = $headContent.IndexOf('<!-- Production SEO Meta -->')
    if ($prodMetaStart -lt 0) { continue }

    # End of good block: first twitter:image after Production SEO Meta marker
    $goodBlockEnd = -1
    $twitterImgMatch = [regex]::Match($headContent.Substring($prodMetaStart), '<meta\s+name="twitter:image"[^>]*>')
    if ($twitterImgMatch.Success) {
        $goodBlockEnd = $prodMetaStart + $twitterImgMatch.Index + $twitterImgMatch.Length
    }
    if ($goodBlockEnd -lt 0) { continue }

    # Locate duplicate block start in tail
    $tailContent = $headContent.Substring($goodBlockEnd)
    $dupStartInTail = -1
    foreach ($pattern in @(
        '<meta\s+name="description"',
        '<meta\s+property="og:type"',
        '<meta\s+property="og:title"',
        '<meta\s+property="og:description"',
        '<!--\s*Open Graph\s*-->',
        '<!--\s*Favicon\s*-->',
        '<link\s+rel="icon"\s+type="image/svg\+xml"\s+href="/assets/favicon\.svg"\s*/>'
    )) {
        $m = [regex]::Match($tailContent, $pattern)
        if ($m.Success -and ($dupStartInTail -lt 0 -or $m.Index -lt $dupStartInTail)) {
            $dupStartInTail = $m.Index
        }
    }
    if ($dupStartInTail -lt 0) {
        Write-Host "    [SKIP] $($f.Name)  (no duplicate found)" -ForegroundColor DarkGray
        continue
    }

    # End of duplicate section
    $dupSection = $tailContent.Substring($dupStartInTail)
    $dupEndInSection = $dupSection.Length
    foreach ($endPattern in @(
        '<link\s+rel="stylesheet"',
        '<!--\s*Styles',
        '<!--\s*hreflang',
        '<link\s+rel="alternate"'
    )) {
        $em = [regex]::Match($dupSection, $endPattern)
        if ($em.Success -and $em.Index -lt $dupEndInSection) {
            $dupEndInSection = $em.Index
        }
    }

    $absoluteDupStart = $goodBlockEnd + $dupStartInTail
    $absoluteDupEnd = $goodBlockEnd + $dupStartInTail + $dupEndInSection
    $newHead = $headContent.Substring(0, $absoluteDupStart) + $headContent.Substring($absoluteDupEnd)
    $newHead = [regex]::Replace($newHead, "(`r?`n){3,}", "`r`n`r`n")
    $newC = $newHead + $afterHead

    if ($newC -ne $original) {
        [System.IO.File]::WriteAllText($f.FullName, $newC, $utf8NoBom)
        $bytesRemoved = $original.Length - $newC.Length
        Write-Host "    [FIX] $($f.Name)  (-$bytesRemoved chars)" -ForegroundColor Green
        $dupRemoved++
    }
}
Write-Host "Meta dedup done: $dupRemoved file(s)" -ForegroundColor Green

# ============================================================
# Step 3: Replace WhatsApp placeholder
# ============================================================
Log-Step "Step 3/3: Replace WhatsApp placeholder"
$waReplaced = 0
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName)
    $original = $c
    $c = $c -replace 'wa\.me/65XXXXXXXX', 'wa.me/WHATSAPP_PLACEHOLDER'
    if ($c -ne $original) {
        [System.IO.File]::WriteAllText($f.FullName, $c, $utf8NoBom)
        $waReplaced++
    }
}
# main.js
$mainJsPath = "$htmlDir\scripts\main.js"
if (Test-Path $mainJsPath) {
    $c = [System.IO.File]::ReadAllText($mainJsPath)
    $original = $c
    $c = $c -replace 'wa\.me/65XXXXXXXX', 'wa.me/WHATSAPP_PLACEHOLDER'
    if ($c -ne $original) {
        [System.IO.File]::WriteAllText($mainJsPath, $c, $utf8NoBom)
        Write-Host "    [FIX] scripts\main.js" -ForegroundColor Green
    }
}
Write-Host "WhatsApp placeholder replaced: $waReplaced HTML file(s)" -ForegroundColor Green

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "P0 bulk fix done." -ForegroundColor Green
Write-Host "Next: manual fixes for products.html L399 / FormHandler / h5-app / sw.js" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Green
