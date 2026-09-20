# Matoo Power - 生产级关键图升级
# 升级目标：
#   - 更立体的产品建模（金属外壳质感、显示屏、按键）
#   - 更专业的光照（高光/暗部/反射）
#   - 更精细的场景图（远景/中景/近景 + 多层灯光）
#   - 保留 PLACEHOLDER 角标，便于管理员识别

Add-Type -AssemblyName System.Drawing

$OutputDir = "e:\MatooPower\website\assets"
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

# 品牌色
$Navy      = [System.Drawing.Color]::FromArgb(255, 9, 30, 66)
$NavyDeep  = [System.Drawing.Color]::FromArgb(255, 4, 17, 38)
$Matoo     = [System.Drawing.Color]::FromArgb(255, 0, 82, 204)
$MatooLight = [System.Drawing.Color]::FromArgb(255, 38, 132, 255)
$MatooDark = [System.Drawing.Color]::FromArgb(255, 0, 51, 153)
$Amber     = [System.Drawing.Color]::FromArgb(255, 255, 171, 0)
$AmberLight = [System.Drawing.Color]::FromArgb(255, 255, 220, 120)
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
function Save-Jpg-Progressive {
    param($Bitmap, [string]$Path, [int]$Quality = 88)
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters 2
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
    # Progressive = 1
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

function Add-PlaceholderBadge {
    param($G, [int]$W, [int]$H, [string]$Category, [string]$Title, [string]$Description)

    $bx = 24; $by = 24; $bw = 320; $bh = 100

    $dashPen = New-Object System.Drawing.Pen $ErrorCol, 3
    $dashPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $G.DrawRectangle($dashPen, $bx, $by, $bw, $bh)
    $dashPen.Dispose()

    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 255, 86, 48))
    $G.FillRectangle($bgBrush, ($bx + 3), ($by + 3), ($bw - 6), ($bh - 6))
    $bgBrush.Dispose()

    $tagFont = New-Object System.Drawing.Font ("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
    $tagBrush = New-Object System.Drawing.SolidBrush $White
    $G.DrawString("PLACEHOLDER", $tagFont, $tagBrush, ($bx + 14), ($by + 10))
    $tagFont.Dispose(); $tagBrush.Dispose()

    $descFont = New-Object System.Drawing.Font ("Segoe UI", 10, [System.Drawing.FontStyle]::Regular)
    $descBrush = New-Object System.Drawing.SolidBrush $White
    $G.DrawString("Replace with real photography", $descFont, $descBrush, ($bx + 14), ($by + 38))
    $G.DrawString(("$Category - $Title"), $descFont, $descBrush, ($bx + 14), ($by + 56))
    $G.DrawString($Description, $descFont, $descBrush, ($bx + 14), ($by + 74))
    $descFont.Dispose(); $descBrush.Dispose()
}

# ============================================================
# 升级版产品图 - 更专业的产品渲染风格
# ============================================================
function New-ProProductRender {
    param([string]$Out, [int]$W, [int]$H,
          [string]$Product, [string]$ShotType, [string]$Description,
          [string]$Shape = "portable",  # portable / home / modular / controller
          [int]$StackCount = 1)

    $ctx = New-Bitmap $W $H $Slate50
    $g = $ctx.Graphics

    # 三段渐变背景（顶光环境）
    $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bgPath.AddRectangle((New-Object System.Drawing.Rectangle 0, 0, $W, $H))
    $pbBg = New-Object System.Drawing.Drawing2D.PathGradientBrush $bgPath
    $pbBg.CenterColor = [System.Drawing.Color]::FromArgb(255, 255, 255, 252)
    $pbBg.CenterPoint = New-Object System.Drawing.PointF ($W / 2), ($H * 0.25)
    $pbBg.SurroundColors = @([System.Drawing.Color]::FromArgb(255, 220, 226, 236))
    $g.FillRectangle($pbBg, 0, 0, $W, $H)
    $pbBg.Dispose()
    $bgPath.Dispose()

    # 地面投影（柔和椭圆）
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 9, 30, 66))
    $g.FillEllipse($shadowBrush, ([int]($W * 0.30)), ([int]($H * 0.82)), ([int]($W * 0.40)), 28)
    $shadowBrush.Dispose()

    # 主体产品
    $cx = [int]($W / 2)
    switch ($Shape) {
        "portable"   { Draw-PortableUnit $g $cx $H $StackCount }
        "home"       { Draw-HomeUnit $g $cx $H $StackCount }
        "modular"    { Draw-ModularUnit $g $cx $H $StackCount }
        "controller" { Draw-ControllerUnit $g $cx $H }
    }

    # 反射光（在产品下方）
    $reflBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 0, 82, 204))
    $g.FillRectangle($reflBrush, ([int]($W * 0.30)), ([int]($H * 0.85)), ([int]($W * 0.40)), 30)
    $reflBrush.Dispose()

    # 标签
    $titleFont = New-Object System.Drawing.Font ("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
    $titleBrush = New-Object System.Drawing.SolidBrush $Navy
    $g.DrawString($Product, $titleFont, $titleBrush, 24, ($H - 56))
    $titleFont.Dispose(); $titleBrush.Dispose()

    $subFont = New-Object System.Drawing.Font ("Segoe UI", 12, [System.Drawing.FontStyle]::Regular)
    $subBrush = New-Object System.Drawing.SolidBrush $Slate500
    $g.DrawString($ShotType, $subFont, $subBrush, 24, ($H - 28))
    $subFont.Dispose(); $subBrush.Dispose()

    Add-PlaceholderBadge $g $W $H "Product Render" "$Product - $ShotType" $Description

    Save-Jpg-Progressive $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out" -ForegroundColor Gray
}

