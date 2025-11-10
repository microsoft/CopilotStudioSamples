/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Strategy } from './strategy'

export interface PrebuiltBotStrategySettings {
  readonly host: URL;
  readonly identifier: string;
}

export class PrebuiltBotStrategy implements Strategy {
  private readonly API_VERSION = '2022-03-01-preview'
  private baseURL: URL

  constructor (settings: PrebuiltBotStrategySettings) {
    const { identifier, host } = settings

    this.baseURL = new URL(
      `/copilotstudio/prebuilt/authenticated/bots/${identifier}`,
      host
    )
    this.baseURL.searchParams.append('api-version', this.API_VERSION)
  }

  public getConversationUrl (conversationId?: string): string {
    const conversationUrl = new URL(this.baseURL.href)
    conversationUrl.pathname = `${conversationUrl.pathname}/conversations`

    if (conversationId) {
      conversationUrl.pathname = `${conversationUrl.pathname}/${conversationId}`
    }

    return conversationUrl.href
  }
}
