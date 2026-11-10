// Bot App Registration Module for Local Development
// Creates an Entra ID app registration for bot authentication
// Used for local development with Single Tenant authentication
// Note: Client secret must be created manually in Azure Portal after deployment

extension microsoftGraphV1

@description('Application name for the bot Entra ID app registration')
param appName string

@description('Tenant ID where the application will be registered')
param tenantId string

// Bot Application Registration (Single Tenant)
resource botApplication 'Microsoft.Graph/applications@v1.0' = {
  displayName: appName
  uniqueName: appName
  signInAudience: 'AzureADMyOrg' // Single tenant
  
  // Bot-specific configuration
  web: {
    redirectUris: []
    implicitGrantSettings: {
      enableIdTokenIssuance: false
      enableAccessTokenIssuance: false
    }
  }
  
  // Required for bot authentication
  requiredResourceAccess: []
}

// Service Principal for the bot application
resource botServicePrincipal 'Microsoft.Graph/servicePrincipals@v1.0' = {
  appId: botApplication.appId
  accountEnabled: true
  displayName: appName
  servicePrincipalType: 'Application'
  tags: [
    'WindowsAzureActiveDirectoryIntegratedApp'
  ]
}

// Outputs
output appId string = botApplication.appId
output objectId string = botApplication.id
output servicePrincipalId string = botServicePrincipal.id
output tenantId string = tenantId

// Note: Client secret must be created manually after deployment
// Navigate to Azure Portal → App Registrations → {appName} → Certificates & secrets → New client secret
