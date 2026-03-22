"use strict";
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotStudioWebChat = void 0;
const uuid_1 = require("uuid");
const agents_activity_1 = require("@microsoft/agents-activity");
const rxjs_1 = require("rxjs");
const logger_1 = require("@microsoft/agents-activity/logger");
const logger = (0, logger_1.debug)('copilot-studio:webchat');
/**
 * A utility class that provides WebChat integration capabilities for Copilot Studio services.
 *
 * @remarks
 * This class acts as a bridge between Microsoft Bot Framework WebChat and Copilot Studio,
 * enabling seamless communication through a DirectLine-compatible interface.
 *
 * ## Key Features:
 * - DirectLine protocol compatibility for easy WebChat integration
 * - Real-time bidirectional messaging with Copilot Studio agents
 * - Automatic conversation management and message sequencing
 * - Optional typing indicators for enhanced user experience
 * - Observable-based architecture for reactive programming patterns
 *
 * ## Usage Scenarios:
 * - Embedding Copilot Studio agents in web applications
 * - Creating custom chat interfaces with WebChat components
 * - Building conversational AI experiences with Microsoft's bot ecosystem
 *
 * @example Basic WebChat Integration
 * ```typescript
 * import { CopilotStudioClient } from '@microsoft/agents-copilotstudio-client';
 * import { CopilotStudioWebChat } from '@microsoft/agents-copilotstudio-client';
 *
 * // Initialize the Copilot Studio client
 * const client = new CopilotStudioClient({
 *   botId: 'your-bot-id',
 *   tenantId: 'your-tenant-id'
 * });
 *
 * // Create a WebChat-compatible connection
 * const directLine = CopilotStudioWebChat.createConnection(client, {
 *   showTyping: true
 * });
 *
 * // Integrate with WebChat
 * window.WebChat.renderWebChat({
 *   directLine: directLine,
 *   // ... other WebChat options
 * }, document.getElementById('webchat'));
 * ```
 *
 * @example Advanced Usage with Connection Monitoring
 * ```typescript
 * const connection = CopilotStudioWebChat.createConnection(client);
 *
 * // Monitor connection status
 * connection.connectionStatus$.subscribe(status => {
 *   switch (status) {
 *     case 0: console.log('Disconnected'); break;
 *     case 1: console.log('Connecting...'); break;
 *     case 2: console.log('Connected and ready'); break;
 *   }
 * });
 *
 * // Listen for incoming activities
 * connection.activity$.subscribe(activity => {
 *   console.log('Received activity:', activity);
 * });
 * ```
 */
class CopilotStudioWebChat {
    /**
     * Creates a DirectLine-compatible connection for integrating Copilot Studio with WebChat.
     *
  
     * @param client - A configured CopilotStudioClient instance that handles the underlying
     *                 communication with the Copilot Studio service. This client should be
     *                 properly authenticated and configured with the target bot details.
     *
     * @param settings - Optional configuration settings that control the behavior of the
     *                   WebChat connection. These settings allow customization of features
     *                   like typing indicators and other user experience enhancements.
     *
     * @returns A new CopilotStudioWebChatConnection instance that can be passed directly
     *          to WebChat's renderWebChat function as the directLine parameter. The
     *          connection is immediately ready for use and will automatically manage
     *          the conversation lifecycle.
     *
     * @throws Error if the provided client is not properly configured or if there are
     *         issues establishing the initial connection to the Copilot Studio service.
     *
     * @remarks
     * This method establishes a real-time communication channel between WebChat and the
     * Copilot Studio service. The returned connection object implements the DirectLine
     * protocol, making it fully compatible with Microsoft Bot Framework WebChat components.
     *
     * ## Connection Lifecycle:
     * 1. **Initialization**: Creates observables for connection status and activity streaming
     * 2. **Conversation Start**: Automatically initiates conversation when first activity is posted
     * 3. **Message Flow**: Handles bidirectional message exchange with proper sequencing
     * 4. **Cleanup**: Provides graceful connection termination
     *
     * ## Message Processing:
     * - User messages are validated and sent to Copilot Studio
     * - Agent responses are received and formatted for WebChat
     * - All activities include timestamps and sequence IDs for proper ordering
     * - Optional typing indicators provide visual feedback during processing
     *
     * @example
     * ```typescript
     * const connection = CopilotStudioWebChat.createConnection(client, {
     *   showTyping: true
     * });
     *
     * // Use with WebChat
     * window.WebChat.renderWebChat({
     *   directLine: connection
     * }, document.getElementById('webchat'));
     * ```
     */
    static createConnection(client, settings) {
        logger.info('--> Creating connection between Copilot Studio and WebChat ...');
        let sequence = 0;
        let activitySubscriber;
        let conversation;
        const connectionStatus$ = new rxjs_1.BehaviorSubject(0);
        const activity$ = createObservable(async (subscriber) => {
            activitySubscriber = subscriber;
            if (connectionStatus$.value < 2) {
                connectionStatus$.next(2);
                return;
            }
            logger.debug('--> Connection established.');
            notifyTyping();
            for await (const activity of client.startConversationAsync()) {
                delete activity.replyToId;
                conversation = activity.conversation;
                notifyActivity(activity);
            }
        });
        const notifyActivity = (activity) => {
            const newActivity = {
                ...activity,
                timestamp: new Date().toISOString(),
                channelData: {
                    ...activity.channelData,
                    'webchat:sequence-id': sequence,
                },
            };
            sequence++;
            logger.debug(`Notify '${newActivity.type}' activity to WebChat:`, newActivity);
            activitySubscriber === null || activitySubscriber === void 0 ? void 0 : activitySubscriber.next(newActivity);
        };
        const notifyTyping = () => {
            if (!(settings === null || settings === void 0 ? void 0 : settings.showTyping)) {
                return;
            }
            const from = conversation
                ? { id: conversation.id, name: conversation.name }
                : { id: 'agent', name: 'Agent' };
            notifyActivity({ type: 'typing', from });
        };
        return {
            connectionStatus$,
            activity$,
            postActivity(activity) {
                logger.info('--> Preparing to send activity to Copilot Studio ...');
                if (!activity) {
                    throw new Error('Activity cannot be null.');
                }
                if (!activitySubscriber) {
                    throw new Error('Activity subscriber is not initialized.');
                }
                return createObservable(async (subscriber) => {
                    try {
                        logger.info('--> Sending activity to Copilot Studio ...');
                        const newActivity = agents_activity_1.Activity.fromObject({
                            ...activity,
                            id: (0, uuid_1.v4)(),
                            attachments: await processAttachments(activity)
                        });
                        notifyActivity(newActivity);
                        notifyTyping();
                        // Notify WebChat immediately that the message was sent
                        subscriber.next(newActivity.id);
                        // Stream the agent's response, but don't block the UI
                        for await (const responseActivity of client.sendActivity(newActivity)) {
                            notifyActivity(responseActivity);
                            logger.info('<-- Activity received correctly from Copilot Studio.');
                        }
                        subscriber.complete();
                    }
                    catch (error) {
                        logger.error('Error sending Activity to Copilot Studio:', error);
                        subscriber.error(error);
                    }
                });
            },
            end() {
                logger.info('--> Ending connection between Copilot Studio and WebChat ...');
                connectionStatus$.complete();
                if (activitySubscriber) {
                    activitySubscriber.complete();
                    activitySubscriber = undefined;
                }
            },
        };
    }
}
exports.CopilotStudioWebChat = CopilotStudioWebChat;
/**
 * Processes activity attachments.
 * @param activity The activity to process for attachments.
 * @returns A promise that resolves to the activity with all attachments converted.
 */
