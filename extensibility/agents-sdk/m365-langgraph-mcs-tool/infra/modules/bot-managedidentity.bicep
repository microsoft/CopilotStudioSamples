@description('The name of the User Assigned Managed Identity to create.')
param identityName string 
@description('Location for all resources.')
param location string = resourceGroup().location


resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  location: location
  name: identityName
}

// Outputs for use in other modules
output identityId string = identity.id
output identityName string = identity.name
output identityClientId string = identity.properties.clientId
output identityPrincipalId string = identity.properties.principalId
