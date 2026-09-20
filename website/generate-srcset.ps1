# Matoo Power - 生产级 srcset 多尺寸生成器
# 为关键图生成 480/800/1200/1920 四种尺寸（原始尺寸保留为默认）
# 命名规则：name@800.jpg / name@1200.jpg / name@1920.jpg
# 注意：仅对宽度 >= 800 的图生成更大尺寸；800 以下的保持单尺寸

Add-Type -AssemblyName System.Drawing

$AssetsDir = "e:\MatooPower\website\assets"

# 配置：每个文件对应的尺寸档
$sizeMap = @{
    # Hero 图片 — 1920 → 1200, 1920（保留）
    'hero-home.jpg'           = @( 1200, 1920 )
    'hero-manufacturing.jpg'  = @( 1200, 1920 )
    'hero-partnership.jpg'    = @( 1200, 1920 )
    'hero-insights.jpg'       = @( 1200, 1920 )
    'hero-about.jpg'          = @( 1200, 1920 )
    # 产品图 — 800 → 480, 800（保留）
    'product-power01-front.jpg'    = @( 480, 800 )
    'product-power01-side.jpg'     = @( 480, 800 )
    'product-power01-carrying.jpg' = @( 480, 800 )
    'product-power01-charging.jpg' = @( 480, 800 )
    'product-power02-front.jpg'    = @( 480, 800 )
    'product-power02-side.jpg'     = @( 480, 800 )
    'product-power02-stack2.jpg'   = @( 480, 800 )
    'product-powerbox-front.jpg'   = @( 480, 800 )
    'product-powerbox-stack2.jpg'  = @( 480, 800 )
    'product-powerbox-stack4.jpg'  = @( 480, 800 )
    'product-powerbox-interior.jpg'= @( 480, 800 )
    'product-motor-controller-front.jpg' = @( 480, 800 )
    'product-motor-controller-mounted.jpg'= @( 480, 800 )
    # 场景图 — 1200 → 800, 1200（保留）
    'scenario-home-evening.jpg' = @( 800, 1200 )
    'scenario-home-kitchen.jpg'= @( 800, 1200 )
    'scenario-home-office.jpg' = @( 800, 1200 )
    'scenario-camping.jpg'     = @( 800, 1200 )
    'scenario-rv.jpg'          = @( 800, 1200 )
    'scenario-island.jpg'      = @( 800, 1200 )
    'scenario-boat.jpg'        = @( 800, 1200 )
    'scenario-nightmarket.jpg' = @( 800, 1200 )
    'scenario-telecom.jpg'     = @( 800, 1200 )
    'scenario-shop.jpg'        = @( 800, 1200 )
    'scenario-construction.jpg'= @( 800, 1200 )
    'scenario-farm.jpg'        = @( 800, 1200 )
    'scenario-clinic.jpg'      = @( 800, 1200 )
    'scenario-e-rickshaw.jpg'  = @( 800, 1200 )
    'scenario-e-scooter.jpg'   = @( 800, 1200 )
    'scenario-e-tuktuk.jpg'    = @( 800, 1200 )
    'scenario-solar-home.jpg'  = @( 800, 1200 )
    'scenario-solar-farm.jpg'  = @( 800, 1200 )
    'scenario-disaster.jpg'    = @( 800, 1200 )
    'scenario-emergency.jpg'   = @( 800, 1200 )
    # 工厂图
    'factory-floor.jpg'        = @( 800, 1200 )
    'factory-assembly.jpg'     = @( 800, 1200 )
    'factory-warehouse.jpg'    = @( 800, 1200 )
    # 区域图
    'region-south-asia.jpg'    = @( 800, 1200 )
    'region-africa.jpg'        = @( 800, 1200 )
    'region-mena.jpg'          = @( 800, 1200 )
    'region-sea.jpg'           = @( 800, 1200 )
    # 洞察封面
    'insight-cover-01.jpg'     = @( 800, 1200 )
    'insight-cover-02.jpg'     = @( 800, 1200 )
    'insight-cover-03.jpg'     = @( 800, 1200 )
    'insight-cover-04.jpg'     = @( 800, 1200 )
    'insight-cover-05.jpg'     = @( 800, 1200 )
    'insight-cover-06.jpg'     = @( 800, 1200 )
}

function Save-Jpg-Progressive {
    param($Bitmap, [string]$Path, [int]$Quality = 85)
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters 2
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
    $encParams.Param[1] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::RenderMethod, [long]3)
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $Bitmap.Save($Path, $codec, $encParams)
}

function Resize-Jpg {
    param([string]$Source, [string]$DestPath, [int]$TargetWidth)
    $src = [System.Drawing.Image]::FromFile($Source)
    $ratio = $src.Height / $src.Width
    $newW = $TargetWidth
    $newH = [int]($newW * $ratio)
    $bmp = New-Object System.Drawing.Bitmap $newW, $newH
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, $newW, $newH)
    Save-Jpg-Progressive $bmp $DestPath 85
    $g.Dispose()
    $bmp.Dispose()
    $src.Dispose()
}

Write-Host "[srcset] Generating multi-size variants..." -ForegroundColor Cyan
$totalGenerated = 0
$totalSkipped = 0

foreach ($name in $sizeMap.Keys) {
    $src = Join-Path $AssetsDir $name
    if (-not (Test-Path $src)) {
        Write-Host "    SKIP $name (not found)" -ForegroundColor Yellow
        $totalSkipped++
        continue
    }

    $sizes = $sizeMap[$name]
    foreach ($w in $sizes) {
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($name)
        $destName = "$baseName@$w.jpg"
        $dest = Join-Path $AssetsDir $destName

        # 跳过已经存在且更大的文件
        if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 0)) {
            Write-Host "    KEEP $destName (exists)" -ForegroundColor DarkGray
            continue
        }

        try {
            Resize-Jpg $src $dest $w
            $totalGenerated++
            $size = (Get-Item $dest).Length
            Write-Host "    + $destName  ($([math]::Round($size/1KB,1)) KB)" -ForegroundColor Gray
        } catch {
            Write-Host "    FAIL $destName : $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Generated: $totalGenerated | Skipped: $totalSkipped" -ForegroundColor Green