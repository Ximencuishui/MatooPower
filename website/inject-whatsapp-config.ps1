$htmlDir = "e:\MatooPower\website"
$utf8 = New-Object System.Text.UTF8Encoding $False
$files = Get-ChildItem "$htmlDir\*.html"
$updated = 0

foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $original = $c

    # Idempotent: skip if already injected
    if ($c -notmatch 'whatsapp-config\.js') {
        # Match <script src="/scripts/main.js" defer></script> with optional defer/async
        $pattern = '<script\s+src="/scripts/main\.js"([^>]*)></script>'
        if ($c -match $pattern) {
            $attrs = $matches[1]
            $c = [regex]::Replace($c, $pattern,
                '<script src="/scripts/whatsapp-config.js"></script>' + "`r`n  " +
                '<script src="/scripts/main.js"' + $attrs + '></script>')
        }
    }

    if ($c -ne $original) {
        [System.IO.File]::WriteAllText($f.FullName, $c, $utf8)
        Write-Host "    [FIX] $($f.Name)" -ForegroundColor Green
        $updated++
    }
}
Write-Host ""
Write-Host "Updated $updated HTML file(s)" -ForegroundColor Green
