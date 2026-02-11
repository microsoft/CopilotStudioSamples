#!/bin/bash
# Grant Apex class and External Credential access to the Einstein Bot (Chatbot) permission set
# This allows Einstein Bot dialogs to call the DirectLine Apex classes and use the Named Credential

set -e

echo "Querying Chatbot permission set..."

# Get the Chatbot permission set ID
PERMSET_QUERY=$(sf data query --query "SELECT Id FROM PermissionSet WHERE Name = 'sfdc_chatbot_service_permset' LIMIT 1" --json 2>/dev/null)
PERMSET_ID=$(echo "$PERMSET_QUERY" | grep -o '"Id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"//')

if [ -z "$PERMSET_ID" ]; then
    echo "WARNING: Chatbot permission set (sfdc_chatbot_service_permset) not found."
    echo "This permission set is created when Einstein Bots is enabled."
    echo "You may need to manually grant Apex class access after enabling Einstein Bots."
    exit 0
fi

echo "Found Chatbot permission set: $PERMSET_ID"

# Get Apex class IDs
APEX_CLASSES=("DL_GetConversation" "DL_PostActivity" "DL_GetActivity")

for CLASS_NAME in "${APEX_CLASSES[@]}"; do
    echo ""
    echo "Processing $CLASS_NAME..."

    # Query the Apex class ID
    CLASS_QUERY=$(sf data query --query "SELECT Id FROM ApexClass WHERE Name = '$CLASS_NAME' LIMIT 1" --json 2>/dev/null)
    CLASS_ID=$(echo "$CLASS_QUERY" | grep -o '"Id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"//')

    if [ -z "$CLASS_ID" ]; then
        echo "  WARNING: Apex class $CLASS_NAME not found. Was it deployed?"
        continue
    fi

    echo "  Found Apex class: $CLASS_ID"

    # Check if access already exists
    EXISTING_QUERY=$(sf data query --query "SELECT Id FROM SetupEntityAccess WHERE ParentId = '$PERMSET_ID' AND SetupEntityId = '$CLASS_ID'" --json 2>/dev/null)
    EXISTING_ID=$(echo "$EXISTING_QUERY" | grep -o '"Id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"//')

    if [ -n "$EXISTING_ID" ]; then
        echo "  Access already granted."
        continue
    fi

    # Create SetupEntityAccess record
    echo "  Granting access..."
    sf data create record --sobject SetupEntityAccess --values "ParentId='$PERMSET_ID' SetupEntityId='$CLASS_ID' SetupEntityType='ApexClass'" > /dev/null 2>&1 && \
        echo "  Access granted successfully." || \
        echo "  WARNING: Failed to grant access. You may need to do this manually in Setup."
done

# Grant External Credential Principal Access
echo ""
echo "Granting External Credential Principal access..."

# Get the External Credential ID via Tooling API
EXT_CRED_QUERY=$(sf data query --query "SELECT Id FROM ExternalCredential WHERE DeveloperName = 'Directline' LIMIT 1" --use-tooling-api --json 2>/dev/null)
EXT_CRED_ID=$(echo "$EXT_CRED_QUERY" | grep -o '"Id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"//')

if [ -z "$EXT_CRED_ID" ]; then
    echo "  WARNING: External Credential 'Directline' not found. Was it deployed?"
else
    echo "  Found External Credential: $EXT_CRED_ID"

    # Get the Principal ID via Tooling API
    PRINCIPAL_QUERY=$(sf data query --query "SELECT Id, ParameterName FROM ExternalCredentialParameter WHERE ExternalCredentialId = '$EXT_CRED_ID' AND ParameterType = 'NamedPrincipal' LIMIT 1" --use-tooling-api --json 2>/dev/null)
    PRINCIPAL_ID=$(echo "$PRINCIPAL_QUERY" | grep -o '"Id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"//')

    if [ -z "$PRINCIPAL_ID" ]; then
        echo "  WARNING: Principal not found in External Credential."
    else
        echo "  Found Principal: $PRINCIPAL_ID"

        # Check if access already exists
        EXISTING_QUERY=$(sf data query --query "SELECT Id FROM SetupEntityAccess WHERE ParentId = '$PERMSET_ID' AND SetupEntityId = '$PRINCIPAL_ID'" --json 2>/dev/null)
        EXISTING_ID=$(echo "$EXISTING_QUERY" | grep -o '"Id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"//')

        if [ -n "$EXISTING_ID" ]; then
            echo "  Principal access already granted."
        else
            echo "  Granting Principal access..."
            sf data create record --sobject SetupEntityAccess --values "ParentId='$PERMSET_ID' SetupEntityId='$PRINCIPAL_ID' SetupEntityType='ExternalCredentialParameter'" > /dev/null 2>&1 && \
                echo "  Principal access granted successfully." || \
                echo "  WARNING: Failed to grant Principal access. You may need to do this manually in Setup."
        fi
    fi
fi

echo ""
echo "Permission grant process complete."
