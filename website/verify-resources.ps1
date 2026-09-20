# Matoo Power - 生产资源 HTTP 验证
$base = 'http://localhost:8000'

# 收集所有需要验证的 URL
$urls = @()

# 1. 所有 HTML 页面
$htmlFiles = Get-ChildItem 'e:\MatooPower\website\*.html'
foreach ($f in $htmlFiles) {
    $urls += '/' + $f.Name
}

# 2. 所有静态资源（跳过隐藏文件/目录，例如 .archive）
$assets = Get-ChildItem 'e:\MatooPower\website\assets' -Force | Where-Object { -not $_.PSIsContainer -and -not $_.Name.StartsWith('.') }
foreach ($a in $assets) {
    $urls += '/assets/' + $a.Name
}

# 3. 顶层 meta 文件
$topLevel = @('robots.txt', 'sitemap.xml', 'site.webmanifest')
foreach ($f in $topLevel) {
    if (Test-Path ('e:\MatooPower\website\' + $f)) {
        $urls += '/' + $f
    }
}

# 4. i18n 文件
$i18nDir = Get-ChildItem 'e:\MatooPower\website\i18n' -ErrorAction SilentlyContinue
if ($i18nDir) {
    foreach ($f in $i18nDir) {
        $urls += '/i18n/' + $f.Name
    }
}

# 5. styles 和 scripts
$stylesDir = Get-ChildItem 'e:\MatooPower\website\styles' -ErrorAction SilentlyContinue
if ($stylesDir) {
    foreach ($f in $stylesDir) {
        $urls += '/styles/' + $f.Name
    }
}
$scriptsDir = Get-ChildItem 'e:\MatooPower\website\scripts' -ErrorAction SilentlyContinue
if ($scriptsDir) {
    foreach ($f in $scriptsDir) {
        $urls += '/scripts/' + $f.Name
    }
}

Write-Host ('Total URLs to check: ' + $urls.Count) -ForegroundColor Cyan
Write-Host ''

$ok = 0
$fail = 0
$missing = @()
$failed = @()
$results = @()

foreach ($url in $urls) {
    $fullUrl = $base + $url
    try {
        $r = Invoke-WebRequest -Uri $fullUrl -UseBasicParsing -Method Head -TimeoutSec 5
        if ($r.StatusCode -eq 200) {
            $ok++
            $results += 'OK   ' + $url
        } else {
            $fail++
            $failed += $url + ' (' + $r.StatusCode + ')'
            $results += 'FAIL ' + $url + ' (' + $r.StatusCode + ')'
        }
    } catch {
        $fail++
        $failed += $url + ' (ERROR: ' + $_.Exception.Message + ')'
        $results += 'ERR  ' + $url
    }
}

Write-Host ('Passed: ' + $ok) -ForegroundColor Green
Write-Host ('Failed: ' + $fail) -ForegroundColor Red

if ($fail -gt 0) {
    Write-Host ''
    Write-Host 'Failed URLs:' -ForegroundColor Red
    foreach ($u in $failed) {
        Write-Host ('  ' + $u) -ForegroundColor Red
    }
}

# 输出到文件以便后续分析
$results | Out-File -FilePath 'e:\MatooPower\website\verify-results.txt' -Encoding UTF8