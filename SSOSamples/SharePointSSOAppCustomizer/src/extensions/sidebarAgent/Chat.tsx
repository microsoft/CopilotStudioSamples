import * as React from 'react';
import { useEffect, useState } from 'react';
import { Components } from 'botframework-webchat';
import { FluentThemeProvider } from 'botframework-webchat-fluent-theme';
import { ConnectionSettings, CopilotStudioClient, CopilotStudioWebChat, CopilotStudioWebChatConnection } from '@microsoft/agents-copilotstudio-client';
import { acquireToken } from './acquireToken';

const { BasicWebChat, Composer } = Components;

export interface IChatProps {
  appClientId: string;
  tenantId: string;
  environmentId: string;
  agentIdentifier: string;
  directConnectUrl?: string;
  showTyping?: boolean;
  currentUserLogin?: string;
}

export const Chat: React.FC<IChatProps> = (props: IChatProps) => {
  const { appClientId, tenantId, environmentId, agentIdentifier, directConnectUrl, showTyping, currentUserLogin } = props;
  const [connection, setConnection] = useState<CopilotStudioWebChatConnection | null>(null);
  const [error, setError] = useState<string | undefined>();

  const ready = appClientId && tenantId && environmentId && agentIdentifier;

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    const init = async (): Promise<void> => {
      const token = await acquireToken({ appClientId, tenantId, currentUserLogin });
      if (!token) {
        setError('Unable to acquire token.');
        return;
      }
      const settings = new ConnectionSettings({
        appClientId,
        tenantId,
        environmentId,
        agentIdentifier,
        directConnectUrl
      });
      const client = new CopilotStudioClient(settings, token);
      const webchatSettings = { showTyping: showTyping !== false };
      if (!cancelled) {
        setConnection(CopilotStudioWebChat.createConnection(client, webchatSettings));
      }
    };
    init().catch((e: unknown) => {
      if (!cancelled) {
        // eslint-disable-next-line no-console
        console.error(e);
        const message = e instanceof Error ? e.message : 'Unknown error initialising chat';
        setError(message);
      }
    });
    return () => { cancelled = true; };
  }, [ready, appClientId, tenantId, environmentId, agentIdentifier, directConnectUrl, showTyping, currentUserLogin]);

  if (!ready) {
    return <div style={{ padding: 16 }}>Configure appClientId, tenantId, environmentId and agentIdentifier in the manifest properties.</div>;
  }
  if (error) {
    return <div style={{ padding: 16, color: 'red' }}>Error: {error}</div>;
  }
  if (!connection) {
    return <div style={{ padding: 16 }}>Connecting to Copilot...</div>;
  }
  return (
    <FluentThemeProvider>
      <Composer 
        directLine={connection}
        styleOptions={{
          rootHeight: '100%',
          rootWidth: '100%'
        }}
      >
        <BasicWebChat />
      </Composer>
    </FluentThemeProvider>
  );
};

export default Chat;
