# Matoo Power - 产品图 + 场景图批量生成器（部署前冷启动占位）
# 重新设计：使用局部变量避免 PowerShell 多行参数问题

Add-Type -AssemblyName System.Drawing

$OutputDir = "e:\MatooPower\website\assets"
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

# ============================================
# 品牌色
# ============================================
$Navy      = [System.Drawing.Color]::FromArgb(255, 9, 30, 66)
$NavyDeep  = [System.Drawing.Color]::FromArgb(255, 4, 17, 38)
$Matoo     = [System.Drawing.Color]::FromArgb(255, 0, 82, 204)
$MatooLight = [System.Drawing.Color]::FromArgb(255, 38, 132, 255)
$Amber     = [System.Drawing.Color]::FromArgb(255, 255, 171, 0)
$Success   = [System.Drawing.Color]::FromArgb(255, 54, 179, 126)
$ErrorCol  = [System.Drawing.Color]::FromArgb(255, 255, 86, 48)
$Slate500  = [System.Drawing.Color]::FromArgb(255, 107, 119, 140)
$Slate400  = [System.Drawing.Color]::FromArgb(255, 122, 134, 154)
$Slate200  = [System.Drawing.Color]::FromArgb(255, 223, 225, 230)
$Slate100  = [System.Drawing.Color]::FromArgb(255, 235, 236, 240)
$Slate50   = [System.Drawing.Color]::FromArgb(255, 244, 245, 247)
$White     = [System.Drawing.Color]::White

# ============================================
# 工具
# ============================================
function Save-Jpg {
    param($Bitmap, [string]$Path, [int]$Quality = 90)
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters 1
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $Bitmap.Save($Path, $codec, $encParams)
}

function New-Bitmap {
    param([int]$W, [int]$H, [System.Drawing.Color]$BgColor)
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.FillRectangle((New-Object System.Drawing.SolidBrush $BgColor), 0, 0, $W, $H)
    return @{ Bitmap = $bmp; Graphics = $g }
}

function Add-PlaceholderBadge {
    param($Canvas, [int]$W, [int]$H, [string]$Category, [string]$Title, [string]$Description)

    $bx = 24; $by = 24; $bw = 300; $bh = 90

    # 红色虚线框
    $dashPen = New-Object System.Drawing.Pen $ErrorCol, 3
    $dashPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $Canvas.DrawRectangle($dashPen, $bx, $by, $bw, $bh)
    $dashPen.Dispose()

    # 半透明红底
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 255, 86, 48))
    $Canvas.FillRectangle($bgBrush, ($bx + 3), ($by + 3), ($bw - 6), ($bh - 6))
    $bgBrush.Dispose()

    # PLACEHOLDER 字样
    $tagFont = New-Object System.Drawing.Font ("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
    $tagBrush = New-Object System.Drawing.SolidBrush $White
    $Canvas.DrawString("PLACEHOLDER", $tagFont, $tagBrush, ($bx + 12), ($by + 8))
    $tagFont.Dispose(); $tagBrush.Dispose()

    # 描述
    $descFont = New-Object System.Drawing.Font ("Segoe UI", 9, [System.Drawing.FontStyle]::Regular)
    $descBrush = New-Object System.Drawing.SolidBrush $White
    $Canvas.DrawString("Replace with real photography", $descFont, $descBrush, ($bx + 12), ($by + 30))
    $Canvas.DrawString(("$Category - $Title"), $descFont, $descBrush, ($bx + 12), ($by + 46))
    $Canvas.DrawString($Description, $descFont, $descBrush, ($bx + 12), ($by + 62))
    $descFont.Dispose(); $descBrush.Dispose()
}

function Add-Caption {
    param($Canvas, [int]$X, [int]$Y, [int]$W,
          [string]$Title, [string]$Subtitle = "",
          [System.Drawing.Color]$TitleColor = $Navy,
          [System.Drawing.Color]$SubColor = $Slate500,
          [int]$TitleSize = 32, [int]$SubSize = 14)

    $titleFont = New-Object System.Drawing.Font ("Segoe UI", $TitleSize, [System.Drawing.FontStyle]::Bold)
    $subFont   = New-Object System.Drawing.Font ("Segoe UI", $SubSize,  [System.Drawing.FontStyle]::Regular)
    $titleBrush = New-Object System.Drawing.SolidBrush $TitleColor
    $subBrush   = New-Object System.Drawing.SolidBrush $SubColor

    $Canvas.DrawString($Title, $titleFont, $titleBrush, $X, $Y)
    if ($Subtitle) { $Canvas.DrawString($Subtitle, $subFont, $subBrush, $X, ($Y + $TitleSize + 8)) }

    $titleFont.Dispose(); $subFont.Dispose()
    $titleBrush.Dispose(); $subBrush.Dispose()
}

