<#
.SYNOPSIS
  Configures a ServiceNow instance so the Copilot UX component can call it directly
  with the signed-in user's Microsoft Entra ID token.

.DESCRIPTION
  Creates (if missing) in ServiceNow:
    1. OIDC provider configuration  - validates Entra ID v2 tokens of your tenant and maps the
                                       'preferred_username' claim to sys_user.email
    2. External OIDC provider entity - Client ID = your Entra app ID (the token audience)
    3. CORS rule for the Service Catalog API (GET, POST)
    4. CORS rule for the Table API   (GET; reference-field lookups)
  CORS rules use your SharePoint origin and Allow-Credentials = true (ServiceNow only returns
  'Authorization' in Access-Control-Allow-Headers when credentials are allowed).

  Uses the ServiceNow Table API with an admin account (you're prompted for credentials).
  Safe to run again: existing records with the same names are left unchanged.

.EXAMPLE
  .\Configure-ServiceNow.ps1 -InstanceUrl https://contoso.service-now.com `
      -TenantId 00000000-0000-0000-0000-000000000000 -AppId 11111111-1111-1111-1111-111111111111 `
      -SharePointOrigin https://contoso.sharepoint.com
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InstanceUrl,
  [Parameter(Mandatory = $true)][string]$TenantId,
  [Parameter(Mandatory = $true)][string]$AppId,
  [Parameter(Mandatory = $true)][string]$SharePointOrigin,
  [pscredential]$Credential,
  [string]$NamePrefix = 'Copilot catalog component'
)

$ErrorActionPreference = 'Stop'
$base = $InstanceUrl.TrimEnd('/')
$origin = $SharePointOrigin.TrimEnd('/')
if (-not $Credential) { $Credential = Get-Credential -Message "ServiceNow admin for $base" }

$pair = "$($Credential.UserName):$($Credential.GetNetworkCredential().Password)"
$headers = @{
  Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair))
  Accept = 'application/json'
}

function Get-Records([string]$table, [string]$query, [string]$fields = 'sys_id,name') {
  $q = [uri]::EscapeDataString($query)
  $response = Invoke-WebRequest "$base/api/now/table/${table}?sysparm_fields=$fields&sysparm_query=$q" -Headers $headers -UseBasicParsing
  if ($response.Content -match 'Hibernating') { throw 'The ServiceNow instance is hibernating. Wake it up and run the script again.' }
  return ($response.Content | ConvertFrom-Json).result
}

function New-Record([string]$table, [hashtable]$values) {
  try {
    return (Invoke-RestMethod "$base/api/now/table/$table" -Method Post -Headers $headers -ContentType 'application/json' -Body ($values | ConvertTo-Json)).result
  } catch {
    $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
    throw "Creating $table failed: $($reader.ReadToEnd())"
  }
}

# 1. OIDC provider configuration ---------------------------------------------------------------
$cfgName = "$NamePrefix - Microsoft Entra ID"
$cfg = @(Get-Records 'oidc_provider_configuration' "name=$cfgName")[0]
if (-not $cfg) {
  $cfg = New-Record 'oidc_provider_configuration' @{
    name = $cfgName
    oidc_url = "https://login.microsoftonline.com/$TenantId/v2.0/.well-known/openid-configuration"
    user_claim = 'preferred_username'
    user_field = 'email'
    enable_jti_verification = 'false'
    active = 'true'
  }
  Write-Host "Created OIDC provider configuration: $($cfg.sys_id)" -ForegroundColor Green
} else { Write-Host "OIDC provider configuration exists: $($cfg.sys_id)" }

# 2. External OIDC provider entity ---------------------------------------------------------------
$entity = @(Get-Records 'oauth_oidc_entity' "client_id=$AppId")[0]
if (-not $entity) {
  $bytes = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $entity = New-Record 'oauth_oidc_entity' @{
    name = "$NamePrefix (Entra ID)"
    type = 'oauth_provider'                 # "External OIDC Provider"
    client_id = $AppId                      # must equal the token audience (aud)
    client_secret = [Convert]::ToBase64String($bytes)   # required field; not used to validate tokens
    oidc_provider_configuration = $cfg.sys_id
    clock_skew = '300'
    active = 'true'
  }
  Write-Host "Created External OIDC provider entity: $($entity.sys_id)" -ForegroundColor Green
} else { Write-Host "External OIDC provider entity exists: $($entity.sys_id)" }

# 3 + 4. CORS rules --------------------------------------------------------------------------------
$catalogApi = @(Get-Records 'sys_ws_definition' 'base_uri=/api/sn_sc/servicecatalog' 'sys_id,name')[0]
if (-not $catalogApi) { throw 'Service Catalog API (/api/sn_sc/servicecatalog) not found on this instance.' }

$rules = @(
  @{ name = "$NamePrefix - Service Catalog API"; rest_api = $catalogApi.sys_id; get = 'true'; post = 'true'; headers = 'authorization,content-type,accept' },
  # Built-in APIs such as the Table API are referenced by their route instead of a sys_id.
  @{ name = "$NamePrefix - Table API"; rest_api = 'now/table'; get = 'true'; post = 'false'; headers = 'authorization,accept' }
)
foreach ($r in $rules) {
  $existing = @(Get-Records 'sys_cors_rule' "name=$($r.name)")[0]
  if ($existing) { Write-Host "CORS rule exists: $($r.name)"; continue }
  $created = New-Record 'sys_cors_rule' @{
    name = $r.name
    rest_api = $r.rest_api
    domain = $origin                        # wildcards (*) are rejected by ServiceNow
    get = $r.get; post = $r.post; put = 'false'; patch = 'false'; delete = 'false'
    access_control_allow_headers = $r.headers
    access_control_allow_credentials = 'true'
    max_age = '300'
    active = 'true'
  }
  Write-Host "Created CORS rule: $($r.name) ($($created.sys_id))" -ForegroundColor Green
}

# Verify the preflight -------------------------------------------------------------------------------
Start-Sleep -Seconds 2
$preflight = Invoke-WebRequest "$base/api/sn_sc/servicecatalog/items/00000000000000000000000000000000/order_now" -Method Options -UseBasicParsing -Headers @{
  Origin = $origin; 'Access-Control-Request-Method' = 'POST'; 'Access-Control-Request-Headers' = 'authorization,content-type,accept'
}
$allowHeaders = $preflight.Headers['Access-Control-Allow-Headers']
if ("$allowHeaders" -match 'authorization') {
  Write-Host "Preflight OK: Access-Control-Allow-Headers = $allowHeaders" -ForegroundColor Green
} else {
  Write-Warning "Preflight doesn't allow 'authorization' yet (got '$allowHeaders'). Check the CORS rules in System Web Services > REST > CORS Rules."
}

Write-Host ''
Write-Host 'Reminder: every Microsoft 365 user needs a ServiceNow user whose email equals their sign-in name (UPN).' -ForegroundColor Cyan
