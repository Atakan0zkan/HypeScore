$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$ArtifactDir = "C:\Users\atakan\.gemini\antigravity\brain\86ea5766-5445-468c-9295-e49a148787bd"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$StoreDir = Join-Path $ProjectRoot "store-assets"

$mappings = @(
  @{ Source = "store_screenshot_1_live_scores_1787759957908.jpg"; Target = "screenshot-1-live-scores-1280x800.png"; W = 1280; H = 800 },
  @{ Source = "store_screenshot_2_standings_1787759986558.jpg"; Target = "screenshot-2-standings-1280x800.png"; W = 1280; H = 800 },
  @{ Source = "store_screenshot_3_match_details_1787760011762.jpg"; Target = "screenshot-3-match-detail-1280x800.png"; W = 1280; H = 800 },
  @{ Source = "store_screenshot_4_tournaments_1787760035146.jpg"; Target = "screenshot-4-tournaments-1280x800.png"; W = 1280; H = 800 },
  @{ Source = "store_screenshot_5_global_leagues_1787760096007.jpg"; Target = "screenshot-5-multi-league-1280x800.png"; W = 1280; H = 800 },
  @{ Source = "store_promo_small_440x280_1787760117107.jpg"; Target = "promo-small-440x280.png"; W = 440; H = 280 },
  @{ Source = "store_promo_marquee_1400x560_1787760137740.jpg"; Target = "promo-marquee-1400x560.png"; W = 1400; H = 560 }
)

foreach ($item in $mappings) {
  $srcPath = Join-Path $ArtifactDir $item.Source
  $dstPath = Join-Path $StoreDir $item.Target
  $artDstPath = Join-Path $ArtifactDir $item.Target

  if (-not (Test-Path $srcPath)) {
    throw "Missing source image: $srcPath"
  }

  $srcImg = [System.Drawing.Image]::FromFile($srcPath)

  $bmp = New-Object System.Drawing.Bitmap($item.W, $item.H, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  $srcRatio = [double]$srcImg.Width / [double]$srcImg.Height
  $tgtRatio = [double]$item.W / [double]$item.H

  if ($srcRatio -gt $tgtRatio) {
    $cropW = [int]($srcImg.Height * $tgtRatio)
    $cropH = $srcImg.Height
    $cropX = [int](($srcImg.Width - $cropW) / 2)
    $cropY = 0
  } else {
    $cropW = $srcImg.Width
    $cropH = [int]($srcImg.Width / $tgtRatio)
    $cropX = 0
    $cropY = [int](($srcImg.Height - $cropH) / 2)
  }

  $srcRect = [System.Drawing.Rectangle]::new($cropX, $cropY, $cropW, $cropH)
  $tgtRect = [System.Drawing.Rectangle]::new(0, 0, $item.W, $item.H)

  $g.DrawImage($srcImg, $tgtRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $srcImg.Dispose()

  $bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Save($artDstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()

  Write-Host "Processed $($item.Target): $($item.W)x$($item.H) Format24bppRgb"
}