function Add-GridLines {
    param($Canvas, [int]$W, [int]$H, [int]$Spacing, [System.Drawing.Color]$Color, [int]$Alpha)
    $c = [System.Drawing.Color]::FromArgb($Alpha, $Color.R, $Color.G, $Color.B)
    $pen = New-Object System.Drawing.Pen $c, 1
    for ($x = 0; $x -lt $W; $x += $Spacing) { $Canvas.DrawLine($pen, $x, 0, $x, $H) }
    for ($y = 0; $y -lt $H; $y += $Spacing) { $Canvas.DrawLine($pen, 0, $y, $W, $y) }
    $pen.Dispose()
}

function Add-GlowOrb {
    param($Canvas, [int]$X, [int]$Y, [int]$R, [System.Drawing.Color]$Color, [int]$Alpha)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(($X - $R), ($Y - $R), ($R * 2), ($R * 2))
    $pb = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
    $pb.CenterColor = [System.Drawing.Color]::FromArgb($Alpha, $Color.R, $Color.G, $Color.B)
    $pb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $Color.R, $Color.G, $Color.B))
    $Canvas.FillEllipse($pb, ($X - $R), ($Y - $R), ($R * 2), ($R * 2))
    $pb.Dispose(); $path.Dispose()
}

function Draw-BatteryUnit {
    param($Canvas, [int]$X, [int]$Y, [int]$W, [int]$H,
          [System.Drawing.Color]$BodyColor, [System.Drawing.Color]$BoltColor, [int]$Charge)

    if ($null -eq $Canvas) { throw "Draw-BatteryUnit: Canvas is null. BodyColor=$BodyColor, BoltColor=$BoltColor" }
    if ($Canvas -is [int]) { throw "Draw-BatteryUnit: Canvas is Int32=$Canvas. BodyColor=$BodyColor" }

    $strokePen = New-Object System.Drawing.Pen $MatooLight, 3
    $bodyBrush = New-Object System.Drawing.SolidBrush $BodyColor
    $capBrush  = New-Object System.Drawing.SolidBrush $BodyColor

    # 顶部 cap
    $capW = $W * 0.35; $capH = 12
    $Canvas.FillRectangle($capBrush, ($X + ($W - $capW) / 2), ($Y - $capH), $capW, $capH)

    # 主体
    $Canvas.FillRectangle($bodyBrush, $X, $Y, $W, $H)
    $Canvas.DrawRectangle($strokePen, $X, $Y, $W, $H)

    # Cells
    $cellH = ($H - 40) / 4
    $cellBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 230, 240, 255))
    $padX = 12
    for ($i = 0; $i -lt $Charge; $i++) {
        $cellY = $Y + 12 + $i * ($cellH + 4)
        $Canvas.FillRectangle($cellBrush, ($X + $padX), $cellY, ($W - $padX * 2), $cellH)
    }
    $cellBrush.Dispose()

    # 闪电符号
    $cx = $X + ($W / 2)
    $boltBrush = New-Object System.Drawing.SolidBrush $BoltColor
    $p1x = $cx + 5;  $p1y = $Y + $H - 60
    $p2x = $cx - 12; $p2y = $Y + $H - 25
    $p3x = $cx + 2;  $p3y = $Y + $H - 25
    $p4x = $cx - 15; $p4y = $Y + $H - 4
    $p1 = New-Object System.Drawing.Point -ArgumentList ([int]$p1x), ([int]$p1y)
    $p2 = New-Object System.Drawing.Point -ArgumentList ([int]$p2x), ([int]$p2y)
    $p3 = New-Object System.Drawing.Point -ArgumentList ([int]$p3x), ([int]$p3y)
    $p4 = New-Object System.Drawing.Point -ArgumentList ([int]$p4x), ([int]$p4y)
    $Canvas.FillPolygon($boltBrush, @($p1, $p2, $p3, $p4))

    $strokePen.Dispose(); $bodyBrush.Dispose(); $capBrush.Dispose(); $boltBrush.Dispose()
}

