export interface ISidebarAgentApplicationCustomizerProperties {
  appClientId: string;
  tenantId: string;
  environmentId?: string;
  agentIdentifier?: string;
  directConnectUrl?: string;
  showTyping?: boolean;
  headerBackgroundColor?: string;
  agentTitle?: string;
}

export interface ISidebarAgentState {
  isPanelOpen: boolean;
  currentUserLogin?: string;
  chatKey: number;
}

export interface ISidePanelProps {
  isOpen: boolean;
  properties: ISidebarAgentApplicationCustomizerProperties;
  currentUserLogin?: string;
  onDismiss: () => void;
  onNewConversation: () => void;
  chatKey: number;
}