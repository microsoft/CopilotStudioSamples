import {
  ConnectionSettings,
  CopilotStudioClient,
  CopilotStudioWebChat,
} from '@microsoft/agents-copilotstudio-client'
import { acquireToken } from './auth'
import type { CopilotChatConfig } from './config'

// WebChat is loaded via CDN — reference as global
declare const WebChat: {
  renderWebChat: (options: Record<string, unknown>, element: HTMLElement) => void
  createStore: (
    initialState: Record<string, unknown>,
    middleware: (store: unknown) => (next: (action: unknown) => unknown) => (action: unknown) => unknown
  ) => unknown
}

export type StatusCallback = (status: 'authenticating' | 'connecting' | 'rendering' | 'connected' | 'error') => void

export interface ChatHandle {
  end: () => void
  refresh: () => Promise<void>
}

export async function initChat(
  container: HTMLElement,
  config: CopilotChatConfig,
  onStatus?: StatusCallback
): Promise<ChatHandle> {
  const settings = new ConnectionSettings({
    environmentId: config.environmentId,
    agentIdentifier: config.agentIdentifier,
    tenantId: config.tenantId,
    appClientId: config.appClientId,
    cloud: config.cloud || 'Prod',
  })

  if (config.debug) {
    window.localStorage.debug = 'copilot-studio:*'
  }

  onStatus?.('authenticating')
  const token = await acquireToken(settings, config.redirectUri)

  onStatus?.('connecting')
  const client = new CopilotStudioClient(settings, token)

  const styleOptions = {
    // Hide upload
    hideUploadButton: true,

    // Avatars
    botAvatarInitials: 'AI',
    botAvatarBackgroundColor: '#1b3e4f',
    userAvatarInitials: 'Me',
    userAvatarBackgroundColor: '#62717b',

    // Bubble styles — bot messages
    bubbleBackground: '#f1f3f5',
    bubbleBorderColor: 'transparent',
    bubbleBorderRadius: 8,
    bubbleTextColor: '#2e3338',

    // Bubble styles — user messages
    bubbleFromUserBackground: '#1b3e4f',
    bubbleFromUserBorderColor: 'transparent',
    bubbleFromUserBorderRadius: 8,
    bubbleFromUserTextColor: '#ffffff',

    // Typography
    primaryFont: "'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",

    // Send box
    sendBoxBackground: '#ffffff',
    sendBoxTextColor: '#2e3338',
    sendBoxBorderTop: '1px solid #e0e0e0',
    sendBoxButtonColor: '#1b3e4f',
    sendBoxButtonColorOnHover: '#294d5e',
    sendBoxPlaceholderColor: '#8c959a',

    // Suggested actions
    suggestedActionBackgroundColor: '#ffffff',
    suggestedActionBorderColor: '#1b3e4f',
    suggestedActionTextColor: '#1b3e4f',
    suggestedActionBorderRadius: 16,

    // General
    rootHeight: '100%',
    backgroundColor: '#ffffff',
    timestampColor: '#8c959a',

    // User overrides
    ...config.styleOptions,
  }

  function render() {
    const directLine = CopilotStudioWebChat.createConnection(client, {
      showTyping: true,
    })
    const store = WebChat.createStore({}, () => (next) => (action) => next(action))

    WebChat.renderWebChat({ directLine, store, styleOptions }, container)
    onStatus?.('connected')
    return directLine
  }

  let directLine = render()

  return {
    end() {
      directLine.end()
    },
    async refresh() {
      directLine.end()
      directLine = render()
    },
  }
}
