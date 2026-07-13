param([string]$ChromeBinary = $env:HYPE_CHROME_BINARY)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$SourceExtensionDir = Join-Path $ProjectRoot "extension"
$TempRoot = "C:\tmp"
$RunId = [Guid]::NewGuid().ToString("N").Substring(0, 10)
$ExtensionDir = Join-Path $TempRoot "hype-ext-$RunId"
$ProfileDir = Join-Path $TempRoot "hype-profile-$RunId"

$ChromeCandidates = @(
  $ChromeBinary,
  "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
  "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$ChromePath = $ChromeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } |
  Select-Object -First 1
if (-not $ChromePath) {
  throw "Brave or Chrome executable was not found."
}

function Receive-CdpMessage {
  param($Client)
  $buffer = New-Object byte[] 1048576
  $stream = [IO.MemoryStream]::new()
  do {
    $segment = [ArraySegment[byte]]::new($buffer)
    $result = $Client.ReceiveAsync(
      $segment,
      [Threading.CancellationToken]::None
    ).GetAwaiter().GetResult()
    if ($result.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close) {
      throw "Chrome DevTools websocket closed unexpectedly."
    }
    $stream.Write($buffer, 0, $result.Count)
  } until ($result.EndOfMessage)
  $text = [Text.Encoding]::UTF8.GetString($stream.ToArray())
  $stream.Dispose()
  $text | ConvertFrom-Json
}

$script:CdpId = 0
function Send-Cdp {
  param($Client, [string]$Method, [hashtable]$Params = @{})
  $script:CdpId += 1
  $payload = @{ id = $script:CdpId; method = $Method }
  if ($Params.Count -gt 0) { $payload.params = $Params }
  $json = $payload | ConvertTo-Json -Depth 30 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $segment = [ArraySegment[byte]]::new($bytes)
  $null = $Client.SendAsync(
    $segment,
    [Net.WebSockets.WebSocketMessageType]::Text,
    $true,
    [Threading.CancellationToken]::None
  ).GetAwaiter().GetResult()
  while ($true) {
    $message = Receive-CdpMessage $Client
    if ($message.id -ne $script:CdpId) { continue }
    if ($message.error) {
      throw ("CDP error in {0}: {1}" -f $Method, ($message.error | ConvertTo-Json -Compress))
    }
    return $message.result
  }
}

function Invoke-CdpExpression {
  param($Client, [string]$Expression, [bool]$AwaitPromise = $false)
  $result = Send-Cdp $Client "Runtime.evaluate" @{
    expression = $Expression
    awaitPromise = $AwaitPromise
    returnByValue = $true
  }
  if ($result.exceptionDetails) {
    throw ($result.exceptionDetails | ConvertTo-Json -Depth 10 -Compress)
  }
  $result.result.value
}

function Wait-ForExpression {
  param($Client, [string]$Expression, [int]$TimeoutMs = 15000)
  $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
      if (Invoke-CdpExpression $Client $Expression) { return }
    } catch {
      $lastError = $_
    }
    Start-Sleep -Milliseconds 100
  }
  if ($lastError) {
    throw "Timed out waiting for expression. Last error: $lastError"
  }
  throw "Timed out waiting for expression."
}

$fixtureOrigin = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
$smokePayload = Invoke-RestMethod -Uri "https://api.atakanozkan.com/live-matches" -Headers @{
  Origin = $fixtureOrigin
}
$requiredFixtureLeagues = @(
  [pscustomobject]@{ id = "2395"; code = "uefa.nations"; name = "UEFA Nations League"; logo = $null; logoTone = "dark"; matches = @() },
  [pscustomobject]@{ id = "781"; code = "uefa.euro"; name = "UEFA EURO"; logo = $null; logoTone = "dark"; matches = @() },
  [pscustomobject]@{ id = "780"; code = "conmebol.america"; name = "Copa América"; logo = $null; logoTone = "dark"; matches = @() }
)
foreach ($league in $requiredFixtureLeagues) {
  if (-not ($smokePayload.leagues | Where-Object { $_.code -eq $league.code })) {
    $smokePayload.leagues += $league
  }
}
$smokePayloadJson = $smokePayload | ConvertTo-Json -Depth 50 -Compress

New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
New-Item -ItemType Directory -Force -Path $ExtensionDir | Out-Null
New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
Copy-Item -Path (Join-Path $SourceExtensionDir "*") -Destination $ExtensionDir -Recurse -Force


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
  "--disable-extensions-except=$ExtensionDir",
  "--load-extension=$ExtensionDir",
  "about:blank"
)

