$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$OutDir = Join-Path $ProjectRoot "store-assets"
$SourceDir = Join-Path $OutDir "sources"
$IconPath = Join-Path $ProjectRoot "extension\icons\icon128.png"

$SourceLive = Join-Path $SourceDir "popup-live-list.png"
$SourceLeague = Join-Path $SourceDir "popup-league-detail.png"
$SourceMatch = Join-Path $SourceDir "popup-match-detail.png"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

foreach ($source in @($SourceLive, $SourceLeague, $SourceMatch)) {
  if (-not (Test-Path $source)) {
    throw "Missing source screenshot: $source. Capture the popup screenshots before regenerating store assets."
  }
}

function New-Bitmap24 {
  param([int] $Width, [int] $Height)
  New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
}

function New-Color {
  param([string] $Hex)
  [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function New-Brush {
  param([string] $Hex)
  [System.Drawing.SolidBrush]::new((New-Color $Hex))
}

function New-AlphaBrush {
  param([int] $Alpha, [string] $Hex)
  $base = New-Color $Hex
  [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($Alpha, $base.R, $base.G, $base.B))
}

function New-AlphaColor {
  param([int] $Alpha, [string] $Hex)
  $base = New-Color $Hex
  [System.Drawing.Color]::FromArgb($Alpha, $base.R, $base.G, $base.B)
}

function New-Pen {
  param([string] $Hex, [float] $Width = 1)
  [System.Drawing.Pen]::new((New-Color $Hex), $Width)
}

function New-RoundedPath {
  param([float] $X, [float] $Y, [float] $Width, [float] $Height, [float] $Radius)

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $path
}

function Fill-RoundedRect {
  param($Graphics, $Brush, [float] $X, [float] $Y, [float] $Width, [float] $Height, [float] $Radius)

  $path = New-RoundedPath $X $Y $Width $Height $Radius
  $Graphics.FillPath($Brush, $path)
  $path.Dispose()
}

function Stroke-RoundedRect {
  param($Graphics, $Pen, [float] $X, [float] $Y, [float] $Width, [float] $Height, [float] $Radius)

  $path = New-RoundedPath $X $Y $Width $Height $Radius
  $Graphics.DrawPath($Pen, $path)
  $path.Dispose()
}

function Draw-Text {
  param(
    $Graphics,
    [string] $Text,
    [string] $FontName,
    [float] $Size,
    [string] $Style,
    [string] $Color,
    [float] $X,
    [float] $Y,
    [float] $Width,
    [float] $Height,
    [string] $Align = "Near"
  )

  $fontStyle = [System.Drawing.FontStyle]::Regular
  if ($Style -match "Bold") {
    $fontStyle = $fontStyle -bor [System.Drawing.FontStyle]::Bold
  }

  $font = [System.Drawing.Font]::new($FontName, $Size, $fontStyle, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Brush $Color
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::$Align
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
  $rect = [System.Drawing.RectangleF]::new($X, $Y, $Width, $Height)

  $Graphics.DrawString($Text, $font, $brush, $rect, $format)

  $format.Dispose()
  $brush.Dispose()
  $font.Dispose()
}

function Draw-StoreBackground {
  param($Graphics, [int] $Width, [int] $Height)

  $rect = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
  $base = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    (New-Color "#160808"),
    (New-Color "#040303"),
    90
  )
  $blend = [System.Drawing.Drawing2D.Blend]::new()
  $blend.Positions = [float[]] @(0, 0.42, 0.72, 1)
  $blend.Factors = [float[]] @(0.95, 0.62, 0.18, 0.02)
  $base.Blend = $blend
  $Graphics.FillRectangle($base, $rect)
  $base.Dispose()

  # Full-canvas color blends create soft studio light without visible circular blobs or hard polygon edges.
  $goldWash = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    (New-AlphaColor 0 "#d69b40"),
    (New-AlphaColor 0 "#d69b40"),
    24
  )
  $goldBlend = [System.Drawing.Drawing2D.ColorBlend]::new()
  $goldBlend.Positions = [float[]] @(0, 0.13, 0.32, 1)
  $goldBlend.Colors = [System.Drawing.Color[]] @(
    (New-AlphaColor 34 "#e0a94c"),
    (New-AlphaColor 46 "#b88338"),
    (New-AlphaColor 0 "#b88338"),
    (New-AlphaColor 0 "#b88338")
  )
  $goldWash.InterpolationColors = $goldBlend
  $Graphics.FillRectangle($goldWash, $rect)
  $goldWash.Dispose()

  $redBeam = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    (New-AlphaColor 0 "#ff4444"),
    (New-AlphaColor 0 "#ff4444"),
    -24
  )
  $redBlend = [System.Drawing.Drawing2D.ColorBlend]::new()
  $redBlend.Positions = [float[]] @(0, 0.38, 0.52, 0.64, 1)
  $redBlend.Colors = [System.Drawing.Color[]] @(
    (New-AlphaColor 0 "#5a1414"),
    (New-AlphaColor 8 "#5a1414"),
    (New-AlphaColor 80 "#661717"),
    (New-AlphaColor 18 "#2a0a0a"),
    (New-AlphaColor 0 "#2a0a0a")
  )
  $redBeam.InterpolationColors = $redBlend
  $Graphics.FillRectangle($redBeam, $rect)
  $redBeam.Dispose()

  $subtleEdge = [System.Drawing.Pen]::new((New-AlphaColor 28 "#ff5b5b"), [Math]::Max(10, [int]($Width * 0.012)))
  $Graphics.DrawLine(
    $subtleEdge,
    [int]($Width * 0.58),
    -[int]($Height * 0.08),
    [int]($Width * 0.82),
    [int]($Height * 1.08)
  )
  $subtleEdge.Dispose()

  $floorRect = [System.Drawing.Rectangle]::new(0, [int]($Height * 0.66), $Width, [int]($Height * 0.34))
  $floorBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $floorRect,
    (New-AlphaColor 0 "#000000"),
    (New-AlphaColor 210 "#000000"),
    90
  )
  $Graphics.FillRectangle($floorBrush, $floorRect)
  $floorBrush.Dispose()

  $vignettePen = [System.Drawing.Pen]::new((New-AlphaColor 92 "#000000"), [Math]::Max(34, [int]($Width * 0.045)))
  $Graphics.DrawRectangle($vignettePen, 0, 0, $Width, $Height)
  $vignettePen.Dispose()
}

