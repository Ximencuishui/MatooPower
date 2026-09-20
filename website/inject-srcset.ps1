# Matoo Power - HTML img 标签 srcset 注入（IndexOf 版）
# 为已有的 /assets/{name}.jpg 图自动添加 srcset 多尺寸声明

$htmlDir = 'e:\MatooPower\website'

# 需要添加 srcset 的图片（页面：图片路径列表）
$targets = @{
    'products.html' = @(
        'product-power01-front.jpg',
        'product-power02-front.jpg',
        'product-powerbox-front.jpg',
        'product-powerbox-stack2.jpg',
        'product-powerbox-stack4.jpg',
        'product-powerbox-interior.jpg',
        'product-power01-side.jpg',
        'product-power01-carrying.jpg',
        'product-power01-charging.jpg',
        'product-power02-side.jpg',
        'product-power02-stack2.jpg',
        'product-motor-controller-front.jpg',
        'product-motor-controller-mounted.jpg',
        'scenario-home-evening.jpg',
        'scenario-home-kitchen.jpg',
        'scenario-home-office.jpg',
        'scenario-camping.jpg',
        'scenario-rv.jpg',
        'scenario-island.jpg',
        'scenario-boat.jpg',
        'scenario-nightmarket.jpg',
        'scenario-telecom.jpg',
        'scenario-shop.jpg',
        'scenario-e-rickshaw.jpg',
        'scenario-e-tuktuk.jpg',
        'scenario-solar-home.jpg',
        'scenario-solar-farm.jpg',
        'scenario-disaster.jpg',
        'scenario-emergency.jpg'
    )
    'partnership.html' = @(
        'region-south-asia.jpg',
        'region-africa.jpg',
        'region-mena.jpg',
        'region-sea.jpg',
        'scenario-nightmarket.jpg',
        'scenario-farm.jpg',
        'scenario-telecom.jpg',
        'scenario-e-rickshaw.jpg'
    )
    'index.html' = @(
        'scenario-home-evening.jpg',
        'scenario-camping.jpg',
        'scenario-telecom.jpg',
        'scenario-e-rickshaw.jpg'
    )
    'manufacturing.html' = @(
        'factory-floor.jpg',
        'factory-assembly.jpg',
        'factory-warehouse.jpg'
    )
    'insights.html' = @(
        'insight-cover-01.jpg',
        'insight-cover-02.jpg',
        'insight-cover-03.jpg',
        'insight-cover-04.jpg',
        'insight-cover-05.jpg',
        'insight-cover-06.jpg'
    )
    'about.html' = @()
    'technology.html' = @()
    'contact.html' = @()
    'configurator.html' = @()
}

# 图片尺寸档
function Get-Sizes {
    param([string]$name)
    if ($name -match '^product-') {
        return @(480, 800)
    } elseif ($name -match '^scenario-') {
        return @(800, 1200)
    } elseif ($name -match '^hero-') {
        return @(1200, 1920)
    } elseif ($name -match '^region-') {
        return @(800, 1200)
    } elseif ($name -match '^factory-') {
        return @(800, 1200)
    } elseif ($name -match '^insight-cover-') {
        return @(800, 1200)
    } else {
        return @(1200)
    }
}

function Build-Srcset {
    param([string]$name)
    $sizes = Get-Sizes $name
    $base = $name -replace '\.jpg$', ''
    $parts = @()
    foreach ($w in $sizes) {
        $parts += "/assets/${base}@${w}.jpg ${w}w"
    }
    return ($parts -join ', ')
}

Write-Host '[srcset] Injecting responsive image attributes...' -ForegroundColor Cyan
$total = 0

foreach ($fileName in $targets.Keys) {
    $path = Join-Path $htmlDir $fileName
    if (-not (Test-Path $path)) { continue }
    $content = [System.IO.File]::ReadAllText($path)
    $modified = $false

    foreach ($img in $targets[$fileName]) {
        $base = $img -replace '\.jpg$', ''
        $srcset = Build-Srcset $img

        # 检测：若 srcset 已经包含对应的 base@ 标记，跳过
        $marker = 'srcset="/assets/' + $base + '@'
        if ($content.Contains($marker)) { continue }

        # 用 IndexOf 定位 <img src="/assets/{img}"
        $needle = '<img src="/assets/' + $img + '"'
        $idx = $content.IndexOf($needle)
        if ($idx -lt 0) { continue }

        # 在 src 引号后插入 srcset 属性
        $insertAt = $idx + $needle.Length
        $nl = "`r`n"
        $insert = $nl + '             srcset="' + $srcset + '"'
        $content = $content.Substring(0, $insertAt) + $insert + $content.Substring($insertAt)
        $modified = $true
        $total++
    }

    if ($modified) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        $msg = '    + ' + $fileName + ' : ' + $targets[$fileName].Count + ' imgs targeted'
        Write-Host $msg -ForegroundColor Gray
    }
}

Write-Host ''
Write-Host ('srcset injection complete: ' + $total + ' images') -ForegroundColor Green