function Draw-StackedUnits {
    param($Canvas, [int]$X, [int]$Y, [int]$W, [int]$H, [int]$Count)

    $unitH = ($H - ($Count - 1) * 4) / $Count
    for ($i = 0; $i -lt $Count; $i++) {
        $uy = $Y + $i * ($unitH + 4)
        $r = [Math]::Max(0, $Matoo.R + $i * 10)
        $g = [Math]::Max(0, $Matoo.G + $i * 8)
        $b = [Math]::Min(255, $Matoo.B - $i * 15)
        $shade = [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
        Draw-BatteryUnit -Canvas $Canvas -X $X -Y $uy -W $W -H $unitH -BodyColor $shade -BoltColor $Amber -Charge 3
    }
}

# ============================================================
# 1. 产品多角度图（13 张）
# ============================================================
function New-ProductShot {
    param([string]$Out, [int]$W, [int]$H,
          [string]$Product, [string]$ShotType, [string]$Description,
          [int]$UnitCount)

    $ctx = New-Bitmap $W $H $Slate50
    $g = $ctx.Graphics

    # 背景渐变
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList (
        (New-Object System.Drawing.Point -ArgumentList 0, 0),
        (New-Object System.Drawing.Point -ArgumentList 0, $H),
        $Slate50, $White
    )
    $g.FillRectangle($bgBrush, 0, 0, $W, $H)
    $bgBrush.Dispose()

    # 网格背景
    Add-GridLines $g $W $H 40 $Slate200 50

    # 阴影
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 9, 30, 66))
    $g.FillEllipse($shadowBrush, ([int]($W / 2 - 180)), ([int]($H * 0.85)), 360, 28)
    $shadowBrush.Dispose()

    # 产品主体
    $cx = [int]($W / 2)
    $ux = $cx - 70
    $uy = [int]($H * 0.25)
    if ($UnitCount -eq 1) {
        Draw-BatteryUnit $g $ux $uy 140 280 $Matoo $Amber 4
    } else {
        Draw-StackedUnits -Canvas $g $ux ([int]($H * 0.20)) 140 ([int]($H * 0.65)) $UnitCount
    }

    # 标签
    Add-Caption $g 20 ($H - 70) ($W - 40) $Product $ShotType $Navy $Slate500 26 14

    Add-PlaceholderBadge $g $W $H "Product Shot" "$Product - $ShotType" $Description

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 92
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out" -ForegroundColor Gray
}

Write-Host "[1] Generating 13 product shots..." -ForegroundColor Cyan

New-ProductShot 'product-power01-front.jpg'     800 800 'Power01'     'Front View'         '7.5kg 便携主机正面图'                1
New-ProductShot 'product-power01-side.jpg'      800 800 'Power01'     'Side View'          '侧面：提手、散热孔、接口'             1
New-ProductShot 'product-power01-carrying.jpg'  800 800 'Power01'     'Being Carried'      '被单人提握的实景'                    1
New-ProductShot 'product-power01-charging.jpg'  800 800 'Power01'     'Charging Setup'     '太阳能板 + AC 适配器同时充电'        1
New-ProductShot 'product-power02-front.jpg'     800 800 'Power02'     'Front View'         '14kg 家用主机正面图'                 1
New-ProductShot 'product-power02-side.jpg'      800 800 'Power02'     'Side View'          '侧面：提手、通风口、扩展口'           1
New-ProductShot 'product-power02-stack2.jpg'    800 800 'Power02 x 2' '2-Unit Stack'       '两台并联堆叠 = 4.8kWh'               2
New-ProductShot 'product-powerbox-front.jpg'    800 800 'Power Box'   'Single Module'      '单模块 5kWh 基单元'                  1
New-ProductShot 'product-powerbox-stack2.jpg'   800 800 'Power Box'   '2-Module Stack'     '2 模块堆叠 = 10kWh'                  2
New-ProductShot 'product-powerbox-stack4.jpg'   800 800 'Power Box'   '4-Module Stack'     '4 模块堆叠 = 20kWh'                  4
New-ProductShot 'product-powerbox-interior.jpg' 800 800 'Power Box'   'Internal View'      'BMS / 电芯 / 接线端子特写'          1
New-ProductShot 'product-motor-controller-front.jpg'    800 800 'Motor Controller' 'Front View'         '控制板、接口标识特写'              1
New-ProductShot 'product-motor-controller-mounted.jpg'  800 800 'Motor Controller' 'Mounted on Vehicle' '安装在车辆上的实景'                1

# ============================================================
# 2a. 家庭场景（3 张）
# ============================================================
function New-HomeScenario {
    param([string]$Out, [string]$Title, [string]$Setting, [string]$Description,
          [int]$UnitCount, [System.Drawing.Color]$WallColor)

    $W = 1200; $H = 800
    $ctx = New-Bitmap $W $H $WallColor
    $g = $ctx.Graphics

    # 地板
    $floorBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 35, 50, 80))
    $g.FillRectangle($floorBrush, 0, [int]($H * 0.7), $W, [int]($H * 0.3))
    $floorBrush.Dispose()

    # 暖光窗户
    $winBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(60, 255, 200, 100))
    $g.FillRectangle($winBrush, 100, 80, 250, 300)
    $winBrush.Dispose()

    # 地平线
    $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(100, 255, 255, 255)), 1
    $g.DrawLine($linePen, 0, [int]($H * 0.7), $W, [int]($H * 0.7))
    $linePen.Dispose()

    # 阴影
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
    $g.FillEllipse($shadowBrush, ([int]($W * 0.6 - 100)), ([int]($H * 0.65)), 200, 24)
    $shadowBrush.Dispose()

    Draw-StackedUnits -Canvas $g ([int]($W * 0.6 - 60)) ([int]($H * 0.4)) 120 220 $UnitCount

    # LED 指示灯
    $ledBrush = New-Object System.Drawing.SolidBrush $Amber
    $g.FillEllipse($ledBrush, ([int]($W * 0.6 + 10)), ([int]($H * 0.4 - 5)), 8, 8)
    $g.FillEllipse($ledBrush, ([int]($W * 0.6 + 30)), ([int]($H * 0.4 - 5)), 8, 8)
    $ledBrush.Dispose()

    Add-GlowOrb $g 250 200 100 $Amber 100

    Add-Caption $g 20 20 ($W - 40) $Title $Setting $White $MatooLight 32 16
    Add-Caption $g 20 ($H - 70) ($W - 40) $Description "" $MatooLight $Slate400 14 12

    Add-PlaceholderBadge $g $W $H "场景图" $Title $Description

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out" -ForegroundColor Gray
}

