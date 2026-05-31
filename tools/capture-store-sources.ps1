$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$SourceDir = Join-Path $ProjectRoot "store-assets\sources"
$PopupPath = Join-Path $ProjectRoot "extension\popup.html"
$ProfileDir = Join-Path $ProjectRoot ".chrome-store-capture-profile"

$ChromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$ChromePath = $ChromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $ChromePath) {
  throw "Chrome or Edge executable was not found."
}

New-Item -ItemType Directory -Force -Path $SourceDir | Out-Null
New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

function ConvertTo-FileUrl {
  param([string] $Path)
  "file:///" + ((Resolve-Path $Path).Path -replace "\\", "/")
}

function Receive-CdpMessage {
  param($Client)

  $buffer = New-Object byte[] 1048576
  $stream = [System.IO.MemoryStream]::new()

  do {
    $segment = [System.ArraySegment[byte]]::new($buffer)
    $result = $Client.ReceiveAsync($segment, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
    if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
      throw "Chrome DevTools websocket closed unexpectedly."
    }
    $stream.Write($buffer, 0, $result.Count)
  } until ($result.EndOfMessage)

  $text = [System.Text.Encoding]::UTF8.GetString($stream.ToArray())
  $stream.Dispose()
  $text | ConvertFrom-Json
}

$script:CdpId = 0
function Send-Cdp {
  param(
    $Client,
    [string] $Method,
    [hashtable] $Params = @{}
  )

  $script:CdpId += 1
  $payload = @{
    id = $script:CdpId
    method = $Method
  }
  if ($Params.Count -gt 0) {
    $payload.params = $Params
  }

  $json = $payload | ConvertTo-Json -Depth 20 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $segment = [System.ArraySegment[byte]]::new($bytes)
  $null = $Client.SendAsync(
    $segment,
    [System.Net.WebSockets.WebSocketMessageType]::Text,
    $true,
    [System.Threading.CancellationToken]::None
  ).GetAwaiter().GetResult()

  while ($true) {
    $message = Receive-CdpMessage $Client
    if ($message.id -ne $script:CdpId) {
      continue
    }
    if ($message.error) {
      throw ("CDP error in {0}: {1}" -f $Method, ($message.error | ConvertTo-Json -Compress))
    }
    return $message.result
  }
}

function Wait-CdpExpression {
  param(
    $Client,
    [string] $Expression
  )

  Send-Cdp $Client "Runtime.evaluate" @{
    expression = $Expression
    awaitPromise = $true
    returnByValue = $true
  } | Out-Null
}

function Wait-ForSelector {
  param(
    $Client,
    [string] $Selector,
    [int] $TimeoutMs = 10000
  )

  $selectorJson = $Selector | ConvertTo-Json -Compress
  Wait-CdpExpression $Client @"
new Promise((resolve, reject) => {
  const selector = $selectorJson;
  const startedAt = Date.now();
  const timer = setInterval(() => {
    if (document.querySelector(selector)) {
      clearInterval(timer);
      resolve(true);
      return;
    }
    if (Date.now() - startedAt > $TimeoutMs) {
      clearInterval(timer);
      reject(new Error("Timed out waiting for " + selector));
    }
  }, 100);
})
"@
}

function Wait-Quiet {
  param($Client, [int] $Ms = 1800)
  Wait-CdpExpression $Client "new Promise((resolve) => setTimeout(resolve, $Ms))"
}

function Save-CdpScreenshot {
  param(
    $Client,
    [string] $FileName
  )

  $result = Send-Cdp $Client "Page.captureScreenshot" @{
    format = "png"
    fromSurface = $true
    clip = @{
      x = 0
      y = 0
      width = 580
      height = 600
      scale = 1
    }
  }

  $path = Join-Path $SourceDir $FileName
  [System.IO.File]::WriteAllBytes($path, [System.Convert]::FromBase64String($result.data))
  $path
}

$port = Get-Random -Minimum 9300 -Maximum 9700
$chromeArgs = @(
  "--headless=new",
  "--disable-gpu",
  "--disable-crash-reporter",
  "--disable-crashpad",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=$port",
  "--user-data-dir=$ProfileDir",
  "about:blank"
)

$chrome = Start-Process -FilePath $ChromePath -ArgumentList $chromeArgs -PassThru -WindowStyle Hidden
$client = $null

try {
  $version = $null
  $deadline = (Get-Date).AddSeconds(12)
  while ((Get-Date) -lt $deadline) {
    try {
      $version = Invoke-RestMethod "http://127.0.0.1:$port/json/version"
      break
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
  if (-not $version) {
    throw "Chrome DevTools endpoint did not become available."
  }

  $targets = Invoke-RestMethod "http://127.0.0.1:$port/json/list"
  $target = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1
  if (-not $target) {
    throw "No Chrome page target was available."
  }

  $client = [System.Net.WebSockets.ClientWebSocket]::new()
  $null = $client.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()

  Send-Cdp $client "Page.enable" | Out-Null
  Send-Cdp $client "Runtime.enable" | Out-Null
  Send-Cdp $client "Emulation.setDeviceMetricsOverride" @{
    width = 580
    height = 600
    deviceScaleFactor = 2
    mobile = $false
    screenWidth = 580
    screenHeight = 600
  } | Out-Null

  Send-Cdp $client "Page.navigate" @{ url = ConvertTo-FileUrl $PopupPath } | Out-Null
  Wait-ForSelector $client ".league-pick-card" 15000
  Wait-Quiet $client 1800
  Save-CdpScreenshot $client "popup-live-list.png" | Out-Null
  Copy-Item (Join-Path $SourceDir "popup-live-list.png") (Join-Path $SourceDir "popup-live-list-full.png") -Force

  Wait-CdpExpression $client "document.querySelector('.league-pick-card')?.click(); true"
  Wait-ForSelector $client ".league-detail-header" 10000
  Wait-Quiet $client 2600
  Save-CdpScreenshot $client "popup-league-detail.png" | Out-Null
  Copy-Item (Join-Path $SourceDir "popup-league-detail.png") (Join-Path $SourceDir "popup-league-detail-full.png") -Force

  Wait-CdpExpression $client "document.querySelector('.match-card--clickable')?.click(); true"
  Wait-ForSelector $client ".match-detail-hero" 10000
  Wait-Quiet $client 2400
  Save-CdpScreenshot $client "popup-match-detail.png" | Out-Null
  Copy-Item (Join-Path $SourceDir "popup-match-detail.png") (Join-Path $SourceDir "popup-match-detail-full.png") -Force
} finally {
  if ($client) {
    try {
      $client.Dispose()
    } catch {
      # Ignore cleanup failures for the capture helper.
    }
  }

  if ($chrome -and -not $chrome.HasExited) {
    Stop-Process -Id $chrome.Id -Force
  }
}

Get-ChildItem $SourceDir -Filter "popup-*.png" | Sort-Object Name | ForEach-Object {
  Add-Type -AssemblyName System.Drawing
  $image = [System.Drawing.Image]::FromFile($_.FullName)
  $result = "{0}: {1}x{2} {3}" -f $_.Name, $image.Width, $image.Height, $image.PixelFormat
  $image.Dispose()
  $result
}
