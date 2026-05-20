#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup.sh — Starts the HITL backend and creates a public tunnel.
#
#   1. Installs npm dependencies
#   2. Creates a dev tunnel (public HTTPS URL → localhost:3978)
#   3. Starts the server and tunnel
#
# After running this script, import solution/customHIL_1_0_0_3.zip into
# your Power Platform environment and set the HitlHostUrl environment
# variable to the tunnel URL printed below.
#
# Prerequisites:
#   - Node.js 18+
#   - devtunnel CLI (brew install devtunnel)
#
# Usage:
#   ./setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3978
TUNNEL_NAME="hitl-sample"

# ── Colors ──
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${BLUE}▸ $1${NC}"; }
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }

# ── 1. Install dependencies ──
step "Installing npm dependencies"
cd "$SCRIPT_DIR"
npm install --silent
ok "Done"

# ── 2. Create dev tunnel ──
step "Setting up dev tunnel"

if ! command -v devtunnel &>/dev/null; then
  warn "devtunnel CLI not found. Install with: brew install devtunnel"
  exit 1
fi

if ! devtunnel user show &>/dev/null; then
  echo "  You need to log in to devtunnel first."
  devtunnel user login
fi

devtunnel delete "$TUNNEL_NAME" 2>/dev/null || true
sleep 2
devtunnel create "$TUNNEL_NAME" --allow-anonymous
devtunnel port create "$TUNNEL_NAME" --port-number "$PORT" --protocol http
ok "Tunnel created"

# Get tunnel URL
TUNNEL_URL=""
TUNNEL_URL=$(devtunnel show "$TUNNEL_NAME" --json 2>/dev/null \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
tid = data.get('tunnel', data).get('tunnelId', '')
parts = tid.rsplit('.', 1)
if len(parts) == 2:
    print(f'https://{parts[0]}-${PORT}.{parts[1]}.devtunnels.ms')
elif tid:
    print(f'https://{tid}-${PORT}.devtunnels.ms')
" 2>/dev/null) || true

if [[ -z "$TUNNEL_URL" ]]; then
  TUNNEL_ID=$(devtunnel show "$TUNNEL_NAME" 2>/dev/null | grep 'Tunnel ID' | awk '{print $NF}')
  if [[ -n "$TUNNEL_ID" ]]; then
    NAME=$(echo "$TUNNEL_ID" | cut -d. -f1)
    CLUSTER=$(echo "$TUNNEL_ID" | cut -d. -f2)
    TUNNEL_URL="https://${NAME}-${PORT}.${CLUSTER}.devtunnels.ms"
  fi
fi

if [[ -z "$TUNNEL_URL" ]]; then
  warn "Could not extract tunnel URL. Run: devtunnel show $TUNNEL_NAME"
  exit 1
fi

TUNNEL_HOST=$(echo "$TUNNEL_URL" | sed 's|https://||')

# ── 3. Start server ──
step "Starting server"

pkill -f "node $SCRIPT_DIR/server.js" 2>/dev/null || true
sleep 1

node "$SCRIPT_DIR/server.js" &
SERVER_PID=$!
sleep 2

if ! kill -0 $SERVER_PID 2>/dev/null; then
  warn "Server failed to start"
  exit 1
fi
ok "Server running (PID $SERVER_PID)"

# ── 4. Print instructions and start tunnel ──
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  HITL backend ready!${NC}"
echo ""
echo "  Tunnel URL:   $TUNNEL_URL"
echo "  Tunnel host:  $TUNNEL_HOST"
echo ""
echo "  Next steps:"
echo "    1. Import solution/customHIL_1_0_0_3.zip into your environment"
echo "    2. When prompted, set HitlHostUrl to:"
echo ""
echo -e "       ${BLUE}${TUNNEL_HOST}${NC}"
echo ""
echo "    3. Create a flow or agent action using the connector"
echo ""
echo "  Starting tunnel (Ctrl+C to stop everything)..."
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""

trap "echo ''; echo 'Stopping server...'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM

devtunnel host "$TUNNEL_NAME"

kill $SERVER_PID 2>/dev/null
