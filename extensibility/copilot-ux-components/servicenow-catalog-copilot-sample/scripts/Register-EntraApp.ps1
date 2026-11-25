<#
.SYNOPSIS
  Registers the Entra ID app whose tokens ServiceNow accepts from the Copilot UX component.

.DESCRIPTION
  Creates (or updates) an app registration with:
    - Application ID URI   api://<appId>
    - Delegated scope      user_impersonation
    - Access token version 2 (the token audience is the app ID)
  and creates its service principal so SharePoint can request consent for it.

  Requires Azure CLI signed in to your Microsoft 365 tenant (az login) with rights to create
  app registrations (Application Developer or higher).

.EXAMPLE
  .\Register-EntraApp.ps1
  .\Register-EntraApp.ps1 -AppName "Contoso ServiceNow Catalog API"
#>
[CmdletBinding()]
param(
  # Must match the "resource" name in spfx/config/package-solution.json (webApiPermissionRequests).
  [string]$AppName = 'ServiceNow Catalog Copilot API'
)

$ErrorActionPreference = 'Stop'

function Invoke-Az {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $output = & az @args 2>$null } finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) { throw "az $($args[0..2] -join ' ') failed (exit $LASTEXITCODE)." }
  return $output
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw 'Azure CLI is required: https://aka.ms/installazurecliwindows. Then run "az login".'
}

$account = Invoke-Az account show --output json | ConvertFrom-Json
$tenantId = $account.tenantId
Write-Host "Tenant: $tenantId" -ForegroundColor Cyan

$app = Invoke-Az ad app list --display-name $AppName --query '[0]' --output json | ConvertFrom-Json
if (-not $app) {
  Write-Host "Creating app registration '$AppName'..."
  $app = Invoke-Az ad app create --display-name $AppName --sign-in-audience AzureADMyOrg --output json | ConvertFrom-Json
}
$appId = $app.appId

$existingScope = $null
if ($app.api -and $app.api.oauth2PermissionScopes) {
  $existingScope = $app.api.oauth2PermissionScopes | Where-Object { $_.value -eq 'user_impersonation' } | Select-Object -First 1
}
$scopeId = if ($existingScope) { $existingScope.id } else { [guid]::NewGuid().ToString() }

$patch = @{
  identifierUris = @("api://$appId")
  api = @{
    requestedAccessTokenVersion = 2
    oauth2PermissionScopes = @(@{
      id = $scopeId
      value = 'user_impersonation'
      type = 'User'
      isEnabled = $true
      adminConsentDisplayName = 'Access the ServiceNow catalog on behalf of the signed-in user'
      adminConsentDescription = 'Allows the Copilot catalog component to read ServiceNow catalog items and submit requests as the signed-in user.'
      userConsentDisplayName = 'Request ServiceNow catalog items'
      userConsentDescription = 'Allows the app to read ServiceNow catalog items and submit requests for you.'
    })
  }
} | ConvertTo-Json -Depth 6

$patchFile = Join-Path $env:TEMP "entra-app-$([guid]::NewGuid()).json"
Set-Content -Path $patchFile -Value $patch -Encoding UTF8
try {
  Invoke-Az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$($app.id)" --headers 'Content-Type=application/json' --body "@$patchFile" | Out-Null
} finally {
  Remove-Item $patchFile -Force -ErrorAction SilentlyContinue
}

$sp = Invoke-Az ad sp list --filter "appId eq '$appId'" --query '[0]' --output json | ConvertFrom-Json
if (-not $sp) { Invoke-Az ad sp create --id $appId --output none | Out-Null }

Write-Host ''
Write-Host 'Done. Use these values:' -ForegroundColor Green
Write-Host "  Tenant ID        : $tenantId"
Write-Host "  App (client) ID  : $appId"
Write-Host "  apiResource      : api://$appId     (spfx/src/copilotComponents/serviceNowCatalog/settings.ts)"
Write-Host "  Permission name  : $AppName / user_impersonation   (spfx/config/package-solution.json)"
Write-Host ''
Write-Host "Next: .\Configure-ServiceNow.ps1 -InstanceUrl https://<instance>.service-now.com -TenantId $tenantId -AppId $appId -SharePointOrigin https://<tenant>.sharepoint.com"