Write-Host "`n[2a] Generating home scenarios (3)..." -ForegroundColor Cyan
New-HomeScenario 'scenario-home-evening.jpg'  'Home Evening Backup'   '家庭夜间停电备用'      '客厅断电时为灯光、电视、WiFi 供电'    1 $Navy
New-HomeScenario 'scenario-home-kitchen.jpg' 'Kitchen Outage'        '厨房停电应急'          '为冰箱、小家电、应急照明供电'         1 $Navy
New-HomeScenario 'scenario-home-office.jpg'  'Home Office UPS'       '家庭办公 UPS'          '为笔记本、网络设备、显示器持续供电'    1 $Navy

# ============================================================
# 2b. 户外场景（5 张）
# ============================================================
function New-OutdoorScenario {
    param([string]$Out, [string]$Title, [string]$Setting, [string]$Description,
          [System.Drawing.Color]$SkyColor, [System.Drawing.Color]$GroundColor,
          [int]$UnitCount, [string]$Scene)

    $W = 1200; $H = 800
    $ctx = New-Bitmap $W $H $SkyColor
    $g = $ctx.Graphics

    # 地面
    $groundBrush = New-Object System.Drawing.SolidBrush $GroundColor
    $g.FillRectangle($groundBrush, 0, [int]($H * 0.7), $W, [int]($H * 0.3))
    $groundBrush.Dispose()

    # 远山
    $mountainBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 30, 50, 80))
    $m1 = New-Object System.Drawing.Point -ArgumentList 0, ([int]($H * 0.7))
    $m2 = New-Object System.Drawing.Point -ArgumentList 200, ([int]($H * 0.4))
    $m3 = New-Object System.Drawing.Point -ArgumentList 400, ([int]($H * 0.55))
    $m4 = New-Object System.Drawing.Point -ArgumentList 650, ([int]($H * 0.35))
    $m5 = New-Object System.Drawing.Point -ArgumentList 900, ([int]($H * 0.5))
    $m6 = New-Object System.Drawing.Point -ArgumentList 1200, ([int]($H * 0.6))
    $g.FillPolygon($mountainBrush, @($m1, $m2, $m3, $m4, $m5, $m6))
    $mountainBrush.Dispose()

    switch ($Scene) {
        'tent' {
            $tentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 80, 100, 130))
            $t1 = New-Object System.Drawing.Point -ArgumentList 200, ([int]($H * 0.7))
            $t2 = New-Object System.Drawing.Point -ArgumentList 300, ([int]($H * 0.45))
            $t3 = New-Object System.Drawing.Point -ArgumentList 400, ([int]($H * 0.7))
            $g.FillPolygon($tentBrush, @($t1, $t2, $t3))
            $tentBrush.Dispose()
            Add-GlowOrb $g 300 ([int]($H * 0.55)) 40 $Amber 200
        }
        'rv' {
            $rvBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 200, 210, 220))
            $g.FillRectangle($rvBrush, 800, [int]($H * 0.4), 320, 200)
            $rvBrush.Dispose()
            $winBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 255, 220, 100))
            $g.FillRectangle($winBrush, 830, [int]($H * 0.45), 80, 60)
            $g.FillRectangle($winBrush, 930, [int]($H * 0.45), 80, 60)
            $winBrush.Dispose()
            $wheelBrush = New-Object System.Drawing.SolidBrush $Navy
            $g.FillEllipse($wheelBrush, 830, [int]($H * 0.62), 40, 40)
            $g.FillEllipse($wheelBrush, 1050, [int]($H * 0.62), 40, 40)
            $wheelBrush.Dispose()
        }
        'island' {
            $seaBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 30, 60, 100))
            $g.FillRectangle($seaBrush, 0, [int]($H * 0.65), $W, [int]($H * 0.15))
            $seaBrush.Dispose()
            Add-GlowOrb $g 1000 150 80 $Amber 200
        }
        'boat' {
            $seaBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 30, 60, 100))
            $g.FillRectangle($seaBrush, 0, [int]($H * 0.65), $W, [int]($H * 0.15))
            $seaBrush.Dispose()
            $boatBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 100, 60, 50))
            $b1 = New-Object System.Drawing.Point -ArgumentList 700, ([int]($H * 0.6))
            $b2 = New-Object System.Drawing.Point -ArgumentList 1100, ([int]($H * 0.6))
            $b3 = New-Object System.Drawing.Point -ArgumentList 1050, ([int]($H * 0.7))
            $b4 = New-Object System.Drawing.Point -ArgumentList 750, ([int]($H * 0.7))
            $g.FillPolygon($boatBrush, @($b1, $b2, $b3, $b4))
            $boatBrush.Dispose()
        }
        'market' {
            $stallBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 60, 40, 30))
            $g.FillRectangle($stallBrush, 200, [int]($H * 0.4), 350, 250)
            $stallBrush.Dispose()
            $topBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 200, 150, 80))
            $top1 = New-Object System.Drawing.Point -ArgumentList 180, ([int]($H * 0.4))
            $top2 = New-Object System.Drawing.Point -ArgumentList 570, ([int]($H * 0.4))
            $top3 = New-Object System.Drawing.Point -ArgumentList 600, ([int]($H * 0.45))
            $top4 = New-Object System.Drawing.Point -ArgumentList 150, ([int]($H * 0.45))
            $g.FillPolygon($topBrush, @($top1, $top2, $top3, $top4))
            $topBrush.Dispose()
            Add-GlowOrb $g 375 ([int]($H * 0.45)) 100 $Amber 200
        }
    }

    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
    $g.FillEllipse($shadowBrush, ([int]($W * 0.45 - 100)), ([int]($H * 0.65)), 200, 24)
    $shadowBrush.Dispose()
    Draw-StackedUnits -Canvas $g ([int]($W * 0.45 - 60)) ([int]($H * 0.4)) 120 220 $UnitCount

    Add-Caption $g 20 20 ($W - 40) $Title $Setting $White $MatooLight 32 16
    Add-Caption $g 20 ($H - 70) ($W - 40) $Description "" $MatooLight $Slate400 14 12

    Add-PlaceholderBadge $g $W $H "场景图" $Title $Description

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out" -ForegroundColor Gray
}

