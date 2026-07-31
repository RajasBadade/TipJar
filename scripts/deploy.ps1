<#
.SYNOPSIS
    Build and deploy the TipJar contracts to a Stellar network.

.DESCRIPTION
    Reproduces the full deployment workflow:
      1. Build both contracts to wasm32v1-none
      2. Deploy CreatorRegistry
      3. Resolve the native XLM Stellar Asset Contract id
      4. Deploy TipJar, wiring it to the registry + token via its constructor
      5. Verify the wiring, then write frontend/.env.local

    Requires the `stellar` CLI and a funded identity. To create one:
      stellar keys generate deployer --network testnet --fund

.EXAMPLE
    ./scripts/deploy.ps1
.EXAMPLE
    ./scripts/deploy.ps1 -Network testnet -Identity deployer
#>
[CmdletBinding()]
param(
    [string]$Network = "testnet",
    [string]$Identity = "deployer",
    # Path to the stellar CLI. Defaults to the project-local copy, then PATH.
    [string]$StellarCli = "",
    # Extra args forwarded to every CLI call (e.g. --config-dir .stellar).
    [string[]]$CliArgs = @()
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
$ContractsDir = Join-Path $Root "contracts"
$WasmDir = Join-Path $ContractsDir "target\wasm32v1-none\release"

function Resolve-StellarCli {
    if ($StellarCli) { return $StellarCli }
    $local = Join-Path $Root ".tools\stellar.exe"
    if (Test-Path $local) { return $local }
    $onPath = Get-Command stellar -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }
    throw "stellar CLI not found. Install it, or pass -StellarCli <path>."
}

$Cli = Resolve-StellarCli
$LocalConfig = Join-Path $Root ".stellar"
if ((Test-Path $LocalConfig) -and ($CliArgs -notcontains "--config-dir")) {
    $CliArgs += @("--config-dir", $LocalConfig)
}

function Invoke-Stellar {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $all = $Arguments + $CliArgs
    Write-Host "  > stellar $($Arguments -join ' ')" -ForegroundColor DarkGray
    $out = & $Cli @all 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "stellar $($Arguments -join ' ') failed:`n$out"
    }
    # The CLI logs progress to stderr; the last non-empty line is the result.
    ($out | Where-Object { $_ -and $_.ToString().Trim() } | Select-Object -Last 1).ToString().Trim()
}

Write-Host "`n[1/5] Building contracts (wasm32v1-none, release)" -ForegroundColor Cyan
Push-Location $ContractsDir
try {
    cargo build --target wasm32v1-none --release
    if ($LASTEXITCODE -ne 0) { throw "cargo build failed." }
}
finally { Pop-Location }

$RegistryWasm = Join-Path $WasmDir "creator_registry.wasm"
$TipJarWasm = Join-Path $WasmDir "tipjar.wasm"
foreach ($w in @($RegistryWasm, $TipJarWasm)) {
    if (-not (Test-Path $w)) { throw "Expected build artifact missing: $w" }
}

Write-Host "`n[2/5] Deploying CreatorRegistry" -ForegroundColor Cyan
$RegistryId = Invoke-Stellar contract deploy `
    --wasm $RegistryWasm --source $Identity --network $Network
Write-Host "      CreatorRegistry: $RegistryId" -ForegroundColor Green

Write-Host "`n[3/5] Resolving native XLM Stellar Asset Contract" -ForegroundColor Cyan
$TokenId = Invoke-Stellar contract id asset `
    --asset native --source $Identity --network $Network
Write-Host "      Native XLM SAC: $TokenId" -ForegroundColor Green

Write-Host "`n[4/5] Deploying TipJar (constructor: registry + token)" -ForegroundColor Cyan
$TipJarId = Invoke-Stellar contract deploy `
    --wasm $TipJarWasm --source $Identity --network $Network `
    -- --registry $RegistryId --token $TokenId
Write-Host "      TipJar: $TipJarId" -ForegroundColor Green

Write-Host "`n[5/5] Verifying inter-contract wiring" -ForegroundColor Cyan
$WiredRegistry = Invoke-Stellar contract invoke `
    --id $TipJarId --source $Identity --network $Network -- registry
$WiredRegistry = $WiredRegistry.Trim('"')
if ($WiredRegistry -ne $RegistryId) {
    throw "TipJar reports registry '$WiredRegistry' but expected '$RegistryId'."
}
Write-Host "      TipJar.registry() matches the deployed registry." -ForegroundColor Green

$Passphrase = switch ($Network) {
    "testnet" { "Test SDF Network ; September 2015" }
    "futurenet" { "Test SDF Future Network ; October 2022" }
    "mainnet" { "Public Global Stellar Network ; September 2015" }
    default { "" }
}
$RpcUrl = switch ($Network) {
    "testnet" { "https://soroban-testnet.stellar.org" }
    "mainnet" { "https://mainnet.sorobanrpc.com" }
    default { "https://soroban-testnet.stellar.org" }
}

$EnvPath = Join-Path $Root "frontend\.env.local"
@(
    "NEXT_PUBLIC_SOROBAN_RPC_URL=$RpcUrl",
    "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=$Passphrase",
    "NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID=$RegistryId",
    "NEXT_PUBLIC_TIPJAR_CONTRACT_ID=$TipJarId"
) | Set-Content -Path $EnvPath -Encoding utf8

Write-Host "`nDeployed to $Network. Wrote frontend/.env.local" -ForegroundColor Cyan
Write-Host "  CreatorRegistry : $RegistryId"
Write-Host "  TipJar          : $TipJarId"
Write-Host "  Native XLM SAC  : $TokenId"
Write-Host "`nRemember to update the contract ids in README.md and .github/workflows/ci.yml.`n"
