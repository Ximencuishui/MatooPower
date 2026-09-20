$ErrorActionPreference = 'Stop'

$path = $PSCommandPath
$bytes = [System.IO.File]::ReadAllBytes($path)
if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
    $newBytes = New-Object byte[] ($bytes.Length + 3)
    $newBytes[0] = 0xEF; $newBytes[1] = 0xBB; $newBytes[2] = 0xBF
    [Array]::Copy($bytes, 0, $newBytes, 3, $bytes.Length)
    [System.IO.File]::WriteAllBytes($path, $newBytes)
}

$readme = "e:\MatooPower\h5-app\prototype\README.md"
$utf8 = New-Object System.Text.UTF8Encoding $True
$utf8NoBom = New-Object System.Text.UTF8Encoding $False

$content = [System.IO.File]::ReadAllText($readme, $utf8NoBom)

# Idempotency
if ($content.Contains('Next.js 16') -and $content.Contains('React 19')) {
    Write-Host "[SKIP] README already mentions Next.js 16 + React 19" -ForegroundColor Yellow
    exit 0
}

$oldLine = '- Next.js 14 (App Router) + React 18 + TypeScript'
$newLine = '- Next.js 16 (App Router) + React 19 + TypeScript'

if (-not $content.Contains($oldLine)) {
    Write-Host "[ERROR] Could not find old tech stack line" -ForegroundColor Red
    Write-Host "[DEBUG] Searching for 'Next.js'..." -ForegroundColor Gray
    foreach ($line in ($content -split "`r?`n")) {
        if ($line -match 'Next\.js' -or $line -match 'React') {
            Write-Host "  $line" -ForegroundColor Gray
        }
    }
    exit 1
}

$content = $content.Replace($oldLine, $newLine)

# Also update the "9 locked decisions" note to reflect any tech-stack-affecting decisions
# (none apply here, but add a clarifying line below the tech stack)
$appendix = ''
if (-not $content.Contains('See package.json for exact versions')) {
    $appendix = "`n- See `package.json` for exact versions (`next 16.3.5`, `react 19.2.0`)."
    $content = $content.Replace($newLine, $newLine + $appendix)
}

[System.IO.File]::WriteAllText($readme, $content, $utf8)
Write-Host "[OK] README.md tech stack updated: Next.js 14/18 -> Next.js 16/19" -ForegroundColor Green