# ----- 各形状绘制函数 -----

function Draw-PortableUnit {
    param($G, [int]$Cx, [int]$H, [int]$Stack)

    $unitW = 220
    $unitH = 340
    $ux = $Cx - [int]($unitW / 2)
    $uy = [int]($H * 0.30)

    # 主体（带圆角的渐变填充）
    $bodyPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $radius = 18
    $bodyPath.AddArc($ux, $uy, $radius * 2, $radius * 2, 180, 90)
    $bodyPath.AddArc(($ux + $unitW - $radius * 2), $uy, $radius * 2, $radius * 2, 270, 90)
    $bodyPath.AddArc(($ux + $unitW - $radius * 2), ($uy + $unitH - $radius * 2), $radius * 2, $radius * 2, 0, 90)
    $bodyPath.AddArc($ux, ($uy + $unitH - $radius * 2), $radius * 2, $radius * 2, 90, 90)
    $bodyPath.CloseFigure()

    # 渐变蓝（顶亮底暗）
    $bodyBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point $ux, $uy),
        (New-Object System.Drawing.Point $ux, ($uy + $unitH)),
        ([System.Drawing.Color]::FromArgb(255, 38, 132, 255)),
        ([System.Drawing.Color]::FromArgb(255, 0, 51, 153))
    )
    $G.FillPath($bodyBrush, $bodyPath)
    $bodyBrush.Dispose()

    # 边框（深色）
    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 4, 17, 38)), 2
    $G.DrawPath($borderPen, $bodyPath)
    $borderPen.Dispose()

    # 顶部高光
    $hlPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $hlPath.AddArc(($ux + 10), ($uy + 4), ($unitW - 20), 30, 180, 180)
    $hlPath.AddLine(($ux + $unitW - 10), ($uy + 18), ($ux + 10), ($uy + 18))
    $hlPath.CloseFigure()
    $hlBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(80, 255, 255, 255))
    $G.FillPath($hlBrush, $hlPath)
    $hlBrush.Dispose()
    $hlPath.Dispose()

    # 显示屏区域
    $screenX = $ux + 20
    $screenY = $uy + 50
    $screenW = $unitW - 40
    $screenH = 80
    $screenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 17, 38))
    $G.FillRectangle($screenBrush, $screenX, $screenY, $screenW, $screenH)
    $screenBrush.Dispose()

    # 显示屏内容 - 大数字
    $numFont = New-Object System.Drawing.Font ("Consolas", 36, [System.Drawing.FontStyle]::Bold)
    $numBrush = New-Object System.Drawing.SolidBrush $Amber
    $G.DrawString("98", $numFont, $numBrush, ($screenX + 22), ($screenY + 8))
    $numFont.Dispose(); $numBrush.Dispose()

    $pctFont = New-Object System.Drawing.Font ("Consolas", 14, [System.Drawing.FontStyle]::Regular)
    $pctBrush = New-Object System.Drawing.SolidBrush $Amber
    $G.DrawString("%", $pctFont, $pctBrush, ($screenX + 100), ($screenY + 28))
    $pctFont.Dispose(); $pctBrush.Dispose()

    $smallFont = New-Object System.Drawing.Font ("Segoe UI", 8, [System.Drawing.FontStyle]::Regular)
    $smallBrush = New-Object System.Drawing.SolidBrush $MatooLight
    $G.DrawString("BATTERY", $smallFont, $smallBrush, ($screenX + 8), ($screenY + 12))
    $smallFont.Dispose(); $smallBrush.Dispose()

    # 闪电符号
    $boltPts = @(
        (New-Object System.Drawing.Point -ArgumentList ([int]($ux + $unitW / 2 - 12), [int]($uy + $unitH - 130))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($ux + $unitW / 2 + 14), [int]($uy + $unitH - 130))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($ux + $unitW / 2 - 8), [int]($uy + $unitH - 70))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($ux + $unitW / 2 + 18), [int]($uy + $unitH - 70))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($ux + $unitW / 2 - 14), [int]($uy + $unitH - 8))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($ux + $unitW / 2 + 6), [int]($uy + $unitH - 80))),
        (New-Object System.Drawing.Point -ArgumentList ([int]($ux + $unitW / 2 - 18), [int]($uy + $unitH - 80)))
    )
    $boltBrush = New-Object System.Drawing.SolidBrush $Amber
    $G.FillPolygon($boltBrush, $boltPts)
    $boltBrush.Dispose()

    # 把手（顶部凹陷）
    $handleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(200, 4, 17, 38))
    $G.FillRectangle($handleBrush, ($ux + $unitW / 2 - 30), ($uy - 18), 60, 14)
    $handleBrush.Dispose()
}

