# Matoo Power - LCP preload 注入 + 清理重复 meta (简化版)

$htmlDir = 'e:\MatooPower\website'

$lcpMap = @{
    'index.html'         = 'hero-home.jpg'
    'partnership.html'   = 'hero-partnership.jpg'
    'insights.html'      = 'hero-insights.jpg'
    'manufacturing.html' = 'hero-manufacturing.jpg'
    'about.html'         = 'hero-about.jpg'
}

Write-Host '[Cleanup + LCP] Processing HTML files...' -ForegroundColor Cyan

foreach ($file in Get-ChildItem "$htmlDir\*.html") {
    $name = $file.Name
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $changed = $false

    # 1. 清理重复的旧 og:image meta
    $ogOld = '  <meta property="og:image" content="/assets/og-image.jpg">'
    if ($content.Contains($ogOld)) {
        $content = $content.Replace("`n$ogOld", '')
        $changed = $true
        Write-Host "    - $name : removed duplicate og:image" -ForegroundColor Gray
    }

    # 2. 添加 LCP preload
    $lcpImg = $lcpMap[$name]
    if ($lcpImg -and -not $content.Contains("preload.*$lcpImg")) {
        $base = $lcpImg -replace '\.jpg$', ''
        # 简单插入（使用字符串拼接，避免引号转义麻烦）
        $nl = "`r`n"
        $preloadBlock = $nl + '  <!-- LCP Preload -->' + $nl
        $preloadBlock += '  <link rel="preload" as="image" href="/assets/' + $lcpImg + '"' + $nl
        $preloadBlock += '        imagesrcset="/assets/' + $base + '@1200.jpg 1200w, /assets/' + $base + '@1920.jpg 1920w"' + $nl
        $preloadBlock += '        imagesizes="100vw">' + $nl

        if ($content.Contains('</head>')) {
            $content = $content.Replace('</head>', $preloadBlock + '</head>')
            $changed = $true
            $msg = '    + ' + $name + ' : LCP preload ' + $lcpImg
            Write-Host $msg -ForegroundColor Gray
        }
    }

    if ($changed) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
    }
}

Write-Host ''
Write-Host 'LCP preload injection complete.' -ForegroundColor Green