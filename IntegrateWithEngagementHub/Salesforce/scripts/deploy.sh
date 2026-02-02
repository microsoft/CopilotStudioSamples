#!/bin/bash
# Deploy Copilot Studio DirectLine Apex classes to Salesforce
# This script deploys Apex classes and Remote Site Setting, then grants permissions to the Chatbot permission set

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Copilot Studio - Salesforce Integration Deployment ==="
echo ""

# Check if Salesforce CLI is installed
if ! command -v sf &> /dev/null; then
    echo "ERROR: Salesforce CLI (sf) is not installed."
    echo "Install it from: https://developer.salesforce.com/tools/salesforcecli"
    exit 1
fi

# Check if logged into a Salesforce org
ORG_INFO=$(sf org display --json 2>/dev/null || echo '{"result":{}}')
ORG_USERNAME=$(echo "$ORG_INFO" | grep -o '"username"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"//')

if [ -z "$ORG_USERNAME" ]; then
    echo "ERROR: Not logged into a Salesforce org."
    echo "Run: sf org login web"
    exit 1
fi

echo "Deploying to org: $ORG_USERNAME"
echo ""

# Create temporary SFDX project structure for deployment
TEMP_DIR=$(mktemp -d)
FORCE_APP="$TEMP_DIR/force-app/main/default"
mkdir -p "$FORCE_APP/classes"
mkdir -p "$FORCE_APP/remoteSiteSettings"
mkdir -p "$FORCE_APP/externalCredentials"
mkdir -p "$FORCE_APP/namedCredentials"

# Copy Apex classes and metadata
echo "Preparing Apex classes..."
cp "$PROJECT_DIR/ApexClasses/"*.cls "$FORCE_APP/classes/"
cp "$PROJECT_DIR/Metadata/classes/"*.cls-meta.xml "$FORCE_APP/classes/"

# Copy Remote Site Setting
echo "Preparing Remote Site Setting..."
cp "$PROJECT_DIR/Metadata/remoteSiteSettings/"*.xml "$FORCE_APP/remoteSiteSettings/"

# Copy External Credential and Named Credential
echo "Preparing External Credential and Named Credential..."
cp "$PROJECT_DIR/Metadata/externalCredentials/"*.xml "$FORCE_APP/externalCredentials/"
cp "$PROJECT_DIR/Metadata/namedCredentials/"*.xml "$FORCE_APP/namedCredentials/"

# Create sfdx-project.json
cat > "$TEMP_DIR/sfdx-project.json" << 'EOF'
{
  "packageDirectories": [{ "path": "force-app/main/default", "default": true }],
  "name": "copilot-studio-directline",
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "62.0"
}
EOF

# Deploy to Salesforce
echo ""
echo "Deploying to Salesforce..."
cd "$TEMP_DIR"
sf project deploy start --source-dir force-app --wait 10

# Cleanup temp directory
rm -rf "$TEMP_DIR"

echo ""
echo "=== Deployment Complete ==="
echo ""

# Grant permissions to Chatbot permission set
echo "Granting Apex class permissions to Chatbot permission set..."
"$SCRIPT_DIR/grant-bot-permissions.sh"

echo ""
echo "=== Next Steps ==="
echo ""
echo "The following have been deployed:"
echo "  - Apex classes (DL_GetConversation, DL_PostActivity, DL_GetActivity)"
echo "  - Remote Site Setting (directline.botframework.com)"
echo "  - External Credential (Directline)"
echo "  - Named Credential (Directline)"
echo ""
echo "You must now add your DirectLine secret:"
echo "  1. Go to Setup > Named Credentials > External Credentials tab"
echo "  2. Click 'Directline'"
echo "  3. Under 'Principals', click 'Directline_Principal'"
echo "  4. Click 'Add' under Authentication Parameters"
echo "  5. Set Name: 'Token', Value: YOUR_DIRECTLINE_SECRET"
echo "  6. Save"
echo ""
echo "Then grant the bot access to the credential:"
echo "  1. Go to Setup > Permission Sets > 'Chatbot'"
echo "  2. Click 'External Credential Principal Access' > Edit"
echo "  3. Add 'Directline - Directline_Principal'"
echo "  4. Save"
echo ""
echo "For full instructions, see the Microsoft Learn documentation:"
echo "https://learn.microsoft.com/en-us/microsoft-copilot-studio/customer-copilot-salesforce"
echo ""