Write-Host "[2b] Generating outdoor scenarios (5)..." -ForegroundColor Cyan
New-OutdoorScenario 'scenario-camping.jpg'      'Camping'              '野外露营'      '帐篷夜灯、手机充电、便携冰箱'      $NavyDeep $Slate500 1 'tent'
New-OutdoorScenario 'scenario-rv.jpg'           'RV Travel'            '房车自驾旅行'  '为房车空调、照明、厨房电器供电'    $Navy     $Slate500 2 'rv'
New-OutdoorScenario 'scenario-island.jpg'       'Off-Grid Island'      '离网海岛'      '海岛全屋离网供电 + 海水淡化'      $Navy     $Slate50  4 'island'
New-OutdoorScenario 'scenario-boat.jpg'         'Marine / Boat'        '渔船/船用'     '船上导航、冷藏、通讯设备'         $NavyDeep $Slate500 1 'boat'
New-OutdoorScenario 'scenario-nightmarket.jpg'  'Night Market Stall'   '夜市摊位'     '商用照明、收款机、音响'           $NavyDeep $Slate500 1 'market'

# ============================================================
# 2c. 商用场景（5 张）
# ============================================================
function New-CommercialScenario {
    param([string]$Out, [string]$Title, [string]$Setting, [string]$Description,
          [System.Drawing.Color]$BgColor, [string]$Scene)

    $W = 1200; $H = 800
    $ctx = New-Bitmap $W $H $BgColor
    $g = $ctx.Graphics

    Add-GridLines $g $W $H 40 $MatooLight 15

    switch ($Scene) {
        'tower' {
            $towerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 100, 110, 120))
            $g.FillRectangle($towerBrush, [int]($W * 0.3), [int]($H * 0.1), 16, [int]($H * 0.85))
            $towerBrush.Dispose()
            $crossBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 80, 90, 100))
            $g.FillRectangle($crossBrush, [int]($W * 0.28), [int]($H * 0.25), 24, 6)
            $g.FillRectangle($crossBrush, [int]($W * 0.28), [int]($H * 0.4), 24, 6)
            $g.FillRectangle($crossBrush, [int]($W * 0.28), [int]($H * 0.55), 24, 6)
            $crossBrush.Dispose()
            $blinkerBrush = New-Object System.Drawing.SolidBrush $ErrorCol
            $g.FillEllipse($blinkerBrush, [int]($W * 0.3 + 6), [int]($H * 0.05), 6, 6)
            $blinkerBrush.Dispose()
        }
        'shop' {
            $shelfBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 50, 60, 80))
            $g.FillRectangle($shelfBrush, 100, [int]($H * 0.4), 200, [int]($H * 0.4))
            $g.FillRectangle($shelfBrush, 1000, [int]($H * 0.4), 200, [int]($H * 0.4))
            $shelfBrush.Dispose()
            for ($i = 0; $i -lt 5; $i++) {
                $prod = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 100, 150, 200))
                $g.FillRectangle($prod, (120 + $i * 35), [int]($H * 0.45), 25, 30)
                $prod.Dispose()
            }
        }
        'construction' {
            $craneBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 200, 170, 60))
            $g.FillRectangle($craneBrush, [int]($W * 0.3), 100, 8, [int]($H * 0.7))
            $g.FillRectangle($craneBrush, [int]($W * 0.3), 100, 250, 8)
            $g.FillRectangle($craneBrush, [int]($W * 0.3), 100, 8, 50)
            $craneBrush.Dispose()
            $workerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 0, 82, 204))
            $g.FillEllipse($workerBrush, 800, [int]($H * 0.55), 30, 30)
            $g.FillRectangle($workerBrush, 800, [int]($H * 0.6), 30, 80)
            $workerBrush.Dispose()
        }
        'farm' {
            $rowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 80, 60, 30))
            for ($i = 0; $i -lt 12; $i++) {
                $g.FillRectangle($rowBrush, (50 + $i * 100), [int]($H * 0.75), 60, 200)
            }
            $rowBrush.Dispose()
        }
        'clinic' {
            $bedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 220, 220, 230))
            $g.FillRectangle($bedBrush, 400, [int]($H * 0.4), 400, 80)
            $bedBrush.Dispose()
            $crossBrush = New-Object System.Drawing.SolidBrush $ErrorCol
            $g.FillRectangle($crossBrush, 880, [int]($H * 0.15), 50, 130)
            $g.FillRectangle($crossBrush, 840, [int]($H * 0.18), 130, 50)
            $crossBrush.Dispose()
        }
    }

    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
    $g.FillEllipse($shadowBrush, ([int]($W * 0.08)), ([int]($H * 0.65)), 200, 24)
    $shadowBrush.Dispose()
    Draw-StackedUnits -Canvas $g ([int]($W * 0.08) + 50) ([int]($H * 0.4)) 120 220 4

    Add-Caption $g 20 20 ($W - 40) $Title $Setting $White $MatooLight 32 16
    Add-Caption $g 20 ($H - 70) ($W - 40) $Description "" $MatooLight $Slate400 14 12

    Add-PlaceholderBadge $g $W $H "商用场景" $Title $Description

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out" -ForegroundColor Gray
}

