"use strict";
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotStudioClient = void 0;
const eventsource_client_1 = require("eventsource-client");
const powerPlatformEnvironment_1 = require("./powerPlatformEnvironment");
const agents_activity_1 = require("@microsoft/agents-activity");
const executeTurnRequest_1 = require("./executeTurnRequest");
const logger_1 = require("@microsoft/agents-activity/logger");
const package_json_1 = require("../package.json");
const os_1 = __importDefault(require("os"));
const logger = (0, logger_1.debug)('copilot-studio:client');
/**
 * Client for interacting with Microsoft Copilot Studio services.
 * Provides functionality to start conversations and send messages to Copilot Studio bots.
 */
class CopilotStudioClient {
    /**
     * Creates an instance of CopilotStudioClient.
     * @param settings The connection settings.
     * @param token The authentication token.
     */
    constructor(settings, token) {
        /** The ID of the current conversation. */
        this.conversationId = '';
        this.settings = settings;
        this.token = token;
    }
    /**
     * Streams activities from the Copilot Studio service using eventsource-client.
     * @param url The connection URL for Copilot Studio.
     * @param body Optional. The request body (for POST).
     * @param method Optional. The HTTP method (default: POST).
     * @returns An async generator yielding the Agent's Activities.
     */
    async *postRequestAsync(url, body, method = 'POST') {
        var _a, _b;
        logger.debug(`>>> SEND TO ${url}`);
        const eventSource = (0, eventsource_client_1.createEventSource)({
            url,
            headers: {
                Authorization: `Bearer ${this.token}`,
                'User-Agent': CopilotStudioClient.getProductInfo(),
                'Content-Type': 'application/json',
                Accept: 'text/event-stream'
            },
            body: body ? JSON.stringify(body) : undefined,
            method,
            fetch: async (url, init) => {
                const response = await fetch(url, init);
                this.processResponseHeaders(response.headers);
                return response;
            }
        });
        try {
            for await (const { data, event } of eventSource) {
                if (data && event === 'activity') {
                    try {
                        const activity = agents_activity_1.Activity.fromJson(data);
                        switch (activity.type) {
                            case agents_activity_1.ActivityTypes.Message:
                                if (!this.conversationId.trim()) { // Did not get it from the header.
                                    this.conversationId = (_b = (_a = activity.conversation) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : '';
                                    logger.debug(`Conversation ID: ${this.conversationId}`);
                                }
                                yield activity;
                                break;
                            default:
                                logger.debug(`Activity type: ${activity.type}`);
                                yield activity;
                                break;
                        }
                    }
                    catch (error) {
                        logger.error('Failed to parse activity:', error);
                    }
                }
                else if (event === 'end') {
                    logger.debug('Stream complete');
                    break;
                }
                if (eventSource.readyState === 'closed') {
                    logger.debug('Connection closed');
                    break;
                }
            }
        }
        finally {
            eventSource.close();
        }
    }
    /**
     * Appends this package.json version to the User-Agent header.
     * - For browser environments, it includes the user agent of the browser.
     * - For Node.js environments, it includes the Node.js version, platform, architecture, and release.
     * @returns A string containing the product information, including version and user agent.
     */
    static getProductInfo() {
        const versionString = `CopilotStudioClient.agents-sdk-js/${package_json_1.version}`;
        let userAgent;
        if (typeof window !== 'undefined' && window.navigator) {
            userAgent = `${versionString} ${navigator.userAgent}`;
        }
        else {
            userAgent = `${versionString} nodejs/${process.version} ${os_1.default.platform()}-${os_1.default.arch()}/${os_1.default.release()}`;
        }
        logger.debug(`User-Agent: ${userAgent}`);
        return userAgent;
    }
    processResponseHeaders(responseHeaders) {
        var _a, _b;
        if (this.settings.useExperimentalEndpoint && !((_a = this.settings.directConnectUrl) === null || _a === void 0 ? void 0 : _a.trim())) {
            const islandExperimentalUrl = responseHeaders === null || responseHeaders === void 0 ? void 0 : responseHeaders.get(CopilotStudioClient.islandExperimentalUrlHeaderKey);
            if (islandExperimentalUrl) {
                this.settings.directConnectUrl = islandExperimentalUrl;
                logger.debug(`Island Experimental URL: ${islandExperimentalUrl}`);
            }
        }
        this.conversationId = (_b = responseHeaders === null || responseHeaders === void 0 ? void 0 : responseHeaders.get(CopilotStudioClient.conversationIdHeaderKey)) !== null && _b !== void 0 ? _b : '';
        if (this.conversationId) {
            logger.debug(`Conversation ID: ${this.conversationId}`);
        }
        const sanitizedHeaders = new Headers();
        responseHeaders.forEach((value, key) => {
            if (key.toLowerCase() !== 'authorization' && key.toLowerCase() !== CopilotStudioClient.conversationIdHeaderKey.toLowerCase()) {
                sanitizedHeaders.set(key, value);
            }
        });
        logger.debug('Headers received:', sanitizedHeaders);
    }
    /**
     * Starts a new conversation with the Copilot Studio service.
     * @param emitStartConversationEvent Whether to emit a start conversation event. Defaults to true.
     * @returns An async generator yielding the Agent's Activities.
     */
    async *startConversationAsync(emitStartConversationEvent = true) {
        const uriStart = (0, powerPlatformEnvironment_1.getCopilotStudioConnectionUrl)(this.settings);
        const body = { emitStartConversationEvent };
        logger.info('Starting conversation ...');
        yield* this.postRequestAsync(uriStart, body, 'POST');
    }
    /**
     * Sends a question to the Copilot Studio service and retrieves the response activities.
     * @param question The question to ask.
     * @param conversationId The ID of the conversation. Defaults to the current conversation ID.
     * @returns An async generator yielding the Agent's Activities.
     */
    async *askQuestionAsync(question, conversationId = this.conversationId) {
        const conversationAccount = {
            id: conversationId
        };
        const activityObj = {
            type: 'message',
            text: question,
            conversation: conversationAccount
        };
        const activity = agents_activity_1.Activity.fromObject(activityObj);
        yield* this.sendActivity(activity);
    }
    /**
     * Sends an activity to the Copilot Studio service and retrieves the response activities.
     * @param activity The activity to send.
     * @param conversationId The ID of the conversation. Defaults to the current conversation ID.
     * @returns An async generator yielding the Agent's Activities.
     */
    async *sendActivity(activity, conversationId = this.conversationId) {
        var _a, _b;
        const localConversationId = (_b = (_a = activity.conversation) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : conversationId;
        const uriExecute = (0, powerPlatformEnvironment_1.getCopilotStudioConnectionUrl)(this.settings, localConversationId);
        const qbody = new executeTurnRequest_1.ExecuteTurnRequest(activity);
        logger.info('Sending activity...', activity);
        yield* this.postRequestAsync(uriExecute, qbody, 'POST');
    }
}
exports.CopilotStudioClient = CopilotStudioClient;
/** Header key for conversation ID. */
CopilotStudioClient.conversationIdHeaderKey = 'x-ms-conversationid';
/** Island Header key */
CopilotStudioClient.islandExperimentalUrlHeaderKey = 'x-ms-d2e-experimental';
/**
 * Returns the scope URL needed to connect to Copilot Studio from the connection settings.
 * This is used for authentication token audience configuration.
 * @param settings Copilot Studio connection settings.
 * @returns The scope URL for token audience.
 */
CopilotStudioClient.scopeFromSettings = powerPlatformEnvironment_1.getTokenAudience;
//# sourceMappingURL=copilotStudioClient.js.map