$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$ArtifactDir = "C:\Users\atakan\.gemini\antigravity\brain\86ea5766-5445-468c-9295-e49a148787bd"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$StoreDir = Join-Path $ProjectRoot "store-assets"

# Let's test promo_small_440x280_large_v3_1787786656458.jpg and promo_small_440x280_clean_v2_1787786295866.jpg
$srcPath = Join-Path $ArtifactDir "promo_small_440x280_clean_v2_1787786295866.jpg"
$srcImg = [System.Drawing.Image]::FromFile($srcPath)

Write-Host "Source: $($srcImg.Width) x $($srcImg.Height)"

# In promo_small_440x280_clean_v2_1787786295866.jpg:
# Logo is around X: 50..340, Y: 270..570
# Popup is around X: 730..1220, Y: 120..760
# If we extract both and compose them with seamless feathered blending onto a rich dark red gradient background:
# We can make the popup menu as large as 320px wide (covering 70% of 440px width) and 260px tall (covering 93% of 280px height)!

$canvasW = 880
$canvasH = 560
$targetBmp = New-Object System.Drawing.Bitmap($canvasW, $canvasH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($targetBmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# 1. Base dark background with rich red glow
$g.Clear([System.Drawing.Color]::FromArgb(6, 4, 6))

$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0, 0)),
  (New-Object System.Drawing.Point($canvasW, $canvasH)),
  [System.Drawing.Color]::FromArgb(16, 7, 10),
  [System.Drawing.Color]::FromArgb(4, 3, 5)
)
$g.FillRectangle($bgBrush, 0, 0, $canvasW, $canvasH)
$bgBrush.Dispose()

# Soft glow behind popup on right
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(350, 40, 520, 500)
$pbg = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
$pbg.CenterColor = [System.Drawing.Color]::FromArgb(45, 10, 14)
$pbg.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 4, 3, 5))
$g.FillPath($pbg, $path)
$pbg.Dispose()
$path.Dispose()

# 2. Draw the whole source image scaled & positioned so the popup is HUGE on the right
# In source, popup is at X: 730..1220 (width 490), Y: 120..760 (height 640)
# We draw the popup region directly to fill X: 320..850, Y: 15..545 (height 530 out of 560 = 95% height!)
$popupSrc = [System.Drawing.Rectangle]::new(725, 115, 500, 650)
$popupDst = [System.Drawing.Rectangle]::new(310, 15, 545, 530)
$g.DrawImage($srcImg, $popupDst, $popupSrc, [System.Drawing.GraphicsUnit]::Pixel)

# 3. Draw the Logo seamlessly on the left (X: 30..300, Y: 130..430)
$logoSrc = [System.Drawing.Rectangle]::new(40, 260, 300, 320)
$logoDst = [System.Drawing.Rectangle]::new(20, 120, 290, 310)

# To avoid any square seam: we feather/blend the logo edges smoothly using a circular gradient mask!
$logoBmp = New-Object System.Drawing.Bitmap($logoDst.Width, $logoDst.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$lg = [System.Drawing.Graphics]::FromImage($logoBmp)
$lg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$lg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$lg.DrawImage($srcImg, (New-Object System.Drawing.Rectangle(0, 0, $logoDst.Width, $logoDst.Height)), $logoSrc, [System.Drawing.GraphicsUnit]::Pixel)
$lg.Dispose()

# Apply radial alpha mask to logoBmp so outer square edges fade to 100% transparent smoothly
$centerX = $logoDst.Width / 2.0
$centerY = $logoDst.Height / 2.0
$maxRadius = [Math]::Min($centerX, $centerY)
$innerRadius = $maxRadius * 0.70

for ($y = 0; $y -lt $logoDst.Height; $y++) {
  for ($x = 0; $x -lt $logoDst.Width; $x++) {
    $c = $logoBmp.GetPixel($x, $y)
    $dx = $x - $centerX
    $dy = $y - $centerY
    $dist = [Math]::Sqrt($dx * $dx + $dy * $dy)
    if ($dist -gt $maxRadius) {
      $logoBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $c.R, $c.G, $c.B))
    } elseif ($dist -gt $innerRadius) {
      $alphaFactor = 1.0 - (($dist - $innerRadius) / ($maxRadius - $innerRadius))
      # smooth cosine roll-off
      $smoothAlpha = (1.0 - [Math]::Cos($alphaFactor * [Math]::PI)) / 2.0
      $newA = [int]($c.A * $smoothAlpha)
      $logoBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($newA, $c.R, $c.G, $c.B))
    }
  }
}

$g.DrawImage($logoBmp, $logoDst.X, $logoDst.Y)
$logoBmp.Dispose()
$g.Dispose()
$srcImg.Dispose()

# Downsample to exact 440x280 Format24bppRgb
$finalBmp = New-Object System.Drawing.Bitmap(440, 280, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$fg = [System.Drawing.Graphics]::FromImage($finalBmp)
$fg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$fg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$fg.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$fg.DrawImage($targetBmp, 0, 0, 440, 280)
$fg.Dispose()
$targetBmp.Dispose()

$outPath = Join-Path $StoreDir "promo-small-440x280.png"
$artOutPath = Join-Path $ArtifactDir "promo-small-440x280.png"
$finalBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$finalBmp.Save($artOutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$finalBmp.Dispose()

Write-Host "Generated seamless 440x280 with massive popup menu and circular feathered logo!"
