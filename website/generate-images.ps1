# Matoo Power · 占位图片批量生成器（冷启动阶段）
# 设计语言：深色科技蓝 + 琥珀强调色 + 现代几何抽象
# 所有图片均为程序生成的占位图，正式素材到位后可整体替换

Add-Type -AssemblyName System.Drawing

$OutputDir = "e:\MatooPower\website\assets"
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

# ============================================
# 品牌色板（与 tokens.css 保持一致）
# ============================================
$Colors = @{
    Navy        = [System.Drawing.Color]::FromArgb(255, 9, 30, 66)        # #091E42
    NavyDeep    = [System.Drawing.Color]::FromArgb(255, 4, 17, 38)        # #041126
    Matoo       = [System.Drawing.Color]::FromArgb(255, 0, 82, 204)       # #0052CC
    MatooLight  = [System.Drawing.Color]::FromArgb(255, 38, 132, 255)     # #2684FF
    Matoo50     = [System.Drawing.Color]::FromArgb(255, 230, 240, 255)    # #E6F0FF
    Amber       = [System.Drawing.Color]::FromArgb(255, 255, 171, 0)      # #FFAB00
    Success     = [System.Drawing.Color]::FromArgb(255, 54, 179, 126)     # #36B37E
    Slate500    = [System.Drawing.Color]::FromArgb(255, 107, 119, 140)   # #6B778C
    Slate200    = [System.Drawing.Color]::FromArgb(255, 223, 225, 230)   # #DFE1E6
    Slate50     = [System.Drawing.Color]::FromArgb(255, 244, 245, 247)   # #F4F5F7
    White       = [System.Drawing.Color]::White
}

# ============================================
# 工具函数
# ============================================
function Save-Jpg {
    param($Bitmap, [string]$Path, [int]$Quality = 92)
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters 1
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter (
        [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality
    )
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq "image/jpeg" }
    $Bitmap.Save($Path, $codec, $encParams)
}

function New-Bitmap {
    param([int]$W, [int]$H, [System.Drawing.Color]$BgColor)
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.FillRectangle((New-Object System.Drawing.SolidBrush $BgColor), 0, 0, $W, $H)
    [pscustomobject]@{ Bitmap = $bmp; Graphics = $g }
}

function Add-CircuitPattern {
    param($G, [int]$W, [int]$H, [int]$Density = 30, [System.Drawing.Color]$Color = $Colors.MatooLight, [int]$Opacity = 40)
    $alpha = [Math]::Max(0, [Math]::Min(255, $Opacity))
    $c = [System.Drawing.Color]::FromArgb($alpha, $Color.R, $Color.G, $Color.B)
    $pen = New-Object System.Drawing.Pen $c, 1
    $dotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb([int]($alpha * 1.6), $c))

    $rnd = New-Object System.Random 42  # 固定种子，结果一致
    for ($i = 0; $i -lt $Density; $i++) {
        $x = $rnd.Next(10, $W - 10)
        $y = $rnd.Next(10, $H - 10)
        $dx = $rnd.Next(60, 220)
        $dy = $rnd.Next(40, 100)
        $G.DrawLine($pen, $x, $y, ($x + $dx), $y)
        $G.DrawLine($pen, ($x + $dx), $y, ($x + $dx), ($y + $dy))
        $G.FillEllipse($dotBrush, ($x + $dx - 3), ($y + $dy - 3), 6, 6)
    }
}

function Add-GridLines {
    param($G, [int]$W, [int]$H, [int]$Spacing = 60, [System.Drawing.Color]$Color = $Colors.MatooLight, [int]$Opacity = 15)
    $alpha = [Math]::Max(0, [Math]::Min(255, $Opacity))
    $c = [System.Drawing.Color]::FromArgb($alpha, $Color.R, $Color.G, $Color.B)
    $pen = New-Object System.Drawing.Pen $c, 1
    for ($x = 0; $x -lt $W; $x += $Spacing) { $G.DrawLine($pen, $x, 0, $x, $H) }
    for ($y = 0; $y -lt $H; $y += $Spacing) { $G.DrawLine($pen, 0, $y, $W, $y) }
}

function Add-GlowOrb {
    param($G, [int]$X, [int]$Y, [int]$R, [System.Drawing.Color]$Color, [int]$Alpha = 80)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(($X - $R), ($Y - $R), ($R * 2), ($R * 2))
    $pb = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
    $pb.CenterColor = [System.Drawing.Color]::FromArgb($Alpha, $Color.R, $Color.G, $Color.B)
    $pb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $Color.R, $Color.G, $Color.B))
    $G.FillEllipse($pb, ($X - $R), ($Y - $R), ($R * 2), ($R * 2))
    $pb.Dispose()
    $path.Dispose()
}

