// Application Insights Module with Managed Identity Support
// This module deploys Log Analytics Workspace and Application Insights
// Configured to use managed identity authentication (no instrumentation key needed)

@description('Base name for resources')
param resourceBaseName string

@description('Location for all resources')
param location string = resourceGroup().location

@description('The managed identity principal ID that will access Application Insights')
param identityPrincipalId string

@description('Application Insights application type')
@allowed([
  'web'
  'other'
])
param applicationType string = 'web'

// Log Analytics Workspace (required for Application Insights)
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${resourceBaseName}-law'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: 1 // Limit to 1GB per day to control costs
    }
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${resourceBaseName}-ai'
  location: location
  kind: applicationType
  properties: {
    Application_Type: applicationType
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    DisableLocalAuth: false // Set to true to enforce managed identity only (more secure)
  }
}

// Grant Managed Identity "Monitoring Metrics Publisher" role on Application Insights
// This allows the bot to publish telemetry without using instrumentation key
var monitoringMetricsPublisherRoleId = '3913510d-42f4-4e42-8a64-420c390055eb' // Built-in role ID
resource appInsightsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appInsights.id, identityPrincipalId, monitoringMetricsPublisherRoleId)
  scope: appInsights
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', monitoringMetricsPublisherRoleId)
    principalId: identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Outputs
output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
