param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"

if (-not $env:CLOUDFLARE_ACCOUNT_ID) {
  $env:CLOUDFLARE_ACCOUNT_ID = (Read-Host "Cloudflare account ID").Trim()
}

if ($env:CLOUDFLARE_ACCOUNT_ID -notmatch '^[a-fA-F0-9]{32}$') {
  throw "Cloudflare account ID must be a 32-character hexadecimal value."
}

if (-not $env:CLOUDFLARE_API_TOKEN) {
  $secureToken = Read-Host "Cloudflare API token" -AsSecureString
  $env:CLOUDFLARE_API_TOKEN = [System.Net.NetworkCredential]::new(
    "",
    $secureToken
  ).Password
  Remove-Variable secureToken
}

$headers = @{
  Authorization = "Bearer $env:CLOUDFLARE_API_TOKEN"
}

$verificationUri = if ($env:CLOUDFLARE_API_TOKEN.StartsWith("cfat_")) {
  "https://api.cloudflare.com/client/v4/accounts/$env:CLOUDFLARE_ACCOUNT_ID/tokens/verify"
} else {
  "https://api.cloudflare.com/client/v4/user/tokens/verify"
}

try {
  $verification = Invoke-RestMethod `
    -Uri $verificationUri `
    -Headers $headers
  if ($verification.result.status -ne "active") {
    throw "Cloudflare token is not active."
  }
} catch {
  Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
  throw "Cloudflare token verification failed. Create a new scoped token and try again."
}

$env:HYPE_ANALYTICS_PORT = [string]$Port
Write-Host "Starting Hype Analytics on http://127.0.0.1:$Port"
node analytics-dashboard/server.mjs
