#!/usr/bin/env bash
set -uo pipefail

# --- Configuration ---
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

# --- Output helpers ---
BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

step()  { echo -e "\n${BOLD}${CYAN}[$1]${RESET} ${BOLD}$2${RESET}"; }
info()  { echo -e "  ${DIM}$1${RESET}"; }
ok()    { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${RESET} $1"; }
fail()  { echo -e "  ${RED}✗${RESET} $1"; }

# --- Cleanup ---
cleanup() {
  echo ""
  step "•" "Shutting down..."
  [ -n "${CATALOG_PID:-}" ] && kill "$CATALOG_PID" 2>/dev/null
  [ -n "${MCP_PID:-}" ] && kill "$MCP_PID" 2>/dev/null
  [ -n "${TUNNEL_PID:-}" ] && kill "$TUNNEL_PID" 2>/dev/null
  wait 2>/dev/null
  ok "All processes stopped."
}
trap cleanup EXIT

# ============================================================
# Step 1: Authentication
# ============================================================
step "1/5" "Authenticating with Power Platform"

need_login=false
if [ ! -f "$PACONN_TOKEN_FILE" ]; then
  info "No token file found."
  need_login=true
else
  expires_on=$(python3 -c "import json; print(json.load(open('$PACONN_TOKEN_FILE')).get('expires_on','0'))" 2>/dev/null || echo "0")
  now=$(python3 -c "import time; print(time.time())")
  if python3 -c "exit(0 if float('$expires_on') < float('$now') else 1)" 2>/dev/null; then
    info "Token expired."
    need_login=true
  fi

  if [ -n "$TENANT_ID" ] && [ "$need_login" = false ]; then
    current_tenant=$(python3 -c "import json; print(json.load(open('$PACONN_TOKEN_FILE')).get('tenant_id',''))" 2>/dev/null || echo "")
    if [ "$current_tenant" != "$TENANT_ID" ]; then
      info "Logged into tenant $current_tenant, need $TENANT_ID."
      need_login=true
    fi
  fi
fi

if [ "$need_login" = true ]; then
  warn "Login required — follow the device code prompt below:"
  if [ -n "$TENANT_ID" ]; then
    python3 -m paconn login -t "$TENANT_ID"
  else
    python3 -m paconn login
  fi
  ok "Login complete."
else
  user_id=$(python3 -c "import json; print(json.load(open('$PACONN_TOKEN_FILE')).get('user_id','unknown'))" 2>/dev/null)
  ok "Logged in as $user_id"
fi

# ============================================================
# Step 2: Start servers
# ============================================================
step "2/5" "Starting servers"

info "Building..."
cd "$PROJECT_DIR"
npm run build > /dev/null 2>&1

info "Catalog server on port $CATALOG_PORT..."
PORT=$CATALOG_PORT node build/catalog/index.js > /tmp/catalog-server.log 2>&1 &
CATALOG_PID=$!

info "MCP server on port $MCP_PORT..."
PORT=$MCP_PORT node build/mcp-server/index.js > /tmp/mcp-server.log 2>&1 &
MCP_PID=$!

info "Waiting for servers to respond..."
SERVERS_READY=false
for i in $(seq 1 20); do
  catalog_ok=false
  mcp_ok=false
  curl -sf http://localhost:$CATALOG_PORT/instances > /dev/null 2>&1 && catalog_ok=true
  curl -sf -o /dev/null -w '' http://localhost:$MCP_PORT/instances/contoso/mcp 2>/dev/null && mcp_ok=true
  # Also accept connection refused → not ready yet; 404/405 → server is up
  curl -s -o /dev/null -w "%{http_code}" http://localhost:$MCP_PORT/ 2>/dev/null | grep -qE "^[2-5]" && mcp_ok=true
  if [ "$catalog_ok" = true ] && [ "$mcp_ok" = true ]; then
    SERVERS_READY=true
    break
  fi
  sleep 1
done
if [ "$SERVERS_READY" = true ]; then
  ok "Catalog server ready on :$CATALOG_PORT"
  ok "MCP server ready on :$MCP_PORT"
else
  fail "Servers did not start in time."
  info "Catalog log: /tmp/catalog-server.log"
  info "MCP log: /tmp/mcp-server.log"
  exit 1
fi

# ============================================================
# Step 3: Dev tunnel
# ============================================================
step "3/5" "Creating dev tunnel"

info "Exposing ports $CATALOG_PORT and $MCP_PORT..."
devtunnel host -p "$CATALOG_PORT" -p "$MCP_PORT" --allow-anonymous > /tmp/devtunnel-output.log 2>&1 &
TUNNEL_PID=$!

CATALOG_HOST=""
MCP_HOST=""
for i in $(seq 1 30); do
  if grep -q "Ready to accept" /tmp/devtunnel-output.log 2>/dev/null; then
    CATALOG_HOST=$(grep -oE "[a-z0-9]+-${CATALOG_PORT}\.[a-z]+\.devtunnels\.ms" /tmp/devtunnel-output.log | head -1)
    MCP_HOST=$(grep -oE "[a-z0-9]+-${MCP_PORT}\.[a-z]+\.devtunnels\.ms" /tmp/devtunnel-output.log | head -1)
    break
  fi
  if [ "$i" -eq 30 ]; then
    fail "Tunnel did not start in time."
    info "Log: /tmp/devtunnel-output.log"
    exit 1
  fi
  sleep 1
done

ok "Catalog: https://$CATALOG_HOST"
ok "MCP:     https://$MCP_HOST"

# Restart catalog with public MCP URL
info "Restarting catalog with public MCP URLs..."
kill "$CATALOG_PID" 2>/dev/null
wait "$CATALOG_PID" 2>/dev/null || true
cd "$PROJECT_DIR"
MCP_SERVER_BASE="https://$MCP_HOST" PORT=$CATALOG_PORT node build/catalog/index.js > /tmp/catalog-server.log 2>&1 &
CATALOG_PID=$!
sleep 3

# Verify
INSTANCE_COUNT=$(curl -s "https://$CATALOG_HOST/instances" 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
ok "Catalog verified — $INSTANCE_COUNT instances with public MCP URLs"

# ============================================================
# Step 4: Update swagger
# ============================================================
step "4/5" "Updating connector definition"

python3 -c "
import json
with open('$SWAGGER_FILE', 'r') as f:
    swagger = json.load(f)
swagger['host'] = '$CATALOG_HOST'
with open('$SWAGGER_FILE', 'w') as f:
    json.dump(swagger, f, indent=2)
"
ok "Swagger host → $CATALOG_HOST"

# ============================================================
# Step 5: Deploy connector
# ============================================================
step "5/5" "Deploying connector to environment $ENV_ID"

if [ -f "$SETTINGS_FILE" ]; then
  CONNECTOR_ID=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['connectorId'])")
  info "Found existing connector: $CONNECTOR_ID"
  info "Updating..."
  python3 -m paconn update \
    -e "$ENV_ID" \
    -c "$CONNECTOR_ID" \
    -d "$SWAGGER_FILE" \
    -p "$PROPS_FILE" \
    -x "$SCRIPT_FILE"
  ok "Connector updated."
else
  info "No settings.json found — creating new connector..."

  CREATE_OUTPUT=$(python3 -m paconn create \
    -e "$ENV_ID" \
    -d "$SWAGGER_FILE" \
    -p "$PROPS_FILE" \
    -x "$SCRIPT_FILE" \
    -w 2>&1) || true

  if echo "$CREATE_OUTPUT" | grep -qi "DisplayNameIsInUse\|already exists"; then
    SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c 4)
    NEW_TITLE="Dynamic MCP Connector $SUFFIX"
    warn "Name already taken. Retrying as '$NEW_TITLE'..."
    python3 -c "
