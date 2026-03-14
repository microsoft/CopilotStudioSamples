"use strict";
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedBotStrategy = void 0;
class PublishedBotStrategy {
    constructor(settings) {
        this.API_VERSION = '2022-03-01-preview';
        const { schema, host } = settings;
        this.baseURL = new URL(`/copilotstudio/dataverse-backed/authenticated/bots/${schema}`, host);
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
exports.PublishedBotStrategy = PublishedBotStrategy;
//# sourceMappingURL=publishedBotStrategy.js.map