function Draw-HomeUnit {
    param($G, [int]$Cx, [int]$H, [int]$Stack)

    $unitW = 260
    $unitH = 360
    $ux = $Cx - [int]($unitW / 2)
    $uy = [int]($H * 0.30)

    # 主体（更大圆角）
    $bodyBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point $ux, $uy),
        (New-Object System.Drawing.Point $ux, ($uy + $unitH)),
        ([System.Drawing.Color]::FromArgb(255, 28, 110, 230)),
        ([System.Drawing.Color]::FromArgb(255, 0, 51, 153))
    )
    $bodyPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $radius = 24
    $bodyPath.AddArc($ux, $uy, $radius * 2, $radius * 2, 180, 90)
    $bodyPath.AddArc(($ux + $unitW - $radius * 2), $uy, $radius * 2, $radius * 2, 270, 90)
    $bodyPath.AddArc(($ux + $unitW - $radius * 2), ($uy + $unitH - $radius * 2), $radius * 2, $radius * 2, 0, 90)
    $bodyPath.AddArc($ux, ($uy + $unitH - $radius * 2), $radius * 2, $radius * 2, 90, 90)
    $bodyPath.CloseFigure()
    $G.FillPath($bodyBrush, $bodyPath)
    $bodyBrush.Dispose()

    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 4, 17, 38)), 2
    $G.DrawPath($borderPen, $bodyPath)
    $borderPen.Dispose()

    # 显示屏
    $scrW = 180
    $scrH = 90
    $scrX = $ux + ($unitW - $scrW) / 2
    $scrY = $uy + 70
    $screenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 17, 38))
    $G.FillRectangle($screenBrush, $scrX, $scrY, $scrW, $scrH)
    $screenBrush.Dispose()

    # 数字
    $numFont = New-Object System.Drawing.Font ("Consolas", 48, [System.Drawing.FontStyle]::Bold)
    $numBrush = New-Object System.Drawing.SolidBrush $Amber
    $G.DrawString("98", $numFont, $numBrush, ($scrX + 30), ($scrY + 12))
    $numFont.Dispose(); $numBrush.Dispose()

    $pctFont = New-Object System.Drawing.Font ("Consolas", 18, [System.Drawing.FontStyle]::Bold)
    $pctBrush = New-Object System.Drawing.SolidBrush $Amber
    $G.DrawString("%", $pctFont, $pctBrush, ($scrX + 130), ($scrY + 30))
    $pctFont.Dispose(); $pctBrush.Dispose()

    # LED 灯条（4 个）
    for ($i = 0; $i -lt 4; $i++) {
        $ledX = $ux + 30 + ($i * 50)
        $ledY = $uy + 200
        $ledBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 54, 179, 126))
        $G.FillEllipse($ledBrush, $ledX, $ledY, 14, 14)
        $ledBrush.Dispose()
    }

    # 品牌 logo（顶部）
    $logoFont = New-Object System.Drawing.Font ("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
    $logoBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 255, 255, 255))
    $G.DrawString("MATOO", $logoFont, $logoBrush, ($ux + 20), ($uy + 30))
    $logoFont.Dispose(); $logoBrush.Dispose()

    $subLogoFont = New-Object System.Drawing.Font ("Segoe UI", 8, [System.Drawing.FontStyle]::Regular)
    $subLogoBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 255, 255, 255))
    $G.DrawString("POWER", $subLogoFont, $subLogoBrush, ($ux + 20), ($uy + 48))
    $subLogoFont.Dispose(); $subLogoBrush.Dispose()
}

