# Adds UTF-8 BOM to deploy-fix-all.ps1 so Windows PowerShell 5.x reads it correctly
$path = "e:\MatooPower\website\deploy-fix-all.ps1"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$utf8Bom = New-Object System.Text.UTF8Encoding $True
[System.IO.File]::WriteAllText($path, $content, $utf8Bom)
Write-Host "BOM added to deploy-fix-all.ps1" -ForegroundColor Green
