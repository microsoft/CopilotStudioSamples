export interface IStarterPrompt {
  title: string;
  text: string;
}

export interface ISidebarAgentApplicationCustomizerProperties {
  appClientId: string;
  tenantId: string;
  environmentId?: string;
  schemaName?: string;
  /** Compatibility alias for schemaName. */
  agentIdentifier?: string;
  directConnectUrl?: string;
  startConversation?: boolean;
  showTyping?: boolean;
  enableFileUpload?: boolean;
  showReasoning?: boolean;
  showToolCalls?: boolean;
  starterPrompts?: IStarterPrompt[];
  headerBackgroundColor?: string;
  agentTitle?: string;
}

export interface ISidebarAgentState {
  isPanelOpen: boolean;
  currentUserLogin?: string;
  chatKey: number;
  hasOpened: boolean;
}

export interface ISidePanelProps {
  isOpen: boolean;
  properties: ISidebarAgentApplicationCustomizerProperties;
  currentUserLogin?: string;
  baseUrl?: string;
  onDismiss: () => void;
  onNewConversation: () => void;
  chatKey: number;
}