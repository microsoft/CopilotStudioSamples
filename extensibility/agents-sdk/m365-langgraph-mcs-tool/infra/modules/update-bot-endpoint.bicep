// Module to update an existing Azure Bot Service endpoint
// This is used when the bot already exists and only the endpoint needs to be updated

@description('The name of the existing bot service')
param botServiceName string

@description('The new bot messaging endpoint (dev tunnel URL)')
param botEndpoint string

@description('The bot application (client) ID')
param botAppId string

@description('The tenant ID for the bot application')
param botAppTenantId string

@description('The bot display name')
param botDisplayName string

@description('The SKU for the Bot Service')
param botServiceSku string

// Reference the existing bot service and update its properties
resource botService 'Microsoft.BotService/botServices@2021-03-01' = {
  kind: 'azurebot'
  location: 'global'
  name: botServiceName
  properties: {
    displayName: botDisplayName
    endpoint: botEndpoint  // This is the key property we're updating
    msaAppId: botAppId
    msaAppTenantId: botAppTenantId
    msaAppType: 'SingleTenant'
  }
  sku: {
    name: botServiceSku
  }
}

// Outputs
output botServiceName string = botService.name
output botServiceId string = botService.id
output botEndpoint string = botEndpoint