import json
with open('$SWAGGER_FILE', 'r') as f:
    swagger = json.load(f)
swagger['info']['title'] = '$NEW_TITLE'
with open('$SWAGGER_FILE', 'w') as f:
    json.dump(swagger, f, indent=2)
"
    python3 -m paconn create \
      -e "$ENV_ID" \
      -d "$SWAGGER_FILE" \
      -p "$PROPS_FILE" \
      -x "$SCRIPT_FILE" \
      -w
    ok "Connector '$NEW_TITLE' created."
  elif echo "$CREATE_OUTPUT" | grep -qi "created successfully"; then
    ok "Connector created."
  else
    echo "$CREATE_OUTPUT"
    fail "Connector creation failed. See output above."
    exit 1
  fi
fi

# ============================================================
# Done
# ============================================================
echo ""
echo -e "${BOLD}${GREEN}=========================================${RESET}"
echo -e "${BOLD}  Deployment complete!${RESET}"
echo -e "${GREEN}=========================================${RESET}"
echo -e "  Catalog:     ${CYAN}https://$CATALOG_HOST${RESET}"
echo -e "  MCP Server:  ${CYAN}https://$MCP_HOST${RESET}"
echo -e "  Environment: ${DIM}$ENV_ID${RESET}"
echo -e "${GREEN}=========================================${RESET}"
echo ""
echo -e "${DIM}Press Ctrl+C to stop servers and tunnel.${RESET}"
wait
