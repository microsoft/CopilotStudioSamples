// Bot OAuth Connection Module
// Configures Azure AD v2 OAuth connection with Federated Credentials for SSO
// This enables single sign-on (SSO) for the bot in Teams

@description('The name of the Bot Service to configure')
param botServiceName string

@description('The name for the OAuth connection setting')
param connectionName string = 'SsoConnection'

@description('The Azure AD Application (client) ID from the app registration')
param aadAppId string

@description('The Azure AD Application ID URI (e.g., api://botid-{guid})')
param aadAppIdUri string

@description('The federated credential name (unique identifier from the federated credential)')
param federatedCredentialName string

@description('OAuth scopes to request - should be the app ID URI with access_as_user scope')
param scopes string

@description('The tenant ID for the Azure AD application')
param tenantId string

@description('Location for the connection resource')
param location string = 'global'

// Azure AD v2 OAuth Connection for Bot Service with Federated Credentials
// This enables SSO using federated credentials (no client secret needed)
// Uses the access_as_user scope defined in the app registration
resource botOAuthConnection 'Microsoft.BotService/botServices/connections@2022-09-15' = {
  name: '${botServiceName}/${connectionName}'
  location: location
  properties: {
    serviceProviderId: 'c00b44ab-5e16-c44c-af26-2fd5bc55eb18' // AAD v2 with Federated Credentials
    serviceProviderDisplayName: 'AAD v2 with Federated Credentials'
    clientId: aadAppId
    scopes: scopes
    parameters: [
      {
        key: 'ClientId'
        value: aadAppId
      }
      {
        key: 'UniqueIdentifier'
        value: federatedCredentialName
      }
      {
        key: 'TokenExchangeUrl'
        value: aadAppIdUri
      }
      {
        key: 'TenantId'
        value: tenantId
      }
    ]
  }
}

// Outputs
output connectionName string = connectionName
output connectionId string = botOAuthConnection.id
output settingId string = botOAuthConnection.properties.settingId
output provisioningState string = botOAuthConnection.properties.provisioningState
