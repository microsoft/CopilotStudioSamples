/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { Strategy } from './strategy';
export interface PublishedBotStrategySettings {
    readonly host: URL;
    readonly schema: string;
}
export declare class PublishedBotStrategy implements Strategy {
    private readonly API_VERSION;
    private baseURL;
    constructor(settings: PublishedBotStrategySettings);
    getConversationUrl(conversationId?: string): string;
}
