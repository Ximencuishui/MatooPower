# Matoo Power - HTML 引用资源深度验证
# 从 HTML 中提取所有引用的 /assets/* URL 和 styles/scripts/i18n 引用
$base = 'http://localhost:8000'
$htmlDir = 'e:\MatooPower\website'

# 收集所有 HTML 文件中引用的资源
$referenced = @()

foreach ($file in Get-ChildItem "$htmlDir\*.html") {
    $content = [System.IO.File]::ReadAllText($file.FullName)

    # 提取 src="/assets/..." 引用
    $assetRefs = [regex]::Matches($content, 'src="(/assets/[^"]+)"')
    foreach ($m in $assetRefs) {
        $referenced += $m.Groups[1].Value
    }

    # 提取 href="/assets/..." 引用
    $assetRefsH = [regex]::Matches($content, 'href="(/assets/[^"]+)"')
    foreach ($m in $assetRefsH) {
        $referenced += $m.Groups[1].Value
    }

    # 提取 srcset 中的资源
    $srcsets = [regex]::Matches($content, 'srcset="([^"]+)"')
    foreach ($m in $srcsets) {
        $parts = $m.Groups[1].Value -split ',\s*'
        foreach ($p in $parts) {
            $url = ($p -split '\s+')[0]
            if ($url.StartsWith('/assets/')) {
                $referenced += $url
            }
        }
    }

    # styles/scripts/i18n/manifest
    $otherRefs = [regex]::Matches($content, '(href|src)="(/styles/[^"]+|/scripts/[^"]+|/i18n/[^"]+|/site\.webmanifest|/sitemap\.xml|/robots\.txt)"')
    foreach ($m in $otherRefs) {
        $referenced += $m.Groups[2].Value
    }

    # imagesrcset (LCP preload)
    $imgSrcsets = [regex]::Matches($content, 'imagesrcset="([^"]+)"')
    foreach ($m in $imgSrcsets) {
        $parts = $m.Groups[1].Value -split ',\s*'
        foreach ($p in $parts) {
            $url = ($p -split '\s+')[0]
            if ($url.StartsWith('/assets/')) {
                $referenced += $url
            }
        }
    }

    # og:image / twitter:image / icon 等 URL（包含 https:// 的绝对 URL 不验证，本地 /assets 才验证）
    $localRefs = [regex]::Matches($content, '(href|content)="(/assets/[^"]+)"')
    foreach ($m in $localRefs) {
        if ($m.Groups[2].Value -notin $referenced) {
            $referenced += $m.Groups[2].Value
        }
    }
}

# 去重
$referenced = $referenced | Select-Object -Unique

Write-Host ('Total unique referenced URLs in HTML: ' + $referenced.Count) -ForegroundColor Cyan
Write-Host ''

$ok = 0
$fail = 0
$failedList = @()

foreach ($url in $referenced) {
    $fullUrl = $base + $url
    try {
        $r = Invoke-WebRequest -Uri $fullUrl -UseBasicParsing -Method Head -TimeoutSec 5
        if ($r.StatusCode -eq 200) {
            $ok++
        } else {
            $fail++
            $failedList += $url + ' (' + $r.StatusCode + ')'
        }
    } catch {
        $fail++
        $failedList += $url + ' (ERROR)'
    }
}

Write-Host ('Referenced URLs passed: ' + $ok) -ForegroundColor Green
Write-Host ('Referenced URLs failed: ' + $fail) -ForegroundColor Red

if ($fail -gt 0) {
    Write-Host ''
    Write-Host 'Failed references:' -ForegroundColor Red
    foreach ($u in $failedList) {
        Write-Host ('  ' + $u)
    }
}

# 输出引用列表
$referenced | Sort-Object | Out-File -FilePath 'e:\MatooPower\website\html-references.txt' -Encoding UTF8
Write-Host ''
Write-Host 'References saved to html-references.txt'