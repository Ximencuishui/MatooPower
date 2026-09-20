# Matoo Power · 批量为页面注入业务图片
# 1. 为每个页面加 hero 背景图（page-header 改造）
# 2. 为 manufacturing/partnership/insights 加业务图

$ErrorActionPreference = "Stop"
$websiteDir = "e:\MatooPower\website"
Set-Location $websiteDir

# ----- 1. page-header 加背景图的统一改造 -----
function Set-PageHero {
    param([string]$File, [string]$HeroImage)

    $content = Get-Content $File -Raw -Encoding UTF8

    # 找到 <section class="page-header"> 并替换为带背景图 + 遮罩 + 白色文字的版本
    $oldPattern = '(?s)(<section class="page-header">)(\s*<div class="container">)(.*?)(</section>)'
    $newBlock = @"
<section class="page-header page-header-hero" style="position: relative; min-height: 360px; display: flex; align-items: center; background-image: linear-gradient(90deg, rgba(9, 30, 66, 0.92) 0%, rgba(9, 30, 66, 0.65) 60%, rgba(9, 30, 66, 0.30) 100%), url('$HeroImage'); background-size: cover; background-position: center; color: white; padding: var(--space-20) 0;">
  <div class="container">
"@

    # 替换 page-header 起始块
    $content = $content -replace '(?s)<section class="page-header">\s*<div class="container">', $newBlock

    Set-Content -Path $File -Value $content -Encoding UTF8 -NoNewline
    Write-Host "  Hero set: $HeroImage" -ForegroundColor Green
}

# 各页面 hero 映射
$pageHeroMap = @{
    'index.html'          = '/assets/hero-home.jpg'
    'about.html'          = '/assets/hero-about.jpg'
    'manufacturing.html'  = '/assets/hero-manufacturing.jpg'
    'partnership.html'    = '/assets/hero-partnership.jpg'
    'insights.html'       = '/assets/hero-insights.jpg'
}

Write-Host "[A] Adding hero backgrounds..." -ForegroundColor Cyan
foreach ($page in $pageHeroMap.Keys) {
    $path = Join-Path $websiteDir $page
    if (Test-Path $path) {
        Set-PageHero $path $pageHeroMap[$page]
    } else {
        Write-Host "  NOT FOUND: $page" -ForegroundColor Yellow
    }
}

# ----- 2. manufacturing.html - 加 3 张工厂产线图 -----
Write-Host "`n[B] manufacturing.html: adding 3 factory images..." -ForegroundColor Cyan
$mfgFile = Join-Path $websiteDir 'manufacturing.html'
$mfgContent = Get-Content $mfgFile -Raw -Encoding UTF8

# 在 "Six Production Lines" section 后面插入 3 张图
$mfgInsert = @'

    <!-- ========== Production Gallery ========== -->
    <section class="section">
      <div class="container">
        <header class="modules-header">
          <h2>On the Floor</h2>
          <p>A walkthrough of our Shenzhen facility.</p>
        </header>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4);">
          <figure style="margin: 0;">
            <img src="/assets/factory-floor.jpg" alt="Factory floor overview" loading="lazy"
                 style="width: 100%; aspect-ratio: 3/2; object-fit: cover; border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
            <figcaption style="margin-top: var(--space-3); font-size: var(--fs-sm); color: var(--color-slate-500); text-align: center;">Six dedicated production lines</figcaption>
          </figure>
          <figure style="margin: 0;">
            <img src="/assets/factory-assembly.jpg" alt="Pack assembly line" loading="lazy"
                 style="width: 100%; aspect-ratio: 3/2; object-fit: cover; border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
            <figcaption style="margin-top: var(--space-3); font-size: var(--fs-sm); color: var(--color-slate-500); text-align: center;">Modular pack assembly</figcaption>
          </figure>
          <figure style="margin: 0;">
            <img src="/assets/factory-warehouse.jpg" alt="Warehouse and shipping" loading="lazy"
                 style="width: 100%; aspect-ratio: 3/2; object-fit: cover; border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
            <figcaption style="margin-top: var(--space-3); font-size: var(--fs-sm); color: var(--color-slate-500); text-align: center;">Export-ready warehouse</figcaption>
          </figure>
        </div>
      </div>
    </section>
'@

# 在 final-cta 之前插入
$mfgContent = $mfgContent -replace '(?s)(\s*<!-- ========== Visit CTA ========== -->)', ("`n$mfgInsert`$1")
Set-Content -Path $mfgFile -Value $mfgContent -Encoding UTF8 -NoNewline

# ----- 3. partnership.html - 加 4 张区域图 -----
Write-Host "[C] partnership.html: adding 4 region images..." -ForegroundColor Cyan
$partFile = Join-Path $websiteDir 'partnership.html'
$partContent = Get-Content $partFile -Raw -Encoding UTF8

