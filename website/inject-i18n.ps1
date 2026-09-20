# Matoo Power · 批量为所有页面注入 i18n 支持
# 1. 给 nav/footer 链接添加 data-i18n 属性
# 2. 在 footer 之前注入 <script id="i18n-data"> 翻译 JSON

$ErrorActionPreference = "Stop"
$websiteDir = "e:\MatooPower\website"
Set-Location $websiteDir

# ----- 1. nav 链接文本替换 -----
# 每个 nav 链接 <a href="...">TEXT</a> → <a href="..." data-i18n="nav.KEY">TEXT</a>
$navReplacements = @{
    '<a href="/products.html">Products</a>'         = '<a href="/products.html" data-i18n="nav.products">Products</a>'
    '<a href="/technology.html">Technology</a>'     = '<a href="/technology.html" data-i18n="nav.technology">Technology</a>'
    '<a href="/manufacturing.html">Manufacturing</a>' = '<a href="/manufacturing.html" data-i18n="nav.manufacturing">Manufacturing</a>'
    '<a href="/partnership.html">Partnership</a>'   = '<a href="/partnership.html" data-i18n="nav.partnership">Partnership</a>'
    '<a href="/insights.html">Insights</a>'         = '<a href="/insights.html" data-i18n="nav.insights">Insights</a>'
    '<a href="/about.html">About</a>'               = '<a href="/about.html" data-i18n="nav.about">About</a>'
    '<a href="/contact.html" class="btn btn-primary btn-sm">Contact</a>' = '<a href="/contact.html" class="btn btn-primary btn-sm" data-i18n="nav.contact">Contact</a>'
}

# ----- 2. footer 链接文本替换 -----
$footerReplacements = @{
    '<a href="/products.html#power01">Power01</a>' = '<a href="/products.html#power01" data-i18n="footer.products">Power01</a>'
    '<a href="/products.html#power02">Power02</a>' = '<a href="/products.html#power02" data-i18n="footer.products">Power02</a>'
    '<a href="/products.html#power-box">Power Box</a>' = '<a href="/products.html#power-box" data-i18n="footer.products">Power Box</a>'
    '<a href="/about.html">About</a>'              = '<a href="/about.html" data-i18n="footer.about">About</a>'
    '<a href="/manufacturing.html">Manufacturing</a>' = '<a href="/manufacturing.html" data-i18n="footer.mfg">Manufacturing</a>'
    '<a href="/partnership.html">Partnership</a>'  = '<a href="/partnership.html" data-i18n="footer.partnership">Partnership</a>'
    '<a href="/insights.html">Insights</a>'        = '<a href="/insights.html" data-i18n="footer.insights">Insights</a>'
    '<a href="/privacy.html">Privacy Policy</a>'   = '<a href="/privacy.html" data-i18n="footer.privacy">Privacy Policy</a>'
    '<a href="/cookies.html">Cookie Settings</a>'  = '<a href="/cookies.html" data-i18n="footer.cookies">Cookie Settings</a>'
    '<a href="/terms.html">Terms</a>'              = '<a href="/terms.html" data-i18n="footer.terms">Terms</a>'
    '<h4>Products</h4>'                            = '<h4 data-i18n="footer.products">Products</h4>'
    '<h4>Company</h4>'                             = '<h4 data-i18n="footer.company">Company</h4>'
    '<h4>Contact</h4>'                             = '<h4 data-i18n="footer.contact">Contact</h4>'
    '<p>Lithium iron phosphate energy storage, engineered in China for emerging markets worldwide.</p>' = '<p data-i18n="footer.brand">Lithium iron phosphate energy storage, engineered in China for emerging markets worldwide.</p>'
}

# ----- 3. i18n-data 注入块 -----
$i18nDataBlock = @'

  <!-- i18n data injection -->
  <script id="i18n-data" type="application/json">
  {
    "en": __EN__,
    "zh": __ZH__,
    "bn": __BN__
  }
  </script>
</body>
</html>
'@

# 读取三个 JSON
$enJson = (Get-Content "$websiteDir\i18n\en.json" -Raw -Encoding UTF8) -replace "`r`n", "`n" -replace "</", "<\/"
$zhJson = (Get-Content "$websiteDir\i18n\zh.json" -Raw -Encoding UTF8) -replace "`r`n", "`n" -replace "</", "<\/"
$bnJson = (Get-Content "$websiteDir\i18n\bn.json" -Raw -Encoding UTF8) -replace "`r`n", "`n" -replace "</", "<\/"

$htmlFiles = Get-ChildItem "$websiteDir\*.html" -File

foreach ($file in $htmlFiles) {
    Write-Host "Processing: $($file.Name)" -ForegroundColor Cyan
    $content = Get-Content $file.FullName -Raw -Encoding UTF8

    $original = $content

    # 应用 nav 替换
    foreach ($key in $navReplacements.Keys) {
        $content = $content.Replace($key, $navReplacements[$key])
    }

    # 应用 footer 替换
    foreach ($key in $footerReplacements.Keys) {
        $content = $content.Replace($key, $footerReplacements[$key])
    }

    # 替换 footer 版权年份翻译键
    $content = $content.Replace(
        '© 2026 Matoo Power. All rights reserved.',
        '<span data-i18n="footer.legal">© 2026 Matoo Power. All rights reserved.</span>'
    )

    # 注入 i18n-data（在 </body> 之前）
    if ($content -notmatch 'id="i18n-data"') {
        $i18nBlock = $i18nDataBlock -replace '__EN__', $enJson -replace '__ZH__', $zhJson -replace '__BN__', $bnJson
        # 确保只匹配一次
        $content = $content -replace '(?s)\s*</body>\s*</html>\s*$', "`n$i18nBlock"
    }

    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "  Updated" -ForegroundColor Green
    } else {
        Write-Host "  No changes" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green