function Draw-Battery {
    param($G, [int]$X, [int]$Y, [int]$W, [int]$H,
          [System.Drawing.Color]$BodyColor = $Colors.Matoo,
          [System.Drawing.Color]$StrokeColor = $Colors.MatooLight,
          [System.Drawing.Color]$BoltColor = $Colors.Amber,
          [int]$Charge = 3)

    $capH = 14
    $strokePen = New-Object System.Drawing.Pen $StrokeColor, 3
    $bodyBrush = New-Object System.Drawing.SolidBrush $BodyColor
    $capBrush  = New-Object System.Drawing.SolidBrush $BodyColor

    # Body
    $G.FillRectangle($bodyBrush, $X, $Y, $W, $H)
    $G.DrawRectangle($strokePen, $X, $Y, $W, $H)

    # Cap
    $G.FillRectangle($capBrush, ($X + ($W / 2 - $W / 6)), ($Y - $capH), ($W / 3), $capH)

    # Cells
    $cellH = ($H - 60) / 4
    $cellBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 230, 240, 255))
    $padX = 14
    $padY = 14
    for ($i = 0; $i -lt $Charge; $i++) {
        $G.FillRectangle($cellBrush, ($X + $padX), ($Y + $padY + $i * ($cellH + 6)), ($W - $padX * 2), $cellH)
    }

    # Bolt
    $bolt = New-Object System.Drawing.SolidBrush $BoltColor
    $pts = @(
        (New-Object System.Drawing.Point (($X + ($W / 2) + 6), ($Y + $H - 70))),
        (New-Object System.Drawing.Point (($X + ($W / 2) - 14), ($Y + $H - 30))),
        (New-Object System.Drawing.Point (($X + ($W / 2) + 2), ($Y + $H - 30))),
        (New-Object System.Drawing.Point (($X + ($W / 2) - 18), ($Y + $H - 4)))
    )
    $G.FillPolygon($bolt, $pts)

    $strokePen.Dispose(); $bodyBrush.Dispose(); $capBrush.Dispose(); $cellBrush.Dispose(); $bolt.Dispose()
}

function Draw-ModularPacks {
    param($G, [int]$X, [int]$Y, [int]$W, [int]$H)

    # 3 个堆叠的模块
    $modW = ($W - 40) / 3
    $modH = $H - 40
    for ($i = 0; $i -lt 3; $i++) {
        $mx = $X + 20 + $i * ($modW + 0)
        $my = $Y + 20
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,
            [Math]::Max(0, $Colors.Matoo.R - $i * 20),
            [Math]::Max(0, $Colors.Matoo.G - $i * 10),
            [Math]::Min(255, $Colors.Matoo.B)))
        $G.FillRectangle($brush, $mx, $my, $modW - 8, $modH)
        $brush.Dispose()

        # 顶部条纹
        $topBrush = New-Object System.Drawing.SolidBrush $Colors.Amber
        $G.FillRectangle($topBrush, $mx, $my, ($modW - 8), 6)
        $topBrush.Dispose()

        # 内部分割线
        $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, $Colors.White.R, $Colors.White.G, $Colors.White.B)), 1
        for ($j = 1; $j -lt 4; $j++) {
            $G.DrawLine($linePen, $mx, ($my + ($modH / 4) * $j), ($mx + $modW - 8), ($my + ($modH / 4) * $j))
        }
        $linePen.Dispose()
    }
}

function Add-Caption {
    param($G, [int]$X, [int]$Y, [string]$Eyebrow, [string]$Title,
          [System.Drawing.Color]$EyebrowColor = $Colors.MatooLight,
          [System.Drawing.Color]$TitleColor   = $Colors.White,
          [int]$TitleSize = 64, [int]$EyebrowSize = 18)

    $eyebrowFont = New-Object System.Drawing.Font ("Segoe UI", $EyebrowSize, [System.Drawing.FontStyle]::Regular)
    $titleFont   = New-Object System.Drawing.Font ("Segoe UI", $TitleSize,  [System.Drawing.FontStyle]::Bold)

    $eyebrowBrush = New-Object System.Drawing.SolidBrush $EyebrowColor
    $titleBrush   = New-Object System.Drawing.SolidBrush $TitleColor

    $G.DrawString($Eyebrow, $eyebrowFont, $eyebrowBrush, $X, $Y)
    $G.DrawString($Title, $titleFont, $titleBrush, $X, ($Y + $EyebrowSize + 8))

    $eyebrowFont.Dispose(); $titleFont.Dispose()
    $eyebrowBrush.Dispose(); $titleBrush.Dispose()
}

# ============================================================
# 1. 升级 favicon.svg（精致版）
# ============================================================
$faviconSvg = @"
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>Matoo Power Favicon</title>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0052CC"/>
      <stop offset="100%" stop-color="#003D99"/>
    </linearGradient>
    <linearGradient id="bolt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFD24D"/>
      <stop offset="100%" stop-color="#FFAB00"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <g>
    <path d="M14 50 L14 14 L22 14 L30 32 L38 14 L46 14 L46 50 L38 50 L38 26 L32 38 L28 38 L22 26 L22 50 Z" fill="#FFFFFF"/>
    <path d="M48 14 L40 32 L48 32 L42 54 L58 32 L50 32 L56 14 Z" fill="url(#bolt)"/>
  </g>
</svg>
"@
Set-Content -Path "$OutputDir\favicon.svg" -Value $faviconSvg -Encoding UTF8
Write-Host "[1] favicon.svg updated" -ForegroundColor Green

