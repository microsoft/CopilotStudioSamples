/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

// This file emulates the process object in node.
// rename this file to settings.js before running this test sample
import { ConnectionSettings } from '@microsoft/agents-copilotstudio-client'

// Flag to enable debug mode, which will store the debug information in localStorage.
// Copilot Studio Client uses the "debug" library for logging (https://github.com/debug-js/debug?tab=readme-ov-file#browser-support).
window.localStorage.debug = 'copilot-studio-client' 

export const settings = new ConnectionSettings({
  // App ID of the App Registration used to log in, this should be in the same tenant as the Copilot.
  appClientId: 'APP-REGISTRATION-CLIENT-ID-HERE',
  // Tenant ID of the App Registration used to log in, this should be in the same tenant as the Copilot.
  tenantId: 'YOUR-TENANT-ID-HERE',
  // Authority endpoint for the Azure AD login. Default is 'https://login.microsoftonline.com'.
  authority: 'https://login.microsoftonline.com',
  // Environment ID of the environment with the Copilot Studio App.
  environmentId: undefined,
  // Schema Name of the Copilot to use.
  agentIdentifier: undefined,
  // PowerPlatformCloud enum key.
  cloud: undefined,
  // Power Platform API endpoint to use if Cloud is configured as "Other".
  customPowerPlatformCloud: undefined,
  // AgentType enum key.
  copilotAgentType: undefined,
  // URL used to connect to the Copilot Studio service.
  directConnectUrl: "YOUR-DIRECT-CONNECT-URL-HERE",
  // Flag to use the "x-ms-d2e-experimental" header URL on subsequent calls to the Copilot Studio service.
  useExperimentalEndpoint: false
})