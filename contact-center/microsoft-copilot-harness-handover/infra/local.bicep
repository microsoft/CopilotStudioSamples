@description('Local relay still needs an Azure Bot registration for Teams/M365.')
param appName string
@minLength(1)
@maxLength(30)
param displayName string = 'Local Copilot Studio handover'
param endpoint string
param botClientId string
param oauthClientId string
param federatedCredentialId string
param serviceProviderId string

resource bot 'Microsoft.BotService/botServices@2022-09-15' = {
  name: '${appName}-local-bot'
  location: 'global'
  kind: 'azurebot'
  sku: { name: 'F0' }
  properties: {
    displayName: displayName
    endpoint: endpoint
    msaAppId: botClientId
    msaAppTenantId: tenant().tenantId
    msaAppType: 'SingleTenant'
    publicNetworkAccess: 'Enabled'
  }
}
resource teams 'Microsoft.BotService/botServices/channels@2022-09-15' = {
  parent: bot
  name: 'MsTeamsChannel'
  location: 'global'
  properties: { channelName: 'MsTeamsChannel', properties: { isEnabled: true } }
}
resource oauth 'Microsoft.BotService/botServices/connections@2022-09-15' = {
  parent: bot
  name: 'mcs'
  location: 'global'
  properties: {
    clientId: oauthClientId
    serviceProviderId: serviceProviderId
    scopes: 'https://api.powerplatform.com/.default'
    parameters: [
      { key: 'TenantId', value: tenant().tenantId }
      { key: 'ClientId', value: oauthClientId }
      { key: 'UniqueIdentifier', value: federatedCredentialId }
      { key: 'TokenExchangeUrl', value: 'api://botid-${botClientId}' }
    ]
  }
}
