/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AgentType } from './agentType'
import { CopilotStudioConnectionSettings } from './copilotStudioConnectionSettings'
import { PowerPlatformCloud } from './powerPlatformCloud'

/**
 * Configuration options for establishing a connection to Copilot Studio.
 */
abstract class ConnectionOptions implements Omit<CopilotStudioConnectionSettings, 'cloud' | 'copilotAgentType'> {
  /** The client ID of the application. */
  public appClientId: string = ''
  /** The tenant ID of the application. */
  public tenantId: string = ''
  /** The login authority to use for the connection */
  public authority?: string = ''
  /** The environment ID of the application. */
  public environmentId: string = ''
  /** The identifier of the agent. */
  public agentIdentifier: string = ''
  /** The cloud environment of the application. */
  public cloud?: PowerPlatformCloud | keyof typeof PowerPlatformCloud
  /** The custom Power Platform cloud URL, if any. */
  public customPowerPlatformCloud?: string
  /** The type of the Copilot agent. */
  public copilotAgentType?: AgentType | keyof typeof AgentType
  /** The URL to connect directly to Copilot Studio endpoint */
  public directConnectUrl?: string
  /** Flag to use the experimental endpoint if available */
  public useExperimentalEndpoint?: boolean = false
}

/**
 * Represents the settings required to establish a connection to Copilot Studio.
 */
export class ConnectionSettings extends ConnectionOptions {
  /** The cloud environment of the application. */
  public cloud?: PowerPlatformCloud
  /** The type of the Copilot agent. */
  public copilotAgentType?: AgentType

  /**
   * Default constructor for the ConnectionSettings class.
   */
  constructor ()

  /**
   * Creates an instance of ConnectionSettings.
   * @param options Represents the settings required to establish a direct connection to the engine.
   */
  constructor (options: ConnectionOptions)

  /**
   * @private
   */
  constructor (options?: ConnectionOptions) {
    super()

    if (!options) {
      return
    }

    const cloud = options.cloud ?? PowerPlatformCloud.Prod
    const copilotAgentType = options.copilotAgentType ?? AgentType.Published
    const authority = options.authority && options.authority.trim() !== ''
      ? options.authority
      : 'https://login.microsoftonline.com'

    if (!Object.values(PowerPlatformCloud).includes(cloud as PowerPlatformCloud)) {
      throw new Error(`Invalid PowerPlatformCloud: '${cloud}'. Supported values: ${Object.values(PowerPlatformCloud).join(', ')}`)
    }

    if (!Object.values(AgentType).includes(copilotAgentType as AgentType)) {
      throw new Error(`Invalid AgentType: '${copilotAgentType}'. Supported values: ${Object.values(AgentType).join(', ')}`)
    }

    Object.assign(this, { ...options, cloud, copilotAgentType, authority })
  }
}

/**
 * Loads the connection settings for Copilot Studio from environment variables.
 * @returns The connection settings.
 */
export const loadCopilotStudioConnectionSettingsFromEnv: () => ConnectionSettings = () => {
  return new ConnectionSettings({
    appClientId: process.env.appClientId ?? '',
    tenantId: process.env.tenantId ?? '',
    authority: process.env.authorityEndpoint ?? 'https://login.microsoftonline.com',
    environmentId: process.env.environmentId ?? '',
    agentIdentifier: process.env.agentIdentifier ?? '',
    cloud: process.env.cloud as PowerPlatformCloud,
    customPowerPlatformCloud: process.env.customPowerPlatformCloud,
    copilotAgentType: process.env.copilotAgentType as AgentType,
    directConnectUrl: process.env.directConnectUrl,
    useExperimentalEndpoint: process.env.useExperimentalEndpoint?.toLowerCase() === 'true'
  })
}