function Draw-ModularUnit {
    param($G, [int]$Cx, [int]$H, [int]$Stack)

    # 模块化堆叠 - 最多 4 模块
    $count = [Math]::Min($Stack, 4)
    $unitW = 280
    $unitH = 360 / $count - 6

    $totalH = $unitH * $count + 6 * ($count - 1)
    $ux = $Cx - [int]($unitW / 2)
    $uy = [int]($H / 2 - $totalH / 2)

    for ($i = 0; $i -lt $count; $i++) {
        $uy_i = $uy + $i * ($unitH + 6)
        $shade = [System.Drawing.Color]::FromArgb(255,
            [Math]::Max(0, 38 + $i * 4),
            [Math]::Max(0, 132 - $i * 8),
            [Math]::Min(255, 255 - $i * 18))

        # 圆角主体
        $bodyPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $r = 14
        $bodyPath.AddArc($ux, $uy_i, $r * 2, $r * 2, 180, 90)
        $bodyPath.AddArc(($ux + $unitW - $r * 2), $uy_i, $r * 2, $r * 2, 270, 90)
        $bodyPath.AddArc(($ux + $unitW - $r * 2), ($uy_i + $unitH - $r * 2), $r * 2, $r * 2, 0, 90)
        $bodyPath.AddArc($ux, ($uy_i + $unitH - $r * 2), $r * 2, $r * 2, 90, 90)
        $bodyPath.CloseFigure()

        $bodyBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
            (New-Object System.Drawing.Point $ux, $uy_i),
            (New-Object System.Drawing.Point $ux, ($uy_i + $unitH)),
            $shade,
            ([System.Drawing.Color]::FromArgb(255, 0, 51, 153))
        )
        $G.FillPath($bodyBrush, $bodyPath)
        $bodyBrush.Dispose()

        $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 4, 17, 38)), 2
        $G.DrawPath($borderPen, $bodyPath)
        $borderPen.Dispose()

        # 模块间对接金属条（顶部凹陷）
        if ($i -gt 0) {
            $cnBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 80, 90, 100))
            $G.FillRectangle($cnBrush, ($ux + 20), ($uy_i - 3), ($unitW - 40), 6)
            $cnBrush.Dispose()
        }

        # 模块状态条（顶部小显示屏）
        $miniW = 60; $miniH = 24
        $miniX = $ux + 20; $miniY = $uy_i + 14
        $miniBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 17, 38))
        $G.FillRectangle($miniBrush, $miniX, $miniY, $miniW, $miniH)
        $miniBrush.Dispose()

        $miniFont = New-Object System.Drawing.Font ("Consolas", 11, [System.Drawing.FontStyle]::Bold)
        $miniBrush2 = New-Object System.Drawing.SolidBrush $Amber
        $G.DrawString("M$($i+1)", $miniFont, $miniBrush2, ($miniX + 6), ($miniY + 6))
        $miniFont.Dispose(); $miniBrush2.Dispose()

        # 4 格 LED 灯
        for ($j = 0; $j -lt 4; $j++) {
            $ledBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 54, 179, 126))
            $G.FillEllipse($ledBrush, ($ux + 100 + $j * 28), ($miniY + 5), 14, 14)
            $ledBrush.Dispose()
        }

        # Matoo 标识
        if ($i -eq 0) {
            $logoFont = New-Object System.Drawing.Font ("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
            $logoBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 255, 255, 255))
            $G.DrawString("MATOO POWER BOX", $logoFont, $logoBrush, ($ux + 100), ($miniY + 26))
            $logoFont.Dispose(); $logoBrush.Dispose()
        }
    }
}

