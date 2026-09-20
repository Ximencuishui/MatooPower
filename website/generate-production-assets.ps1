# Matoo Power - Favicon 套件 + OG/Twitter Card 图 + PWA Manifest

Add-Type -AssemblyName System.Drawing

$AssetsDir = "e:\MatooPower\website\assets"

# 品牌色
$Navy      = [System.Drawing.Color]::FromArgb(255, 9, 30, 66)
$Matoo     = [System.Drawing.Color]::FromArgb(255, 0, 82, 204)
$MatooLight = [System.Drawing.Color]::FromArgb(255, 38, 132, 255)
$Amber     = [System.Drawing.Color]::FromArgb(255, 255, 171, 0)
$White     = [System.Drawing.Color]::White

# ============================================
# 工具
# ============================================
function Save-Png {
    param($Bitmap, [string]$Path)
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/png" }
    $Bitmap.Save($Path, $codec, $null)
}

function Save-Jpg-Progressive {
    param($Bitmap, [string]$Path, [int]$Quality = 88)
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters 2
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
    $encParams.Param[1] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::RenderMethod, [long]3)
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $Bitmap.Save($Path, $codec, $encParams)
}

function New-Bitmap {
    param([int]$W, [int]$H, [System.Drawing.Color]$BgColor)
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.FillRectangle((New-Object System.Drawing.SolidBrush $BgColor), 0, 0, $W, $H)
    return @{ Bitmap = $bmp; Graphics = $g }
}

function Add-GlowOrb {
    param($G, [int]$X, [int]$Y, [int]$R, [System.Drawing.Color]$Color, [int]$Alpha)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(($X - $R), ($Y - $R), ($R * 2), ($R * 2))
    $pb = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
    $pb.CenterColor = [System.Drawing.Color]::FromArgb($Alpha, $Color.R, $Color.G, $Color.B)
    $pb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $Color.R, $Color.G, $Color.B))
    $G.FillEllipse($pb, ($X - $R), ($Y - $R), ($R * 2), ($R * 2))
    $pb.Dispose(); $path.Dispose()
}

# ============================================
# 1. Favicon 套件 - 圆角矩形 + Matoo 闪电符号
# ============================================
function New-FaviconPng {
    param([int]$Size, [string]$Out)

    $ctx = New-Bitmap $Size $Size $Matoo
    $g = $ctx.Graphics

    # 圆角
    $r = [int]($Size * 0.18)
    $bodyPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bodyPath.AddArc(0, 0, ($r * 2), ($r * 2), 180, 90)
    $bodyPath.AddArc(($Size - $r * 2), 0, ($r * 2), ($r * 2), 270, 90)
    $bodyPath.AddArc(($Size - $r * 2), ($Size - $r * 2), ($r * 2), ($r * 2), 0, 90)
    $bodyPath.AddArc(0, ($Size - $r * 2), ($r * 2), ($r * 2), 90, 90)
    $bodyPath.CloseFigure()
    $bodyBrush = New-Object System.Drawing.SolidBrush $Matoo
    $g.FillPath($bodyBrush, $bodyPath)
    $bodyBrush.Dispose()

    # 内层渐变
    $innerR = [int]($Size * 0.10)
    $g2Brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point $Size, $Size),
        $MatooLight,
        $Navy
    )
    $g.FillPath($g2Brush, $bodyPath)
    $g2Brush.Dispose()

    # 闪电符号
    $cx = [int]($Size / 2)
    $cy = [int]($Size / 2)
    $pts = @(
        (New-Object System.Drawing.Point -ArgumentList ([int]($cx + $Size * 0.06)), ([int]($cy - $Size * 0.20))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($cx - $Size * 0.18)), ([int]($cy + $Size * 0.05))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($cx - $Size * 0.02)), ([int]($cy + $Size * 0.05))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($cx - $Size * 0.22)), ([int]($cy + $Size * 0.30))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($cx + $Size * 0.12)), ([int]($cy + $Size * 0.04))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($cx - $Size * 0.04)), ([int]($cy + $Size * 0.04))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($cx + $Size * 0.20)), ([int]($cy - $Size * 0.28)))
    )
    $boltBrush = New-Object System.Drawing.SolidBrush $Amber
    $g.FillPolygon($boltBrush, $pts)
    $boltBrush.Dispose()

    Save-Png $ctx.Bitmap "$AssetsDir\$Out"
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out  ($Size x $Size)" -ForegroundColor Gray
}

