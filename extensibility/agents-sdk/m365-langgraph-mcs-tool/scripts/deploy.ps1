<#
.SYNOPSIS
  One-command deploy for the M365 LangGraph MCS Tool sample.

.DESCRIPTION
  Checks prerequisites, collects the handful of values the sample needs,
  writes them to env/.env.dev (+ secrets to env/.env.dev.user), then runs
  `atk provision` and `atk deploy` to stand up the Azure resources and push
  the bot. When it finishes it tells you how to install the app package.

  Any value already present (as an environment variable or already in
  env/.env.dev) is reused, so re-running is idempotent and CI can pre-seed.

.EXAMPLE
  ./scripts/deploy.ps1
.EXAMPLE
  ./scripts/deploy.ps1 -EnvName dev
#>
[CmdletBinding()]
param(
  [string]$EnvName = $(if ($env:ENV) { $env:ENV } else { 'dev' })
)

$ErrorActionPreference = 'Stop'
$ProjectDir = Split-Path -Parent $PSScriptRoot
$EnvFile    = Join-Path $ProjectDir "env/.env.$EnvName"
$SecretFile = Join-Path $ProjectDir "env/.env.$EnvName.user"
Set-Location $ProjectDir

function Write-Head($m) { Write-Host $m -ForegroundColor Cyan }
function Write-Info($m) { Write-Host "  $m" }
function Fail($m) { Write-Host "Error: $m" -ForegroundColor Red; exit 1 }

Write-Head "M365 LangGraph MCS Tool - deploy (env: $EnvName)"

# --- 1. Prerequisites -------------------------------------------------------
Write-Head "1. Checking prerequisites"
function Need($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Fail "$cmd not found. $hint" }
}
Need node "Install Node.js 22 or 24: https://nodejs.org"
Need npm  "npm ships with Node.js: https://nodejs.org"
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 22) { Fail "Node.js $nodeMajor detected; this sample requires Node 22 or 24." }

# Resolve the Microsoft 365 Agents Toolkit CLI (`atk`). Prefer a global install;
# otherwise run it on demand with npx so no global install is required. (Note: the
# older `teamsapp` CLI reads teamsapp.yml, not m365agents.yml, so it is not used.)
if (Get-Command atk -ErrorAction SilentlyContinue) {
  $AtkExe = 'atk'; $AtkBase = @()
  Write-Info "node $(node -v), npm $(npm -v), atk $((atk --version 2>$null | Select-Object -First 1))"
} else {
  Need npx "npx ships with Node.js: https://nodejs.org"
  $AtkExe = 'npx'; $AtkBase = @('-y', '-p', '@microsoft/m365agentstoolkit-cli', 'atk')
  Write-Info "node $(node -v), npm $(npm -v); atk via npx (@microsoft/m365agentstoolkit-cli)"
}
$AtkDisplay = (@($AtkExe) + $AtkBase) -join ' '

# --- helpers to read/write .env files --------------------------------------
function Read-Env($key, $file) {
  if (-not (Test-Path $file)) { return '' }
  $line = Select-String -Path $file -Pattern "^$([regex]::Escape($key))=" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $line) { return '' }
  return ($line.Line -replace "^$([regex]::Escape($key))=", '')
}
function Upsert-Env($key, $value, $file) {
  $dir = Split-Path -Parent $file
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (-not (Test-Path $file)) { New-Item -ItemType File -Path $file -Force | Out-Null }
  $lines = @(Get-Content -Path $file)
  $out = New-Object System.Collections.Generic.List[string]
  $found = $false
  foreach ($l in $lines) {
    if ($l -match "^$([regex]::Escape($key))=") { $out.Add("$key=$value"); $found = $true }
    else { $out.Add($l) }
  }
  if (-not $found) { $out.Add("$key=$value") }
  Set-Content -Path $file -Value $out
}
function Prompt-Value($key, $prompt, $default, [switch]$Secret) {
  $cur = [Environment]::GetEnvironmentVariable($key)
  if ([string]::IsNullOrEmpty($cur)) { $cur = Read-Env $key $EnvFile }
  if ([string]::IsNullOrEmpty($cur)) { $cur = Read-Env $key $SecretFile }
  if ([string]::IsNullOrEmpty($cur)) {
    if ($Secret) {
      $sec = Read-Host -AsSecureString "  $prompt"
      $cur = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    } else {
      $label = if ($default) { "  $prompt [$default]" } else { "  $prompt" }
      $cur = Read-Host $label
      if ([string]::IsNullOrEmpty($cur)) { $cur = $default }
    }
  }
  return $cur
}