function Draw-ControllerUnit {
    param($G, [int]$Cx, [int]$H)

    $unitW = 360
    $unitH = 280
    $ux = $Cx - [int]($unitW / 2)
    $uy = [int]($H * 0.30)

    # PCB 绿底
    $pcbBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 22, 100, 60))
    $G.FillRectangle($pcbBrush, $ux, $uy, $unitW, $unitH)
    $pcbBrush.Dispose()

    # 边框
    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 8, 60, 30)), 2
    $G.DrawRectangle($borderPen, $ux, $uy, $unitW, $unitH)
    $borderPen.Dispose()

    # 电路走线
    $tracePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 200, 170, 0)), 1
    for ($i = 0; $i -lt 12; $i++) {
        $yLine = $uy + 20 + ($i * 22)
        $G.DrawLine($tracePen, ($ux + 10), $yLine, ($ux + 60 + (($i % 3) * 40)), $yLine)
        $G.DrawLine($tracePen, ($ux + 100 + (($i % 4) * 30)), ($yLine + 10), ($ux + 300), ($yLine + 10))
    }
    $tracePen.Dispose()

    # 主芯片
    $chipBrush = New-Object System.Drawing.SolidBrush $Navy
    $G.FillRectangle($chipBrush, ($ux + 130), ($uy + 90), 100, 100)
    $chipBrush.Dispose()

    $chipFont = New-Object System.Drawing.Font ("Consolas", 9, [System.Drawing.FontStyle]::Bold)
    $chipBrush2 = New-Object System.Drawing.SolidBrush $Amber
    $G.DrawString("MATOO", $chipFont, $chipBrush2, ($ux + 145), ($uy + 110))
    $G.DrawString("READY", $chipFont, $chipBrush2, ($ux + 148), ($uy + 124))
    $G.DrawString("v2.4", $chipFont, $chipBrush2, ($ux + 158), ($uy + 138))
    $G.DrawString("MCU", $chipFont, $chipBrush2, ($ux + 158), ($uy + 152))
    $chipFont.Dispose(); $chipBrush2.Dispose()

    # 接口
    $ports = @(
        [pscustomobject]@{ X = ($ux + 20); Y = ($uy + 60); Name = "PWR"; Color = $MatooLight },
        [pscustomobject]@{ X = ($ux + 20); Y = ($uy + 100); Name = "CAN"; Color = $Amber },
        [pscustomobject]@{ X = ($ux + 20); Y = ($uy + 140); Name = "MOT"; Color = $Success },
        [pscustomobject]@{ X = ($ux + 20); Y = ($uy + 180); Name = "BAT"; Color = $MatooLight }
    )
    foreach ($p in $ports) {
        $portBrush = New-Object System.Drawing.SolidBrush $p.Color
        $G.FillRectangle($portBrush, $p.X, $p.Y, 50, 28)
        $portBrush.Dispose()

        $pFont = New-Object System.Drawing.Font ("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
        $pBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Black)
        $G.DrawString($p.Name, $pFont, $pBrush, ($p.X + 8), ($p.Y + 7))
        $pFont.Dispose(); $pBrush.Dispose()
    }

    # 大端子（右侧）
    $termBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 180, 90, 30))
    $G.FillRectangle($termBrush, ($ux + 300), ($uy + 90), 40, 140)
    $termBrush.Dispose()

    for ($k = 0; $k -lt 5; $k++) {
        $screwBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 60, 60, 60))
        $G.FillEllipse($screwBrush, ($ux + 308), ($uy + 100 + $k * 26), 24, 24)
        $screwBrush.Dispose()
    }
}

