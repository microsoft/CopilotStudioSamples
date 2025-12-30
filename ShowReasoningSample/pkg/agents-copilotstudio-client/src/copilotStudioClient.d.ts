/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ConnectionSettings } from './connectionSettings';
import { Activity } from '@microsoft/agents-activity';
/**
 * Client for interacting with Microsoft Copilot Studio services.
 * Provides functionality to start conversations and send messages to Copilot Studio bots.
 */
export declare class CopilotStudioClient {
    /** Header key for conversation ID. */
    private static readonly conversationIdHeaderKey;
    /** Island Header key */
    private static readonly islandExperimentalUrlHeaderKey;
    /** The ID of the current conversation. */
    private conversationId;
    /** The connection settings for the client. */
    private readonly settings;
    /** The authenticaton token. */
    private readonly token;
    /**
     * Returns the scope URL needed to connect to Copilot Studio from the connection settings.
     * This is used for authentication token audience configuration.
     * @param settings Copilot Studio connection settings.
     * @returns The scope URL for token audience.
     */
    static scopeFromSettings: (settings: ConnectionSettings) => string;
    /**
     * Creates an instance of CopilotStudioClient.
     * @param settings The connection settings.
     * @param token The authentication token.
     */
    constructor(settings: ConnectionSettings, token: string);
    /**
     * Streams activities from the Copilot Studio service using eventsource-client.
     * @param url The connection URL for Copilot Studio.
     * @param body Optional. The request body (for POST).
     * @param method Optional. The HTTP method (default: POST).
     * @returns An async generator yielding the Agent's Activities.
     */
    private postRequestAsync;
    /**
     * Appends this package.json version to the User-Agent header.
     * - For browser environments, it includes the user agent of the browser.
     * - For Node.js environments, it includes the Node.js version, platform, architecture, and release.
     * @returns A string containing the product information, including version and user agent.
     */
    private static getProductInfo;
    private processResponseHeaders;
    /**
     * Starts a new conversation with the Copilot Studio service.
     * @param emitStartConversationEvent Whether to emit a start conversation event. Defaults to true.
     * @returns An async generator yielding the Agent's Activities.
     */
    startConversationAsync(emitStartConversationEvent?: boolean): AsyncGenerator<Activity>;
    /**
     * Sends a question to the Copilot Studio service and retrieves the response activities.
     * @param question The question to ask.
     * @param conversationId The ID of the conversation. Defaults to the current conversation ID.
     * @returns An async generator yielding the Agent's Activities.
     */
    askQuestionAsync(question: string, conversationId?: string): AsyncGenerator<Activity>;
    /**
     * Sends an activity to the Copilot Studio service and retrieves the response activities.
     * @param activity The activity to send.
     * @param conversationId The ID of the conversation. Defaults to the current conversation ID.
     * @returns An async generator yielding the Agent's Activities.
     */
    sendActivity(activity: Activity, conversationId?: string): AsyncGenerator<Activity>;
}
