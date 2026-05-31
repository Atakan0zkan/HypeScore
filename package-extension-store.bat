@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "EXT_DIR=%ROOT_DIR%extension"
set "DIST_DIR=%ROOT_DIR%dist"
set "STAGING_DIR=%DIST_DIR%\chrome-store-package"
set "ZIP_BASENAME=hype-live-football-scores"
set "MANIFEST_PATH=%EXT_DIR%\manifest.json"

if not exist "%MANIFEST_PATH%" (
  echo ERROR: extension\manifest.json not found.
  exit /b 1
)

for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$manifest = Get-Content -Raw -LiteralPath $env:MANIFEST_PATH | ConvertFrom-Json; $manifest.version"`) do set "VERSION=%%V"

if not defined VERSION set "VERSION=dev"

set "ZIP_PATH=%DIST_DIR%\%ZIP_BASENAME%-v%VERSION%-chrome-web-store.zip"

echo Packaging Hype - Live Football Scores v%VERSION%

if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"
if exist "%STAGING_DIR%" rmdir /s /q "%STAGING_DIR%"
if exist "%ZIP_PATH%" del /q "%ZIP_PATH%"
mkdir "%STAGING_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; $required = @('manifest.json', 'popup.html', 'popup.css', 'popup.js'); foreach ($relative in $required) { $source = Join-Path $env:EXT_DIR $relative; if (!(Test-Path -LiteralPath $source)) { throw \"Missing required file: extension/$relative\" }; $destination = Join-Path $env:STAGING_DIR $relative; New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null; Copy-Item -LiteralPath $source -Destination $destination -Force }; $locales = Join-Path $env:EXT_DIR '_locales'; if (!(Test-Path -LiteralPath (Join-Path $locales 'en\messages.json'))) { throw 'Missing required file: extension/_locales/en/messages.json' }; $localeDestination = Join-Path $env:STAGING_DIR '_locales'; New-Item -ItemType Directory -Force -Path $localeDestination | Out-Null; Copy-Item -LiteralPath (Get-ChildItem -LiteralPath $locales -Force).FullName -Destination $localeDestination -Recurse -Force; $icons = Join-Path $env:EXT_DIR 'icons'; if (Test-Path -LiteralPath $icons) { Copy-Item -LiteralPath $icons -Destination (Join-Path $env:STAGING_DIR 'icons') -Recurse -Force }; $zipItems = (Get-ChildItem -LiteralPath $env:STAGING_DIR -Force).FullName; Compress-Archive -LiteralPath $zipItems -DestinationPath $env:ZIP_PATH -Force; $zip = [System.IO.Compression.ZipFile]::OpenRead($env:ZIP_PATH); try { if (-not ($zip.Entries.FullName -contains 'manifest.json')) { throw 'manifest.json is not at the zip root.' }; Write-Host 'Created:' $env:ZIP_PATH; Write-Host 'Included files:'; $zip.Entries | Sort-Object FullName | ForEach-Object { Write-Host ('  ' + $_.FullName) } } finally { $zip.Dispose() }"

if errorlevel 1 (
  echo ERROR: Package creation failed.
  exit /b 1
)

rmdir /s /q "%STAGING_DIR%"

echo Done.
echo Store zip: %ZIP_PATH%
