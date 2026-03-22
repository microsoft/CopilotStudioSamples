"use strict";
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrebuiltBotStrategy = void 0;
class PrebuiltBotStrategy {
    constructor(settings) {
        this.API_VERSION = '2022-03-01-preview';
        const { identifier, host } = settings;
        this.baseURL = new URL(`/copilotstudio/prebuilt/authenticated/bots/${identifier}`, host);
        this.baseURL.searchParams.append('api-version', this.API_VERSION);
    }
    getConversationUrl(conversationId) {
        const conversationUrl = new URL(this.baseURL.href);
        conversationUrl.pathname = `${conversationUrl.pathname}/conversations`;
        if (conversationId) {
            conversationUrl.pathname = `${conversationUrl.pathname}/${conversationId}`;
        }
        return conversationUrl.href;
    }
}
exports.PrebuiltBotStrategy = PrebuiltBotStrategy;
//# sourceMappingURL=prebuiltBotStrategy.js.map