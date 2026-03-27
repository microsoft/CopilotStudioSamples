#Requires -Version 5.1
<#
.SYNOPSIS
  Start servers, create a dev tunnel, and deploy/update the Power Platform connector.

.PARAMETER EnvironmentId
  Power Platform environment ID (required).

.PARAMETER TenantId
  Azure AD tenant ID (optional). Forces re-login if current token is for a different tenant.

.EXAMPLE
  .\scripts\deploy.ps1 -EnvironmentId "6cc0c98e-3fe6-e0d5-8eba-ba51c9da1d13"
  .\scripts\deploy.ps1 -EnvironmentId "6cc0c98e-..." -TenantId "8a235459-..."
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$EnvironmentId,

    [Parameter(Mandatory=$false)]
    [string]$TenantId = ""
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$CatalogPort = 3000
$McpPort = 3001
$SettingsFile = Join-Path $ProjectDir "connector\settings.json"
$SwaggerFile = Join-Path $ProjectDir "connector\apiDefinition.swagger.json"
$PropsFile = Join-Path $ProjectDir "connector\apiProperties.json"
$ScriptFile = Join-Path $ProjectDir "connector\script.csx"
$PaconnTokenFile = Join-Path $env:USERPROFILE ".paconn\accessTokens.json"

$Processes = @()

function Cleanup {
    Write-Host "`nShutting down..."
    foreach ($p in $script:Processes) {
        if ($p -and !$p.HasExited) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "Done."
}

trap { Cleanup; break }

# --- 0. Ensure paconn is logged in ---
function Ensure-Login {
    Write-Host "==> Checking paconn login..."
    $needLogin = $false

    if (-not (Test-Path $PaconnTokenFile)) {
        Write-Host "    No token file found."
        $needLogin = $true
    } else {
        $token = Get-Content $PaconnTokenFile | ConvertFrom-Json

        # Check expiry
        $expiresOn = [double]$token.expires_on
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        if ($expiresOn -lt $now) {
            Write-Host "    Token expired."
            $needLogin = $true
        }

        # Check tenant
        if ($TenantId -and -not $needLogin) {
            if ($token.tenant_id -ne $TenantId) {
                Write-Host "    Logged into tenant $($token.tenant_id), need $TenantId."
                $needLogin = $true
            }
        }
    }

    if ($needLogin) {
        Write-Host "    Logging in..."
        if ($TenantId) {
            python -m paconn login -t $TenantId
        } else {
            python -m paconn login
        }
        Write-Host "    Login complete."
    } else {
        Write-Host "    Logged in as $($token.user_id)"
    }
}

Ensure-Login

# --- 1. Build & start servers ---
Write-Host "==> Building..."
Set-Location $ProjectDir
npm run build

Write-Host "==> Starting catalog server (port $CatalogPort)..."
$env:PORT = $CatalogPort
$catalogProc = Start-Process -FilePath "node" -ArgumentList "build/catalog/index.js" `
    -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\catalog-out.log"
$Processes += $catalogProc

Write-Host "==> Starting MCP server (port $McpPort)..."
$env:PORT = $McpPort
$mcpProc = Start-Process -FilePath "node" -ArgumentList "build/mcp-server/index.js" `
    -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\mcp-out.log"
$Processes += $mcpProc
Remove-Item Env:\PORT

Write-Host "    Waiting for servers..."
for ($i = 0; $i -lt 15; $i++) {
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:$CatalogPort/instances" -TimeoutSec 2
        Write-Host "    Both servers ready."
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

# --- 2. Start devtunnel ---
Write-Host "==> Starting devtunnel for ports $CatalogPort and $McpPort..."
$tunnelLog = "$env:TEMP\devtunnel-output.log"
$tunnelProc = Start-Process -FilePath "devtunnel" `
    -ArgumentList "host -p $CatalogPort -p $McpPort --allow-anonymous" `
    -NoNewWindow -PassThru -RedirectStandardOutput $tunnelLog
$Processes += $tunnelProc

Write-Host "    Waiting for tunnel..."
$catalogHost = ""
$mcpHost = ""
for ($i = 0; $i -lt 30; $i++) {
    if (Test-Path $tunnelLog) {
        $log = Get-Content $tunnelLog -Raw
        if ($log -match "Ready to accept") {
            if ($log -match "([a-z0-9]+-$CatalogPort\.[a-z]+\.devtunnels\.ms)") {
                $catalogHost = $Matches[1]
            }
            if ($log -match "([a-z0-9]+-$McpPort\.[a-z]+\.devtunnels\.ms)") {
                $mcpHost = $Matches[1]
            }
            break
        }
    }
    Start-Sleep -Seconds 1
}

if (-not $catalogHost -or -not $mcpHost) {
    Write-Error "ERROR: Could not extract tunnel URLs. Check $tunnelLog"
    Cleanup
    exit 1
}

Write-Host "    Tunnel ready!"
Write-Host "    Catalog: https://$catalogHost"
Write-Host "    MCP:     https://$mcpHost"

# --- 3. Restart catalog with tunnel URL ---
Stop-Process -Id $catalogProc.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "==> Restarting catalog with MCP_SERVER_BASE=https://$mcpHost..."
$env:MCP_SERVER_BASE = "https://$mcpHost"
$env:PORT = $CatalogPort
$catalogProc = Start-Process -FilePath "node" -ArgumentList "build/catalog/index.js" `
    -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\catalog-out2.log"
$Processes += $catalogProc
Remove-Item Env:\PORT
Remove-Item Env:\MCP_SERVER_BASE
Start-Sleep -Seconds 3

Write-Host "    Verifying catalog..."
$instances = Invoke-RestMethod -Uri "https://$catalogHost/instances"
Write-Host "    Got $($instances.Count) instances"

# --- 4. Update swagger host ---
Write-Host "==> Updating swagger host to $catalogHost..."
$swagger = Get-Content $SwaggerFile | ConvertFrom-Json
$swagger.host = $catalogHost
$swagger | ConvertTo-Json -Depth 20 | Set-Content $SwaggerFile -Encoding UTF8
Write-Host "    Updated."

# --- 5. Deploy or update connector ---
if (Test-Path $SettingsFile) {
    $settings = Get-Content $SettingsFile | ConvertFrom-Json
    $connectorId = $settings.connectorId
    Write-Host "==> Updating existing connector: $connectorId"
    python -m paconn update `
        -e $EnvironmentId `
        -c $connectorId `
        -d $SwaggerFile `
        -p $PropsFile `
        -x $ScriptFile
} else {
    Write-Host "==> Creating new connector..."
    python -m paconn create `
        -e $EnvironmentId `
        -d $SwaggerFile `
        -p $PropsFile `
        -x $ScriptFile `
        -w
    Write-Host "    Connector created."
}

Write-Host ""
Write-Host "========================================="
Write-Host "  Deployment complete!"
Write-Host "  Catalog: https://$catalogHost"
Write-Host "  MCP:     https://$mcpHost"
Write-Host "  Environment: $EnvironmentId"
Write-Host "========================================="
Write-Host ""
Write-Host "Press Ctrl+C to stop servers and tunnel."

try {
    while ($true) { Start-Sleep -Seconds 60 }
} finally {
    Cleanup
}
