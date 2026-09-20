$f = "e:\MatooPower\website\products.html"
$utf8 = New-Object System.Text.UTF8Encoding $False
$c = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
$old = '                  <div style="aspect-ratio: 4/3; overflow: hidden;"><img src="/assets/scenario-e-rickshaw.jpg" alt="E-rickshaw" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;"></div>'
$new = '                  <div style="aspect-ratio: 4/3; overflow: hidden;"><img src="/assets/scenario-e-rickshaw.jpg"' + "`n" + '             srcset="/assets/scenario-e-rickshaw@800.jpg 800w, /assets/scenario-e-rickshaw@1200.jpg 1200w" alt="E-rickshaw" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;"></div>'
if ($c.Contains($old)) {
    $c2 = $c.Replace($old, $new)
    [System.IO.File]::WriteAllText($f, $c2, $utf8)
    Write-Host "[FIX] srcset added to scenario-e-rickshaw.jpg in products.html" -ForegroundColor Green
} else {
    Write-Host "[FAIL] pattern not found" -ForegroundColor Red
}
