import * as React from "react";
import { useEffect, useState } from "react";
import { Components, createStore, ReactWebChat } from "botframework-webchat";
import { FluentThemeProvider } from "botframework-webchat-fluent-theme";

import {
  ConnectionSettings,
  CopilotStudioClient,
  CopilotStudioWebChat,
  CopilotStudioWebChatConnection,
} from "@microsoft/agents-copilotstudio-client";
import { acquireToken } from "./acquireToken";

const { BasicWebChat, Composer } = Components;

// Style constants
const COLORS = {
  white: "white",
  text: "#323130",
  border: "#605e5c",
  shadow: "rgba(0, 0, 0, 0.06)",
  warningText: "#8a6d3b",
  warningBg: "#fcf8e3",
  errorText: "#a94442",
  errorBg: "#f2dede",
} as const;

// Height offset constants for chat container calculations
const CHAT_HEIGHT_OFFSET_WITH_STYLES = 120; // px - accounts for header + padding
const CHAT_HEIGHT_OFFSET_DEFAULT = 60; // px - accounts for header

// Style functions and objects
const headerContainerStyle = (width: string): React.CSSProperties => ({
  height: "50px",
  width,
  background: COLORS.white,
  borderRadius: "12px",
  padding: "4px 4px 4px 4px",
  boxShadow: `0 2px 8px ${COLORS.shadow}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  boxSizing: "border-box",
});

const headerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: COLORS.text,
  paddingLeft: "8px",
};

const buttonContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  paddingRight: "8px",
};

const newChatButtonStyle: React.CSSProperties = {
  background: "none",
  border: `1px solid ${COLORS.border}`,
  cursor: "pointer",
  padding: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  color: COLORS.border,
  borderRadius: "4px",
  transition: "all 0.2s ease",
};

const outerContainerWithStylesStyle = (chatHeight: string | number | undefined, chatWidth: string | number | undefined): React.CSSProperties => ({
  height: chatHeight,
  width: chatWidth,
  gap: "8px",
  display: "flex",
  flexDirection: "column",
  padding: "16px 24px",
});

const outerContainerDefaultStyle = (chatHeight: string | number | undefined, chatWidth: string | number | undefined): React.CSSProperties => ({
  height: chatHeight,
  width: `calc(${chatWidth} - 16px)`,
  paddingLeft: "8px",
  gap: "8px",
  display: "flex",
  flexDirection: "column",
});

const innerContainerDefaultStyle = (chatHeight: string | number | undefined, chatWidth: string | number | undefined): React.CSSProperties => ({
  height: `calc(${chatHeight} - ${CHAT_HEIGHT_OFFSET_DEFAULT}px)`,
  width: chatWidth,
  minHeight: "400px",
  minWidth: "200px",
  textAlign: "left",
});

type ChatMessageType = "info" | "warning" | "error";

const chatMessageStyles: Record<ChatMessageType, React.CSSProperties> = {
  info: { padding: 16 },
  warning: { padding: 16, color: COLORS.warningText, backgroundColor: COLORS.warningBg },
  error: { padding: 16, color: COLORS.errorText, backgroundColor: COLORS.errorBg },
};

export interface IChatProps {
  chatKey?: number;
  agentTitle?: string;
  appClientId: string;
  tenantId: string;
  environmentId?: string;
  agentIdentifier?: string;
  directConnectUrl?: string;
  showTyping?: boolean;
  disableFileUploadButton?: boolean;
  currentUserLogin?: string;
  baseUrl?: string;
  styleOptions?: string;
  width?: string | number;
  height?: string | number;
  onAgentMessageUpdate?: (message: string) => void;
  onConversationIdUpdate?: (conversationId: string) => void;
  onNewConversation?: () => void;
}

export interface ChatRef {
  sendMessage: (text: string) => void;
  sendEvent: (name: string, value?: unknown) => void;
  updateAgentMessage: (message: string) => void;
}

interface ChatHeaderProps {
  displayTitle: string;
  onNewConversation?: () => void;
  width: string;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  displayTitle,
  onNewConversation,
  width,
}) => (
  <div style={headerContainerStyle(width)}>
    <h3 style={headerTitleStyle}>{displayTitle}</h3>
    <div style={buttonContainerStyle}>
      <button
        style={newChatButtonStyle}
        aria-label="Start new conversation"
        onClick={onNewConversation}
        title="Start new conversation"
      >
        <span>
          <NewChatIcon />
        </span>
        &nbsp;New chat
      </button>
    </div>
  </div>
);

const Chat = React.forwardRef<ChatRef, IChatProps>(
  (
    {
      agentTitle,
      appClientId,
      tenantId,
      environmentId,
      agentIdentifier,
      directConnectUrl,
      showTyping = true,
      disableFileUploadButton,
      currentUserLogin,
      baseUrl,
      width,
      height,
      styleOptions,
      onAgentMessageUpdate,
      onConversationIdUpdate,
      onNewConversation,
    },
    ref
  ) => {
    const [connection, setConnection] =
      useState<CopilotStudioWebChatConnection | null>(null);
    const [error, setError] = useState<string>();
    const [store] = useState(() => createStore());
    const [lastConversationId, setLastConversationId] = useState<string | null>(
      null
    );

    // Use "Agent" as default if agentTitle is not provided
    const displayTitle = agentTitle || "Agent";

    // Set up store listener for dispatched actions
    useEffect(() => {
      const unsubscribe = store.subscribe(() => {
        const state = store.getState();

        const connectivityStatus = state.connectivityStatus;
        if (connectivityStatus === "connected") {
          const lastActivity = state.activities?.[state.activities.length - 1];
          if (
            lastActivity?.type === "message" &&
            lastActivity.from?.role === "bot"
          ) {
            // Check for conversation ID changes
            const currentConversationId = lastActivity.conversation?.id;
            if (
              currentConversationId &&
              currentConversationId !== lastConversationId
            ) {
              setLastConversationId(currentConversationId);
              if (onConversationIdUpdate) {
                onConversationIdUpdate(currentConversationId);
              }
            }
            const activityMessage = lastActivity.text;
            if (activityMessage && onAgentMessageUpdate) {
              onAgentMessageUpdate(activityMessage);

            }
          }
        }
      });

      return () => {
        unsubscribe();
      };
    }, [
      store,
      onAgentMessageUpdate,
      onConversationIdUpdate,
      lastConversationId,
    ]);

    const chatWidth = typeof width === "number" ? `${width}px` : width;
    const chatHeight = typeof height === "number" ? `${height}px` : height;

    const isConfigured =
      appClientId &&
      tenantId &&
      (directConnectUrl || (environmentId && agentIdentifier));
    useEffect(() => {
      if (!isConfigured) return;

      let cancelled = false;

      const initializeConnection = async (): Promise<void> => {
        try {
          const token = await acquireToken({
            appClientId,
            tenantId,
            currentUserLogin,
            redirectUri: baseUrl,
          });

          if (!token) {
            setError("Unable to acquire token.");
            return;
          }

          const settings = new ConnectionSettings({
            appClientId,
            tenantId,
            environmentId: environmentId || "",
            agentIdentifier: agentIdentifier || "",
            directConnectUrl: directConnectUrl || "",
          });

          const clientInstance = new CopilotStudioClient(settings, token);
          const webchatSettings = { showTyping };

          if (!cancelled) {
            const connectionInstance =
              await CopilotStudioWebChat.createConnection(
                clientInstance,
                webchatSettings
              );

            try {
              setConnection(connectionInstance);
            } catch (error) {
              console.error("Error setting connection:", error);
              setError("Failed to establish connection");
            }

          }
        } catch (e) {
          if (!cancelled) {
            console.error("Chat initialization error:", e);
            setError(
              e instanceof Error ? e.message : "Unknown error initializing chat"
            );
          }
        }
      };

      initializeConnection();

      return () => {
        cancelled = true;
      };
    }, [
      isConfigured,
      appClientId,
      tenantId,
      environmentId,
      agentIdentifier,
      directConnectUrl,
      showTyping,
      disableFileUploadButton,
      currentUserLogin,
      baseUrl,
      styleOptions,
      width,
      height,
    ]);

    React.useImperativeHandle(
      ref,
      () => ({
        sendMessage: (text: string) => {
          store.dispatch({
            type: "WEB_CHAT/SEND_MESSAGE",
            payload: { text },
          });
        },
        sendEvent: (name: string, value?: unknown) => {
          store.dispatch({
            type: "WEB_CHAT/SEND_EVENT",
            payload: { name, value },
          });
        },
        updateAgentMessage: (message: string) => {
          if (onAgentMessageUpdate) {
            onAgentMessageUpdate(message);
          }
        },
      }),
      [store, onAgentMessageUpdate, onConversationIdUpdate, onNewConversation]
    );

    if (!isConfigured) {
      return (
        <ChatMessage type="warning">
          Configure appClientId, tenantId, and either directConnectUrl or
          (environmentId and agentIdentifier) in the manifest properties.
        </ChatMessage>
      );
    }

    if (error) {
      return <ChatMessage type="error">Error: {error}</ChatMessage>;
    }

    if (!connection) {
      return <ChatMessage>Connecting to Copilot Studio...</ChatMessage>;
    }

    if (styleOptions && styleOptions !== "val") {
      return (
        <div style={outerContainerWithStylesStyle(chatHeight, chatWidth)}>
          <ChatHeader
            displayTitle={displayTitle}
            onNewConversation={onNewConversation}
            width="100%"
          />
          <div style={{ height: `calc(${chatHeight} - ${CHAT_HEIGHT_OFFSET_WITH_STYLES}px)`, width: "95%" }}>
            <ReactWebChat
              directLine={connection}
              store={store}
              styleOptions={JSON.parse(styleOptions)}
            ></ReactWebChat>
          </div>
        </div>
      );
    } else {
      return (
        <div id="chatContainer" style={outerContainerDefaultStyle(chatHeight, chatWidth)}>
          <ChatHeader
            displayTitle={displayTitle}
            onNewConversation={onNewConversation}
            width="100%"
          />
          <div style={innerContainerDefaultStyle(chatHeight, chatWidth)}>
            <FluentThemeProvider fontSize="14px">
              <Composer
                directLine={connection}
                store={store}
                styleOptions={{
                  rootHeight: "100%",
                  rootWidth: "100%",
                  disableFileUpload: disableFileUploadButton,
                  bubbleFromUserMaxWidth: "80%",
                  bubbleMaxWidth: "80%",
                  bubbleFromUserNubOffset: "0",
                  bubbleNubOffset: "0",
                }}
              >
                <BasicWebChat />
              </Composer>
            </FluentThemeProvider>
          </div>
        </div>
      );
    }
  }
);

interface ChatMessageProps {
  children: React.ReactNode;
  type?: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  children,
  type = "info",
}) => {
  return <div style={chatMessageStyles[type]}>{children}</div>;
};

export default Chat;

const NewChatIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10.5 2C15.1944 2 19 5.80558 19 10.5C19 15.1944 15.1944 19 10.5 19C8.76472 19 7.11922 18.4543 5.75373 17.4816L2.49213 18.5078C2.08002 18.6317 1.65087 18.4024 1.52705 17.9903C1.48179 17.8421 1.48179 17.6842 1.52705 17.536L2.5527 14.2752C1.57831 12.9086 1.0317 11.2612 1.0317 9.52322C1.08606 5.05327 4.99567 1.31044 9.46027 1.03543C9.80475 1.01197 10.1513 1 10.5 1V2ZM10.5 3C6.35786 3 3 6.35786 3 10.5C3 11.8905 3.38968 13.1911 4.06306 14.2901C4.14846 14.4308 4.20128 14.5899 4.21725 14.7554C4.23321 14.9209 4.21188 15.0886 4.15513 15.2446L3.45116 17.3484L5.55498 16.6445C5.86607 16.5406 6.20598 16.5808 6.48684 16.7547C7.58156 17.4263 8.87622 17.8142 10.2598 17.8142H10.5C14.6421 17.8142 18 14.4563 18 10.3142V10.186C17.8591 6.33426 14.9119 3.21269 11.0732 3.00673C10.8831 2.99556 10.692 2.99 10.5 2.99V3ZM10.5 5.5C10.7761 5.5 11 5.72386 11 6V9.5H14.5C14.7761 9.5 15 9.72386 15 10C15 10.2761 14.7761 10.5 14.5 10.5H11V14C11 14.2761 10.7761 14.5 10.5 14.5C10.2239 14.5 10 14.2761 10 14V10.5H6.5C6.22386 10.5 6 10.2761 6 10C6 9.72386 6.22386 9.5 6.5 9.5H10V6C10 5.72386 10.2239 5.5 10.5 5.5Z"
      fill="currentColor"
    />
  </svg>
);
