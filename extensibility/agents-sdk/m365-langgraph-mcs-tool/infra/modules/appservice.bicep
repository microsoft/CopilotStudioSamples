// Azure App Service Module for Node.js 22 LTS Application
// This module deploys an App Service Plan and App Service with managed identity

@maxLength(20)
@minLength(4)
@description('Used to generate names for all resources in this file')
param resourceBaseName string

@description('The resource ID of the User Assigned Managed Identity')
param MSIid string 

@description('Location for all resources')
param location string = resourceGroup().location

@description('The name of the App Service Plan')
param serverfarmsName string = resourceBaseName

@description('The name of the Web App')
param webAppName string = resourceBaseName

@description('The SKU for the App Service Plan')
param webAppSKU string

@description('Additional app settings for the Web App')
param additionalAppSettings array = []

@description('Enable Application Insights')
param enableAppInsights bool = true

@description('Application Insights connection string (for managed identity authentication)')
param appInsightsConnectionString string = ''

// Bot Configuration (for appsettings.json template variables)
@description('Bot ID (Managed Identity Client ID)')
param botId string

@description('Bot Tenant ID')
param botTenantId string

@description('OAuth Connection Name')
param oauthConnectionName string

@description('MCS (Copilot Studio) OAuth Connection Name')
param mcsConnectionName string = 'mcs'

// MCS Configuration
@description('MCS Environment ID')
param mcsEnvironmentId string = ''

@description('MCS Agent Schema Name')
param mcsSchemaName string = ''

// Azure OpenAI Configuration
@description('Azure OpenAI Endpoint')
param azureOpenAiEndpoint string = ''

@description('Azure OpenAI Deployment Name')
param azureOpenAiDeployment string = 'gpt-4o'

@secure()
@description('Azure OpenAI API Key')
param azureOpenAiApiKey string = ''

@description('Azure OpenAI API Version')
param azureOpenAiApiVersion string = '2024-12-01-preview'

// App Service Plan - Compute resources for your Web App
resource serverfarm 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: serverfarmsName
  location: location
  kind: 'linux'
  sku: {
    name: webAppSKU
  }
  properties: {
    reserved: true // false = Windows, true = Linux
  }
}

// Web App that hosts your Node.js 22 LTS agent
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: serverfarm.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'FtpsOnly'
      linuxFxVersion: 'NODE|22-lts'
      appCommandLine: 'node dist/index.js'
      healthCheckPath: '/health'
      logsDirectorySizeLimit: 100
      detailedErrorLoggingEnabled: true
      httpLoggingEnabled: true
      requestTracingEnabled: true
      appSettings: concat([
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'ENABLE_ORYX_BUILD'
          value: 'true'
        }
        {
          name: 'clientId'  // Lowercase - required by @microsoft/agents-hosting SDK
          value: botId
        }
        {
          name: 'tenantId'  // Lowercase - required by @microsoft/agents-hosting SDK
          value: botTenantId
        }
        // Application-specific configuration (used by src/config.ts and src/agent.ts)
        {
          name: 'MCS_CONNECTION_NAME'
          value: mcsConnectionName
        }
        {
          name: 'MCS_ENVIRONMENT_ID'
          value: mcsEnvironmentId
        }
        {
          name: 'MCS_SCHEMA_NAME'
          value: mcsSchemaName
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: azureOpenAiEndpoint
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT'
          value: azureOpenAiDeployment
        }
        {
          name: 'AZURE_OPENAI_API_KEY'
          value: azureOpenAiApiKey
        }
        {
          name: 'AZURE_OPENAI_API_VERSION'
          value: azureOpenAiApiVersion
        }
        {
          name: 'OAUTHCONNECTIONNAME'
          value: oauthConnectionName
        }
        {
          name: 'DEBUG'
          value: 'agents:*:error'
        }
      ], enableAppInsights && !empty(appInsightsConnectionString) ? [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'XDT_MicrosoftApplicationInsights_Mode'
          value: 'recommended'
        }
      ] :       [], additionalAppSettings)
      cors: {
        allowedOrigins: [
          'https://portal.azure.com'
          'https://ms.portal.azure.com'
        ]
        supportCredentials: false
      }
      metadata: [
        {
          name: 'CURRENT_STACK'
          value: 'node'
        }
      ]
    }
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${MSIid}': {}
    }
  }
}

// Outputs for use in other modules
output webAppName string = webApp.name
output webAppId string = webApp.id
output webAppHostName string = webApp.properties.defaultHostName
output webAppPrincipalId string = reference(MSIid, '2023-01-31').principalId
output appServicePlanId string = serverfarm.id
