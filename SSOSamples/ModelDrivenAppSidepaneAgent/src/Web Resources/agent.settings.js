/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ConnectionSettings } from '@microsoft/agents-copilotstudio-client';
import { getEnvironmentId, getTenantId, getEnvironmentVariableValue } from './dataverseHelpers.js';

// Flag to enable debug mode, which will store the debug information in localStorage.
// Copilot Studio Client uses the "debug" library for logging (https://github.com/debug-js/debug?tab=readme-ov-file#browser-support).
window.localStorage.debug = 'copilot-studio-client';

export const settings = new ConnectionSettings({
  appClientId: await getEnvironmentVariableValue("cat_SidePaneAgentAppRegistration"),
  tenantId: getTenantId(),
  environmentId: getEnvironmentId(),
  // Schema Name of the Copilot to use.  Hard coded here to match the agent included with the solution
  agentIdentifier: 'cat_sidePaneAgent'
});