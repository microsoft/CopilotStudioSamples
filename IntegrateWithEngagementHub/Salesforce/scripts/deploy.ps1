# Deploy Copilot Studio DirectLine Apex classes to Salesforce
# This script deploys Apex classes and Remote Site Setting, then grants permissions to the Chatbot permission set

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

Write-Host "=== Copilot Studio - Salesforce Integration Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Check if Salesforce CLI is installed
try {
    $null = Get-Command sf -ErrorAction Stop
} catch {
    Write-Host "ERROR: Salesforce CLI (sf) is not installed." -ForegroundColor Red
    Write-Host "Install it from: https://developer.salesforce.com/tools/salesforcecli"
    exit 1
}

# Check if logged into a Salesforce org
try {
    $orgInfo = sf org display --json 2>$null | ConvertFrom-Json
    $orgUsername = $orgInfo.result.username
} catch {
    $orgUsername = $null
}

if ([string]::IsNullOrEmpty($orgUsername)) {
    Write-Host "ERROR: Not logged into a Salesforce org." -ForegroundColor Red
    Write-Host "Run: sf org login web"
    exit 1
}

Write-Host "Deploying to org: $orgUsername"
Write-Host ""

# Create temporary SFDX project structure for deployment
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
$ForceApp = Join-Path $TempDir "force-app\main\default"
New-Item -ItemType Directory -Path "$ForceApp\classes" -Force | Out-Null
New-Item -ItemType Directory -Path "$ForceApp\remoteSiteSettings" -Force | Out-Null

# Copy Apex classes and metadata
Write-Host "Preparing Apex classes..."
Copy-Item "$ProjectDir\ApexClasses\*.cls" "$ForceApp\classes\"
Copy-Item "$ProjectDir\Metadata\classes\*.cls-meta.xml" "$ForceApp\classes\"

# Copy Remote Site Setting
Write-Host "Preparing Remote Site Setting..."
Copy-Item "$ProjectDir\Metadata\remoteSiteSettings\*.xml" "$ForceApp\remoteSiteSettings\"

# Create sfdx-project.json
$sfdxProject = @{
    packageDirectories = @(@{ path = "force-app/main/default"; default = $true })
    name = "copilot-studio-directline"
    namespace = ""
    sfdcLoginUrl = "https://login.salesforce.com"
    sourceApiVersion = "62.0"
}
$sfdxProject | ConvertTo-Json -Depth 10 | Set-Content "$TempDir\sfdx-project.json"

# Deploy to Salesforce
Write-Host ""
Write-Host "Deploying to Salesforce..."
Push-Location $TempDir
try {
    sf project deploy start --source-dir force-app --wait 10
} finally {
    Pop-Location
}

# Cleanup temp directory
Remove-Item -Recurse -Force $TempDir

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""

# Grant permissions to Chatbot permission set
Write-Host "Granting Apex class permissions to Chatbot permission set..."
& "$ScriptDir\grant-bot-permissions.ps1"

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "The Apex classes and Remote Site Setting have been deployed."
Write-Host "You must now manually configure the Named Credential in Salesforce Setup."
Write-Host ""
Write-Host "Follow the instructions in the Microsoft Learn documentation:"
Write-Host "https://learn.microsoft.com/en-us/microsoft-copilot-studio/customer-copilot-salesforce"
Write-Host ""