# ============================================================
# 升级版场景图（仅 4 个核心场景）
# ============================================================
function New-ProHomeEvening {
    param([string]$Out)

    $W = 1200; $H = 800
    $ctx = New-Bitmap $W $H ([System.Drawing.Color]::FromArgb(255, 28, 38, 56))
    $g = $ctx.Graphics

    # 远景窗户外（暖光）
    $winBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 255, 200, 100))
    $g.FillRectangle($winBrush, 80, 60, 320, 380)
    $winBrush.Dispose()

    # 窗户光晕
    Add-GlowOrb $g 240 200 250 $Amber 90

    # 地板（深色木）
    $floorBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 24, 32, 48))
    $g.FillRectangle($floorBrush, 0, 600, $W, 200)
    $floorBrush.Dispose()

    # 电视柜（深色长方形）
    $cabBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 35, 45, 65))
    $g.FillRectangle($cabBrush, 600, 540, 320, 80)
    $cabBrush.Dispose()

    # 电视（关闭屏幕的暗块）
    $tvBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 8, 12, 24))
    $g.FillRectangle($tvBrush, 660, 380, 240, 160)
    $tvBrush.Dispose()

    # 电视边框
    $tvBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 30, 40, 60)), 4
    $g.DrawRectangle($tvBorder, 660, 380, 240, 160)
    $tvBorder.Dispose()

    # 电池（放在柜子上）
    Draw-PortableUnit $g 760 800 1

    # LED 灯（从电池供电）
    Add-GlowOrb $g 1100 280 60 $Amber 200
    Add-GlowOrb $g 100 380 50 $AmberLight 150

    # 吊灯
    Add-GlowOrb $g 550 100 200 $Amber 100

    # 文字
    $titleFont = New-Object System.Drawing.Font ("Segoe UI", 36, [System.Drawing.FontStyle]::Bold)
    $titleBrush = New-Object System.Drawing.SolidBrush $White
    $g.DrawString("Home Evening Backup", $titleFont, $titleBrush, 30, 30)
    $titleFont.Dispose(); $titleBrush.Dispose()

    $subFont = New-Object System.Drawing.Font ("Segoe UI", 14, [System.Drawing.FontStyle]::Regular)
    $subBrush = New-Object System.Drawing.SolidBrush $MatooLight
    $g.DrawString("Power01 powers lights, TV, WiFi during grid outage", $subFont, $subBrush, 30, 76)
    $subFont.Dispose(); $subBrush.Dispose()

    Add-PlaceholderBadge $g $W $H "Scenario - Home" "Evening Backup" "Replace with real photography"

    Save-Jpg-Progressive $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out" -ForegroundColor Gray
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

