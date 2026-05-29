param(
  [Parameter(Mandatory = $true)]
  [string]$ImagePath
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]

function Await($AsyncOperation) {
  return [System.WindowsRuntimeSystemExtensions]::AsTask($AsyncOperation).GetAwaiter().GetResult()
}

$file = Await([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath))
$stream = Await($file.OpenAsync([Windows.Storage.FileAccessMode]::Read))
$decoder = Await([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream))
$softwareBitmap = Await($decoder.GetSoftwareBitmapAsync())
$ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()

if ($null -eq $ocrEngine) {
  throw "Windows OCR engine is not available on this system."
}

$result = Await($ocrEngine.RecognizeAsync($softwareBitmap))

if ($null -eq $result) {
  return
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$blocks = @()
$lineIndex = 0

foreach ($line in $result.Lines) {
  $words = @($line.Words)
  if ($words.Count -eq 0) {
    continue
  }

  $left = ($words | ForEach-Object { $_.BoundingRect.X } | Measure-Object -Minimum).Minimum
  $top = ($words | ForEach-Object { $_.BoundingRect.Y } | Measure-Object -Minimum).Minimum
  $right = ($words | ForEach-Object { $_.BoundingRect.X + $_.BoundingRect.Width } | Measure-Object -Maximum).Maximum
  $bottom = ($words | ForEach-Object { $_.BoundingRect.Y + $_.BoundingRect.Height } | Measure-Object -Maximum).Maximum

  $blocks += [PSCustomObject]@{
    id = "line_$lineIndex"
    text = $line.Text
    box = [PSCustomObject]@{
      x = [Math]::Round($left, 2)
      y = [Math]::Round($top, 2)
      width = [Math]::Round($right - $left, 2)
      height = [Math]::Round($bottom - $top, 2)
    }
    lineIndex = $lineIndex
    blockIndex = $lineIndex
  }
  $lineIndex += 1
}

$payload = [PSCustomObject]@{
  text = ($result.Lines | ForEach-Object { $_.Text }) -join [Environment]::NewLine
  blocks = $blocks
  canvas = [PSCustomObject]@{
    width = $softwareBitmap.PixelWidth
    height = $softwareBitmap.PixelHeight
  }
}

$payload | ConvertTo-Json -Depth 8 -Compress
