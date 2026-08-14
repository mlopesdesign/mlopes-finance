#!/usr/bin/env pwsh
# Publish de release do MLopes Finance.
# SEMPRE: Setup.exe + resources.neu. NUNCA: ZIP portatil.
# Marcio nao trabalha com portatil — sempre instalador tradicional.
#
# Uso: powershell -File tools/publish-release.ps1 vX.Y.Z "Titulo" "Notas markdown"

param(
  [Parameter(Mandatory=$true)][string]$Version,
  [Parameter(Mandatory=$true)][string]$Title,
  [Parameter(Mandatory=$true)][string]$Notes
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Publicando release $Version ===" -ForegroundColor Cyan

# 1. Builda os recursos e o portable (o portable eh usado como source do Setup.exe)
Write-Host "1. Build resources + portable..." -ForegroundColor Yellow
& npm run build:resources 2>&1 | Select-Object -Last 2
& npm run build:portable 2>&1 | Select-Object -Last 2

# 2. Bumpa a versao no .iss (ja foi feito antes, mas por seguranca)
$issPath = Join-Path $root "installer\MLopesFinance.iss"
$issContent = Get-Content $issPath -Raw
if ($issContent -notmatch [regex]::Escape($Version)) {
  Write-Host "Atualizando installer/MLopesFinance.iss pra $Version..." -ForegroundColor Yellow
  $issContent = $issContent -replace '#define AppVersion "[0-9.]+"', "#define AppVersion `"$Version`""
  Set-Content $issPath -Value $issContent -NoNewline
}

# 3. Builda o Setup.exe usando o Inno Setup
$toolsDir = Join-Path $root ".tools"
$installDir = Join-Path $toolsDir "innosetup7"
$isccExe = Join-Path $installDir "ISCC.exe"
if (-not (Test-Path $isccExe)) {
  Write-Host "Inno Setup nao encontrado em $installDir. Baixando..." -ForegroundColor Yellow
  if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null }
  $installerPath = Join-Path $toolsDir "innosetup-7.1.0-x64.exe"
  if (-not (Test-Path $installerPath)) {
    $url = "https://github.com/jrsoftware/issrc/releases/download/is-7_1_0/innosetup-7.1.0-x64.exe"
    [System.Net.WebClient]::new().DownloadFile($url, $installerPath)
  }
  if (-not (Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir -Force | Out-Null }
  Write-Host "Instalando Inno Setup silenciosamente..." -ForegroundColor Yellow
  Start-Process -FilePath $installerPath -ArgumentList "/VERYSILENT","/DIR=`"$installDir`"" -Wait
  if (-not (Test-Path $isccExe)) {
    Write-Host "ERRO: iscc.exe nao encontrado apos instalacao" -ForegroundColor Red
    exit 1
  }
}

Write-Host "2. Compilando Setup.exe..." -ForegroundColor Yellow
& $isccExe (Join-Path $root "installer\MLopesFinance.iss") 2>&1 | Select-Object -Last 5

# 4. Renomeia pra sem espaco e prepara caminhos
$setupExe = Join-Path $root "release\MLopes Finance Setup.exe"
$setupExeFinal = Join-Path $root "release\MLopesFinance_Setup.exe"
if (Test-Path $setupExe) {
  Copy-Item $setupExe $setupExeFinal -Force
  Write-Host "Setup.exe: $([math]::Round((Get-Item $setupExeFinal).Length / 1MB, 1)) MB" -ForegroundColor Green
} else {
  Write-Host "ERRO: Setup.exe nao foi gerado" -ForegroundColor Red
  exit 1
}

$resourcesNeu = Join-Path $root "dist\MLopesFinance\resources.neu"
if (-not (Test-Path $resourcesNeu)) {
  Write-Host "ERRO: resources.neu nao encontrado" -ForegroundColor Red
  exit 1
}

# 5. Publica no GitHub (so Setup.exe + resources.neu, NUNCA ZIP)
Write-Host "3. Publicando no GitHub..." -ForegroundColor Yellow
& gh release create $Version $setupExeFinal $resourcesNeu --title $Title --notes $Notes --latest 2>&1 | Select-Object -Last 3

if ($LASTEXITCODE -ne 0) {
  Write-Host "ERRO: gh release create falhou" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=== Release $Version publicada com sucesso ===" -ForegroundColor Green
Write-Host "  Setup.exe:    $setupExeFinal ($([math]::Round((Get-Item $setupExeFinal).Length / 1MB, 1)) MB)"
Write-Host "  resources.neu: $resourcesNeu ($([math]::Round((Get-Item $resourcesNeu).Length / 1MB, 1)) MB)"
Write-Host "  ZIP portatil: REMOVIDO (Marcio nao trabalha com portatil)"
Write-Host ""
Write-Host "Link: https://github.com/mlopesdesign/mlopes-finance/releases/tag/$Version"