Write-Host "[1] Favicon PNGs..." -ForegroundColor Cyan
New-FaviconPng  16 'favicon-16x16.png'
New-FaviconPng  32 'favicon-32x32.png'
New-FaviconPng  48 'favicon-48x48.png'
New-FaviconPng 180 'apple-touch-icon.png'
New-FaviconPng 192 'android-chrome-192x192.png'
New-FaviconPng 512 'android-chrome-512x512.png'
New-FaviconPng 150 'mstile-150x150.png'

# ============================================
# 2. OG 图套件 - 1200x630 (Facebook/LinkedIn) + 1200x627 (Twitter Card)
# ============================================
function New-OgImage {
    param([string]$Out, [string]$Title, [string]$Subtitle, [string]$Tag, [int]$W = 1200, [int]$H = 630)

    $ctx = New-Bitmap $W $H $Navy
    $g = $ctx.Graphics

    # 背景径向光晕
    Add-GlowOrb $g ([int]($W * 0.85)) ([int]($H * 0.15)) 350 $MatooLight 60
    Add-GlowOrb $g ([int]($W * 0.10)) ([int]($H * 0.85)) 280 $Amber 30

    # 渐变覆盖
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point $W, $H),
        ([System.Drawing.Color]::FromArgb(80, 0, 0, 0)),
        ([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    )
    $g.FillRectangle($bgBrush, 0, 0, $W, $H)
    $bgBrush.Dispose()

    # 装饰电路纹理
    $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(20, 38, 132, 255)), 1
    for ($x = 0; $x -lt $W; $x += 60) { $g.DrawLine($linePen, $x, 0, $x, $H) }
    for ($y = 0; $y -lt $H; $y += 60) { $g.DrawLine($linePen, 0, $y, $W, $y) }
    $linePen.Dispose()

    # Tag 标签（顶部）
    $tagBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 0, 82, 204))
    $g.FillRectangle($tagBrush, 60, 80, 240, 36)
    $tagBrush.Dispose()

    $tagFont = New-Object System.Drawing.Font ("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
    $tagBrush2 = New-Object System.Drawing.SolidBrush $White
    $g.DrawString($Tag.ToUpper(), $tagFont, $tagBrush2, 80, 88)
    $tagFont.Dispose(); $tagBrush2.Dispose()

    # 主标题
    $titleFont = New-Object System.Drawing.Font ("Segoe UI", 52, [System.Drawing.FontStyle]::Bold)
    $titleBrush = New-Object System.Drawing.SolidBrush $White
    $g.DrawString($Title, $titleFont, $titleBrush, 60, 160)
    $titleFont.Dispose(); $titleBrush.Dispose()

    # 副标题（多行）
    $subFont = New-Object System.Drawing.Font ("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
    $subBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 200, 215, 240))
    $lines = $Subtitle -split "`n"
    $yPos = 250
    foreach ($line in $lines) {
        $g.DrawString($line, $subFont, $subBrush, 60, $yPos)
        $yPos += 36
    }
    $subFont.Dispose(); $subBrush.Dispose()

    # 底部品牌
    $brandFont = New-Object System.Drawing.Font ("Segoe UI", 20, [System.Drawing.FontStyle]::Bold)
    $brandBrush = New-Object System.Drawing.SolidBrush $MatooLight
    $g.DrawString("MATOO POWER", $brandFont, $brandBrush, 60, ($H - 70))
    $brandFont.Dispose(); $brandBrush.Dispose()

    $taglineFont = New-Object System.Drawing.Font ("Segoe UI", 14, [System.Drawing.FontStyle]::Regular)
    $taglineBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 200, 215, 240))
    $g.DrawString("matoopower.com", $taglineFont, $taglineBrush, 60, ($H - 38))
    $taglineFont.Dispose(); $taglineBrush.Dispose()

    # 右下角产品图标（圆角方块 + 闪电）
    $iconW = 220
    $iconX = $W - 60 - $iconW
    $iconY = $H - 60 - $iconW
    $iconPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rr = 24
    $iconPath.AddArc($iconX, $iconY, $rr * 2, $rr * 2, 180, 90)
    $iconPath.AddArc(($iconX + $iconW - $rr * 2), $iconY, $rr * 2, $rr * 2, 270, 90)
    $iconPath.AddArc(($iconX + $iconW - $rr * 2), ($iconY + $iconW - $rr * 2), $rr * 2, $rr * 2, 0, 90)
    $iconPath.AddArc($iconX, ($iconY + $iconW - $rr * 2), $rr * 2, $rr * 2, 90, 90)
    $iconPath.CloseFigure()
    $iconBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 0, 82, 204))
    $g.FillPath($iconBrush, $iconPath)
    $iconBrush.Dispose()

    # 闪电
    $boltPts = @(
        (New-Object System.Drawing.Point -ArgumentList ([int]($iconX + 110)), ([int]($iconY + 30))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($iconX + 70)),  ([int]($iconY + 130))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($iconX + 100)), ([int]($iconY + 110))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($iconX + 70)),  ([int]($iconY + 190))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($iconX + 150)), ([int]($iconY + 100))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($iconX + 110)), ([int]($iconY + 120))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($iconX + 140)), ([int]($iconY + 30)))
    )
    $boltBrush = New-Object System.Drawing.SolidBrush $Amber
    $g.FillPolygon($boltBrush, $boltPts)
    $boltBrush.Dispose()

    Save-Jpg-Progressive $ctx.Bitmap "$AssetsDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out  ($W x $H)" -ForegroundColor Gray
}