Write-Host "[2c] Generating commercial scenarios (5)..." -ForegroundColor Cyan
New-CommercialScenario 'scenario-telecom.jpg'      'Telecom Tower Backup'    '通讯基站备电'    '基站断电时维持 8+ 小时运营'        $NavyDeep 'tower'
New-CommercialScenario 'scenario-shop.jpg'          'Retail Shop UPS'         '商铺 UPS'        '为收银、防盗门、监控不间断供电'     $Navy     'shop'
New-CommercialScenario 'scenario-construction.jpg'  'Construction Site'       '工地作业'        '为电动工具、照明、监控供电'         $NavyDeep 'construction'
New-CommercialScenario 'scenario-farm.jpg'          'Farm Irrigation'         '农田灌溉'        '为灌溉泵、控制阀、监控供电'         $NavyDeep 'farm'
New-CommercialScenario 'scenario-clinic.jpg'        'Rural Clinic'            '乡村诊所'        '为医疗设备、冰箱、照明持续供电'     $Navy     'clinic'

# ============================================================
# 2d. 交通场景（3 张）
# ============================================================
function New-MobilityScenario {
    param([string]$Out, [string]$Title, [string]$Setting, [string]$Description, [string]$Vehicle)

    $W = 1200; $H = 800
    $ctx = New-Bitmap $W $H $NavyDeep
    $g = $ctx.Graphics

    Add-GridLines $g $W $H 40 $MatooLight 15

    switch ($Vehicle) {
        'rickshaw' {
            $bodyBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 200, 80, 30))
            $g.FillRectangle($bodyBrush, 400, [int]($H * 0.4), 400, 150)
            $g.FillRectangle($bodyBrush, 400, [int]($H * 0.55), 400, 80)
            $bodyBrush.Dispose()
            $wheelBrush = New-Object System.Drawing.SolidBrush $Navy
            $g.FillEllipse($wheelBrush, 420, [int]($H * 0.62), 60, 60)
            $g.FillEllipse($wheelBrush, 720, [int]($H * 0.62), 60, 60)
            $wheelBrush.Dispose()
            $handleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 80, 80, 80))
            $g.FillRectangle($handleBrush, 800, [int]($H * 0.45), 100, 8)
            $handleBrush.Dispose()
        }
        'scooter' {
            $bodyBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 0, 82, 204))
            $g.FillEllipse($bodyBrush, 500, [int]($H * 0.55), 200, 80)
            $g.FillRectangle($bodyBrush, 580, [int]($H * 0.4), 40, 100)
            $bodyBrush.Dispose()
            $wheelBrush = New-Object System.Drawing.SolidBrush $Navy
            $g.FillEllipse($wheelBrush, 480, [int]($H * 0.62), 60, 60)
            $g.FillEllipse($wheelBrush, 660, [int]($H * 0.62), 60, 60)
            $wheelBrush.Dispose()
        }
        'tuktuk' {
            $bodyBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 50, 150, 50))
            $g.FillRectangle($bodyBrush, 350, [int]($H * 0.4), 500, 200)
            $bodyBrush.Dispose()
            $topBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 30, 100, 30))
            $g.FillRectangle($topBrush, 380, [int]($H * 0.35), 440, 60)
            $topBrush.Dispose()
            $wheelBrush = New-Object System.Drawing.SolidBrush $Navy
            $g.FillEllipse($wheelBrush, 380, [int]($H * 0.62), 60, 60)
            $g.FillEllipse($wheelBrush, 760, [int]($H * 0.62), 60, 60)
            $wheelBrush.Dispose()
        }
    }

    Draw-BatteryUnit $g ([int]($W * 0.1)) ([int]($H * 0.45)) 90 180 $Matoo $Amber 4

    Add-Caption $g 20 20 ($W - 40) $Title $Setting $White $MatooLight 32 16
    Add-Caption $g 20 ($H - 70) ($W - 40) $Description "" $MatooLight $Slate400 14 12

    Add-PlaceholderBadge $g $W $H "出行场景" $Title $Description

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out" -ForegroundColor Gray
}

