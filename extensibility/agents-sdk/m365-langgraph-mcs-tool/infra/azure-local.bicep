// Local Development Bicep - Two App Security Model
// App 1: Bot App (created by M365 Agents Toolkit) - uses client secret for Bot Service authentication
// App 2: SSO App (created by this Bicep) - uses federated credentials for user authentication
// This deploys: Bot Service Principal → SSO App Registration → Azure Bot Service → OAuth Connections

targetScope = 'resourceGroup'

@description('Name of the bot')
param botName string

@description('The Bot ID (Microsoft App ID) - created by M365 Agents Toolkit')
param botId string

@description('Bot messaging endpoint')
param botEndpoint string

@description('Tenant ID')
param tenantId string

@description('Location for all resources')
param location string = resourceGroup().location

@description('Bot Service SKU')
param botServiceSku string = 'F0'

@description('SSO App ID - use 00000000-0000-0000-0000-000000000000 for first-time deployment')
param ssoAppId string = '00000000-0000-0000-0000-000000000000'

// Variables
var ssoAppName = '${botName}-UserAuth'  // Different name to avoid duplicate
var nullGuid = '00000000-0000-0000-0000-000000000000'
var isFirstTimeDeployment = ssoAppId == nullGuid

// ========================================
// GUID ENCODING: Encode Tenant ID Once (First-time only)
// ========================================
// Run GUID encoder once and reuse the encoded value for all OAuth connections
module guidEncoder 'modules/guid-encoder.bicep' = if (isFirstTimeDeployment) {
  name: 'encode-tenant-guid-local'
  params: {
    guidToEncode: tenantId
    location: location
  }
}

// ========================================
// STEP 1: Create SSO App Registration (First-time only)
// ========================================
// This is a separate app for user authentication using federated credentials
// No client secret - uses federated credentials instead
module ssoAppRegistration 'modules/app-registration.bicep' = if (isFirstTimeDeployment) {
  name: 'deploy-sso-app-registration-local'
  params: {
    aadAppName: ssoAppName
    botId: botId
    tenantId: tenantId
    encodedTenantId: guidEncoder!.outputs.encodedGuid
  }
}

// ========================================
// STEP 2: Create Azure Bot Service (First-time only)
// ========================================
// Uses Bot App (with client secret) for authentication
resource botService 'Microsoft.BotService/botServices@2021-03-01' = if (isFirstTimeDeployment) {
  kind: 'azurebot'
  location: 'global'
  name: botName
  properties: {
    displayName: botName
    endpoint: botEndpoint
    msaAppId: botId
    msaAppTenantId: tenantId
    msaAppType: 'SingleTenant'
  }
  sku: {
    name: botServiceSku
  }
}

// Connect to Microsoft Teams (First-time only)
resource botServiceMsTeamsChannel 'Microsoft.BotService/botServices/channels@2021-03-01' = if (isFirstTimeDeployment) {
  parent: botService
  location: 'global'
  name: 'MsTeamsChannel'
  properties: {
    channelName: 'MsTeamsChannel'
  }
}

// ========================================
// STEP 3: Create OAuth Connection for SSO (First-time only)
// ========================================
// Uses SSO App with federated credentials for user authentication
module botOAuthConnection 'modules/bot-oauth-connection.bicep' = if (isFirstTimeDeployment) {
  name: 'deploy-bot-oauth-connection-sso-local'
  params: {
    botServiceName: botName
    connectionName: 'SsoConnection'
    aadAppId: ssoAppRegistration!.outputs.aadAppId
    aadAppIdUri: ssoAppRegistration!.outputs.aadAppIdUri
    federatedCredentialName: ssoAppRegistration!.outputs.fciName
    scopes: '${ssoAppRegistration!.outputs.aadAppIdUri}/access_as_user'
    tenantId: tenantId
    location: 'global'
  }
  dependsOn: [
    botService
  ]
}

// ========================================
// STEP 4: Create OAuth Connection for Copilot Studio (First-time only)
// ========================================
// Used by the MCS tool to call Copilot Studio on behalf of the user.
// The .default scope is required for Bot Service federated credential token exchange —
// do NOT replace with a more specific scope (e.g. CopilotStudio.Copilots.Invoke)
// as that will break the exchange flow. Actual permissions are controlled by the
// app registration's requiredResourceAccess in app-registration.bicep.
module botOAuthConnectionMCS 'modules/bot-oauth-connection.bicep' = if (isFirstTimeDeployment) {
  name: 'deploy-bot-oauth-connection-mcs-local'
  params: {
    botServiceName: botName
    connectionName: 'mcs'
    aadAppId: ssoAppRegistration!.outputs.aadAppId
    aadAppIdUri: ssoAppRegistration!.outputs.aadAppIdUri
    federatedCredentialName: ssoAppRegistration!.outputs.fciName
    scopes: 'https://api.powerplatform.com/.default'
    tenantId: tenantId
    location: 'global'
  }
  dependsOn: [
    botService
  ]
}

// ========================================
// STEP 5: Create Service Principal for Bot App (First-time only)
// ========================================
// The Bot App is created by M365 Agents Toolkit with a client secret
// We create its service principal after SSO app registration to avoid replication timing issues
module botServicePrincipal 'modules/service-principal.bicep' = if (isFirstTimeDeployment) {
  name: 'deploy-bot-service-principal-local'
  params: {
    appId: botId
  }
  dependsOn: [
    ssoAppRegistration
  ]
}

// ========================================
// STEP 6: Create Service Principal for SSO App (First-time only)
// ========================================
// The SSO App is created by M365 Agents Toolkit with a client secret
// We create its service principal after SSO app registration to avoid replication timing issues
module SSOServicePrincipal 'modules/service-principal.bicep' = if (isFirstTimeDeployment) {
  name: 'deploy-sso-service-principal-local'
  params: {
    appId: ssoAppRegistration.outputs.aadAppId
  }

}

// ========================================
// STEP 7: Update Bot Endpoint (Always - for dev tunnel changes)
// ========================================
// This runs on every deployment to update the bot endpoint with the latest dev tunnel URL
module updateBotEndpoint 'modules/update-bot-endpoint.bicep' = if (!isFirstTimeDeployment) {
  name: 'update-bot-endpoint-local'
  params: {
    botServiceName: botName
    botAppId: botId
    botEndpoint: botEndpoint
    botAppTenantId: tenantId
    botDisplayName: botName
    botServiceSku: botServiceSku
  }
}

// ========================================
// OUTPUTS
// ========================================
output botServiceName string = isFirstTimeDeployment ? botService.name : botName
output botId string = botId
output tenantId string = tenantId
output SSO_APP_ID_URI string = 'api://botid-${botId}'

// SSO App outputs
output sso_App_Id string = isFirstTimeDeployment ? ssoAppRegistration!.outputs.aadAppId : ssoAppId


// OAuth Connection names
output oauthConnectionName string = 'SsoConnection'
output mcsConnectionName string = 'mcs'