function Draw-AppIcon {
  param($Graphics, [int] $X, [int] $Y, [int] $Size)

  $shadow = New-AlphaBrush 150 "#000000"
  Fill-RoundedRect $Graphics $shadow ($X + 6) ($Y + 9) $Size $Size 22
  $shadow.Dispose()

  if (Test-Path $IconPath) {
    $image = [System.Drawing.Image]::FromFile($IconPath)
    $Graphics.DrawImage($image, [System.Drawing.Rectangle]::new($X, $Y, $Size, $Size))
    $image.Dispose()
    return
  }

  $brush = New-Brush "#1f0d0d"
  Fill-RoundedRect $Graphics $brush $X $Y $Size $Size 22
  $brush.Dispose()
  Draw-Text $Graphics "H" "Georgia" ($Size * 0.58) "Bold" "#ff4444" $X ($Y + $Size * 0.17) $Size $Size "Center"
}

function Draw-Pill {
  param($Graphics, [string] $Text, [float] $X, [float] $Y, [float] $Width, [string] $Fill = "#451515")

  $brush = New-Brush $Fill
  $pen = New-Pen "#743030" 1
  Fill-RoundedRect $Graphics $brush $X $Y $Width 40 20
  Stroke-RoundedRect $Graphics $pen $X $Y $Width 40 20
  $brush.Dispose()
  $pen.Dispose()
  Draw-Text $Graphics $Text "Trebuchet MS" 15 "Bold" "#fff1f1" $X ($Y + 11) $Width 22 "Center"
}

function Draw-ScreenshotCard {
  param(
    $Graphics,
    [string] $ImagePath,
    [int] $X,
    [int] $Y,
    [int] $Width,
    [int] $Height,
    [int] $Radius = 28
  )

  $shadow = New-AlphaBrush 145 "#000000"
  Fill-RoundedRect $Graphics $shadow ($X + 18) ($Y + 22) $Width $Height $Radius
  $shadow.Dispose()

  $image = [System.Drawing.Image]::FromFile($ImagePath)
  $cropWidth = $image.Width
  $cropHeight = $image.Height
  $sourceRect = [System.Drawing.Rectangle]::new(0, 0, $cropWidth, $cropHeight)

  $scaled = New-Bitmap24 $Width $Height
  $scaledGraphics = [System.Drawing.Graphics]::FromImage($scaled)
  $scaledGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $scaledGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scaledGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $scaledGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  if (
    $Width -eq $cropWidth -and
    $Height -eq $cropHeight -and
    $cropWidth -eq $image.Width -and
    $cropHeight -eq $image.Height
  ) {
    $scaledGraphics.DrawImageUnscaled($image, 0, 0)
  } else {
    $scaledGraphics.DrawImage(
      $image,
      [System.Drawing.Rectangle]::new(0, 0, $Width, $Height),
      $sourceRect,
      [System.Drawing.GraphicsUnit]::Pixel
    )
  }
  $scaledGraphics.Dispose()

  $roundedPath = New-RoundedPath $X $Y $Width $Height $Radius
  $texture = [System.Drawing.TextureBrush]::new($scaled)
  $texture.TranslateTransform($X, $Y)
  $Graphics.FillPath($texture, $roundedPath)
  $texture.Dispose()
  $scaled.Dispose()

  $border = New-Pen "#692323" 2
  $Graphics.DrawPath($border, $roundedPath)
  $border.Dispose()
  $roundedPath.Dispose()
  $image.Dispose()
}