Write-Host "[2d] Generating mobility scenarios (3)..." -ForegroundColor Cyan
New-MobilityScenario 'scenario-e-rickshaw.jpg' 'E-Rickshaw'         '电动三轮车'     'Matoo Ready 控制器 + Power02 电池'  'rickshaw'
New-MobilityScenario 'scenario-e-scooter.jpg'  'E-Scooter'          '电动两轮车'     'Matoo Ready 控制器 + Power01 电池'  'scooter'
New-MobilityScenario 'scenario-e-tuktuk.jpg'   'E-Tuktuk / CNG'     '电动突突车'     '改装替换柴油机，零排放'            'tuktuk'

# ============================================================
# 2e. 太阳能 + 储能（2 张）
# ============================================================
function New-SolarScenario {
    param([string]$Out, [string]$Title, [string]$Setting, [string]$Description, [string]$Scene)

    $W = 1200; $H = 800
    $ctx = New-Bitmap $W $H $Navy
    $g = $ctx.Graphics

    Add-GridLines $g $W $H 50 $MatooLight 15
    Add-GlowOrb $g 1000 100 200 $Amber 100

    $horizonBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 30, 50, 80))
    $g.FillRectangle($horizonBrush, 0, [int]($H * 0.75), $W, [int]($H * 0.25))
    $horizonBrush.Dispose()

    if ($Scene -eq 'home') {
        $houseBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 200, 200, 210))
        $g.FillRectangle($houseBrush, 250, [int]($H * 0.55), 350, [int]($H * 0.3))
        $houseBrush.Dispose()
        $roofBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 120, 60, 40))
        $r1 = New-Object System.Drawing.Point -ArgumentList 250, ([int]($H * 0.55))
        $r2 = New-Object System.Drawing.Point -ArgumentList 425, ([int]($H * 0.4))
        $r3 = New-Object System.Drawing.Point -ArgumentList 600, ([int]($H * 0.55))
        $g.FillPolygon($roofBrush, @($r1, $r2, $r3))
        $roofBrush.Dispose()
        $panelBrush = New-Object System.Drawing.SolidBrush $Matoo
        $p1 = New-Object System.Drawing.Point -ArgumentList 290, ([int]($H * 0.53))
        $p2 = New-Object System.Drawing.Point -ArgumentList 420, ([int]($H * 0.45))
        $p3 = New-Object System.Drawing.Point -ArgumentList 540, ([int]($H * 0.52))
        $p4 = New-Object System.Drawing.Point -ArgumentList 410, ([int]($H * 0.6))
        $g.FillPolygon($panelBrush, @($p1, $p2, $p3, $p4))
        $panelBrush.Dispose()
        $cellPen = New-Object System.Drawing.Pen $Amber, 1
        $g.DrawLine($cellPen, 330, [int]($H * 0.5), 450, [int]($H * 0.47))
        $g.DrawLine($cellPen, 380, [int]($H * 0.49), 470, [int]($H * 0.5))
        $cellPen.Dispose()
    } else {
        $panelBrush = New-Object System.Drawing.SolidBrush $Matoo
        for ($i = 0; $i -lt 3; $i++) {
            $x = 250 + $i * 200
            $y = [int]($H * 0.65) - $i * 30
            $g.FillRectangle($panelBrush, $x, $y, 180, 100)
        }
        $panelBrush.Dispose()
        $cellPen = New-Object System.Drawing.Pen $Amber, 2
        for ($row = 0; $row -lt 3; $row++) {
            for ($col = 0; $col -lt 3; $col++) {
                $px = 250 + $col * 200
                $py = [int]($H * 0.65) - $col * 30 + $row * 33
                $g.DrawLine($cellPen, $px, $py, ($px + 180), $py)
                $g.DrawLine($cellPen, ($px + 60), $py, ($px + 60), ($py + 33))
            }
        }
        $cellPen.Dispose()
    }

    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
    $g.FillEllipse($shadowBrush, ([int]($W * 0.1)), ([int]($H * 0.65)), 200, 24)
    $shadowBrush.Dispose()
    Draw-StackedUnits -Canvas $g ([int]($W * 0.1) + 50) ([int]($H * 0.4)) 120 220 4

    Add-Caption $g 20 20 ($W - 40) $Title $Setting $White $MatooLight 32 16
    Add-Caption $g 20 ($H - 70) ($W - 40) $Description "" $MatooLight $Slate400 14 12

    Add-PlaceholderBadge $g $W $H "光储场景" $Title $Description

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out" -ForegroundColor Gray
}