# ============================================================
# 2. 重做 logo.svg + logo-white.svg（现代品牌系统）
# ============================================================
function New-LogoSvg([bool]$IsWhite) {
    $mainColor  = if ($IsWhite) { "#FFFFFF" } else { "#091E42" }
    $accentColor = if ($IsWhite) { "#FFFFFF" } else { "#0052CC" }
    $boltStart  = if ($IsWhite) { "#FFD24D" } else { "#FFD24D" }
    $boltEnd    = if ($IsWhite) { "#FFFFFF" } else { "#FFAB00" }
    $subtitleOpacity = if ($IsWhite) { ' opacity="0.85"' } else { '' }

    @"
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 48" role="img" aria-label="Matoo Power">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0052CC"/>
      <stop offset="100%" stop-color="#003D99"/>
    </linearGradient>
    <linearGradient id="bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="$boltStart"/>
      <stop offset="100%" stop-color="$boltEnd"/>
    </linearGradient>
  </defs>

  <!-- Icon container -->
  <rect x="2" y="6" width="42" height="36" rx="8" fill="url(#bg-grad)"/>

  <!-- M letterform -->
  <path d="M8 38 L8 10 L14 10 L21 26 L28 10 L34 10 L34 38 L29 38 L29 20 L23 32 L19 32 L13 20 L13 38 Z"
        fill="#FFFFFF"/>

  <!-- Bolt accent -->
  <path d="M37 10 L31 22 L37 22 L33 38 L43 22 L37 22 L41 10 Z"
        fill="url(#bolt-grad)"/>

  <!-- Wordmark -->
  <text x="54" y="26" font-family="Inter, 'SF Pro Display', -apple-system, sans-serif"
        font-size="20" font-weight="700" fill="$mainColor" letter-spacing="-0.5">Matoo</text>
  <text x="54" y="40" font-family="Inter, 'SF Pro Display', -apple-system, sans-serif"
        font-size="9" font-weight="600" fill="$accentColor" letter-spacing="3"${subtitleOpacity}>POWER</text>
</svg>
"@
}

Set-Content -Path "$OutputDir\logo.svg" -Value (New-LogoSvg $false) -Encoding UTF8
Set-Content -Path "$OutputDir\logo-white.svg" -Value (New-LogoSvg $true) -Encoding UTF8
Write-Host "[2] logo.svg + logo-white.svg updated" -ForegroundColor Green

# ============================================================
# 3. 优化 og-image.jpg（更专业）
# ============================================================
function New-OgImage {
    $W = 1200; $H = 630
    $ctx = New-Bitmap $W $H $Colors.NavyDeep
    $g = $ctx.Graphics

    # 背景渐变
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point $W, $H),
        $Colors.NavyDeep, $Colors.Navy
    )
    $g.FillRectangle($bgBrush, 0, 0, $W, $H)

    # 网格
    Add-GridLines $g $W $H 50 $Colors.MatooLight 12
    # 电路纹理
    Add-CircuitPattern $g $W $H 50 $Colors.MatooLight 35

    # Glow orbs
    Add-GlowOrb $g 200 150 280 $Colors.Matoo 60
    Add-GlowOrb $g 1050 500 200 $Colors.MatooLight 50

    # 电池图形
    Draw-Battery $g 130 175 200 320 $Colors.Matoo $Colors.MatooLight $Colors.Amber 4

    # 右侧文案
    $titleFont   = New-Object System.Drawing.Font ("Segoe UI", 68, [System.Drawing.FontStyle]::Bold)
    $subFont     = New-Object System.Drawing.Font ("Segoe UI", 24, [System.Drawing.FontStyle]::Regular)
    $tagFont     = New-Object System.Drawing.Font ("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
    $footFont    = New-Object System.Drawing.Font ("Segoe UI", 16, [System.Drawing.FontStyle]::Regular)

    $whiteBrush  = New-Object System.Drawing.SolidBrush $Colors.White
    $accentBrush = New-Object System.Drawing.SolidBrush $Colors.MatooLight
    $mutedBrush  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(190, 220, 230, 240))

    # Matoo Power
    $g.DrawString("Matoo Power", $titleFont, $whiteBrush, 400, 220)

    # 蓝色横线
    $accentBar = New-Object System.Drawing.SolidBrush $Colors.Matoo
    $g.FillRectangle($accentBar, 400, 325, 100, 6)
    $accentBar.Dispose()

    # Tagline
    $g.DrawString("Reliable Energy Storage", $subFont, $whiteBrush, 400, 360)
    $g.DrawString("for Emerging Markets",    $subFont, $whiteBrush, 400, 398)

    # Subtitle
    $g.DrawString("Engineered in China  $([char]0x00B7)  Trusted Worldwide", $tagFont, $accentBrush, 400, 470)

    # 底部
    $g.DrawString("Lithium Iron Phosphate  |  Off-Grid  |  E-Mobility  |  Commercial Backup",
        $footFont, $mutedBrush, 400, 555)

    $titleFont.Dispose(); $subFont.Dispose(); $tagFont.Dispose(); $footFont.Dispose()
    $whiteBrush.Dispose(); $accentBrush.Dispose(); $mutedBrush.Dispose()
    $bgBrush.Dispose()

    Save-Jpg $ctx.Bitmap "$OutputDir\og-image.jpg" 92
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
}

