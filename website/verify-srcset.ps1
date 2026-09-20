# 验证所有 HTML 文件没有反引号
$htmlDir = 'e:\MatooPower\website'
$files = Get-ChildItem "$htmlDir\*.html"
$total = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $bt = ([regex]::Matches($content, [char]96)).Count
    $srcset = ([regex]::Matches($content, 'srcset=')).Count
    Write-Host ('  ' + $file.Name + ' : backtick=' + $bt + ' srcset=' + $srcset)
    $total += $bt
}
Write-Host ''
Write-Host ('Total backticks: ' + $total)