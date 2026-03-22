/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { CopilotStudioClient } from '@microsoft/agents-copilotstudio-client'

import { acquireToken } from './acquireToken.js'
import { settings } from './settings.js'

export const createCopilotClient = async () => {
  const token = await acquireToken(settings)
  return new CopilotStudioClient(settings, token)
}