param([string]$Notes = "")
$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent
$env:PATH = "C:\Users\Administrator\Downloads\winlibs\mingw64\bin;$env:USERPROFILE\.cargo\bin;$env:PATH"
$ver = (Get-Content "$root\src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json).version

Push-Location $root
npx tauri build
if ($LASTEXITCODE) { throw "Moony build failed" }
Pop-Location

Push-Location $PSScriptRoot
cargo build --release
if ($LASTEXITCODE) { throw "Setup build failed" }
Pop-Location

$out = "$root\release2\v$ver"
New-Item -ItemType Directory -Force $out | Out-Null
$setup = "$out\Moony-Setup-$ver.exe"
Copy-Item "$PSScriptRoot\target\release\moony-setup.exe" $setup -Force
$sha = (Get-FileHash $setup -Algorithm SHA256).Hash.ToLower()
$size = (Get-Item $setup).Length
[ordered]@{
  version = $ver
  url = "https://github.com/johwnsss1-arch/moony/releases/download/v$ver/Moony-Setup-$ver.exe"
  sha256 = $sha
  size = $size
  notes = $Notes
} | ConvertTo-Json | ForEach-Object { [IO.File]::WriteAllText("$out\latest.json", $_) }
"Built $setup ($([math]::Round($size / 1MB, 1)) MB, sha256 $sha)"