async function processAttachments(activity) {
    var _a;
    if (activity.type !== 'message' || !((_a = activity.attachments) === null || _a === void 0 ? void 0 : _a.length)) {
        return activity.attachments || [];
    }
    const attachments = [];
    for (const attachment of activity.attachments) {
        const processed = await processBlobAttachment(attachment);
        attachments.push(processed);
    }
    return attachments;
}
/**
 * Processes a blob attachment to convert its content URL to a data URL.
 * @param attachment The attachment to process.
 * @returns A promise that resolves to the processed attachment.
 */
async function processBlobAttachment(attachment) {
    let newContentUrl = attachment.contentUrl;
    if (!(newContentUrl === null || newContentUrl === void 0 ? void 0 : newContentUrl.startsWith('blob:'))) {
        return attachment;
    }
    try {
        const response = await fetch(newContentUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch blob URL: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        newContentUrl = `data:${blob.type};base64,${base64}`;
    }
    catch (error) {
        newContentUrl = attachment.contentUrl;
        logger.error('Error processing blob attachment:', newContentUrl, error);
    }
    return { ...attachment, contentUrl: newContentUrl };
}
/**
 * Converts an ArrayBuffer to a base64 string.
 * @param buffer The ArrayBuffer to convert.
 * @returns The base64 encoded string.
 */
function arrayBufferToBase64(buffer) {
    // Node.js environment
    const BufferClass = typeof globalThis.Buffer === 'function' ? globalThis.Buffer : undefined;
    if (BufferClass && typeof BufferClass.from === 'function') {
        return BufferClass.from(buffer).toString('base64');
    }
    // Browser environment
    let binary = '';
    for (const byte of new Uint8Array(buffer)) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}
/**
 * Creates an RxJS Observable that wraps an asynchronous function execution.
 *
 * @typeParam T - The type of value that the observable will emit
 * @param fn - An asynchronous function that receives a Subscriber and performs
 *             the desired async operation. The function should call subscriber.next()
 *             with results and subscriber.complete() when finished.
 * @returns A new Observable that executes the provided function and emits its results
 *
 * @remarks
 * This utility function provides a clean way to convert async/await patterns
 * into Observable streams, enabling integration with reactive programming patterns
 * used throughout the WebChat connection implementation.
 *
 * The created Observable handles promise resolution and rejection automatically,
 * converting them to appropriate next/error signals for subscribers.
 *
 * @example
 * ```typescript
 * const dataObservable = createObservable<string>(async (subscriber) => {
 *   try {
 *     const result = await fetchData();
 *     subscriber.next(result);
 *     subscriber.complete();
 *   } catch (error) {
 *     subscriber.error(error);
 *   }
 * });
 * ```
 */
function createObservable(fn) {
    return new rxjs_1.Observable((subscriber) => {
        Promise.resolve(fn(subscriber)).catch((error) => subscriber.error(error));
    });
}
//# sourceMappingURL=copilotStudioWebChat.js.map