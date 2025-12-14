/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */


export function getEnvironmentId(){
  return Xrm.Utility.getGlobalContext().organizationSettings.bapEnvironmentId;
}

export function getTenantId(){
  return Xrm.Utility.getGlobalContext().organizationSettings.organizationTenant;
}

export async function getEnvironmentVariableValue(variableName) {
  var query = "?$filter=schemaname eq '" + variableName + "'&$select=value";
  const response = await Xrm.WebApi.retrieveMultipleRecords("environmentvariablevalue", query);
  return response.entities[0].value;
}

export async function getUsername(){
  var userSettings = Xrm.Utility.getGlobalContext().userSettings;
  console.log("User settings: ",userSettings);

  var id = userSettings.userId
  id = id.replace("{", "").replace("}", "")
  var options = "?$select=domainname";
  var response = await Xrm.WebApi.retrieveRecord("systemuser", id, options);
  return response.domainname
}