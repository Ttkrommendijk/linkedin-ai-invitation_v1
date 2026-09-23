$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repo
$python = Join-Path $repo '.venv-launcher/Scripts/python.exe'
if (!(Test-Path -LiteralPath $python)) { throw 'Create .venv-launcher and install launcher/requirements.txt first.' }
$stage = Join-Path $repo 'build/lef-extension'
New-Item -ItemType Directory -Path $stage -Force | Out-Null
# Allowlist only extension runtime assets. Never package .env, browser profiles or backend secrets.
foreach ($name in @('manifest.json','sidepanel.html','sidepanel.js','src')) {
    Copy-Item -LiteralPath (Join-Path $repo $name) -Destination $stage -Recurse -Force
}
& $python -m PyInstaller --noconfirm --clean --windowed --onedir --name LEF --paths launcher --add-data "$stage;extension" --add-data "$repo/.launcher-browsers;browsers" launcher/main.py
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller failed' }
Copy-Item -LiteralPath (Join-Path $repo 'docs/windows-launcher.md') -Destination (Join-Path $repo 'dist/LEF/START-HERE.md') -Force
Write-Output "Built $repo/dist/LEF/LEF.exe (keep the _internal folder beside it)."