New-OgImage
Write-Host "[3] og-image.jpg updated" -ForegroundColor Green

# ============================================================
# 4. Hero 占位图（5 张）
# ============================================================
function New-HeroImage {
    param([string]$Out, [int]$W, [int]$H,
          [string]$Theme, [string]$Eyebrow, [string]$Title)
    $ctx = New-Bitmap $W $H $Colors.NavyDeep
    $g = $ctx.Graphics

    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point $W, $H),
        $Colors.NavyDeep, $Colors.Navy
    )
    $g.FillRectangle($bgBrush, 0, 0, $W, $H)

    Add-GridLines $g $W $H 60 $Colors.MatooLight 8
    Add-CircuitPattern $g $W $H 60 $Colors.MatooLight 25

    # 主题相关视觉元素
    switch ($Theme) {
        'home' {
            Add-GlowOrb $g ($W * 0.7) ($H * 0.3) 250 $Colors.Matoo 80
            Draw-Battery $g 1450 ($H * 0.3) 220 380 $Colors.Matoo $Colors.MatooLight $Colors.Amber 4
        }
        'manufacturing' {
            Add-GlowOrb $g ($W * 0.75) ($H * 0.4) 280 $Colors.Matoo 80
            # 模拟工厂 + 产线
            Draw-ModularPacks $g 1380 ($H * 0.25) 480 320
            # 工人剪影（矩形+圆）
            $rnd = New-Object System.Random 7
            $workerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120, 255, 255, 255))
            for ($i = 0; $i -lt 4; $i++) {
                $wx = 1450 + $rnd.Next(0, 350)
                $wy = $H * 0.7 + $rnd.Next(-10, 10)
                $g.FillEllipse($workerBrush, $wx, $wy, 18, 18)  # 头
                $g.FillRectangle($workerBrush, ($wx - 4), ($wy + 18), 26, 36)  # 身
            }
            $workerBrush.Dispose()
        }
        'partnership' {
            Add-GlowOrb $g ($W * 0.5) ($H * 0.5) 320 $Colors.MatooLight 60
            # 全球节点
            $rnd = New-Object System.Random 11
            $nodeBrush = New-Object System.Drawing.SolidBrush $Colors.MatooLight
            $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(100, 38, 132, 255)), 1
            $nodes = @()
            for ($i = 0; $i -lt 12; $i++) {
                $x = $rnd.Next(800, $W - 100)
                $y = $rnd.Next(100, $H - 100)
                $nodes += [pscustomobject]@{ X = $x; Y = $y }
                $g.FillEllipse($nodeBrush, ($x - 4), ($y - 4), 8, 8)
            }
            # 连线
            for ($i = 0; $i -lt $nodes.Count; $i++) {
                for ($j = $i + 1; $j -lt $nodes.Count; $j++) {
                    if ($rnd.NextDouble() -lt 0.3) {
                        $g.DrawLine($linePen, $nodes[$i].X, $nodes[$i].Y, $nodes[$j].X, $nodes[$j].Y)
                    }
                }
            }
            $nodeBrush.Dispose(); $linePen.Dispose()
        }
        'insights' {
            Add-GlowOrb $g ($W * 0.6) ($H * 0.4) 280 $Colors.MatooLight 70
            # 数据柱状图
            $barBrush = New-Object System.Drawing.SolidBrush $Colors.Matoo
            $rnd = New-Object System.Random 13
            for ($i = 0; $i -lt 12; $i++) {
                $bx = 1100 + $i * 50
                $bh = $rnd.Next(60, 250)
                $by = $H * 0.7 - $bh
                $g.FillRectangle($barBrush, $bx, $by, 30, $bh)
            }
            $barBrush.Dispose()
            # 折线
            $linePen = New-Object System.Drawing.Pen $Colors.Amber, 3
            $prevX = 1100; $prevY = $H * 0.5
            for ($i = 1; $i -lt 12; $i++) {
                $x = 1100 + $i * 50
                $y = $rnd.Next([int]($H * 0.3), [int]($H * 0.6))
                $g.DrawLine($linePen, $prevX, $prevY, $x, $y)
                $prevX = $x; $prevY = $y
            }
            $linePen.Dispose()
        }
        'about' {
            Add-GlowOrb $g ($W * 0.7) ($H * 0.5) 240 $Colors.MatooLight 60
            # 团队头像圆圈
            $rnd = New-Object System.Random 17
            $skinBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 230, 240, 255))
            $bodyBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 0, 82, 204))
            for ($i = 0; $i -lt 6; $i++) {
                $cx = 1100 + ($i % 3) * 130 + $rnd.Next(-10, 10)
                $cy = [int]($H * 0.35) + [int]([Math]::Floor($i / 3)) * 150 + $rnd.Next(-10, 10)
                $g.FillEllipse($bodyBrush, ($cx - 35), ($cy + 10), 70, 90)
                $g.FillEllipse($skinBrush, ($cx - 25), ($cy - 25), 50, 50)
            }
            $skinBrush.Dispose(); $bodyBrush.Dispose()
        }
    }

    # 文字标题
    $titleFont = New-Object System.Drawing.Font ("Segoe UI", [int]($W / 22), [System.Drawing.FontStyle]::Bold)
    $eyebrowFont = New-Object System.Drawing.Font ("Segoe UI", 20, [System.Drawing.FontStyle]::Regular)
    $titleBrush = New-Object System.Drawing.SolidBrush $Colors.White
    $eyebrowBrush = New-Object System.Drawing.SolidBrush $Colors.MatooLight
    $barBrush = New-Object System.Drawing.SolidBrush $Colors.Matoo

    $g.DrawString($Eyebrow, $eyebrowFont, $eyebrowBrush, 80, 80)
    $g.DrawString($Title, $titleFont, $titleBrush, 80, 120)
    $g.FillRectangle($barBrush, 80, (120 + [int]($W / 22) + 20), 100, 5)

    $titleFont.Dispose(); $eyebrowFont.Dispose()
    $titleBrush.Dispose(); $eyebrowBrush.Dispose(); $barBrush.Dispose()
    $bgBrush.Dispose()

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out ($W x $H)" -ForegroundColor Gray
}

