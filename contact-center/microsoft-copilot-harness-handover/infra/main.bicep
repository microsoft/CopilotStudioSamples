// Adapted from microsoft/Agents samples/shared/production-reference/infra/main.bicep (MIT).
@minLength(4)
@maxLength(19)
param appName string
@minLength(1)
@maxLength(30)
param displayName string = 'Copilot Studio handover'
param location string = resourceGroup().location
param studioEnvironmentId string
param studioSchemaName string
param oauthClientId string
param oauthServiceProviderId string
param federatedCredentialId string

var tenantId = tenant().tenantId
var storageName = 'hnd${uniqueString(resourceGroup().id, appName)}'
var webName = '${appName}-app'

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appName}-id'
  location: location
}
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}
resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = { parent: storage, name: 'default' }
resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobs
  name: 'handover'
  properties: { publicAccess: 'None' }
}
resource storageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, 'blob-contributor')
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}
resource plan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: '${appName}-plan'
  location: location
  sku: { name: 'B1', tier: 'Basic' }
  properties: { reserved: true }
}
resource web 'Microsoft.Web/sites@2022-03-01' = {
  name: webName
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'npm start'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      healthCheckPath: '/health'
      appSettings: [
        { name: 'MODE', value: 'studio' }
        { name: 'HOSTING_TARGET', value: 'azure' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'NPM_CONFIG_INCLUDE', value: 'dev' }
        { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
        { name: 'BLOB_STATE_URL', value: '${storage.properties.primaryEndpoints.blob}handover/state.json' }
        { name: 'STUDIO_ENVIRONMENT_ID', value: studioEnvironmentId }
        { name: 'STUDIO_SCHEMA_NAME', value: studioSchemaName }
        { name: 'connections__serviceConnection__settings__authType', value: 'UserManagedIdentity' }
        { name: 'connections__serviceConnection__settings__clientId', value: identity.properties.clientId }
        { name: 'connections__serviceConnection__settings__tenantId', value: tenantId }
        { name: 'connectionsMap__0__connection', value: 'serviceConnection' }
        { name: 'connectionsMap__0__serviceUrl', value: '*' }
        { name: 'connectionsMap__0__audience', value: identity.properties.clientId }
        { name: 'AgentApplication__UserAuthorization__Handlers__mcs__Settings__azureBotOAuthConnectionName', value: 'mcs' }
        { name: 'AgentApplication__UserAuthorization__Handlers__mcs__Settings__enableSso', value: 'true' }
        { name: 'DEBUG', value: 'agents:cloud-adapter:error' }
        { name: 'OutboundHostValidator__Enabled', value: 'true' }
        { name: 'OutboundHostValidator__IncludeDefaultMicrosoftHosts', value: 'true' }
        { name: 'CloudAdapterOptions__validateServiceUrl', value: 'true' }
      ]
    }
  }
}
resource demoConsoleAccess 'Microsoft.Web/sites/config@2022-03-01' = {
  parent: web
  name: 'authsettingsV2'
  properties: {
    // Explicitly disable the earlier sample's console sign-in on redeployment too.
    platform: { enabled: false }
  }
}
resource bot 'Microsoft.BotService/botServices@2022-09-15' = {
  name: '${appName}-bot'
  location: 'global'
  kind: 'azurebot'
  sku: { name: 'F0' }
  properties: {
    displayName: displayName
    endpoint: 'https://${web.properties.defaultHostName}/api/messages'
    msaAppId: identity.properties.clientId
    msaAppMSIResourceId: identity.id
    msaAppTenantId: tenantId
    msaAppType: 'UserAssignedMSI'
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
    serviceProviderId: oauthServiceProviderId
    scopes: 'https://api.powerplatform.com/.default'
    parameters: [
      { key: 'TenantId', value: tenantId }
      { key: 'ClientId', value: oauthClientId }
      { key: 'UniqueIdentifier', value: federatedCredentialId }
      { key: 'TokenExchangeUrl', value: 'api://botid-${identity.properties.clientId}' }
    ]
  }
}
output appUrl string = 'https://${web.properties.defaultHostName}'
output webAppName string = web.name
output botName string = bot.name
output botClientId string = identity.properties.clientId
output oauthClientId string = oauthClientId
