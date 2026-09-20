Add-Type -AssemblyName System.Drawing.Common -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
try {
  $bmp = New-Object System.Drawing.Bitmap 100, 100
  $codecs = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()
  $codecs | Select-Object MimeType, FilenameExtension | Format-Table -AutoSize
  Write-Host "--- ImageFormat list ---"
  [Enum]::GetNames([System.Drawing.Imaging.ImageFormat]) | ForEach-Object { Write-Host "  $_" }
  $bmp.Dispose()
} catch {
  Write-Host "Error: $($_.Exception.Message)"
}
Write-Host "--- cwebp check ---"
$cwebp = Get-Command cwebp -ErrorAction SilentlyContinue
if ($cwebp) { Write-Host "cwebp found: $($cwebp.Path)" } else { Write-Host "cwebp not found in PATH" }