Write-Host "[4] Generating 5 hero images..." -ForegroundColor Cyan
New-HeroImage 'hero-home.jpg'          1920 1080 'home'          'MATOO POWER'          'Powering Emerging Markets.'
New-HeroImage 'hero-manufacturing.jpg' 1920  900 'manufacturing' 'OUR FACTORY'           'Engineered in Shenzhen.'
New-HeroImage 'hero-partnership.jpg'   1920  900 'partnership'   'PARTNERSHIP'           'Built for global growth.'
New-HeroImage 'hero-insights.jpg'      1920  900 'insights'      'FIELD INSIGHTS'        'Data from 30+ markets.'
New-HeroImage 'hero-about.jpg'         1920  900 'about'         'OUR STORY'             'Two entities. One mission.'

# ============================================================
# 5. 产品占位图（4 张）
# ============================================================
function New-ProductImage {
    param([string]$Out, [int]$W, [int]$H, [string]$Name, [string]$Tagline,
          [System.Drawing.Color]$Accent = $Colors.Matoo)
    $ctx = New-Bitmap $W $H $Colors.Slate50
    $g = $ctx.Graphics

    # 背景渐变
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point $W, $H),
        $Colors.Slate50, $Colors.White
    )
    $g.FillRectangle($bgBrush, 0, 0, $W, $H)

    Add-GridLines $g $W $H 40 ([System.Drawing.Color]::FromArgb(255, 220, 226, 236)) 20

    # 产品主图
    $cx = [int]($W / 2)
    $cy = [int]($H * 0.45)

    # 阴影椭圆
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 9, 30, 66))
    $g.FillEllipse($shadowBrush, ($cx - 220), ($cy + 200), 440, 30)
    $shadowBrush.Dispose()

    # 主产品（电池）
    Draw-Battery $g ($cx - 100) ($cy - 180) 200 360 $Accent $Colors.MatooLight $Colors.Amber 4

    # 标签
    $nameFont = New-Object System.Drawing.Font ("Segoe UI", 28, [System.Drawing.FontStyle]::Bold)
    $tagFont  = New-Object System.Drawing.Font ("Segoe UI", 16, [System.Drawing.FontStyle]::Regular)
    $nameBrush = New-Object System.Drawing.SolidBrush $Colors.Navy
    $tagBrush  = New-Object System.Drawing.SolidBrush $Colors.Slate500

    $nameSize = $g.MeasureString($Name, $nameFont)
    $tagSize  = $g.MeasureString($Tagline, $tagFont)
    $g.DrawString($Name, $nameFont, $nameBrush, ($cx - $nameSize.Width / 2), ($H * 0.85))
    $g.DrawString($Tagline, $tagFont, $tagBrush, ($cx - $tagSize.Width / 2), ($H * 0.85 + 38))

    $nameFont.Dispose(); $tagFont.Dispose()
    $nameBrush.Dispose(); $tagBrush.Dispose()
    $bgBrush.Dispose()

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 92
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out ($W x $H)" -ForegroundColor Gray
}

Write-Host "[5] Generating 4 product images..." -ForegroundColor Cyan
New-ProductImage 'product-power01.jpg'          800 800 'Power01'         ('1 kWh' + [char]0x00B7 + ' Portable Power Station')
New-ProductImage 'product-power02.jpg'          800 800 'Power02'         ('2.4 kWh' + [char]0x00B7 + ' Home Storage')
New-ProductImage 'product-power-box.jpg'        800 800 'Power Box'       ('Modular' + [char]0x00B7 + ' Stack to 20 kWh')
New-ProductImage 'product-motor-controller.jpg' 800 800 'Matoo Ready'     ('EV' + [char]0x00B7 + ' Motor Controller')

