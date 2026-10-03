// Azure Bot Service Module for Local Development
// Registers a bot with Single Tenant + Client Secret authentication
// Used for local development (without managed identity)

@maxLength(20)
@minLength(4)
@description('Used to generate names for all resources in this file')
param resourceBaseName string

@maxLength(42)
param botDisplayName string

param botServiceName string = resourceBaseName
param botServiceSku string = 'F0'

@description('The bot application (client) ID from the bot app registration')
param botAppId string

@description('The tenant ID for the bot application')
param botAppTenantId string

@description('The bot messaging endpoint (e.g., https://abc123-5000.usw2.devtunnels.ms/api/messages)')
param botEndpoint string

// Register your web service as a bot with the Bot Framework (Single Tenant mode)
resource botService 'Microsoft.BotService/botServices@2021-03-01' = {
  kind: 'azurebot'
  location: 'global'
  name: botServiceName
  properties: {
    displayName: botDisplayName
    endpoint: botEndpoint
    msaAppId: botAppId
    msaAppTenantId: botAppTenantId
    msaAppType: 'SingleTenant' // Using Single Tenant authentication
  }
  sku: {
    name: botServiceSku
  }
}

// Connect the bot service to Microsoft Teams
resource botServiceMsTeamsChannel 'Microsoft.BotService/botServices/channels@2021-03-01' = {
  parent: botService
  location: 'global'
  name: 'MsTeamsChannel'
  properties: {
    channelName: 'MsTeamsChannel'
  }
}

// Outputs
output botServiceName string = botService.name
output botServiceId string = botService.id
output botEndpoint string = botEndpoint
