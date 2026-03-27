/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AgentType } from './agentType'
import { PowerPlatformCloud } from './powerPlatformCloud'

/**
 * Represents the settings required to establish a direct connection to the engine.
 */
export interface CopilotStudioConnectionSettings {
  /** The identifier of the agent. */
  agentIdentifier?: string

  /** The custom Power Platform cloud URL. */
  customPowerPlatformCloud?: string

  /** The environment ID of the application. */
  environmentId?: string

  /** The cloud environment of the application. */
  cloud?: PowerPlatformCloud

  /** The type of the Copilot agent. */
  copilotAgentType?: AgentType

  /** URL provided to connect directly to Copilot Studio endpoint. When provided all other settings are ignored. */
  directConnectUrl?: string

  /** Directs Copilot Studio Client to use the experimental endpoint if available. */
  useExperimentalEndpoint?: boolean,

  /** The login authority to use for the connection. */
  authority?: string
}