# ============================================================
# 6. 工厂产线图（3 张）
# ============================================================
function New-FactoryImage {
    param([string]$Out, [int]$W, [int]$H, [string]$Scene)
    $ctx = New-Bitmap $W $H $Colors.Navy
    $g = $ctx.Graphics

    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point 0, $H),
        $Colors.Navy, $Colors.NavyDeep
    )
    $g.FillRectangle($bgBrush, 0, 0, $W, $H)

    Add-GridLines $g $W $H 50 $Colors.MatooLight 8

    switch ($Scene) {
        'floor-overview' {
            # 工厂俯视图：地板网格 + 多条产线
            $lineBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120, 38, 132, 255))
            $rnd = New-Object System.Random 23
            for ($i = 0; $i -lt 4; $i++) {
                $y = 150 + $i * 150
                $g.FillRectangle($lineBrush, 80, $y, ($W - 160), 80)
                # 工位
                for ($j = 0; $j -lt 6; $j++) {
                    $wx = 150 + $j * 160 + $rnd.Next(-5, 5)
                    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 255, 171, 0))), ($wx - 8), ($y + 36), 16, 16)
                }
            }
            $lineBrush.Dispose()
        }
        'assembly-line' {
            # 装配线特写
            Draw-ModularPacks $g 100 ($H * 0.25) ($W - 200) ($H * 0.5)
            # 传送带
            $beltBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(60, 38, 132, 255))
            $g.FillRectangle($beltBrush, 60, ($H * 0.85), ($W - 120), 12)
            $beltBrush.Dispose()
            $beltLine = New-Object System.Drawing.Pen $Colors.Amber, 2
            $g.DrawLine($beltLine, 60, ($H * 0.85 + 6), ($W - 60), ($H * 0.85 + 6))
            $beltLine.Dispose()
        }
        'warehouse' {
            # 仓储
            $rnd = New-Object System.Random 29
            $boxBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 230, 240, 255))
            $accentBrush = New-Object System.Drawing.SolidBrush $Colors.Amber
            for ($row = 0; $row -lt 4; $row++) {
                for ($col = 0; $col -lt 7; $col++) {
                    $x = 100 + $col * 130 + $rnd.Next(-5, 5)
                    $y = 100 + $row * 110
                    $g.FillRectangle($boxBrush, $x, $y, 100, 90)
                    $g.FillRectangle($accentBrush, $x, $y, 100, 6)
                }
            }
            $boxBrush.Dispose(); $accentBrush.Dispose()
        }
    }

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out ($W x $H)" -ForegroundColor Gray
}

Write-Host "[6] Generating 3 factory images..." -ForegroundColor Cyan
New-FactoryImage 'factory-floor.jpg'     1200 800 'floor-overview'
New-FactoryImage 'factory-assembly.jpg'  1200 800 'assembly-line'
New-FactoryImage 'factory-warehouse.jpg' 1200 800 'warehouse'

