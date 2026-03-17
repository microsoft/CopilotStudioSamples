param (
    [Parameter(Mandatory=$true)]
    [string]$siteUrl,

    [Parameter(Mandatory=$true)]
    [string]$botUrl,

    [Parameter(Mandatory=$true)]
    [string]$botName,

    [Parameter(Mandatory=$true)]
    [string]$customScope,

    [Parameter(Mandatory=$true)]
    [string]$clientId,

    [Parameter(Mandatory=$true)]
    [string]$authority,

    [Parameter(Mandatory=$true)]
    [string]$buttonLabel,

    [Parameter(Mandatory=$true)]
    [switch]$greet
)

Connect-PnPOnline -Url $siteUrl -Interactive
$action = (Get-PnPCustomAction | Where-Object { $_.Title -eq "PvaSso" })[0]

$action.ClientSideComponentProperties = @{
    "botURL" = $botUrl
    "customScope" = $customScope
    "clientID" = $clientId
    "authority" = $authority
    "greet" = $greet.isPresent
    "buttonLabel" = $buttonLabel
    "botName" = $botName
} | ConvertTo-Json -Compress

$action.Update()
Invoke-PnPQuery