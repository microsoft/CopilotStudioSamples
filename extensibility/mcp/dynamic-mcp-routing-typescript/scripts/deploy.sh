#!/usr/bin/env bash
#
# deploy.sh — Start servers, create a dev tunnel, and deploy/update
# the Power Platform connector in one step.
#
# Usage:
#   ./scripts/deploy.sh [ENVIRONMENT_ID] [TENANT_ID]
#
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CATALOG_PORT=3000
MCP_PORT=3001
ENV_ID="${1:?Usage: deploy.sh <environment-id> [tenant-id]}"
TENANT_ID="${2:-}"
SETTINGS_FILE="$PROJECT_DIR/connector/settings.json"
SWAGGER_FILE="$PROJECT_DIR/connector/apiDefinition.swagger.json"
PROPS_FILE="$PROJECT_DIR/connector/apiProperties.json"
SCRIPT_FILE="$PROJECT_DIR/connector/script.csx"
PACONN_TOKEN_FILE="$HOME/.paconn/accessTokens.json"

# --- 0. Ensure paconn is logged in (correct tenant) ---
ensure_login() {
  local need_login=false

  if [ ! -f "$PACONN_TOKEN_FILE" ]; then
    echo "    No token file found."
    need_login=true
  else
    local expires_on
    expires_on=$(python3 -c "import json; print(json.load(open('$PACONN_TOKEN_FILE')).get('expires_on','0'))" 2>/dev/null || echo "0")
    local now
    now=$(python3 -c "import time; print(time.time())")
    if python3 -c "exit(0 if float('$expires_on') < float('$now') else 1)" 2>/dev/null; then
      echo "    Token expired."
      need_login=true
    fi

    if [ -n "$TENANT_ID" ] && [ "$need_login" = false ]; then
      local current_tenant
      current_tenant=$(python3 -c "import json; print(json.load(open('$PACONN_TOKEN_FILE')).get('tenant_id',''))" 2>/dev/null || echo "")
      if [ "$current_tenant" != "$TENANT_ID" ]; then
        echo "    Logged into tenant $current_tenant, need $TENANT_ID."
        need_login=true
      fi
    fi
  fi

  if [ "$need_login" = true ]; then
    echo "    Logging in..."
    if [ -n "$TENANT_ID" ]; then
      python3 -m paconn login -t "$TENANT_ID"
    else
      python3 -m paconn login
    fi
    echo "    Login complete."
  else
    local user_id
    user_id=$(python3 -c "import json; print(json.load(open('$PACONN_TOKEN_FILE')).get('user_id','unknown'))" 2>/dev/null)
    echo "    Logged in as $user_id"
  fi
}

echo "==> Checking paconn login..."
ensure_login

# --- Helpers ---
cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "${CATALOG_PID:-}" ] && kill "$CATALOG_PID" 2>/dev/null
  [ -n "${MCP_PID:-}" ] && kill "$MCP_PID" 2>/dev/null
  [ -n "${TUNNEL_PID:-}" ] && kill "$TUNNEL_PID" 2>/dev/null
  wait 2>/dev/null
  echo "Done."
}
trap cleanup EXIT

# --- 1. Build & start servers ---
echo "==> Building..."
cd "$PROJECT_DIR"
npm run build

echo "==> Starting catalog server (port $CATALOG_PORT)..."
PORT=$CATALOG_PORT node build/catalog/index.js &
CATALOG_PID=$!

echo "==> Starting MCP server (port $MCP_PORT)..."
PORT=$MCP_PORT node build/mcp-server/index.js &
MCP_PID=$!

echo "    Waiting for servers..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:$CATALOG_PORT/instances > /dev/null 2>&1; then
    echo "    Both servers ready."
    break
  fi
  sleep 1
done

# --- 2. Start devtunnel ---
echo "==> Starting devtunnel for ports $CATALOG_PORT and $MCP_PORT..."
devtunnel host -p "$CATALOG_PORT" -p "$MCP_PORT" --allow-anonymous > /tmp/devtunnel-output.log 2>&1 &
TUNNEL_PID=$!

echo "    Waiting for tunnel..."
CATALOG_HOST=""
MCP_HOST=""
for i in $(seq 1 30); do
  if grep -q "Ready to accept" /tmp/devtunnel-output.log 2>/dev/null; then
    CATALOG_HOST=$(grep -oE "[a-z0-9]+-${CATALOG_PORT}\.[a-z]+\.devtunnels\.ms" /tmp/devtunnel-output.log | head -1)
    MCP_HOST=$(grep -oE "[a-z0-9]+-${MCP_PORT}\.[a-z]+\.devtunnels\.ms" /tmp/devtunnel-output.log | head -1)
    break
  fi
  sleep 1
done

if [ -z "$CATALOG_HOST" ] || [ -z "$MCP_HOST" ]; then
  echo "ERROR: Could not extract tunnel URLs. Log:"
  cat /tmp/devtunnel-output.log
  exit 1
fi

echo "    Tunnel ready!"
echo "    Catalog: https://$CATALOG_HOST"
echo "    MCP:     https://$MCP_HOST"

# --- 3. Restart catalog with tunnel URL ---
kill "$CATALOG_PID" 2>/dev/null
wait "$CATALOG_PID" 2>/dev/null || true
echo "==> Restarting catalog with MCP_SERVER_BASE=https://$MCP_HOST..."
MCP_SERVER_BASE="https://$MCP_HOST" PORT=$CATALOG_PORT node build/catalog/index.js &
CATALOG_PID=$!
sleep 3

echo "    Verifying catalog..."
curl -s "https://$CATALOG_HOST/instances" | head -c 200
echo ""

# --- 4. Update swagger host ---
echo "==> Updating swagger host to $CATALOG_HOST..."
python3 -c "
import json
with open('$SWAGGER_FILE', 'r') as f:
    swagger = json.load(f)
swagger['host'] = '$CATALOG_HOST'
with open('$SWAGGER_FILE', 'w') as f:
    json.dump(swagger, f, indent=2)
print('    Updated to:', swagger['host'])
"

# --- 5. Deploy or update connector ---
if [ -f "$SETTINGS_FILE" ]; then
  CONNECTOR_ID=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['connectorId'])")
  echo "==> Updating existing connector: $CONNECTOR_ID"
  python3 -m paconn update \
    -e "$ENV_ID" \
    -c "$CONNECTOR_ID" \
    -d "$SWAGGER_FILE" \
    -p "$PROPS_FILE" \
    -x "$SCRIPT_FILE"
else
  echo "==> Creating new connector..."
  python3 -m paconn create \
    -e "$ENV_ID" \
    -d "$SWAGGER_FILE" \
    -p "$PROPS_FILE" \
    -x "$SCRIPT_FILE" \
    -w
  echo "    Connector created."
fi

echo ""
echo "========================================="
echo "  Deployment complete!"
echo "  Catalog: https://$CATALOG_HOST"
echo "  MCP:     https://$MCP_HOST"
echo "  Environment: $ENV_ID"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop servers and tunnel."
wait
