$ErrorActionPreference = 'Stop'

$path = $PSCommandPath
$bytes = [System.IO.File]::ReadAllBytes($path)
if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
    $newBytes = New-Object byte[] ($bytes.Length + 3)
    $newBytes[0] = 0xEF; $newBytes[1] = 0xBB; $newBytes[2] = 0xBF
    [Array]::Copy($bytes, 0, $newBytes, 3, $bytes.Length)
    [System.IO.File]::WriteAllBytes($path, $newBytes)
}

$insights = "e:\MatooPower\website\insights.html"
$utf8Bom = New-Object System.Text.UTF8Encoding $True
$utf8NoBom = New-Object System.Text.UTF8Encoding $False

$content = [System.IO.File]::ReadAllText($insights, $utf8NoBom)

# === Patch insight-cover-02.jpg (L306) ===
$old1 = '<img src="/assets/insight-cover-02.jpg" alt="article cover" loading="lazy" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-2);">'
$new1 = '<img src="/assets/insight-cover-02.jpg"' + "`r`n" + '         srcset="/assets/insight-cover-02@800.jpg 800w, /assets/insight-cover-02@1200.jpg 1200w" sizes="(max-width: 768px) 100vw, 480px"' + "`r`n" + '         alt="article cover" loading="lazy" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-2);">'
if ($content.Contains($old1)) {
    $content = $content.Replace($old1, $new1)
    Write-Host "[FIX 1] insight-cover-02.jpg srcset added" -ForegroundColor Green
} else {
    Write-Host "[SKIP 1] insight-cover-02.jpg pattern not found" -ForegroundColor Yellow
}

# === Patch insight-cover-04.jpg (L321) ===
$old2 = '<img src="/assets/insight-cover-04.jpg" alt="article cover" loading="lazy" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-2);">'
$new2 = '<img src="/assets/insight-cover-04.jpg"' + "`r`n" + '         srcset="/assets/insight-cover-04@800.jpg 800w, /assets/insight-cover-04@1200.jpg 1200w" sizes="(max-width: 768px) 100vw, 480px"' + "`r`n" + '         alt="article cover" loading="lazy" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-2);">'
if ($content.Contains($old2)) {
    $content = $content.Replace($old2, $new2)
    Write-Host "[FIX 2] insight-cover-04.jpg srcset added" -ForegroundColor Green
} else {
    Write-Host "[SKIP 2] insight-cover-04.jpg pattern not found" -ForegroundColor Yellow
}

# === Patch insight-cover-06.jpg (L336) ===
$old3 = '<img src="/assets/insight-cover-06.jpg" alt="article cover" loading="lazy" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-2);">'
$new3 = '<img src="/assets/insight-cover-06.jpg"' + "`r`n" + '         srcset="/assets/insight-cover-06@800.jpg 800w, /assets/insight-cover-06@1200.jpg 1200w" sizes="(max-width: 768px) 100vw, 480px"' + "`r`n" + '         alt="article cover" loading="lazy" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-2);">'
if ($content.Contains($old3)) {
    $content = $content.Replace($old3, $new3)
    Write-Host "[FIX 3] insight-cover-06.jpg srcset added" -ForegroundColor Green
} else {
    Write-Host "[SKIP 3] insight-cover-06.jpg pattern not found" -ForegroundColor Yellow
}

if ($content -ne ([System.IO.File]::ReadAllText($insights, $utf8NoBom))) {
    [System.IO.File]::WriteAllText($insights, $content, $utf8Bom)
    Write-Host ""
    Write-Host "[OK] insights.html srcset patches saved" -ForegroundColor Green
}