Write-Host "`n[2] OG / Twitter Card images..." -ForegroundColor Cyan
New-OgImage 'og-default.jpg'  'Powering Emerging Markets.'            'Engineered for Reliability.'                                  'B2B Brand Site'   1200 630
New-OgImage 'og-products.jpg' 'Products & Solutions'                 'Modular energy storage for emerging markets.'                 'Products'         1200 630
New-OgImage 'og-partnership.jpg' 'Three Ways to Partner.'           'Distribute, OEM, or license PACK lines.'                      'Partnership'      1200 630
New-OgImage 'og-insights.jpg' 'Insights from the Field'              'Market analysis, technology deep-dives, partner stories.'     'Insights'         1200 630
New-OgImage 'og-manufacturing.jpg' 'Shenzhen Factory.'              '20+ Years of battery craftsmanship.'                          'Manufacturing'    1200 630
New-OgImage 'twitter-card.jpg' 'Powering Emerging Markets.'         'Engineered for Reliability.'                                  'Twitter Card'     1200 627

# ============================================
# 3. sitemap.xml + robots.txt + site.webmanifest
# ============================================
Write-Host "`n[3] Writing manifest + meta files..." -ForegroundColor Cyan

$manifest = @'
{
  "name": "Matoo Power",
  "short_name": "Matoo",
  "description": "Lithium iron phosphate energy storage, engineered in China for emerging markets worldwide.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#0052CC",
  "background_color": "#091E42",
  "icons": [
    { "src": "/assets/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
'@
[System.IO.File]::WriteAllText("e:\MatooPower\website\site.webmanifest", $manifest, [System.Text.Encoding]::UTF8)
Write-Host "    + site.webmanifest" -ForegroundColor Gray

$robots = @"
User-agent: *
Allow: /

Sitemap: https://matoopower.com/sitemap.xml
"@
[System.IO.File]::WriteAllText("e:\MatooPower\website\robots.txt", $robots, [System.Text.Encoding]::UTF8)
Write-Host "    + robots.txt" -ForegroundColor Gray

Write-Host ""
Write-Host "Production assets generation complete." -ForegroundColor Green