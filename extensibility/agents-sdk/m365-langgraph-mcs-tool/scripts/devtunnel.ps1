$exe = where.exe devtunnel.exe
if ("" -eq $exe) {
  Write-Host "Dev Tunnels CLI not found. Please install: https://learn.microsoft.com/azure/developer/dev-tunnels/get-started"
  exit
}

# Function to check and ensure login
function Ensure-DevTunnelLogin {
  Write-Host "Checking Dev Tunnels login status..."
  $loginStatus = devtunnel user show 2>&1
  
  if ($LASTEXITCODE -ne 0 -or $loginStatus -like "*not logged in*" -or $loginStatus -like "*expired*") {
    Write-Host "Login required or token expired. Logging in to Dev Tunnels..."
    devtunnel user login
    
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Failed to login to Dev Tunnels. Please try again."
      exit 1
    }
    Write-Host "Successfully logged in to Dev Tunnels."
  } else {
    Write-Host "Already logged in to Dev Tunnels."
  }
}

$tunnelId = ""
$envFile = ".\env\.env.local"
$envFileContent = Get-Content $envFile
$envFileContent | ForEach-Object {
  if ($_ -like "TUNNEL_ID=*") {
    $tunnelId = $_.Split("=")[1].Trim()
  }
}

if ($tunnelId -eq "") {
  Write-Host "No TUNNEL_ID found. Creating tunnel..."

  Ensure-DevTunnelLogin
    
  Write-Host "Creating tunnel..."
  $tunnel = devtunnel.exe create
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create tunnel."
    exit 1
  }
  
  $tunnelId = $tunnel -split '\r?\n' | Select-String 'Tunnel ID' | ForEach-Object { ($_ -split ':')[1].Trim() }
    
  Write-Host "Creating port and access..."
  $port = 3978
  devtunnel port create $tunnelId -p $port > $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create port."
    exit 1
  }
  
  devtunnel access create $tunnelId -p $port -a > $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create access."
    exit 1
  }
    
  Write-Host "Updating env\.env.local..."

  $hostname = $tunnelId.split('.')[0]
  $cluster = $tunnelId.split('.')[1]

  $domain = "$hostname-$port.$cluster.devtunnels.ms"
  $endpoint = "https://$domain"

  $envFileContent | ForEach-Object {
    $line = $_
    if ($line -like "BOT_ENDPOINT=*") {
      $line = "BOT_ENDPOINT=$endpoint/api/messages"
    }
    if ($line -like "BOT_DOMAIN=*") {
      $line = "BOT_DOMAIN=$domain"
    }
    if ($line -like "TUNNEL_ID=*") {
      $line = "TUNNEL_ID=$tunnelId"
    }
    $line
  } | Set-Content $envFile

  Write-Host "TUNNEL_ID: $tunnelId"
  Write-Host "BOT_ENDPOINT: $endpoint"
  Write-Host "BOT_DOMAIN: $domain"
} else {
  Write-Host "Found existing TUNNEL_ID: $tunnelId"
  Ensure-DevTunnelLogin
}

Write-Host "Starting tunnel host..."
devtunnel.exe host $tunnelId

if ($LASTEXITCODE -ne 0) {
  Write-Host "Failed to host tunnel. This might be due to:"
  Write-Host "  - Expired login token (try deleting TUNNEL_ID from .env.local)"
  Write-Host "  - Tunnel no longer exists (delete TUNNEL_ID from .env.local to create new one)"
  Write-Host "  - Network connectivity issues"
  exit 1
}