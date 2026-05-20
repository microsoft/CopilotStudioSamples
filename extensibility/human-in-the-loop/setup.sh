#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup.sh — Sets up the HITL sample end-to-end:
#   1. Installs npm dependencies
#   2. Creates a dev tunnel (public HTTPS URL → localhost:3978)
#   3. Deploys the custom connector via paconn
#
# Prerequisites:
#   - Node.js 18+
#   - devtunnel CLI (brew install devtunnel)
#   - paconn (pip install paconn) — Power Platform Connectors CLI
#
# Usage:
#   ./setup.sh                              # interactive
#   ./setup.sh --env <environment-id>       # skip environment prompt
#   ./setup.sh --tunnel-only                # just create tunnel, skip connector deploy
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3978
TUNNEL_NAME="hitl-sample"
ENV_ID=""
TUNNEL_ONLY=false

# paconn may be in a venv — check common locations
PACONN="paconn"
if ! command -v paconn &>/dev/null; then
  for candidate in \
    /tmp/paconn-venv/bin/paconn \
    "$HOME/.local/bin/paconn" \
    "$HOME/paconn-venv/bin/paconn"; do
    if [[ -x "$candidate" ]]; then
      PACONN="$candidate"
      break
    fi
  done
fi

# ── Parse args ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)         ENV_ID="$2"; shift 2 ;;
    --tunnel-only) TUNNEL_ONLY=true; shift ;;
    *)             echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${BLUE}▸ $1${NC}"; }
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }

# ── 1. Install dependencies ────────────────────────────────────────────────
step "Installing npm dependencies"
cd "$SCRIPT_DIR"
npm install --silent
ok "Dependencies installed"

# ── 2. Create dev tunnel ───────────────────────────────────────────────────
step "Setting up dev tunnel"

# Check devtunnel is available
if ! command -v devtunnel &>/dev/null; then
  warn "devtunnel CLI not found. Install with: brew install devtunnel"
  exit 1
fi

# Check if devtunnel is logged in
if ! devtunnel user show &>/dev/null; then
  echo "  You need to log in to devtunnel first."
  devtunnel user login
fi

# Delete existing tunnel if present (ignore errors)
devtunnel delete "$TUNNEL_NAME" &>/dev/null || true

# Create tunnel with anonymous access (so Power Platform can call it)
devtunnel create "$TUNNEL_NAME" --allow-anonymous
devtunnel port create "$TUNNEL_NAME" --port-number "$PORT" --protocol https
ok "Tunnel '$TUNNEL_NAME' created"

# Get the tunnel URL
TUNNEL_URL=""

# Try JSON output first
TUNNEL_URL=$(devtunnel show "$TUNNEL_NAME" --output json 2>/dev/null \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
ports = data.get('ports', [])
for p in ports:
    uri = p.get('portForwardingUris', [])
    if uri:
        print(uri[0].rstrip('/'))
        sys.exit(0)
tunnel = data.get('tunnel', data)
tid = tunnel.get('tunnelId', '')
cluster = tunnel.get('clusterId', '')
if tid and cluster:
    print(f'https://{tid}-{PORT}.{cluster}.devtunnels.ms')
" 2>/dev/null) || true

# Fallback: parse text output
if [[ -z "$TUNNEL_URL" ]]; then
  TUNNEL_URL=$(devtunnel show "$TUNNEL_NAME" 2>/dev/null \
    | grep -oE 'https://[^ ]+devtunnels\.ms[^ ]*' | head -1 | sed 's:/*$::') || true
fi

if [[ -z "$TUNNEL_URL" ]]; then
  warn "Could not extract tunnel URL automatically."
  echo "  Run: devtunnel show $TUNNEL_NAME"
  echo "  Then set TUNNEL_URL= and re-run."
  exit 1
fi

ok "Tunnel URL: $TUNNEL_URL"

# Extract host for swagger spec
TUNNEL_HOST=$(echo "$TUNNEL_URL" | sed 's|https://||')

# ── 3. Update connector spec with tunnel URL ──────────────────────────────
step "Updating connector spec with tunnel URL"
SWAGGER_FILE="$SCRIPT_DIR/connector/apiDefinition.swagger.json"

python3 -c "
import json
with open('$SWAGGER_FILE', 'r') as f:
    spec = json.load(f)
spec['host'] = '$TUNNEL_HOST'
with open('$SWAGGER_FILE', 'w') as f:
    json.dump(spec, f, indent=2)
"
ok "Host set to: $TUNNEL_HOST"

if $TUNNEL_ONLY; then
  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Tunnel ready!${NC}"
  echo ""
  echo "  Terminal 1:  npm start"
  echo "  Terminal 2:  devtunnel host $TUNNEL_NAME"
  echo ""
  echo "  Tunnel URL:  $TUNNEL_URL"
  echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
  exit 0
fi

# ── 4. Deploy custom connector via paconn ─────────────────────────────────
step "Deploying custom connector via paconn"

# Check paconn is available
if ! command -v "$PACONN" &>/dev/null && [[ ! -x "$PACONN" ]]; then
  warn "paconn not found."
  echo "  Install with: pip install paconn (or pipx install paconn)"
  echo ""
  echo "  You can also create the connector manually:"
  echo "  1. Go to make.powerapps.com → Custom Connectors"
  echo "  2. Import connector/apiDefinition.swagger.json"
  echo "  3. Set the host to: $TUNNEL_HOST"
  exit 1
fi

# Build paconn args
PACONN_ARGS=(
  create
  --api-def "$SWAGGER_FILE"
  --api-prop "$SCRIPT_DIR/connector/apiProperties.json"
)

if [[ -n "$ENV_ID" ]]; then
  PACONN_ARGS+=(--env "$ENV_ID")
fi

echo "  Running: $PACONN ${PACONN_ARGS[*]}"
echo ""

# paconn create is interactive (prompts for environment if not provided)
$PACONN "${PACONN_ARGS[@]}"

ok "Connector deployed"

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo ""
echo "  To start:"
echo "    Terminal 1:  npm start"
echo "    Terminal 2:  devtunnel host $TUNNEL_NAME"
echo ""
echo "  Tunnel URL:    $TUNNEL_URL"
echo "  Console UI:    $TUNNEL_URL"
echo ""
echo "  Next steps:"
echo "    • In Copilot Studio: add the connector as an action"
echo "    • In Power Automate: add 'Request Human Input' step"
echo "    • Open the console UI to see and respond to requests"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