# --- 2. Collect configuration ----------------------------------------------
Write-Head "2. Collecting configuration (press Enter to accept a shown default)"
$McsEnvId   = Prompt-Value 'MCS_ENVIRONMENT_ID' 'Copilot Studio environment ID (GUID)' ''
if (-not $McsEnvId) { Fail "MCS_ENVIRONMENT_ID is required." }
$McsSchema  = Prompt-Value 'MCS_SCHEMA_NAME' 'Copilot Studio agent schema name (e.g. cr123_myAgent)' ''
if (-not $McsSchema) { Fail "MCS_SCHEMA_NAME is required." }
$AoaiEndpoint = Prompt-Value 'AZURE_OPENAI_ENDPOINT' 'Azure OpenAI endpoint (https://<res>.openai.azure.com/)' ''
if (-not $AoaiEndpoint) { Fail "AZURE_OPENAI_ENDPOINT is required." }
$AoaiDeploy = Prompt-Value 'AZURE_OPENAI_DEPLOYMENT' 'Azure OpenAI deployment name' 'gpt-4o'
$AoaiKey    = Prompt-Value 'SECRET_AZURE_OPENAI_API_KEY' 'Azure OpenAI API key' '' -Secret
if (-not $AoaiKey) { Fail "Azure OpenAI API key is required." }

$SubId  = Prompt-Value 'AZURE_SUBSCRIPTION_ID' 'Azure subscription ID (blank = choose during provision)' ''
$RgName = Prompt-Value 'AZURE_RESOURCE_GROUP_NAME' 'Azure resource group (blank = choose/create during provision)' ''

$ResSuffix = Read-Env 'RESOURCE_SUFFIX' $EnvFile
if (-not $ResSuffix) {
  $ResSuffix = -join ((48..57) + (97..122) | Get-Random -Count 6 | ForEach-Object { [char]$_ })
  Write-Info "Generated RESOURCE_SUFFIX=$ResSuffix"
}

# --- 3. Persist to env files -----------------------------------------------
Write-Head "3. Writing env/.env.$EnvName and env/.env.$EnvName.user"
Upsert-Env 'TEAMSFX_ENV'               $EnvName       $EnvFile
Upsert-Env 'RESOURCE_SUFFIX'           $ResSuffix     $EnvFile
Upsert-Env 'AZURE_SUBSCRIPTION_ID'     $SubId         $EnvFile
Upsert-Env 'AZURE_RESOURCE_GROUP_NAME' $RgName        $EnvFile
Upsert-Env 'MCS_CONNECTION_NAME'       'mcs'          $EnvFile
Upsert-Env 'MCS_ENVIRONMENT_ID'        $McsEnvId      $EnvFile
Upsert-Env 'MCS_SCHEMA_NAME'           $McsSchema     $EnvFile
Upsert-Env 'AZURE_OPENAI_ENDPOINT'     $AoaiEndpoint  $EnvFile
Upsert-Env 'AZURE_OPENAI_DEPLOYMENT'   $AoaiDeploy    $EnvFile
Upsert-Env 'SECRET_AZURE_OPENAI_API_KEY' $AoaiKey     $SecretFile
Write-Info "Secrets written to env/.env.$EnvName.user (git-ignored)."

# --- 4. Build --------------------------------------------------------------
Write-Head "4. Installing dependencies and building"
npm install
npm run build

# --- 5. Provision + deploy -------------------------------------------------
Write-Head "5. Provisioning Azure resources (atk provision)"
Write-Info "You may be prompted to sign in to Azure and Microsoft 365."
& $AtkExe @AtkBase provision --env $EnvName

Write-Head "6. Deploying the bot (atk deploy)"
& $AtkExe @AtkBase deploy --env $EnvName

# --- Done ------------------------------------------------------------------
$Pkg = "appPackage/build/appPackage.$EnvName.zip"
Write-Head "Done. Next steps"
Write-Info "1. Install the app package: $Pkg"
Write-Info "   - Teams: Apps -> Manage your apps -> Upload an app -> Upload a custom app"
Write-Info "   - Or run: $AtkDisplay install --file-path $Pkg --env $EnvName"
Write-Info "2. Open the agent in Teams / Microsoft 365 Copilot and say hello."
Write-Info "3. First message triggers a one-time sign-in (delegated Copilot Studio access)."
