# GUID Encoder Integration - Deployment Guide

## Overview
Your Bicep infrastructure now includes a self-contained GUID encoder that converts GUIDs to Base64URL format during deployment. This eliminates the need for external API calls and ensures proper binary encoding of GUIDs.

## What Was Updated

### 1. New Module: `guid-encoder.bicep`
- **Location**: `infra/modules/guid-encoder.bicep`
- **Purpose**: Converts GUIDs to Base64URL encoded format using Azure deployment scripts
- **Method**: Direct binary conversion (no external API needed)
- **Implementation**: Bash script with proper little-endian byte ordering

### 2. Updated Module: `app-registration.bicep`
- **New Parameters**:
  - `location`: Resource location for deployment scripts
  - `encodedTenantId`: Optional pre-encoded tenant ID (skips encoding script)
  - `encodedAppId`: Optional pre-encoded app ID (skips encoding script)

- **Removed Parameters**:
  - `guidEncoderApiEndpoint`: No longer needed - encoding is self-contained

- **New Logic**:
  - Runs deployment script to encode Tenant ID if not pre-provided
  - Runs deployment script to encode Application ID if not pre-provided
  - Uses encoded values to construct federated credential subject

## How It Works

1. **Deployment starts** → Creates Entra ID Application
2. **Script 1**: Converts Tenant ID GUID to binary bytes → Base64URL encoding
3. **Script 2**: Converts App ID GUID to binary bytes → Base64URL encoding
4. **Constructs** federated credential subject: `/eid1/c/pub/t/{encodedTenantId}/a/{encodedAppId}/{uniqueId}`
5. **Creates** federated identity credential with proper subject

### Binary Encoding Process
The script performs the same conversion as the C# `Guid.ToByteArray()` method:
- Removes hyphens from GUID string
- Converts to hexadecimal bytes with little-endian ordering
- Encodes bytes as Base64
- Converts to Base64URL format (URL-safe: replaces `+` with `-`, `/` with `_`, removes `=`)

## Deployment Options

### Option 1: Automatic (Uses Deployment Scripts - Recommended)
```powershell
az deployment group create `
  --resource-group "rg-m365agent-dev" `
  --template-file infra/azure.bicep `
  --parameters resourceBaseName="m365agent" `
               botDisplayName="M365 Agent" `
               tenantId="671740f0-0ce9-4b51-bae5-4096de8b66d3"
```

### Option 2: Pre-calculated (Skips Scripts - Faster)
```powershell
# Pre-calculate values using PowerShell
$guid = [Guid]::Parse("671740f0-0ce9-4b51-bae5-4096de8b66d3")
$bytes = $guid.ToByteArray()
$base64 = [Convert]::ToBase64String($bytes)
$encodedTenantId = $base64.Replace('+', '-').Replace('/', '_').TrimEnd('=')

# Deploy with pre-calculated values
az deployment group create `
  --resource-group "rg-m365agent-dev" `
  --template-file infra/azure.bicep `
  --parameters resourceBaseName="m365agent" `
               encodedTenantId=$encodedTenantId
```

## Deployment Script Details

The `guid-encoder.bicep` module uses Azure Deployment Scripts:
- **Type**: Azure CLI (Bash) script
- **Runtime**: Azure CLI 2.52.0
- **Retention**: 1 hour (auto-cleanup)
- **Timeout**: 5 minutes
- **Cost**: Minimal (uses Azure Container Instances briefly)
- **Encoding Method**: Proper binary conversion matching C# `Guid.ToByteArray()`

## Important Notes

### Performance
- **First deployment**: ~3-5 minutes (includes deployment script overhead)
- **Subsequent deployments**: Same duration (deployment scripts recreate each time)
- **Pre-calculated values**: Instant (no deployment script needed)

### Advantages of Self-Contained Approach
✅ **No external dependencies** - Everything runs in Azure  
✅ **Reliable** - No external API to fail or throttle  
✅ **Secure** - GUIDs never leave your Azure environment  
✅ **Proper encoding** - Binary conversion matches C# behavior  
✅ **Cost-effective** - No need to maintain separate API service

### Cost
- Deployment scripts create temporary Azure resources:
  - Storage account (for script logs)
  - Container instance (to run the script)
- Cost is minimal (~$0.01-0.02 per deployment)
- Resources are auto-deleted after 1 hour

### Warnings (Can be ignored)
- `use-stable-resource-identifiers`: Using `utcNow()` is intentional to force script re-execution
- `no-unused-params`: The `fciSubject` parameter is kept for backward compatibility

## Testing

### Validate Bicep files
```powershell
# Validate guid-encoder module
az bicep build --file infra/modules/guid-encoder.bicep

# Validate app-registration module
az bicep build --file infra/modules/app-registration.bicep

# Validate main orchestration
az bicep build --file infra/azure.bicep
```

### What-if deployment
```powershell
az deployment group what-if `
  --resource-group "rg-m365agent-dev" `
  --template-file infra/azure.bicep `
  --parameters resourceBaseName="m365agent"
```

## Troubleshooting

### Deployment script fails
- Check deployment script logs in Azure Portal
- Verify Azure CLI version 2.52.0 is available
- Ensure your subscription allows deployment scripts
- Check that `xxd` command is available (included in Azure CLI container)

### Pre-calculate values to skip scripts
If deployment scripts are unavailable or failing:
```powershell
# PowerShell
$guid = [Guid]::Parse("671740f0-0ce9-4b51-bae5-4096de8b66d3")
$bytes = $guid.ToByteArray()
$base64 = [Convert]::ToBase64String($bytes)
$encodedTenantId = $base64.Replace('+', '-').Replace('/', '_').TrimEnd('=')

# Deploy with pre-calculated value
az deployment group create ... --parameters encodedTenantId=$encodedTenantId
```

## Architecture

```
azure.bicep
  └─> app-registration.bicep
       ├─> guid-encoder.bicep (tenantId)  → Bash Script → Base64URL
       ├─> guid-encoder.bicep (appId)     → Bash Script → Base64URL
       └─> federatedCredential (uses encoded values)
```

## Next Steps

1. ✅ Test API endpoint availability
2. ✅ Validate Bicep files compile
3. ✅ Run what-if deployment
4. ✅ Deploy to test resource group
5. ✅ Verify federated credential is created correctly
6. ✅ Test bot authentication

## Support

If you encounter issues:

1. Check deployment logs in Azure Portal
2. Verify API is accessible and returning correct values
3. Try pre-calculating values to isolate API issues
4. Review deployment script execution logs
