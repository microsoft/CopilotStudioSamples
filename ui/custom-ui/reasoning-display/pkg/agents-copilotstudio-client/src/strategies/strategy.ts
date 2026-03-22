/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

export interface Strategy {
  getConversationUrl(conversationId?: string): string;
}
