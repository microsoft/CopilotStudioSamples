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
  environmentId?: string;
  agentIdentifier?: string;
  directConnectUrl?: string;
  showTyping?: boolean;
  currentUserLogin?: string;
  baseUrl?: string;  // Add this line
}

const Chat: React.FC<IChatProps> = ({
  appClientId,
  tenantId,
  environmentId,
  agentIdentifier,
  directConnectUrl,
  showTyping = true,
  currentUserLogin,
  baseUrl  // Add this parameter
}) => {
  const [connection, setConnection] = useState<CopilotStudioWebChatConnection | null>(null);
  const [error, setError] = useState<string>();

  const isConfigured = appClientId && tenantId && (directConnectUrl || (environmentId && agentIdentifier));

  useEffect(() => {
    if (!isConfigured) return;

    let cancelled = false;

    const initializeConnection = async (): Promise<void> => {
      try {
        const token = await acquireToken({ 
          appClientId, 
          tenantId, 
          currentUserLogin,
          redirectUri: baseUrl  // Pass baseUrl as redirectUri
        });
        
        if (!token) {
          setError('Unable to acquire token.');
          return;
        }

        const settings = new ConnectionSettings({
          appClientId,
          tenantId,
          environmentId: environmentId || '',
          agentIdentifier: agentIdentifier || '',
          directConnectUrl: directConnectUrl || ''
        });

        const client = new CopilotStudioClient(settings, token);
        const webchatSettings = { showTyping };

        if (!cancelled) {
          setConnection(CopilotStudioWebChat.createConnection(client, webchatSettings));
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Chat initialization error:', e);
          setError(e instanceof Error ? e.message : 'Unknown error initializing chat');
        }
      }
    };

    initializeConnection();

    return () => { 
      cancelled = true; 
    };
  }, [isConfigured, appClientId, tenantId, environmentId, agentIdentifier, directConnectUrl, showTyping, currentUserLogin, baseUrl]); // Add baseUrl to dependencies

  if (!isConfigured) {
    return (
      <ChatMessage type="warning">
        Configure appClientId, tenantId, and either directConnectUrl or (environmentId and agentIdentifier) in the manifest properties.
      </ChatMessage>
    );
  }

  if (error) {
    return <ChatMessage type="error">Error: {error}</ChatMessage>;
  }

  if (!connection) {
    return <ChatMessage>Connecting to Copilot Studio...</ChatMessage>;
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

interface ChatMessageProps {
  children: React.ReactNode;
  type?: 'info' | 'warning' | 'error';
}

const ChatMessage: React.FC<ChatMessageProps> = ({ children, type = 'info' }) => {
  const styles = {
    info: { padding: 16 },
    warning: { padding: 16, color: '#8a6d3b', backgroundColor: '#fcf8e3' },
    error: { padding: 16, color: '#a94442', backgroundColor: '#f2dede' }
  };

  return <div style={styles[type]}>{children}</div>;
};

export default Chat;