function Draw-FeatureCard {
  param($Graphics, [string] $Title, [string] $Body, [int] $X, [int] $Y, [int] $Width)

  $brush = New-AlphaBrush 190 "#160909"
  $pen = New-Pen "#4d1b1b" 1
  Fill-RoundedRect $Graphics $brush $X $Y $Width 88 24
  Stroke-RoundedRect $Graphics $pen $X $Y $Width 88 24
  $brush.Dispose()
  $pen.Dispose()

  Draw-Text $Graphics $Title "Trebuchet MS" 17 "Bold" "#ff6b6b" ($X + 22) ($Y + 16) ($Width - 44) 26
  Draw-Text $Graphics $Body "Trebuchet MS" 14 "Regular" "#d8c8c8" ($X + 22) ($Y + 45) ($Width - 44) 34
}

function New-Canvas {
  param([int] $Width, [int] $Height)

  $bitmap = New-Bitmap24 $Width $Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  Draw-StoreBackground $graphics $Width $Height
  @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-Png24 {
  param($Bitmap, [string] $Path)
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Complete-Canvas {
  param($Canvas, [string] $Path)
  $Canvas.Graphics.Dispose()
  Save-Png24 $Canvas.Bitmap $Path
  $Canvas.Bitmap.Dispose()
}

# 1400x560 marquee promo
$canvas = New-Canvas 1400 560
$g = $canvas.Graphics
Draw-AppIcon $g 88 76 96
Draw-Text $g "Hype Scores" "Georgia" 78 "Bold" "#fff0f0" 86 194 620 96
Draw-Text $g "Live Football Scores" "Trebuchet MS" 36 "Bold" "#ff6b6b" 92 292 540 48
Draw-Text $g "Live scores, league tables and match details in a focused Chrome popup." "Trebuchet MS" 24 "Regular" "#d4c4c4" 94 358 600 72
Draw-ScreenshotCard $g $SourceLeague 762 58 424 438 30
Draw-ScreenshotCard $g $SourceLive 1004 34 346 358 28
Complete-Canvas $canvas (Join-Path $OutDir "promo-marquee-1400x560.png")

# 440x280 small promo
$canvas = New-Canvas 440 280
$g = $canvas.Graphics
Draw-AppIcon $g 30 34 58
Draw-Text $g "Hype Scores" "Georgia" 34 "Bold" "#fff0f0" 104 38 300 46
Draw-Text $g "Live scores, standings and match details." "Trebuchet MS" 16 "Bold" "#ffbaba" 106 86 230 48
Draw-ScreenshotCard $g $SourceLive 286 102 126 130 18
Complete-Canvas $canvas (Join-Path $OutDir "promo-small-440x280.png")

$screens = @(
  @{
    File = "screenshot-1-live-scores-1280x800.png"
    Source = $SourceLive
    Title = "Live Scores"
    Body = "Curated leagues, clear live badges, team and league logos, and a clean scrollable popup."
  },
  @{
    File = "screenshot-2-standings-1280x800.png"
    Source = $SourceLeague
    Title = "League Tables"
    Body = "Open a league to see live matches, results, and full standings loaded only when needed."
  },
  @{
    File = "screenshot-3-match-detail-1280x800.png"
    Source = $SourceMatch
    Title = "Match Details"
    Body = "Kickoff, venue, scoreline, stats, timeline, lineups, commentary, news and links stay one click away."
  }
)

foreach ($screen in $screens) {
  $canvas = New-Canvas 1280 800
  $g = $canvas.Graphics
  Draw-Text $g $screen.Title "Georgia" 54 "Bold" "#fff0f0" 78 78 560 72
  Draw-Text $g $screen.Body "Trebuchet MS" 23 "Regular" "#d4c4c4" 82 162 510 106
  Draw-ScreenshotCard $g $screen.Source 616 78 580 600 34
  Complete-Canvas $canvas (Join-Path $OutDir $screen.File)
}

Get-ChildItem $OutDir -Filter "*.png" | Sort-Object Name | ForEach-Object {
  $image = [System.Drawing.Image]::FromFile($_.FullName)
  $result = "{0}: {1}x{2} {3}" -f $_.Name, $image.Width, $image.Height, $image.PixelFormat
  $image.Dispose()
  $result
}
