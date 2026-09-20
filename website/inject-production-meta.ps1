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

$pageConfig = @{
    'index.html'         = @{ og = 'og-default';       title = 'Matoo Power · Powering Emerging Markets'; desc = 'Lithium iron phosphate energy storage for off-grid living, e-mobility, and commercial backup - built on 20+ years of Chinese manufacturing excellence.' }
    'products.html'      = @{ og = 'og-products';       title = 'Products & Solutions · Matoo Power';     desc = 'Power01 (1 kWh), Power02 (2 kWh), Power Box modular system, and Matoo Ready EV control modules.' }
    'partnership.html'   = @{ og = 'og-partnership';    title = 'Partnership · Matoo Power';               desc = 'Three ways to partner. Distribute, OEM, or license PACK lines. Pick the path that fits your market.' }
    'insights.html'      = @{ og = 'og-insights';       title = 'Insights · Matoo Power';                  desc = 'Market analysis, technology deep-dives, and partner stories from across 30+ active markets.' }
    'manufacturing.html' = @{ og = 'og-manufacturing';  title = 'Manufacturing · Matoo Power';             desc = 'Shenzhen factory. 20+ years of battery craftsmanship. Self-owned facility, full vertical integration.' }
    'about.html'         = @{ og = 'og-default';        title = 'About · Matoo Power';                     desc = 'Lithium iron phosphate energy storage, engineered in China for emerging markets worldwide.' }
    'technology.html'    = @{ og = 'og-default';        title = 'Technology · Matoo Power';                desc = 'LFP chemistry, BMS architecture, modular design, and safety engineering.' }
    'contact.html'       = @{ og = 'og-default';        title = 'Contact · Matoo Power';                    desc = 'Talk to our sales team. We respond within 24 hours on business days.' }
    'configurator.html'  = @{ og = 'og-default';        title = 'Scenario Configurator · Matoo Power';     desc = 'Pick a real-world scenario. See the core 4-piece kit and recommended combinations.' }
    'privacy.html'       = @{ og = 'og-default';        title = 'Privacy Policy · Matoo Power';            desc = 'How we handle your information. Plain language. Real commitments.' }
    'cookies.html'       = @{ og = 'og-default';        title = 'Cookie Settings · Matoo Power';           desc = 'Transparency first. Here is exactly what we set, why, and how to opt out.' }
    'terms.html'         = @{ og = 'og-default';        title = 'Terms of Service · Matoo Power';          desc = 'The rules of the road. Plain English where possible, legal precision where it matters.' }
}

function Build-MetaTags {
    param($cfg, $fileName)

    $ogImg = $cfg.og
    $title = $cfg.title
    $desc  = $cfg.desc
    $url = "https://matoopower.com/$fileName"
    if ($fileName -eq 'index.html') { $url = "https://matoopower.com/" }

    return @"

  <!-- Production SEO Meta -->
  <meta name="description" content="$desc">
  <meta name="theme-color" content="#0052CC">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="$url">

  <!-- Favicon Suite -->
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="48x48" href="/assets/favicon-48x48.png">
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="msapplication-TileColor" content="#091E42">
  <meta name="msapplication-TileImage" content="/assets/mstile-150x150.png">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="$url">
  <meta property="og:title" content="$title">
  <meta property="og:description" content="$desc">
  <meta property="og:image" content="https://matoopower.com/assets/$ogImg.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="en_US">
  <meta property="og:site_name" content="Matoo Power">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="$title">
  <meta name="twitter:description" content="$desc">
  <meta name="twitter:image" content="https://matoopower.com/assets/twitter-card.jpg">
"@
}

Write-Host "[Production Meta] Injecting into all HTML files (idempotent mode)..." -ForegroundColor Cyan

$files = Get-ChildItem "$htmlDir\*.html"
$totalInjected = 0
$totalSkipped = 0
$totalNoConfig = 0

# Use BOM encoding consistently so re-runs are byte-identical
$utf8Bom = New-Object System.Text.UTF8Encoding $True

foreach ($file in $files) {
    $name = $file.Name
    $cfg = $pageConfig[$name]
    if (-not $cfg) { $totalNoConfig++; continue }

    # Read raw bytes and decode with BOM-stripping UTF8
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $originalContent = $content

    # Step 1: Remove the previously-injected block if present.
    # The block is bounded by the comment and the last twitter:image meta tag.
    $blockRegex = '(?s)\s*<!--\s*Production SEO Meta\s*-->.*?<meta\s+name="twitter:image"\s+content="[^"]*"\s*>'
    if ($content -match $blockRegex) {
        $content = [regex]::Replace($content, $blockRegex, '', 1)
    }

    # Step 2: Insert the canonical meta block immediately after <title>...</title>
    $metaTags = Build-MetaTags -cfg $cfg -fileName $name

    $titleRegex = '(<title>.*?</title>)'
    if ($content -match $titleRegex) {
        $titleMatch = $matches[1]
        $content = [regex]::Replace($content, [regex]::Escape($titleMatch), ($titleMatch + "`r`n" + $metaTags), 1)
    } else {
        Write-Host "    WARN  $name  (no title tag found, meta not injected)" -ForegroundColor Yellow
        continue
    }

    if ($content -ne $originalContent) {
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8Bom)
        Write-Host "    +     $name  (injected $([int]($metaTags.Length / 10)) meta chars)" -ForegroundColor Green
        $totalInjected++
    } else {
        Write-Host "    KEEP  $name  (no change)" -ForegroundColor DarkGray
        $totalSkipped++
    }
}

Write-Host ""
Write-Host "Meta injection complete: $totalInjected updated, $totalSkipped unchanged, $totalNoConfig skipped (no config)." -ForegroundColor Green
