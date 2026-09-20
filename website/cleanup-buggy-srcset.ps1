# 回滚：去掉所有 srcset= 行（因为有 bug）
$htmlDir = 'e:\MatooPower\website'
$files = Get-ChildItem "$htmlDir\*.html"
$total = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $original = $content

    # 匹配一整行 srcset 属性（含行首空白和换行）
    # 单行匹配：\r?\n\s+srcset="..."
    $pattern = '\r?\n\s+srcset="[^"]*"'
    $content = [regex]::Replace($content, $pattern, '')

    if ($content -ne $original) {
        $removed = ([regex]::Matches($original, $pattern)).Count
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host ('    - ' + $file.Name + ' : removed ' + $removed + ' buggy srcset lines')
        $total += $removed
    }
}

Write-Host ''
Write-Host ('Cleanup complete: ' + $total + ' buggy lines removed')