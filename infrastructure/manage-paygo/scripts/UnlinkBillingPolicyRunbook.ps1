 param (
     [Parameter(Mandatory=$false)]
     [object] $WebhookData
 )
 $WebhookData | ConvertTo-Json -depth 99
$alertId = $WebhookData.data.essentials.alertId
$subscriptionId   = ($alertId -split '/')[2]
$resourceGroupName = ($alertId -split '/')[4]
$subscriptionId
$resourceGroupName

#Audience for Azure Public Cloud
# For other clouds see https://learn.microsoft.com/en-us/power-automate/oauth-authentication?tabs=new-designer#audience-values
$aud="https://service.flow.microsoft.com/"
# Connect to Azure Powershell using the Managed Identity
Connect-azaccount -Identity
# Get a token
$EntraToken=Get-AzAccessToken -ResourceUrl $aud
$Token=$EntraToken.Token | ConvertTo-SecureString -AsPlainText


$payload=[pscustomobject]@{
        resourceGroupName=$resourceGroupName
        subscriptionid=$subscriptionId
        } | convertto-json -Compress

$Url="https://eb3001acdd1eef5fa19ccc99b93eeb.01.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/5f5585a66b1f4ce0bd34c0a05769a437/triggers/manual/paths/invoke?api-version=1"

Invoke-RestMethod -Method Post -Authentication Bearer -Token $Token -Uri $Url -Body $payload -ContentType 'application/json' -StatusCodeVariable StatusCode -ResponseHeadersVariable RequestResponse
$RequestResponse | ConvertTo-Json -depth 99
$StatusCode | ConvertTo-Json -depth 99