function New-ProTelecom {
    param([string]$Out)

    $W = 1200; $H = 800
    $ctx = New-Bitmap $W $H ([System.Drawing.Color]::FromArgb(255, 6, 14, 32))
    $g = $ctx.Graphics

    # 远景天空（深蓝渐变）
    $skyBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point 0, 500),
        ([System.Drawing.Color]::FromArgb(255, 4, 17, 38)),
        ([System.Drawing.Color]::FromArgb(255, 18, 38, 78))
    )
    $g.FillRectangle($skyBrush, 0, 0, $W, 500)
    $skyBrush.Dispose()

    # 月亮
    Add-GlowOrb $g 1050 80 80 ([System.Drawing.Color]::FromArgb(255, 240, 240, 220)) 180
    $moonBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 240, 240, 220))
    $g.FillEllipse($moonBrush, 1030, 60, 40, 40)
    $moonBrush.Dispose()

    # 远山轮廓
    $mtnPts = @(
        (New-Object System.Drawing.Point -ArgumentList 0, 500),
        (New-Object System.Drawing.Point -ArgumentList 200, 380),
        (New-Object System.Drawing.Point -ArgumentList 400, 440),
        (New-Object System.Drawing.Point -ArgumentList 650, 360),
        (New-Object System.Drawing.Point -ArgumentList 900, 420),
        (New-Object System.Drawing.Point -ArgumentList 1200, 480)
    )
    $mtnBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 12, 24, 48))
    $g.FillPolygon($mtnBrush, $mtnPts)
    $mtnBrush.Dispose()

    # 地面（暗色）
    $groundBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 8, 16, 32))
    $g.FillRectangle($groundBrush, 0, 500, $W, 300)
    $groundBrush.Dispose()

    # 通讯塔（金属格构塔）
    $towerCenter = 600
    $towerTop = 100
    $towerBase = 600
    $towerW = 30
    $towerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 100, 110, 120))

    # 4 根支柱
    $G.FillRectangle($towerBrush, ($towerCenter - 60), $towerTop, 8, ($towerBase - $towerTop))
    $G.FillRectangle($towerBrush, ($towerCenter + 52), $towerTop, 8, ($towerBase - $towerTop))
    $G.FillRectangle($towerBrush, ($towerCenter - 16), $towerTop, 8, ($towerBase - $towerTop))
    $G.FillRectangle($towerBrush, ($towerCenter + 8), $towerTop, 8, ($towerBase - $towerTop))
    $towerBrush.Dispose()

    # 横梁
    $crossBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 80, 90, 100))
    for ($y = 150; $y -lt 580; $y += 50) {
        $G.FillRectangle($crossBrush, ($towerCenter - 60), $y, 120, 4)
    }
    $crossBrush.Dispose()

    # 塔顶闪烁红灯
    Add-GlowOrb $g 600 90 30 $ErrorCol 250

    # 微波天线（横臂）
    $antBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 120, 130, 140))
    $g.FillRectangle($antBrush, ($towerCenter - 100), 220, 200, 10)
    $g.FillRectangle($antBrush, ($towerCenter - 100), 320, 200, 10)
    $antBrush.Dispose()

    # 微波天线碟
    for ($i = 0; $i -lt 3; $i++) {
        $x = $towerCenter - 80 + $i * 60
        $dishBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 200, 200, 200))
        $G.FillEllipse($dishBrush, $x, 215, 30, 30)
        $dishBrush.Dispose()
    }

    # Power Box（4 模块堆叠在塔基座）
    Draw-ModularUnit $g 200 800 4

    # LED 指示灯（在 Power Box 上）
    Add-GlowOrb $g 200 350 60 $Success 200

    # 文字
    $titleFont = New-Object System.Drawing.Font ("Segoe UI", 36, [System.Drawing.FontStyle]::Bold)
    $titleBrush = New-Object System.Drawing.SolidBrush $White
    $g.DrawString("Telecom Tower Backup", $titleFont, $titleBrush, 30, 30)
    $titleFont.Dispose(); $titleBrush.Dispose()

    $subFont = New-Object System.Drawing.Font ("Segoe UI", 14, [System.Drawing.FontStyle]::Regular)
    $subBrush = New-Object System.Drawing.SolidBrush $MatooLight
    $g.DrawString("Power Box keeps cell tower online 8+ hours during grid outage", $subFont, $subBrush, 30, 76)
    $subFont.Dispose(); $subBrush.Dispose()

    Add-PlaceholderBadge $g $W $H "Scenario - Telecom" "Tower Backup" "Replace with real photography"

    Save-Jpg-Progressive $ctx.Bitmap "$OutputDir\$Out" 90
    $ctx.Graphics.Dispose(); $ctx.Bitmap.Dispose()
    Write-Host "    + $Out" -ForegroundColor Gray
}

# ============================================================
# 主流程
# ============================================================
Write-Host "[Pro] Upgrading key product renders..." -ForegroundColor Cyan

# Power01 正面（升级版）
New-ProProductRender 'product-power01-front.jpg'   800 800 'Power01'         'Front View'         'Front panel: display, LED bar, ports'        'portable'   1
# Power02 正面
New-ProProductRender 'product-power02-front.jpg'   800 800 'Power02'         'Front View'         'Front panel: LCD, LED indicators'           'home'
# Power Box 单模
New-ProProductRender 'product-powerbox-front.jpg'  800 800 'Power Box'       'Single Module'      '5 kWh base unit with BMS'                  'modular'    1
# Power Box 2 stack
New-ProProductRender 'product-powerbox-stack2.jpg' 800 800 'Power Box'       '2-Module Stack'     '10 kWh configuration'                       'modular'    2
# Power Box 4 stack
New-ProProductRender 'product-powerbox-stack4.jpg' 800 800 'Power Box'       '4-Module Stack'     '20 kWh configuration'                       'modular'    4
# Motor Controller
New-ProProductRender 'product-motor-controller-front.jpg' 800 800 'Motor Controller' 'Front View' 'PCB with Matoo Ready MCU + ports'         'controller'

Write-Host "`n[Pro] Upgrading key scenarios..." -ForegroundColor Cyan
New-ProHomeEvening 'scenario-home-evening.jpg'
New-ProTelecom    'scenario-telecom.jpg'

Write-Host ""
Write-Host "Pro renders done." -ForegroundColor Green