# ============================================================
# 7. 洞察文章封面（6 张）
# ============================================================
function New-InsightCover {
    param([string]$Out, [int]$W, [int]$H, [string]$Category, [string]$Pattern)
    $ctx = New-Bitmap $W $H $Colors.Navy
    $g = $ctx.Graphics

    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point $W, $H),
        $Colors.Navy, $Colors.NavyDeep
    )
    $g.FillRectangle($bgBrush, 0, 0, $W, $H)

    Add-GridLines $g $W $H 40 $Colors.MatooLight 8

    $rnd = New-Object System.Random ($Out.GetHashCode())
    switch ($Pattern) {
        'market' {
            # 柱状图
            $barBrush = New-Object System.Drawing.SolidBrush $Colors.Matoo
            for ($i = 0; $i -lt 8; $i++) {
                $bx = 80 + $i * 100
                $bh = $rnd.Next(120, 320)
                $by = $H - 100 - $bh
                $g.FillRectangle($barBrush, $bx, $by, 60, $bh)
            }
            $barBrush.Dispose()
            # 趋势线
            $linePen = New-Object System.Drawing.Pen $Colors.Amber, 4
            $prevX = 80; $prevY = ($H - 100 - 200)
            for ($i = 1; $i -lt 8; $i++) {
                $x = 80 + $i * 100
                $y = $H - 100 - $rnd.Next(120, 320)
                $g.DrawLine($linePen, $prevX, $prevY, $x, $y)
                $prevX = $x; $prevY = $y
            }
            $linePen.Dispose()
        }
        'tech' {
            # 电路图 + 节点
            $nodeBrush = New-Object System.Drawing.SolidBrush $Colors.MatooLight
            $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(80, 38, 132, 255)), 1
            $nodes = @()
            for ($i = 0; $i -lt 18; $i++) {
                $x = $rnd.Next(80, $W - 80)
                $y = $rnd.Next(80, $H - 80)
                $nodes += @{ X = $x; Y = $y }
                $g.FillEllipse($nodeBrush, ($x - 5), ($y - 5), 10, 10)
            }
            for ($i = 0; $i -lt $nodes.Count; $i++) {
                for ($j = $i + 1; $j -lt $nodes.Count; $j++) {
                    $dx = $nodes[$i].X - $nodes[$j].X
                    $dy = $nodes[$i].Y - $nodes[$j].Y
                    if ([Math]::Sqrt($dx * $dx + $dy * $dy) -lt 200) {
                        $g.DrawLine($linePen, $nodes[$i].X, $nodes[$i].Y, $nodes[$j].X, $nodes[$j].Y)
                    }
                }
            }
            $nodeBrush.Dispose(); $linePen.Dispose()
        }
        'field' {
            # 人 + 设备剪影
            $humanBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 255, 255, 255))
            for ($i = 0; $i -lt 5; $i++) {
                $hx = 100 + $i * 200 + $rnd.Next(-15, 15)
                $hy = $H * 0.55 + $rnd.Next(-20, 20)
                $g.FillEllipse($humanBrush, $hx, $hy, 36, 36)
                $g.FillRectangle($humanBrush, ($hx - 8), ($hy + 36), 52, 80)
            }
            $humanBrush.Dispose()
            # 太阳能板
            $panelBrush = New-Object System.Drawing.SolidBrush $Colors.Matoo
            $g.FillRectangle($panelBrush, ($W - 280), ($H - 280), 220, 140)
            $panelBrush.Dispose()
            $panelLine = New-Object System.Drawing.Pen $Colors.Amber, 2
            for ($i = 1; $i -lt 6; $i++) {
                $g.DrawLine($panelLine, ($W - 280), ($H - 280 + $i * 28), ($W - 60), ($H - 280 + $i * 28))
            }
            for ($i = 1; $i -lt 8; $i++) {
                $g.DrawLine($panelLine, ($W - 280 + $i * 31), ($H - 280), ($W - 280 + $i * 31), ($H - 140))
            }
            $panelLine.Dispose()
        }
        'oem' {
            # OEM 制造风格：机械 + 齿轮
            Draw-Battery $g ($W * 0.6) ($H * 0.2) 200 320 $Colors.Matoo $Colors.MatooLight $Colors.Amber 3
            # 齿轮圈
            $gearBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120, 38, 132, 255))
            $gearCenterX = 200; $gearCenterY = $H * 0.5
            $g.FillEllipse($gearBrush, ($gearCenterX - 100), ($gearCenterY - 100), 200, 200)
            $gearBrush.Dispose()
            $gearInnerBrush = New-Object System.Drawing.SolidBrush $Colors.Navy
            $g.FillEllipse($gearInnerBrush, ($gearCenterX - 50), ($gearCenterY - 50), 100, 100)
            $gearInnerBrush.Dispose()
            # 齿
            $toothBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120, 38, 132, 255))
            for ($i = 0; $i -lt 12; $i++) {
                $angle = $i * 30 * [Math]::PI / 180
                $tx = $gearCenterX + [Math]::Cos($angle) * 130
                $ty = $gearCenterY + [Math]::Sin($angle) * 130
                $g.FillRectangle($toothBrush, ($tx - 10), ($ty - 10), 20, 20)
            }
            $toothBrush.Dispose()
        }
        'ops' {
            # 物流：箭头 + 集装箱
            $arrowBrush = New-Object System.Drawing.SolidBrush $Colors.Amber
            for ($i = 0; $i -lt 3; $i++) {
                $ax = 100 + $i * 220
                $ay = $H * 0.4 + $i * 60
                $pts = @(
                    (New-Object System.Drawing.Point $ax, $ay),
                    (New-Object System.Drawing.Point ($ax + 120), $ay),
                    (New-Object System.Drawing.Point ($ax + 120), ($ay - 30)),
                    (New-Object System.Drawing.Point ($ax + 180), ($ay + 15)),
                    (New-Object System.Drawing.Point ($ax + 120), ($ay + 60)),
                    (New-Object System.Drawing.Point ($ax + 120), $ay)
                )
                $g.FillPolygon($arrowBrush, $pts)
            }
            $arrowBrush.Dispose()
        }
        'investment' {
            # 金币堆叠 + 上升趋势
            $coinBrush = New-Object System.Drawing.SolidBrush $Colors.Amber
            for ($row = 0; $row -lt 5; $row++) {
                for ($col = 0; $col -lt 4; $col++) {
                    $cx = 100 + $col * 90
                    $cy = $H - 100 - $row * 50
                    $g.FillEllipse($coinBrush, $cx, $cy, 60, 60)
                }
            }
            $coinBrush.Dispose()
            # 上升线
            $risePen = New-Object System.Drawing.Pen $Colors.Success, 6
            $g.DrawLine($risePen, 80, ($H - 80), ($W - 80), 80)
            $risePen.Dispose()
        }
    }

    # Category tag
    $tagFont = New-Object System.Drawing.Font ("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
    $tagBrush = New-Object System.Drawing.SolidBrush $Colors.MatooLight
    $g.DrawString($Category.ToUpper(), $tagFont, $tagBrush, 60, 60)

    $tagFont.Dispose(); $tagBrush.Dispose()
    $bgBrush.Dispose()

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out ($W x $H)" -ForegroundColor Gray
}

Write-Host "[7] Generating 6 insight covers..." -ForegroundColor Cyan
New-InsightCover 'insight-cover-01.jpg' 1200 800 'Market Report'    'market'
New-InsightCover 'insight-cover-02.jpg' 1200 800 'Technology'       'tech'
New-InsightCover 'insight-cover-03.jpg' 1200 800 'Field Report'     'field'
New-InsightCover 'insight-cover-04.jpg' 1200 800 'OEM Case Study'   'oem'
New-InsightCover 'insight-cover-05.jpg' 1200 800 'Operations'       'ops'
New-InsightCover 'insight-cover-06.jpg' 1200 800 'Investment'       'investment'

