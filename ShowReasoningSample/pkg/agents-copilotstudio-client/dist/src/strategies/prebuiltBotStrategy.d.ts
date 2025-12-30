/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { Strategy } from './strategy';
export interface PrebuiltBotStrategySettings {
    readonly host: URL;
    readonly identifier: string;
}
export declare class PrebuiltBotStrategy implements Strategy {
    private readonly API_VERSION;
    private baseURL;
    constructor(settings: PrebuiltBotStrategySettings);
    getConversationUrl(conversationId?: string): string;
}
