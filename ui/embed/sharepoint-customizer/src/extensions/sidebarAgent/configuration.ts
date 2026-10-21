import { ISidebarAgentApplicationCustomizerProperties, IStarterPrompt } from './models/ISidebarAgentProperties';

export const DEFAULT_STARTER_PROMPTS: IStarterPrompt[] = [
  { title: 'Get started', text: 'What can you help me with?' }
];

export interface ChatConfiguration {
  appClientId: string;
  tenantId: string;
  environmentId?: string;
  schemaName?: string;
  directConnectUrl?: string;
  startConversation: boolean;
  showTyping: boolean;
  enableFileUpload: boolean;
  showReasoning: boolean;
  showToolCalls: boolean;
  starterPrompts: IStarterPrompt[];
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('Connection settings must be strings.');
  return value.trim() || undefined;
}

function flag(value: unknown, fallback: boolean, name: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new Error(`${name} must be true or false (not a string).`);
  return value;
}

function starterPrompts(value: unknown): IStarterPrompt[] {
  if (value === undefined) return DEFAULT_STARTER_PROMPTS.map(prompt => ({ ...prompt }));
  if (!Array.isArray(value)) throw new Error('starterPrompts must be an array of { title, text } objects.');
  return value.map(prompt => {
    if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt) ||
        Object.keys(prompt).some(key => key !== 'title' && key !== 'text') ||
        typeof prompt.title !== 'string' || !prompt.title.trim() ||
        typeof prompt.text !== 'string' || !prompt.text.trim()) {
      throw new Error('Each starter prompt must contain only a non-empty title and text.');
    }
    return { title: prompt.title.trim(), text: prompt.text.trim() };
  });
}

export function normalizeConfiguration(properties: ISidebarAgentApplicationCustomizerProperties): ChatConfiguration {
  const appClientId = optionalText(properties.appClientId);
  const tenantId = optionalText(properties.tenantId);
  const environmentId = optionalText(properties.environmentId);
  const schemaName = optionalText(properties.schemaName) || optionalText(properties.agentIdentifier);
  const directConnectUrl = optionalText(properties.directConnectUrl);
  if (!appClientId || !tenantId) throw new Error('Configure appClientId and tenantId for Microsoft sign-in.');
  if (!directConnectUrl && (!environmentId || !schemaName)) {
    throw new Error('Configure environmentId and schemaName for endpoint discovery, or an explicit directConnectUrl.');
  }
  if (directConnectUrl) {
    const url = new URL(directConnectUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
      throw new Error('directConnectUrl must be an HTTPS URL without credentials or a fragment.');
    }
  }
  return {
    appClientId, tenantId, environmentId, schemaName, directConnectUrl,
    startConversation: flag(properties.startConversation, false, 'startConversation'),
    showTyping: flag(properties.showTyping, true, 'showTyping'),
    enableFileUpload: flag(properties.enableFileUpload, true, 'enableFileUpload'),
    showReasoning: flag(properties.showReasoning, false, 'showReasoning'),
    showToolCalls: flag(properties.showToolCalls, false, 'showToolCalls'),
    starterPrompts: starterPrompts(properties.starterPrompts)
  };
}