# ============================================================
# 8. 全球区域图（4 张）
# ============================================================
function New-RegionImage {
    param([string]$Out, [int]$W, [int]$H, [string]$Region, [string]$Label,
          [System.Drawing.Color]$Accent = $Colors.Matoo)
    $ctx = New-Bitmap $W $H $Colors.Navy
    $g = $ctx.Graphics

    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point $W, $H),
        $Colors.NavyDeep, $Colors.Navy
    )
    $g.FillRectangle($bgBrush, 0, 0, $W, $H)

    Add-GridLines $g $W $H 50 $Colors.MatooLight 10
    Add-CircuitPattern $g $W $H 30 $Colors.MatooLight 20

    # 抽象地图形状
    $regionBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, $Accent.R, $Accent.G, $Accent.B))
    $borderPen = New-Object System.Drawing.Pen $Colors.MatooLight, 2

    switch ($Region) {
        'south-asia' {
            $pts = @(
                (New-Object System.Drawing.Point 280, 200),
                (New-Object System.Drawing.Point 480, 180),
                (New-Object System.Drawing.Point 580, 280),
                (New-Object System.Drawing.Point 620, 380),
                (New-Object System.Drawing.Point 560, 480),
                (New-Object System.Drawing.Point 380, 520),
                (New-Object System.Drawing.Point 220, 460),
                (New-Object System.Drawing.Point 200, 320)
            )
            $g.FillPolygon($regionBrush, $pts)
            $g.DrawPolygon($borderPen, $pts)
        }
        'africa' {
            $pts = @(
                (New-Object System.Drawing.Point 320, 200),
                (New-Object System.Drawing.Point 520, 220),
                (New-Object System.Drawing.Point 580, 380),
                (New-Object System.Drawing.Point 540, 540),
                (New-Object System.Drawing.Point 420, 600),
                (New-Object System.Drawing.Point 320, 540),
                (New-Object System.Drawing.Point 280, 380),
                (New-Object System.Drawing.Point 300, 280)
            )
            $g.FillPolygon($regionBrush, $pts)
            $g.DrawPolygon($borderPen, $pts)
        }
        'mena' {
            $pts = @(
                (New-Object System.Drawing.Point 260, 200),
                (New-Object System.Drawing.Point 540, 240),
                (New-Object System.Drawing.Point 520, 420),
                (New-Object System.Drawing.Point 400, 500),
                (New-Object System.Drawing.Point 300, 440),
                (New-Object System.Drawing.Point 240, 320)
            )
            $g.FillPolygon($regionBrush, $pts)
            $g.DrawPolygon($borderPen, $pts)
        }
        'sea' {
            $pts = @(
                (New-Object System.Drawing.Point 320, 280),
                (New-Object System.Drawing.Point 600, 260),
                (New-Object System.Drawing.Point 680, 400),
                (New-Object System.Drawing.Point 600, 520),
                (New-Object System.Drawing.Point 400, 540),
                (New-Object System.Drawing.Point 280, 460),
                (New-Object System.Drawing.Point 260, 360)
            )
            $g.FillPolygon($regionBrush, $pts)
            $g.DrawPolygon($borderPen, $pts)
        }
    }

    # 城市节点
    $nodeBrush = New-Object System.Drawing.SolidBrush $Colors.Amber
    $rnd = New-Object System.Random ($Region.GetHashCode())
    for ($i = 0; $i -lt 8; $i++) {
        $nx = $rnd.Next(280, $W - 280)
        $ny = $rnd.Next(200, $H - 150)
        $g.FillEllipse($nodeBrush, ($nx - 6), ($ny - 6), 12, 12)
    }
    $nodeBrush.Dispose()

    # Label
    $labelFont = New-Object System.Drawing.Font ("Segoe UI", 48, [System.Drawing.FontStyle]::Bold)
    $subFont   = New-Object System.Drawing.Font ("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
    $labelBrush = New-Object System.Drawing.SolidBrush $Colors.White
    $subBrush   = New-Object System.Drawing.SolidBrush $Colors.MatooLight

    $g.DrawString($Label, $labelFont, $labelBrush, 60, 60)
    $g.DrawString("Open Market  $([char]0x00B7)  Local Team", $subFont, $subBrush, 60, 130)

    $labelFont.Dispose(); $subFont.Dispose()
    $labelBrush.Dispose(); $subBrush.Dispose()
    $regionBrush.Dispose(); $borderPen.Dispose()
    $bgBrush.Dispose()

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out ($W x $H)" -ForegroundColor Gray
}

Write-Host "[8] Generating 4 region images..." -ForegroundColor Cyan
New-RegionImage 'region-south-asia.jpg' 1200 800 'south-asia' 'South Asia' $Colors.Matoo
New-RegionImage 'region-africa.jpg'     1200 800 'africa'     'Africa'     $Colors.Amber
New-RegionImage 'region-mena.jpg'       1200 800 'mena'       'MENA'       $Colors.Success
New-RegionImage 'region-sea.jpg'        1200 800 'sea'        'SEA'        $Colors.MatooLight

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "DONE. All placeholder images generated." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Get-ChildItem $OutputDir | Sort-Object Name | Format-Table Name, Length -AutoSize