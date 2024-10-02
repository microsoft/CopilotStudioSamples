param botName string = 'CopilotSpeechBot'
param subscriptionId string = ''
param resourceGroupName string = ''
@description('Name of the Azure Speech services desployment')
param speechResourceName string = ''
param appId string = ''
param tenantId string = ''
@description('The resource URI of the cognitive services account')
param cognitiveServicesResource string = '/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.CognitiveServices/accounts/${speechResourceName}'
param webAppName string = ''

@description('The Azure Bot FX relay bot')
resource botResource 'Microsoft.BotService/botServices@2023-09-15-preview' = {
  name: botName
  location: 'global'
  sku: {
    name: 'F0'
  }
  kind: 'azurebot'
  properties: {
    displayName: botName
    iconUrl: 'https://docs.botframework.com/static/devportal/client/images/bot-framework-default.png'
    endpoint: 'https://${webAppName}.azurewebsites.net/api/messages'
    msaAppId: appId
    msaAppTenantId: tenantId
    msaAppType: 'SingleTenant'
    luisAppIds: []
    isStreamingSupported: true
    schemaTransformationVersion: '1.3'
    tenantId: tenantId
    isCmekEnabled: false
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

@description('Direct line channel registration')
resource botDirectLineChannel 'Microsoft.BotService/botServices/channels@2023-09-15-preview' = {
  parent: botResource
  name: 'DirectLineChannel'
  location: 'global'
  properties: {
    properties: {
      sites: [
        {
          siteName: 'Default Site'
          isEnabled: true
          isV1Enabled: true
          isV3Enabled: true
          isSecureSiteEnabled: false
          isBlockUserUploadEnabled: false
        }
      ]
    }
    channelName: 'DirectLineChannel'
    location: 'global'
  }
}

@description('Direct Line speech channel')
resource botDirectLineSpeechChannel 'Microsoft.BotService/botServices/channels@2023-09-15-preview' = {
  parent: botResource
  name: 'DirectLineSpeechChannel'
  location: 'global'
  properties: {
    properties: {
      cognitiveServiceResourceId: cognitiveServicesResource
      isEnabled: true
      isDefaultBotForCogSvcAccount: false
    }
    channelName: 'DirectLineSpeechChannel'
    location: 'global'
  }
}

@description('Web chat channel for testing')
resource botWebChatChannel 'Microsoft.BotService/botServices/channels@2023-09-15-preview' = {
  parent: botResource
  name: 'WebChatChannel'
  location: 'global'
  properties: {
    properties: {
      sites: [
        {
          siteName: 'Default Site'
          isEnabled: true
          isWebchatPreviewEnabled: true
          isBlockUserUploadEnabled: false
        }
      ]
    }
    channelName: 'WebChatChannel'
    location: 'global'
  }
}
