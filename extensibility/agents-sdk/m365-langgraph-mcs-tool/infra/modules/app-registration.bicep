// Application Registration Module
// Required Role: Application Administrator or Cloud Application Administrator
// Deploys: Entra ID app registration, service principal, OAuth settings

extension microsoftGraphV1

@description('Application name for the Entra ID app registration')
param aadAppName string

@description('BotID this should match the Microsoft App ID in the Azure Bot Service Configuration')
param botId string

@description('Tenant ID where the application will be registered')
param tenantId string

@description('Pre-encoded tenant ID in Base64URL format (from guid-encoder module)')
param encodedTenantId string

// Microsoft Entra ID Application Registration
// Note: identifierUris cannot be set on initial creation with appId reference
// Note: Retdirect URIs might vary based on your bot configuration
// Note: List of redirect URL : https://learn.microsoft.com/en-us/microsoft-365/agents-sdk/azure-bot-user-authorization-federated-credentials#create-the-microsoft-entra-id-identity-provider
resource aadApplication 'Microsoft.Graph/applications@v1.0' = {
  displayName: aadAppName
  uniqueName: aadAppName
  signInAudience: 'AzureADMyOrg'
  identifierUris: [
    'api://botid-${botId}'
  ]
  web: {
    redirectUris: [
      'https://token.botframework.com/.auth/web/redirect'
    ]
    implicitGrantSettings: {
      enableIdTokenIssuance: false
      enableAccessTokenIssuance: false
    }
  }
  
  api: {
    requestedAccessTokenVersion: 2
    oauth2PermissionScopes: [
      {
        id: guid(aadAppName, 'access_as_user')
        adminConsentDescription: 'Default scope for Agent SSO access'
        adminConsentDisplayName: 'Agent SSO'
        userConsentDescription: 'Default scope for Agent SSO access'
        userConsentDisplayName: 'Agent SSO'
        value: 'access_as_user'
        type: 'User'
        isEnabled: true
      }
    ]
    preAuthorizedApplications: [
          {
            // Teams web client
            appId: '1fec8e78-bce4-4aaf-ab1b-5451cc387264'
            delegatedPermissionIds: [
              guid(aadAppName, 'access_as_user')
            ]
          }
          {
            // Teams desktop client
            appId: '5e3ce6c0-2b1f-4285-8d4b-75ee78787346'
            delegatedPermissionIds: [
              guid(aadAppName, 'access_as_user')
            ]
          }
          {
            // Microsoft 365 web application
            appId: '4765445b-32c6-49b0-83e6-1d93765276ca'
            delegatedPermissionIds: [
              guid(aadAppName, 'access_as_user')
            ]
          }
          {
            // Microsoft 365 desktop application
            appId: '0ec893e0-5785-4de6-99da-4ed124e5296c'
            delegatedPermissionIds: [
              guid(aadAppName, 'access_as_user')
            ]
          }
          {
            // Microsoft 365 mobile application Outlook desktop application
            appId: 'd3590ed6-52b3-4102-aeff-aad2292ab01c'
            delegatedPermissionIds: [
              guid(aadAppName, 'access_as_user')
            ]
          }
          {
            // Outlook web application
            appId: 'bc59ab01-8403-45c6-8796-ac3ef710b3e3'
            delegatedPermissionIds: [
              guid(aadAppName, 'access_as_user')
            ]
          }
          {
            // Outlook mobile application
            appId: '27922004-5251-4030-b22d-91ecd9a37ea4'
            delegatedPermissionIds: [
              guid(aadAppName, 'access_as_user')
            ]
          }

        ]
  }
  
  requiredResourceAccess: [
    {
      // OpenID permissions & offline_access
      resourceAppId: '00000003-0000-0000-c000-000000000000'
      resourceAccess: [
        {
          // openid
          id: '37f7f235-527c-4136-accd-4a02d197296e'
          type: 'Scope'
        }
        {
          // profile
          id: '14dad69e-099b-42c9-810b-d002981feec1'
          type: 'Scope'
        }
        {
          // email
          id: '64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0'
          type: 'Scope'
        }
        {
          // offline_access
          id: '7427e0e9-2fba-42fe-b0c0-848c9e6a8182'
          type: 'Scope'
        }
      ]
    }
        {
      // Power Platform API
      // Required for Copilot Studio (MCS) OBO token exchange
      resourceAppId: '8578e004-a5c6-46e7-913e-12f58912df43'
      resourceAccess: [
        {
          // user_impersonation
          id: 'cbd05a27-8576-45c3-add0-7b39ee43d6fc'
          type: 'Scope'
        }
        {
          // CopilotStudio.Copilots.Invoke
          id: '204440d3-c1d0-4826-b570-99eb6f5e2aeb'
          type: 'Scope'
        }
      ]
    }
  ]
}

// Construct federated credential subject using pre-encoded tenant ID
// appId encode value is the Bot Service one. it is hardcoded on purpose.
var myfciSubject ='/eid1/c/pub/t/${encodedTenantId}/a/9ExAW52n_ky4ZiS_jhpJIQ/${guid(aadAppName, 'BotServiceOauthConnection')}'

// Federated Identity Credential for Bot Framework token exchange
// This must be a separate resource as it's a child resource type
resource federatedCredential 'Microsoft.Graph/applications/federatedIdentityCredentials@v1.0' = {
  name: '${aadApplication.uniqueName}/${guid(aadAppName, 'BotServiceOauthConnection')}'
  audiences: [
    'api://AzureADTokenExchange'
  ]
  issuer: '${environment().authentication.loginEndpoint}${tenantId}/v2.0'
  subject: myfciSubject
  description: 'Federated credential for Bot Framework token exchange'
}

// Service Principal for the application
resource aadServicePrincipal 'Microsoft.Graph/servicePrincipals@v1.0' = {
  appId: aadApplication.appId
  accountEnabled: true
  displayName: aadAppName
  servicePrincipalType: 'Application'
  tags: [
    'WindowsAzureActiveDirectoryIntegratedApp'
  ]
}

// Outputs for other modules
output aadAppId string = aadApplication.appId
output aadAppObjectId string = aadApplication.id
output aadAppIdUri string = 'api://botid-${botId}'
output servicePrincipalId string = aadServicePrincipal.id
output servicePrincipalObjectId string = aadServicePrincipal.id
output fciName string = federatedCredential.name
output fciSubject string = myfciSubject
