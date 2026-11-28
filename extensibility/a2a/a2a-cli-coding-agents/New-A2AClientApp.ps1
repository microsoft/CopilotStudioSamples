<#
.SYNOPSIS
Registers the Entra app the a2a CLI signs in with to call Copilot Studio agents over A2A,
and prints the matching a2a-cli configuration.

.DESCRIPTION
Uses your Azure CLI sign-in. Creates (or updates, matched by display name) a single-tenant
public client app with:
  - the redirect URI http://127.0.0.1/oauth/callback (the a2a CLI's loopback redirect;
    Entra ignores the port)
  - public client flows allowed, for a2a auth login --device
  - the delegated permission MCS.InvokeAsA2A on the Copilot Studio channel API
Then creates its service principal and, with -GrantAdminConsent, consents for all users.

.EXAMPLE
./New-A2AClientApp.ps1 -TenantId 00000000-0000-0000-0000-000000000000 -GrantAdminConsent
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $TenantId,
    [string] $DisplayName = 'a2a CLI for Copilot Studio',
    [switch] $GrantAdminConsent,
    [string] $ConfigPath = (Join-Path $HOME '.config/a2a-cli/config.yaml')
)
$ErrorActionPreference = 'Stop'

$channelApiAppId = '6f46e6ed-07bf-4616-80f0-47546850f654'
$redirectUri = 'http://127.0.0.1/oauth/callback'
$graph = 'https://graph.microsoft.com/v1.0'

$token = az account get-access-token --tenant $TenantId --resource https://graph.microsoft.com --query accessToken -o tsv
if (-not $token) { throw "Sign in first: az login --tenant $TenantId" }
$headers = @{ Authorization = "Bearer $token" }

function Invoke-Graph([string] $Method, [string] $Path, $Body) {
    $params = @{ Method = $Method; Uri = "$graph$Path"; Headers = $headers }
    if ($null -ne $Body) {
        $params.ContentType = 'application/json'
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    Invoke-RestMethod @params
}

$channelApi = (Invoke-Graph GET "/servicePrincipals?`$filter=appId eq '$channelApiAppId'").value | Select-Object -First 1
if (-not $channelApi) {
    throw "The Copilot Studio channel API is not in this tenant yet. Open the A2A client channel on a published agent once, then run this again."
}
$scope = $channelApi.oauth2PermissionScopes | Where-Object value -EQ 'MCS.InvokeAsA2A'

$appBody = @{
    displayName            = $DisplayName
    signInAudience         = 'AzureADMyOrg'
    isFallbackPublicClient = $true
    publicClient           = @{ redirectUris = @($redirectUri) }
    requiredResourceAccess = @(@{
        resourceAppId  = $channelApiAppId
        resourceAccess = @(@{ id = $scope.id; type = 'Scope' })
    })
}
$escapedName = $DisplayName.Replace("'", "''")
$app = (Invoke-Graph GET "/applications?`$filter=displayName eq '$escapedName'").value | Select-Object -First 1
if ($app) {
    Invoke-Graph PATCH "/applications/$($app.id)" $appBody | Out-Null
    Write-Host "Updated app registration '$DisplayName'"
}
else {
    $app = Invoke-Graph POST '/applications' $appBody
    Write-Host "Created app registration '$DisplayName'"
}

$sp = (Invoke-Graph GET "/servicePrincipals?`$filter=appId eq '$($app.appId)'").value | Select-Object -First 1
if (-not $sp) {
    # A new app can take a few seconds to replicate before its service principal can be created.
    for ($i = 0; -not $sp -and $i -lt 6; $i++) {
        try { $sp = Invoke-Graph POST '/servicePrincipals' @{ appId = $app.appId } }
        catch { Start-Sleep -Seconds 5 }
    }
}

if ($GrantAdminConsent) {
    $grant = (Invoke-Graph GET "/oauth2PermissionGrants?`$filter=clientId eq '$($sp.id)' and resourceId eq '$($channelApi.id)'").value | Select-Object -First 1
    if (-not $grant) {
        Invoke-Graph POST '/oauth2PermissionGrants' @{
            clientId = $sp.id; consentType = 'AllPrincipals'; resourceId = $channelApi.id; scope = 'MCS.InvokeAsA2A'
        } | Out-Null
    }
    Write-Host 'Admin consent granted for MCS.InvokeAsA2A'
}

$yaml = @"
oauth: cached
oauth-clients:
  - authority: https://login.microsoftonline.com/$TenantId/v2.0
    client_id: $($app.appId)
    omit_resource: true
"@

if (Test-Path $ConfigPath) {
    Write-Host "`n$ConfigPath already exists, so it was left unchanged. Add this to it:`n"
    Write-Output $yaml
}
else {
    New-Item -ItemType Directory -Force -Path (Split-Path $ConfigPath) | Out-Null
    Set-Content -Path $ConfigPath -Value $yaml -Encoding utf8
    Write-Host "`nWrote $ConfigPath"
}
Write-Host "Application (client) ID: $($app.appId)"
