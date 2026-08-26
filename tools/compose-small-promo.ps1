$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$ArtifactDir = "C:\Users\atakan\.gemini\antigravity\brain\86ea5766-5445-468c-9295-e49a148787bd"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$StoreDir = Join-Path $ProjectRoot "store-assets"
$SourcePath = Join-Path $ArtifactDir "promo_small_440x280_clean_v2_1787786295866.jpg"

$srcBmp = [System.Drawing.Bitmap]::FromFile($SourcePath)

# High-resolution canvas (880 x 560 = 2x Retina for 440x280)
$canvasW = 880
$canvasH = 560
$targetBmp = New-Object System.Drawing.Bitmap($canvasW, $canvasH, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($targetBmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# 1. Subtle, toned-down dark background with gentle red radial gradient
$g.Clear([System.Drawing.Color]::FromArgb(8, 6, 8))

# Subdued soft background glow behind logo and popup (toned down holo)
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0, 0)),
  (New-Object System.Drawing.Point($canvasW, $canvasH)),
  [System.Drawing.Color]::FromArgb(18, 9, 11),
  [System.Drawing.Color]::FromArgb(6, 4, 6)
)
$g.FillRectangle($bgBrush, 0, 0, $canvasW, $canvasH)
$bgBrush.Dispose()

# Soft subdued red glow on right side behind popup
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(450, 60, 420, 440)
$pbg = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
$pbg.CenterColor = [System.Drawing.Color]::FromArgb(45, 12, 16)
$pbg.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 8, 6, 8))
$g.FillPath($pbg, $path)
$pbg.Dispose()
$path.Dispose()

# Soft subdued red glow behind logo on left
$pathLogo = New-Object System.Drawing.Drawing2D.GraphicsPath
$pathLogo.AddEllipse(40, 100, 320, 360)
$pbgLogo = New-Object System.Drawing.Drawing2D.PathGradientBrush($pathLogo)
$pbgLogo.CenterColor = [System.Drawing.Color]::FromArgb(35, 10, 14)
$pbgLogo.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 8, 6, 8))
$g.FillPath($pbgLogo, $pathLogo)
$pbgLogo.Dispose()
$pathLogo.Dispose()

# 2. Extract Logo from source (source coordinates: X: 40 to 330, Y: 270 to 570)
# In 1264x848 source:
# Logo center is around X=180, Y=425, width/height ~ 260x260
$logoRectSrc = [System.Drawing.Rectangle]::new(40, 270, 290, 300)
$logoRectDst = [System.Drawing.Rectangle]::new(50, 130, 280, 290)
$g.DrawImage($srcBmp, $logoRectDst, $logoRectSrc, [System.Drawing.GraphicsUnit]::Pixel)

# 3. Extract 3D Popup Menu from source (natural dark UI with NO neon LED tube border)
# In 1264x848 source:
# Popup card is from X: 730 to 1210, Y: 120 to 760 (width ~ 480, height ~ 640)
$popupRectSrc = [System.Drawing.Rectangle]::new(740, 130, 460, 620)
# Make popup menu significantly LARGER and taller vertically:
$popupRectDst = [System.Drawing.Rectangle]::new(410, 20, 440, 520)
$g.DrawImage($srcBmp, $popupRectDst, $popupRectSrc, [System.Drawing.GraphicsUnit]::Pixel)

$g.Dispose()
$srcBmp.Dispose()

# Downsample high-res 880x560 to exact 440x280 (Format24bppRgb)
$finalBmp = New-Object System.Drawing.Bitmap(440, 280, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$fg = [System.Drawing.Graphics]::FromImage($finalBmp)
$fg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$fg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$fg.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$fg.DrawImage($targetBmp, 0, 0, 440, 280)
$fg.Dispose()
$targetBmp.Dispose()

# Save final images
$outPath = Join-Path $StoreDir "promo-small-440x280.png"
$artOutPath = Join-Path $ArtifactDir "promo-small-440x280.png"
$finalBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$finalBmp.Save($artOutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$finalBmp.Dispose()

Write-Host "Generated promo-small-440x280.png: 440x280 Format24bppRgb (Enlarged natural popup, toned down holo, no LED border)"
