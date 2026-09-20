Add-Type -AssemblyName System.Drawing

$width  = 1200
$height = 630
$out    = Join-Path $PSScriptRoot "assets\og-image.jpg"

$bmp = New-Object System.Drawing.Bitmap $width, $height
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# 背景：深海军蓝
$bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 9, 30, 66))
$g.FillRectangle($bg, 0, 0, $width, $height)

# 电路纹理：浅蓝细线条
$linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(40, 38, 132, 255)), 1
for ($i = 0; $i -lt 30; $i++) {
    $y = [int](Get-Random -Minimum 20 -Maximum ($height - 20))
    $x = [int](Get-Random -Minimum 0 -Maximum $width)
    $g.DrawLine($linePen, $x, $y, ($x + [int](Get-Random -Minimum 60 -Maximum 220)), $y)
    $g.DrawLine($linePen, ($x + 120), $y, ($x + 120), ($y + [int](Get-Random -Minimum 40 -Maximum 100)))
}
$dotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(80, 38, 132, 255))
for ($i = 0; $i -lt 50; $i++) {
    $x = [int](Get-Random -Minimum 10 -Maximum ($width - 10))
    $y = [int](Get-Random -Minimum 10 -Maximum ($height - 10))
    $g.FillEllipse($dotBrush, $x, $y, 4, 4)
}

# 左侧：电池图标
$batX = 110
$batY = 220
$batW = 180
$batH = 280
$batBrush   = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 82, 204))
$batStroke  = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 179, 212, 255)), 6
$g.FillRectangle($batBrush, $batX, $batY, $batW, $batH)
$g.DrawRectangle($batStroke, $batX, $batY, $batW, $batH)
# 电池正极
$g.FillRectangle($batBrush, ($batX + 60), ($batY - 16), 60, 16)
# 电池内部能量条
$energyBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 230, 240, 255))
$g.FillRectangle($energyBrush, ($batX + 20), ($batY + 30), ($batW - 40), 30)
$g.FillRectangle($energyBrush, ($batX + 20), ($batY + 80), ($batW - 40), 30)
$g.FillRectangle($energyBrush, ($batX + 20), ($batY + 130), ($batW - 40), 30)
# 闪电符号
$boltBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 171, 0))
$pts = @(
    (New-Object System.Drawing.Point (($batX + 100), ($batY + 200))),
    (New-Object System.Drawing.Point (($batX + 75),  ($batY + 235))),
    (New-Object System.Drawing.Point (($batX + 95),  ($batY + 235))),
    (New-Object System.Drawing.Point (($batX + 80),  ($batY + 270)))
)
$g.FillPolygon($boltBrush, $pts)

# 右侧文案
$titleFont    = New-Object System.Drawing.Font ("Segoe UI", 64, [System.Drawing.FontStyle]::Bold)
$subFont      = New-Object System.Drawing.Font ("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
$taglineFont  = New-Object System.Drawing.Font ("Segoe UI", 20, [System.Drawing.FontStyle]::Regular)

$whiteBrush   = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$accentBrush  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 82, 204))
$mutedBrush   = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 223, 225, 230))

# Matoo Power
$g.DrawString("Matoo Power", $titleFont, $whiteBrush, 380, 230)
# 蓝色横线
$g.FillRectangle($accentBrush, 380, 325, 90, 6)
# Tagline
$g.DrawString("Reliable Energy Storage", $subFont, $whiteBrush, 380, 360)
$g.DrawString("for Emerging Markets",    $subFont, $whiteBrush, 380, 395)
# Subtitle
$dotChar = [char]0x00B7
$g.DrawString("Engineered in China  $dotChar  Trusted Worldwide", $taglineFont, $mutedBrush, 380, 470)

# 底部小标识
$footFont = New-Object System.Drawing.Font ("Segoe UI", 14, [System.Drawing.FontStyle]::Regular)
$g.DrawString("Lithium Iron Phosphate  |  Off-Grid  |  E-Mobility  |  Commercial Backup", $footFont, $mutedBrush, 380, 555)

# 保存为 JPG
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter (
    [System.Drawing.Imaging.Encoder]::Quality,
    [long]92
)
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" }
$bmp.Save($out, $jpegCodec, $encoderParams)

$g.Dispose()
$bmp.Dispose()

Write-Host "OG 图片已生成: $out" -ForegroundColor Green
Write-Host "尺寸: $width x $height" -ForegroundColor Gray