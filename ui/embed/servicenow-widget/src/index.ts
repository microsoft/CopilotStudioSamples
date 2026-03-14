import { createBubble } from './bubble'
import type { CopilotChatConfig } from './config'

export type { CopilotChatConfig } from './config'

let initialized = false

/**
 * Initialize the Copilot Chat floating bubble.
 * @param container - DOM element to attach the bubble to (typically document.body)
 * @param config - Agent connection settings and UI options
 */
export function init(container: HTMLElement, config: CopilotChatConfig): void {
  if (initialized) {
    console.warn('CopilotChat.init() already called — ignoring duplicate')
    return
  }

  const required: (keyof CopilotChatConfig)[] = [
    'environmentId',
    'agentIdentifier',
    'tenantId',
    'appClientId',
  ]
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`CopilotChat.init: missing required config "${key}"`)
    }
  }

  initialized = true
  createBubble(container, config)
}
