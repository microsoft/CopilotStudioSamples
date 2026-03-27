/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { AgentType } from './agentType';
import { CopilotStudioConnectionSettings } from './copilotStudioConnectionSettings';
import { PowerPlatformCloud } from './powerPlatformCloud';
/**
 * Configuration options for establishing a connection to Copilot Studio.
 */
declare abstract class ConnectionOptions implements Omit<CopilotStudioConnectionSettings, 'cloud' | 'copilotAgentType'> {
    /** The client ID of the application. */
    appClientId: string;
    /** The tenant ID of the application. */
    tenantId: string;
    /** The login authority to use for the connection */
    authority?: string;
    /** The environment ID of the application. */
    environmentId: string;
    /** The identifier of the agent. */
    agentIdentifier: string;
    /** The cloud environment of the application. */
    cloud?: PowerPlatformCloud | keyof typeof PowerPlatformCloud;
    /** The custom Power Platform cloud URL, if any. */
    customPowerPlatformCloud?: string;
    /** The type of the Copilot agent. */
    copilotAgentType?: AgentType | keyof typeof AgentType;
    /** The URL to connect directly to Copilot Studio endpoint */
    directConnectUrl?: string;
    /** Flag to use the experimental endpoint if available */
    useExperimentalEndpoint?: boolean;
}
/**
 * Represents the settings required to establish a connection to Copilot Studio.
 */
export declare class ConnectionSettings extends ConnectionOptions {
    /** The cloud environment of the application. */
    cloud?: PowerPlatformCloud;
    /** The type of the Copilot agent. */
    copilotAgentType?: AgentType;
    /**
     * Default constructor for the ConnectionSettings class.
     */
    constructor();
    /**
     * Creates an instance of ConnectionSettings.
     * @param options Represents the settings required to establish a direct connection to the engine.
     */
    constructor(options: ConnectionOptions);
}
/**
 * Loads the connection settings for Copilot Studio from environment variables.
 * @returns The connection settings.
 */
export declare const loadCopilotStudioConnectionSettingsFromEnv: () => ConnectionSettings;
export {};
