// GUID Encoder Module
// Converts GUID to Base64URL encoded format using deployment script

@description('The GUID to encode')
param guidToEncode string

@description('Location for the deployment script')
param location string = resourceGroup().location

@description('Timestamp to force script re-execution')
param utcValue string = utcNow()

resource guidEncoderScript 'Microsoft.Resources/deploymentScripts@2023-08-01' = {
  name: 'guid-encoder-${uniqueString(guidToEncode, utcValue)}'
  location: location
  kind: 'AzureCLI'
  properties: {
    azCliVersion: '2.52.0'
    retentionInterval: 'PT1H'
    timeout: 'PT5M'
    cleanupPreference: 'OnSuccess'
    forceUpdateTag: utcValue
    scriptContent: '''
      #!/bin/bash
      set -e
      
      GUID_VALUE="$1"
      
      echo "Converting GUID: $GUID_VALUE"
      
      # Remove hyphens from GUID
      GUID_NO_HYPHENS=$(echo "$GUID_VALUE" | tr -d '-')
      
      # Extract parts of the GUID
      # GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      # Byte order needs to be adjusted for little-endian encoding
      PART1="${GUID_NO_HYPHENS:0:8}"   # First 8 chars (4 bytes)
      PART2="${GUID_NO_HYPHENS:8:4}"   # Next 4 chars (2 bytes)
      PART3="${GUID_NO_HYPHENS:12:4}"  # Next 4 chars (2 bytes)
      PART4="${GUID_NO_HYPHENS:16:16}" # Last 16 chars (8 bytes)
      
      # Reverse byte order for first three parts (little-endian)
      BYTES=""
      BYTES+="${PART1:6:2}${PART1:4:2}${PART1:2:2}${PART1:0:2}"
      BYTES+="${PART2:2:2}${PART2:0:2}"
      BYTES+="${PART3:2:2}${PART3:0:2}"
      BYTES+="$PART4"
      
      echo "Hex bytes: $BYTES"
      
      # Convert hex to binary and then to base64
      BASE64=$(echo "$BYTES" | xxd -r -p | base64)
      
      # Convert to Base64URL (remove padding, replace + with -, / with _)
      BASE64URL=$(echo "$BASE64" | tr '+' '-' | tr '/' '_' | tr -d '=\n')
      
      echo "Base64URL encoded: $BASE64URL"
      
      # Output result as JSON
      echo "{\"encodedGuid\":\"$BASE64URL\"}" > $AZ_SCRIPTS_OUTPUT_PATH
    '''
    arguments: guidToEncode
  }
}

output encodedGuid string = guidEncoderScript.properties.outputs.encodedGuid
