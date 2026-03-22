/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { createEventSource, EventSourceClient } from 'eventsource-client'
import { ConnectionSettings } from './connectionSettings'
import { getCopilotStudioConnectionUrl, getTokenAudience } from './powerPlatformEnvironment'
import { Activity, ActivityTypes, ConversationAccount } from '@microsoft/agents-activity'
import { ExecuteTurnRequest } from './executeTurnRequest'
import { debug } from '@microsoft/agents-activity/logger'
import { version } from '../package.json'
import os from 'os'

const logger = debug('copilot-studio:client')

/**
 * Client for interacting with Microsoft Copilot Studio services.
 * Provides functionality to start conversations and send messages to Copilot Studio bots.
 */
export class CopilotStudioClient {
  /** Header key for conversation ID. */
  private static readonly conversationIdHeaderKey: string = 'x-ms-conversationid'
  /** Island Header key */
  private static readonly islandExperimentalUrlHeaderKey: string = 'x-ms-d2e-experimental'

  /** The ID of the current conversation. */
  private conversationId: string = ''
  /** The connection settings for the client. */
  private readonly settings: ConnectionSettings
  /** The authenticaton token. */
  private readonly token: string

  /**
   * Returns the scope URL needed to connect to Copilot Studio from the connection settings.
   * This is used for authentication token audience configuration.
   * @param settings Copilot Studio connection settings.
   * @returns The scope URL for token audience.
   */
  static scopeFromSettings: (settings: ConnectionSettings) => string = getTokenAudience

  /**
   * Creates an instance of CopilotStudioClient.
   * @param settings The connection settings.
   * @param token The authentication token.
   */
  constructor (settings: ConnectionSettings, token: string) {
    this.settings = settings
    this.token = token
  }

  /**
   * Streams activities from the Copilot Studio service using eventsource-client.
   * @param url The connection URL for Copilot Studio.
   * @param body Optional. The request body (for POST).
   * @param method Optional. The HTTP method (default: POST).
   * @returns An async generator yielding the Agent's Activities.
   */
  private async * postRequestAsync (url: string, body?: any, method: string = 'POST'): AsyncGenerator<Activity> {
    logger.debug(`>>> SEND TO ${url}`)

    const eventSource: EventSourceClient = createEventSource({
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
        const response = await fetch(url, init)
        this.processResponseHeaders(response.headers)
        return response
      }
    })

    try {
      for await (const { data, event } of eventSource) {
        if (data && event === 'activity') {
          try {
            const activity = Activity.fromJson(data)
            switch (activity.type) {
              case ActivityTypes.Message:
                if (!this.conversationId.trim()) { // Did not get it from the header.
                  this.conversationId = activity.conversation?.id ?? ''
                  logger.debug(`Conversation ID: ${this.conversationId}`)
                }
                yield activity
                break
              default:
                logger.debug(`Activity type: ${activity.type}`)
                yield activity
                break
            }
          } catch (error) {
            logger.error('Failed to parse activity:', error)
          }
        } else if (event === 'end') {
          logger.debug('Stream complete')
          break
        }

        if (eventSource.readyState === 'closed') {
          logger.debug('Connection closed')
          break
        }
      }
    } finally {
      eventSource.close()
    }
  }

  /**
   * Appends this package.json version to the User-Agent header.
   * - For browser environments, it includes the user agent of the browser.
   * - For Node.js environments, it includes the Node.js version, platform, architecture, and release.
   * @returns A string containing the product information, including version and user agent.
   */
  private static getProductInfo (): string {
    const versionString = `CopilotStudioClient.agents-sdk-js/${version}`
    let userAgent: string

    if (typeof window !== 'undefined' && window.navigator) {
      userAgent = `${versionString} ${navigator.userAgent}`
    } else {
      userAgent = `${versionString} nodejs/${process.version} ${os.platform()}-${os.arch()}/${os.release()}`
    }

    logger.debug(`User-Agent: ${userAgent}`)
    return userAgent
  }

  private processResponseHeaders (responseHeaders: Headers): void {
    if (this.settings.useExperimentalEndpoint && !this.settings.directConnectUrl?.trim()) {
      const islandExperimentalUrl = responseHeaders?.get(CopilotStudioClient.islandExperimentalUrlHeaderKey)
      if (islandExperimentalUrl) {
        this.settings.directConnectUrl = islandExperimentalUrl
        logger.debug(`Island Experimental URL: ${islandExperimentalUrl}`)
      }
    }

    this.conversationId = responseHeaders?.get(CopilotStudioClient.conversationIdHeaderKey) ?? ''
    if (this.conversationId) {
      logger.debug(`Conversation ID: ${this.conversationId}`)
    }

    const sanitizedHeaders = new Headers()
    responseHeaders.forEach((value, key) => {
      if (key.toLowerCase() !== 'authorization' && key.toLowerCase() !== CopilotStudioClient.conversationIdHeaderKey.toLowerCase()) {
        sanitizedHeaders.set(key, value)
      }
    })
    logger.debug('Headers received:', sanitizedHeaders)
  }

  /**
   * Starts a new conversation with the Copilot Studio service.
   * @param emitStartConversationEvent Whether to emit a start conversation event. Defaults to true.
   * @returns An async generator yielding the Agent's Activities.
   */
  public async * startConversationAsync (emitStartConversationEvent: boolean = true): AsyncGenerator<Activity> {
    const uriStart: string = getCopilotStudioConnectionUrl(this.settings)
    const body = { emitStartConversationEvent }

    logger.info('Starting conversation ...')

    yield * this.postRequestAsync(uriStart, body, 'POST')
  }

  /**
   * Sends a question to the Copilot Studio service and retrieves the response activities.
   * @param question The question to ask.
   * @param conversationId The ID of the conversation. Defaults to the current conversation ID.
   * @returns An async generator yielding the Agent's Activities.
   */
  public async * askQuestionAsync (question: string, conversationId: string = this.conversationId) : AsyncGenerator<Activity> {
    const conversationAccount: ConversationAccount = {
      id: conversationId
    }
    const activityObj = {
      type: 'message',
      text: question,
      conversation: conversationAccount
    }
    const activity = Activity.fromObject(activityObj)

    yield * this.sendActivity(activity)
  }

  /**
   * Sends an activity to the Copilot Studio service and retrieves the response activities.
   * @param activity The activity to send.
   * @param conversationId The ID of the conversation. Defaults to the current conversation ID.
   * @returns An async generator yielding the Agent's Activities.
   */
  public async * sendActivity (activity: Activity, conversationId: string = this.conversationId) : AsyncGenerator<Activity> {
    const localConversationId = activity.conversation?.id ?? conversationId
    const uriExecute = getCopilotStudioConnectionUrl(this.settings, localConversationId)
    const qbody: ExecuteTurnRequest = new ExecuteTurnRequest(activity)

    logger.info('Sending activity...', activity)
    yield * this.postRequestAsync(uriExecute, qbody, 'POST')
  }
}
