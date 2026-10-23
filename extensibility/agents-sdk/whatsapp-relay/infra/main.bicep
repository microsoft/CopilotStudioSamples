param location string = resourceGroup().location
param appName string
param planName string
param owner string
@allowed([
  'NODE|22-lts'
  'NODE|24-lts'
])
param nodeRuntime string

var tags = {
  'whatsapp-relay-owner': owner
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
    capacity: 1
  }
  properties: {
    reserved: true
    perSiteScaling: false
    elasticScaleEnabled: false
  }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: nodeRuntime
      appCommandLine: 'node dist/src/index.js'
      alwaysOn: true
      numberOfWorkers: 1
      healthCheckPath: '/health'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
    }
  }
}

output hostname string = app.properties.defaultHostName
