#!/bin/bash

# Ensure ~/bin is in PATH for devtunnel
export PATH="$HOME/bin:$PATH"

exe=$(which devtunnel)
if [ $? -ne 0 ]; then
  echo "Dev Tunnels CLI not found. Please install: https://learn.microsoft.com/azure/developer/dev-tunnels/get-started"
  exit 1
fi

# Function to check and ensure login
ensure_devtunnel_login() {
  echo "Checking Dev Tunnels login status..."
  loginStatus=$(devtunnel user show 2>&1)
  
  if [ $? -ne 0 ] || [[ $loginStatus == *"not logged in"* ]] || [[ $loginStatus == *"expired"* ]]; then
    echo "Login required or token expired. Logging in to Dev Tunnels..."
    devtunnel user login
    
    if [ $? -ne 0 ]; then
      echo "Failed to login to Dev Tunnels. Please try again."
      exit 1
    fi
    echo "Successfully logged in to Dev Tunnels."
  else
    echo "Already logged in to Dev Tunnels."
  fi
}

tunnelId=""
envFile="env/.env.local"

while IFS= read -r line; do
  if [[ $line == TUNNEL_ID=* ]]; then
    tunnelId="${line#*=}"
  fi
done <"$envFile"

if [ -z "$tunnelId" ]; then
  echo "No TUNNEL_ID found. Creating tunnel..."

  ensure_devtunnel_login

  echo "Creating tunnel..."
  tunnel=$(devtunnel create)
  if [ $? -ne 0 ]; then
    echo "Failed to create tunnel."
    exit 1
  fi
  
  tunnelId=$(echo "$tunnel" | grep 'Tunnel ID' | cut -d ':' -f2 | xargs)

  echo "Creating port and access..."
  port=3978
  devtunnel port create $tunnelId -p $port
  if [ $? -ne 0 ]; then
    echo "Failed to create port."
    exit 1
  fi
  
  devtunnel access create $tunnelId -p $port -a
  if [ $? -ne 0 ]; then
    echo "Failed to create access."
    exit 1
  fi

  echo "Updating env/.env.local..."

  hostname=$(echo $tunnelId | cut -d '.' -f1)
  cluster=$(echo $tunnelId | cut -d '.' -f2)

  domain="$hostname-$port.$cluster.devtunnels.ms"
  endpoint="https://$domain"

  # read file into an array
  lines=()
  while IFS= read -r line; do
    lines+=("$line")
  done <"$envFile"

  # update lines
  for i in "${!lines[@]}"; do
    if [[ ${lines[i]} == BOT_ENDPOINT=* ]]; then
      lines[i]="BOT_ENDPOINT=$endpoint/api/messages"
    fi
    if [[ ${lines[i]} == BOT_DOMAIN=* ]]; then
      lines[i]="BOT_DOMAIN=$domain"
    fi
    if [[ ${lines[i]} == TUNNEL_ID=* ]]; then
      lines[i]="TUNNEL_ID=$tunnelId"
    fi
  done

  # write array to file
  printf "%s\n" "${lines[@]}" >"$envFile"

  echo "TUNNEL_ID: $tunnelId"
  echo "BOT_ENDPOINT: $endpoint"
  echo "BOT_DOMAIN: $domain"
else
  echo "Found existing TUNNEL_ID: $tunnelId"
  ensure_devtunnel_login
fi

echo "Starting tunnel host..."
devtunnel host $tunnelId

if [ $? -ne 0 ]; then
  echo "Failed to host tunnel. This might be due to:"
  echo "  - Expired login token (try deleting TUNNEL_ID from .env.local)"
  echo "  - Tunnel no longer exists (delete TUNNEL_ID from .env.local to create new one)"
  echo "  - Network connectivity issues"
  exit 1
fi