Write-Host "[2e] Generating solar+storage scenarios (2)..." -ForegroundColor Cyan
New-SolarScenario 'scenario-solar-home.jpg' 'Residential Solar+Storage' '住宅光伏 + 储能' '屋顶太阳能 + Power Box 削峰填谷'   'home'
New-SolarScenario 'scenario-solar-farm.jpg' 'Solar Farm + BESS'        '光伏电站 + 大储能' 'MW 级储能，跟踪调度，削峰填谷' 'farm'

# ============================================================
# 2f. 应急/特殊（2 张）
# ============================================================
function New-EmergencyScenario {
    param([string]$Out, [string]$Title, [string]$Setting, [string]$Description, [System.Drawing.Color]$BgColor)

    $W = 1200; $H = 800
    $ctx = New-Bitmap $W $H $BgColor
    $g = $ctx.Graphics

    Add-GridLines $g $W $H 50 $MatooLight 12

    # 帐篷
    $tentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 200, 100, 100))
    $t1 = New-Object System.Drawing.Point -ArgumentList 500, ([int]($H * 0.4))
    $t2 = New-Object System.Drawing.Point -ArgumentList 700, ([int]($H * 0.7))
    $t3 = New-Object System.Drawing.Point -ArgumentList 300, ([int]($H * 0.7))
    $g.FillPolygon($tentBrush, @($t1, $t2, $t3))
    $tentBrush.Dispose()

    # 红十字
    $crossBrush = New-Object System.Drawing.SolidBrush $ErrorCol
    $g.FillRectangle($crossBrush, 580, [int]($H * 0.5), 40, 80)
    $g.FillRectangle($crossBrush, 560, [int]($H * 0.52), 80, 40)
    $crossBrush.Dispose()

    # 应急灯
    $lightBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 240, 240, 240))
    $g.FillRectangle($lightBrush, 900, 300, 60, 100)
    $lightBrush.Dispose()
    Add-GlowOrb $g 930 250 80 $Amber 200

    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
    $g.FillEllipse($shadowBrush, ([int]($W * 0.1)), ([int]($H * 0.65)), 200, 24)
    $shadowBrush.Dispose()
    Draw-StackedUnits -Canvas $g ([int]($W * 0.1) + 50) ([int]($H * 0.4)) 120 220 3

    Add-Caption $g 20 20 ($W - 40) $Title $Setting $White $MatooLight 32 16
    Add-Caption $g 20 ($H - 70) ($W - 40) $Description "" $MatooLight $Slate400 14 12

    Add-PlaceholderBadge $g $W $H "应急场景" $Title $Description

    Save-Jpg $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out" -ForegroundColor Gray
}

Write-Host "[2f] Generating emergency scenarios (2)..." -ForegroundColor Cyan
New-EmergencyScenario 'scenario-disaster.jpg'   'Disaster Relief'        '灾区应急救援'    '洪灾/台风后的快速供电'                $NavyDeep
New-EmergencyScenario 'scenario-emergency.jpg'  'Emergency Medical'      '应急医疗'       '为便携医疗设备供电'                  $Navy

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
$count = (Get-ChildItem $OutputDir -File -Include *.jpg,*.svg | Measure-Object).Count
Write-Host "Total assets in /assets: $count" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
