$ErrorActionPreference = 'Stop'

$path = $PSCommandPath
$bytes = [System.IO.File]::ReadAllBytes($path)
if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
    $newBytes = New-Object byte[] ($bytes.Length + 3)
    $newBytes[0] = 0xEF; $newBytes[1] = 0xBB; $newBytes[2] = 0xBF
    [Array]::Copy($bytes, 0, $newBytes, 3, $bytes.Length)
    [System.IO.File]::WriteAllBytes($path, $newBytes)
}

$mainJs = "e:\MatooPower\website\scripts\main.js"
$utf8Bom = New-Object System.Text.UTF8Encoding $True
$utf8NoBom = New-Object System.Text.UTF8Encoding $False

$content = [System.IO.File]::ReadAllText($mainJs, $utf8NoBom)
$original = $content

# Helper: replace single char with 2-char string (PS Replace(char, char) is too strict)
function ReplaceSingleChar([string]$text, [char]$find, [string]$replacement) {
    $result = New-Object System.Text.StringBuilder $text.Length
    for ($i = 0; $i -lt $text.Length; $i++) {
        if ($text[$i] -eq $find) {
            [void]$result.Append($replacement)
        } else {
            [void]$result.Append($text[$i])
        }
    }
    return $result.ToString()
}

# Replace U+8DEF (-> used as arrow in comments)
$count = 0
while ($content.IndexOf([char]0x8DEF) -ge 0) {
    $content = ReplaceSingleChar $content ([char]0x8DEF) '->'
    $count++
    if ($count -gt 200) { break }
}

# Replace U+9259 (checkmark)
$count2 = 0
while ($content.IndexOf([char]0x9259) -ge 0) {
    $content = ReplaceSingleChar $content ([char]0x9259) ([char]0x2713).ToString()
    $count2++
    if ($count2 -gt 200) { break }
}

# Replace U+9275 + ? (em-dash corruption)
$count3 = 0
$emPattern = [char]0x9275 + [char]0x3F
while ($content.IndexOf($emPattern) -ge 0) {
    $content = $content.Replace($emPattern, ([char]0x2014).ToString())
    $count3++
    if ($count3 -gt 200) { break }
}

if ($content -ne $original) {
    [System.IO.File]::WriteAllText($mainJs, $content, $utf8Bom)
    Write-Host "[OK] main.js encoding cleanup: $count U+8DEF (->), $count2 U+9259 (checkmark), $count3 em-dash" -ForegroundColor Green
} else {
    Write-Host "[SKIP] main.js already clean" -ForegroundColor Yellow
}
