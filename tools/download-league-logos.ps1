$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $root "extension\icons\leagues"

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$uefaConferenceSource =
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/" +
  "UEFA_Conference_League_full_logo_(2024_version).svg?width=512&type=png"

$downloads = @(
  @{ File = "arg-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/1.png" },
  @{ File = "aus-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/1308.png" },
  @{ File = "aut-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/5.png" },
  @{ File = "bel-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/6.png" },
  @{ File = "den-1.png"; Source = "https://commons.wikimedia.org/wiki/Special:Redirect/file/Superliga_2010.svg?width=512&type=png" },
  @{ File = "eng-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png" },
  @{ File = "eng-2.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/24.png" },
  @{ File = "eng-fa.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/40.png" },
  @{ File = "eng-w-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/2314.png" },
  @{ File = "esp-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png" },
  @{ File = "fifa-world.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png" },
  @{ File = "fra-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png" },
  @{ File = "ger-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png" },
  @{ File = "ger-2.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/97.png" },
  @{ File = "gre-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/98.png" },
  @{ File = "ita-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png" },
  @{ File = "mex-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/22.png" },
  @{ File = "mex-2.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/2306.png" },
  @{ File = "ned-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/11.png" },
  @{ File = "por-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/14.png" },
  @{ File = "rus-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/106.png" },
  @{ File = "sco-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/45.png" },
  @{ File = "swe-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/16.png" },
  @{ File = "tur-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/18.png" },
  @{ File = "uefa-champions.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/2.png" },
  @{ File = "uefa-europa.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/2310.png" },
  @{
    File = "uefa-europa-conf.png"
    Source = $uefaConferenceSource
  },
  @{ File = "usa-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/19.png" },
  @{ File = "usa-usl-1.png"; Source = "https://a.espncdn.com/i/leaguelogos/soccer/500/2292.png" }
)

foreach ($item in $downloads) {
  $target = Join-Path $targetDir $item.File
  Write-Host "Downloading $($item.File)"
  & curl.exe -L --fail --silent --show-error -o $target $item.Source

  $file = Get-Item -LiteralPath $target
  if ($file.Length -le 0) {
    throw "Downloaded logo is empty: $($item.File)"
  }
}

Write-Host "Downloaded $($downloads.Count) league logos to $targetDir"