$chrome = Start-Process -FilePath $ChromePath -ArgumentList $chromeArgs -PassThru -WindowStyle Hidden
$client = $null

try {
  $version = $null
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    try {
      $version = Invoke-RestMethod "http://127.0.0.1:$port/json/version"
      break
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
  if (-not $version) { throw "Chrome DevTools endpoint did not become available." }

  $targets = Invoke-RestMethod "http://127.0.0.1:$port/json/list"
  $target = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1
  if (-not $target) { throw "No Chrome page target was available." }

  $client = [Net.WebSockets.ClientWebSocket]::new()
  $null = $client.ConnectAsync(
    [Uri]$target.webSocketDebuggerUrl,
    [Threading.CancellationToken]::None
  ).GetAwaiter().GetResult()

  Send-Cdp $client "Page.enable" | Out-Null
  Send-Cdp $client "Runtime.enable" | Out-Null
  Send-Cdp $client "Page.navigate" @{ url = "chrome://extensions/" } | Out-Null
  Wait-ForExpression $client @'
document.querySelector("extensions-manager")?.shadowRoot
  ?.querySelector("extensions-item-list")?.shadowRoot
  ?.querySelectorAll("extensions-item").length > 0
'@ 15000

  $manifest = Get-Content -Raw -LiteralPath (Join-Path $ExtensionDir "manifest.json") |
    ConvertFrom-Json
  $expectedName = [string]$manifest.name
  if ($expectedName -match '^__MSG_(.+)__$') {
    $messageKey = $Matches[1]
    $localePath = Join-Path $ExtensionDir "_locales\$($manifest.default_locale)\messages.json"
    $localeMessages = Get-Content -Raw -LiteralPath $localePath | ConvertFrom-Json
    $expectedName = [string]$localeMessages.$messageKey.message
  }
  $extensionItems = @(Invoke-CdpExpression $client @'
(() => {
  const manager = document.querySelector("extensions-manager");
  const list = manager?.shadowRoot?.querySelector("extensions-item-list");
  return Array.from(list?.shadowRoot?.querySelectorAll("extensions-item") || []).map((item) => ({
    id: item.getAttribute("id") || item.id,
    name: item.shadowRoot?.querySelector("#name")?.textContent?.trim() || "",
  }));
})()
'@)
  $extensionId = ($extensionItems | Where-Object { $_.name -eq $expectedName } |
    Select-Object -First 1).id
  if (-not $extensionId) {
    throw "Unpacked extension id was not found in chrome://extensions."
  }
  Send-Cdp $client "Page.addScriptToEvaluateOnNewDocument" @{
    source = @"
window.__hypeSmokeErrors = [];
const __hypeSmokePayload = $smokePayloadJson;
const __hypeOriginalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input?.url;
  if (url === "https://api.atakanozkan.com/live-matches") {
    return Promise.resolve(new Response(JSON.stringify(__hypeSmokePayload), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }));
  }
  return __hypeOriginalFetch(input, init);
};
window.addEventListener("error", (event) => {
  window.__hypeSmokeErrors.push(String(event.message || event.error || "error"));
});
window.addEventListener("unhandledrejection", (event) => {
  window.__hypeSmokeErrors.push(String(event.reason || "unhandled rejection"));
});
"@
  } | Out-Null
  Send-Cdp $client "Emulation.setDeviceMetricsOverride" @{
    width = 580
    height = 600
    deviceScaleFactor = 1
    mobile = $false
    screenWidth = 580
    screenHeight = 600
  } | Out-Null

  $popupUrl = "chrome-extension://$extensionId/popup.html"
  Send-Cdp $client "Page.navigate" @{ url = $popupUrl } | Out-Null
  try {
    Wait-ForExpression $client "document.querySelectorAll('.league-pick-card').length >= 20" 20000
  } catch {
    $networkDiagnostics = Invoke-CdpExpression $client @"
fetch("https://api.atakanozkan.com/live-matches")
  .then(async (response) => ({
    ok: response.ok,
    status: response.status,
    type: response.type,
    allowOrigin: response.headers.get("access-control-allow-origin"),
    body: (await response.text()).slice(0, 500),
  }))
  .catch((error) => ({ error: String(error), stack: String(error?.stack || "") }))
"@ $true
    $popupDiagnostics = Invoke-CdpExpression $client @"
({
  href: location.href,
  readyState: document.readyState,
  title: document.title,
  cardCount: document.querySelectorAll(".league-pick-card").length,
  bodyText: (document.body?.innerText || "").slice(0, 1000),
  errors: window.__hypeSmokeErrors || [],
})
"@
    throw "Popup league list timeout: dom=$($popupDiagnostics | ConvertTo-Json -Depth 6 -Compress) network=$($networkDiagnostics | ConvertTo-Json -Depth 6 -Compress)"
  }

  $popupResult = Invoke-CdpExpression $client @"
(() => {
  const shell = document.querySelector(".app-shell");
  const list = document.getElementById("leaguePickList");
  const manifest = chrome.runtime.getManifest();
  return {
    href: location.href,
    manifestVersion: manifest.version,
    permissions: manifest.permissions || [],
    hostPermissions: manifest.host_permissions || [],
    cardCount: document.querySelectorAll(".league-pick-card").length,
    listVisible: Boolean(list && !list.hidden),
    shellWidth: shell ? Math.round(shell.getBoundingClientRect().width) : 0,
    shellHeight: shell ? Math.round(shell.getBoundingClientRect().height) : 0,
    storageKeys: Object.keys(localStorage).sort(),
    errors: window.__hypeSmokeErrors || [],
    hasShadowRoot: Array.from(document.querySelectorAll("*")).some((node) => node.shadowRoot),
  };
})()
"@

  if ($popupResult.manifestVersion -ne "1.5.0") { throw "Unexpected manifest version." }
  if ($popupResult.permissions.Count -ne 0) { throw "Unexpected Chrome permissions." }
  if ($popupResult.hostPermissions.Count -ne 1) { throw "Unexpected host permission count." }
  if ($popupResult.cardCount -lt 20 -or -not $popupResult.listVisible) { throw "Popup league list did not render." }
  if ($popupResult.shellWidth -le 0 -or $popupResult.shellHeight -le 0) { throw "Popup CSS dimensions are invalid." }
  if ($popupResult.errors.Count -ne 0) { throw "Popup recorded runtime errors: $($popupResult.errors -join '; ')" }

  Send-Cdp $client "Page.navigate" @{ url = "chrome://settings/" } | Out-Null
  Wait-ForExpression $client "location.href.startsWith('chrome://settings')" 10000
  $restrictedResult = Invoke-CdpExpression $client @"
({
  href: location.href,
  hasHypeAppShell: Boolean(document.querySelector(".app-shell")),
  hasHypeShadowHost: Array.from(document.querySelectorAll("*")).some((node) =>
    node.shadowRoot && node.shadowRoot.querySelector(".app-shell")
  ),
})
"@
  if ($restrictedResult.hasHypeAppShell -or $restrictedResult.hasHypeShadowHost) {
    throw "Extension UI unexpectedly appeared on a browser-owned page."
  }

  $targetsAfterPopup = Invoke-RestMethod "http://127.0.0.1:$port/json/list"
  $serviceWorkerCount = @($targetsAfterPopup | Where-Object {
    $_.type -eq "service_worker" -and $_.url -like "chrome-extension://$extensionId/*"
  }).Count

  [pscustomobject]@{
    browser = $version.Browser
    extensionId = $extensionId
    popupUrl = $popupResult.href
    manifestVersion = $popupResult.manifestVersion
    cardCount = $popupResult.cardCount
    popupSize = "$($popupResult.shellWidth)x$($popupResult.shellHeight)"
    storageKeys = @($popupResult.storageKeys)
    runtimeErrors = @($popupResult.errors)
    restrictedPage = $restrictedResult.href
    restrictedInjection = $false
    contentScriptShadowDom = "not applicable (manifest has no content_scripts)"
    extensionServiceWorkerTargets = $serviceWorkerCount
    serviceWorkerExpected = "none (manifest has no background service_worker)"
    liveApiMode = "CDP fixture derived from live payload; production deploy verified separately"
  } | ConvertTo-Json -Depth 6
} finally {
  if ($client) { $client.Dispose() }
  if ($chrome -and -not $chrome.HasExited) { Stop-Process -Id $chrome.Id -Force }

  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($ProfileDir) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  foreach ($path in @($ExtensionDir, $ProfileDir)) {
    $resolved = [IO.Path]::GetFullPath($path)
    $tempResolved = [IO.Path]::GetFullPath($TempRoot)
    if (-not $resolved.StartsWith($tempResolved, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to clean a path outside the temporary root: $resolved"
    }
    for ($attempt = 0; $attempt -lt 10 -and (Test-Path -LiteralPath $resolved); $attempt += 1) {
      try {
        Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction Stop
      } catch {
        Start-Sleep -Milliseconds 250
      }
    }
    if (Test-Path -LiteralPath $resolved) {
      throw "Temporary Chromium path could not be cleaned: $resolved"
    }
  }
}