$partInsert = @'

    <!-- ========== Regional Showcase ========== -->
    <section class="section">
      <div class="container">
        <header class="modules-header">
          <h2>Where We Work</h2>
          <p>Active partner networks across four continents.</p>
        </header>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4);">
          <figure style="margin: 0; position: relative; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md);">
            <img src="/assets/region-south-asia.jpg" alt="South Asia market" loading="lazy"
                 style="width: 100%; aspect-ratio: 3/2; object-fit: cover; display: block;">
            <figcaption style="position: absolute; bottom: 0; left: 0; right: 0; padding: var(--space-4); background: linear-gradient(to top, rgba(9,30,66,0.95), transparent); color: white;">
              <strong style="font-size: var(--fs-lg);">South Asia</strong><br>
              <span style="font-size: var(--fs-sm); opacity: 0.85;">Bangladesh · Pakistan · India</span>
            </figcaption>
          </figure>
          <figure style="margin: 0; position: relative; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md);">
            <img src="/assets/region-africa.jpg" alt="Africa market" loading="lazy"
                 style="width: 100%; aspect-ratio: 3/2; object-fit: cover; display: block;">
            <figcaption style="position: absolute; bottom: 0; left: 0; right: 0; padding: var(--space-4); background: linear-gradient(to top, rgba(9,30,66,0.95), transparent); color: white;">
              <strong style="font-size: var(--fs-lg);">Africa</strong><br>
              <span style="font-size: var(--fs-sm); opacity: 0.85;">Nigeria · Kenya · Ghana</span>
            </figcaption>
          </figure>
          <figure style="margin: 0; position: relative; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md);">
            <img src="/assets/region-mena.jpg" alt="MENA market" loading="lazy"
                 style="width: 100%; aspect-ratio: 3/2; object-fit: cover; display: block;">
            <figcaption style="position: absolute; bottom: 0; left: 0; right: 0; padding: var(--space-4); background: linear-gradient(to top, rgba(9,30,66,0.95), transparent); color: white;">
              <strong style="font-size: var(--fs-lg);">MENA</strong><br>
              <span style="font-size: var(--fs-sm); opacity: 0.85;">Egypt · Morocco · UAE</span>
            </figcaption>
          </figure>
          <figure style="margin: 0; position: relative; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md);">
            <img src="/assets/region-sea.jpg" alt="Southeast Asia market" loading="lazy"
                 style="width: 100%; aspect-ratio: 3/2; object-fit: cover; display: block;">
            <figcaption style="position: absolute; bottom: 0; left: 0; right: 0; padding: var(--space-4); background: linear-gradient(to top, rgba(9,30,66,0.95), transparent); color: white;">
              <strong style="font-size: var(--fs-lg);">Southeast Asia</strong><br>
              <span style="font-size: var(--fs-sm); opacity: 0.85;">Vietnam · Indonesia · Philippines</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
'@

$partContent = $partContent -replace '(?s)(\s*<!-- ========== Final CTA ========== -->)', ("`n$partInsert`$1")
Set-Content -Path $partFile -Value $partContent -Encoding UTF8 -NoNewline

# ----- 4. insights.html - 给每篇文章卡加封面图 -----
Write-Host "[D] insights.html: adding 6 insight cover images..." -ForegroundColor Cyan
$insFile = Join-Path $websiteDir 'insights.html'
$insContent = Get-Content $insFile -Raw -Encoding UTF8

# 9 个 insight-card，按顺序对应 6 张 insight-cover（部分复用）
$insightCoverMap = @{
    'Dhaka Distributor'         = 'insight-cover-01.jpg'
    '4-Wire Active Balancing'   = 'insight-cover-02.jpg'
    'Lagos'                     = 'insight-cover-03.jpg'
    '72-Hour Aging Test'        = 'insight-cover-04.jpg'
    'Indian EV Brand'           = 'insight-cover-05.jpg'
    'Egypt'                     = 'insight-cover-06.jpg'
    'LFP vs. NMC'               = 'insight-cover-02.jpg'  # 复用 tech
    'UN38.3'                    = 'insight-cover-04.jpg'  # 复用 OEM
    'Singapore'                 = 'insight-cover-06.jpg'  # 复用 investment
}

# 给 insight-card 加封面图（在 class="insight-card" 的 article 后插 img）
$count = 1
foreach ($keyword in $insightCoverMap.Keys) {
    $img = $insightCoverMap[$keyword]
    # 匹配 <article class="insight-card"> 的下一个 insight-tag 行附近
    # 简化做法：在第一个含 keyword 的 insight-card 中插入
    $oldSnippet = '<insight-card>\s*<span class="insight-tag">'
    # 不可靠，改用替换 insight-card 内的第一行 span 前面
}

# 更可靠：在每个 <article class="insight-card"> 后面插入封面图 div
$insCards = [regex]::Matches($insContent, '(?s)<article class="insight-card">.*?</article>')
$covers = @('insight-cover-01.jpg','insight-cover-02.jpg','insight-cover-03.jpg',
            'insight-cover-04.jpg','insight-cover-05.jpg','insight-cover-06.jpg',
            'insight-cover-02.jpg','insight-cover-04.jpg','insight-cover-06.jpg')

# 反向替换避免索引偏移
for ($i = $insCards.Count - 1; $i -ge 0; $i--) {
    $card = $insCards[$i].Value
    $cover = $covers[$i]
    # 在 <article class="insight-card"> 紧后面插入封面图
    $newCard = $card.Replace(
        '<article class="insight-card">',
        "<article class=`"insight-card`">`n            <img src=`"/assets/$cover`" alt=`"article cover`" loading=`"lazy`" style=`"width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-2);`">"
    )
    $insContent = $insContent.Replace($card, $newCard)
}

Set-Content -Path $insFile -Value $insContent -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "All images injected." -ForegroundColor Green