$ErrorActionPreference = 'Stop'

# Ensure BOM
$path = $PSCommandPath
$bytes = [System.IO.File]::ReadAllBytes($path)
if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
    $newBytes = New-Object byte[] ($bytes.Length + 3)
    $newBytes[0] = 0xEF; $newBytes[1] = 0xBB; $newBytes[2] = 0xBF
    [Array]::Copy($bytes, 0, $newBytes, 3, $bytes.Length)
    [System.IO.File]::WriteAllBytes($path, $newBytes)
}

$products = "e:\MatooPower\website\products.html"
$utf8Bom = New-Object System.Text.UTF8Encoding $True
$utf8NoBom = New-Object System.Text.UTF8Encoding $False

$content = [System.IO.File]::ReadAllText($products, $utf8NoBom)
$lines = $content -split "`r?`n"

$kept = @()
$removed = 0
for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    # Drop lines L516-L517: '  <script>' followed by '    // 规格书下载拦截（简化版）'
    # when they appear before another '  <script>'
    if ($line -eq '  <script>' -and ($i + 1) -lt $lines.Length -and $lines[$i + 1].StartsWith('    // ') -and ($i + 2) -lt $lines.Length -and $lines[$i + 2] -eq '  <script>') {
        # Skip this <script> tag and the stale comment, keep the next <script>
        $kept += $lines[$i + 2]
        $i += 2  # also skip the next two lines (comment + the inner script which we already added)
        $removed += 2
        continue
    }
    $kept += $line
}

if ($removed -gt 0) {
    $content = ($kept -join "`r`n")
    [System.IO.File]::WriteAllText($products, $content, $utf8Bom)
    Write-Host "[OK] Removed $removed stale lines" -ForegroundColor Green
} else {
    Write-Host "[INFO] No stale lines to remove" -ForegroundColor Yellow
}

# Sanity check
$openScripts = ([regex]::Matches($content, '<script[ >]')).Count
$closeScripts = ([regex]::Matches($content, '</script>')).Count
Write-Host ("[INFO] script tags: {0} open / {1} close" -f $openScripts, $closeScripts) -ForegroundColor Gray
