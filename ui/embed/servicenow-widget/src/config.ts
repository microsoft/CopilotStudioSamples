export interface CopilotChatConfig {
  // Agent connection (required)
  environmentId: string
  agentIdentifier: string
  tenantId: string
  appClientId: string
  cloud?: string

  // UI customization (optional)
  headerTitle?: string
  bubbleColor?: string
  headerColor?: string
  panelWidth?: string
  panelHeight?: string
  position?: 'bottom-right' | 'bottom-left'
  zIndex?: number
  debug?: boolean

  // WebChat styleOptions passthrough
  styleOptions?: Record<string, unknown>

  // Auth
  redirectUri?: string
}

export const DEFAULT_CONFIG = {
  cloud: 'Prod',
  headerTitle: 'Chat with us',
  bubbleColor: '#1b3e4f',
  headerColor: '#1b3e4f',
  panelWidth: '420px',
  panelHeight: '600px',
  position: 'bottom-right' as const,
  zIndex: 9999,
  debug: false,
}
