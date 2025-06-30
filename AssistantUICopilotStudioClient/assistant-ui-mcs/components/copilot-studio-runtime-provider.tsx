"use client";

import { useEffect, useState, ReactNode, useRef, useCallback, useMemo } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  AppendMessage,
  ThreadMessageLike,
  ExternalStoreThreadData,
  ExternalStoreThreadListAdapter
} from "@assistant-ui/react";
import { acquireToken } from "@/lib/auth";
import { settings } from "@/lib/settings";
import {
  CopilotStudioClient,
} from "@microsoft/agents-copilotstudio-client";
import {
  ActivityTypes
} from "@microsoft/agents-activity";

const DEFAULT_THREAD_ID = "default";
const ERROR_MESSAGES = {
  CLIENT_NOT_INITIALIZED: "Client not initialized",
  CONVERSATION_FAILED: "Failed to create conversation for this thread",
  NO_RESPONSE: "No response received from the agent.",
  GENERAL_ERROR: "⚠️ Something went wrong while processing your request.",
  CONNECTION_ERROR: "⚠️ Failed to connect to Copilot Studio. Please try refreshing the page.",
  CONVERSATION_START_ERROR: "⚠️ Failed to start a new conversation. Please try again."
};

interface MyMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Converts internal message format to Assistant UI compatible format
 * @param message The internal message representation
 * @returns ThreadMessageLike object compatible with Assistant UI
 */
const convertMessage = (message: MyMessage): ThreadMessageLike => {
  return {
    role: message.role,
    content: [{ type: "text", text: message.content }],
  };
};

/**
 * Provider component that integrates Copilot Studio with Assistant UI
 * Manages conversation state and handles communication with the Copilot Studio Chat API
 */
export function CopilotStudioRuntimeProvider({ children }: { children: ReactNode }) {
  // State definitions
  // Thread state management
  const [currentThreadId, setCurrentThreadId] = useState<string>(DEFAULT_THREAD_ID);
  const [threads, setThreads] = useState<Map<string, MyMessage[]>>(
    new Map([[DEFAULT_THREAD_ID, []]])
  );
  const [conversationIds, setConversationIds] = useState<Map<string, string>>(
    new Map()
  );

  // Client state
  const [isRunning, setIsRunning] = useState(false);
  const clientRef = useRef<CopilotStudioClient | null>(null);
  const clientInitializing = useRef<boolean>(false);
  const clientInitialized = useRef<boolean>(false);
  const defaultThreadInitialized = useRef(false);
  
  // Thread UI state
  const [regularThreads, setRegularThreads] = useState<ExternalStoreThreadData<"regular">[]>([
    { threadId: DEFAULT_THREAD_ID, status: "regular", title: "New Chat" },
  ]);
  const [archivedThreads, setArchivedThreads] = useState<ExternalStoreThreadData<"archived">[]>([]);

  // Helper to add messages to a thread
  const addMessageToThread = useCallback((threadId: string, message: MyMessage) => {
    setThreads(prev => {
      const threadMessages = prev.get(threadId) || [];
      const newMessages = [...threadMessages, message];
      return new Map(prev).set(threadId, newMessages);
    });
  }, []);
  
  // Initialize a new conversation for a thread
  const initializeConversationForThread = useCallback(async (threadId: string) => {
    if (!clientRef.current || !clientInitialized.current) {
      return null;
    }

    try {
      console.log(`Starting new conversation for thread ${threadId}...`);
      
      // Start a new conversation
      const activity = await clientRef.current.startConversationAsync(true);
      
      // Extract conversation ID
      let conversationId: string | null = null;
      if (activity.conversation?.id) {
        conversationId = activity.conversation.id;
        console.log(`Conversation ID for thread ${threadId}:`, conversationId);
        
        // Store the conversation ID for this thread
        setConversationIds(prev => new Map(prev).set(threadId, conversationId as string));
      }
      
      // Handle welcome message if present
      if (activity.type === ActivityTypes.Message && activity.text) {
        addMessageToThread(threadId, { 
          role: "assistant", 
          content: activity.text 
        });
      }
      
      if (!conversationId) {
        throw new Error("Failed to get conversation ID");
      }
      
      return conversationId;
    } catch (error) {
      console.error(`Error initializing conversation for thread ${threadId}:`, error);
      addMessageToThread(threadId, { 
        role: "assistant", 
        content: ERROR_MESSAGES.CONVERSATION_START_ERROR 
      });
      return null;
    }
  }, [addMessageToThread, setConversationIds]);

  // Client initialization with default thread handling
  useEffect(() => {
    const initClientAndDefaultThread = async () => {
      // Skip if already initializing or initialized
      if (clientInitializing.current || clientInitialized.current) return;
      clientInitializing.current = true;
      
      try {
        console.log("Initializing Copilot Studio client...");
        const token = await acquireToken();
        console.log("Token acquired successfully");

        const copilotClient = new CopilotStudioClient(settings, token);
        clientRef.current = copilotClient;
        clientInitialized.current = true;
        console.log("Copilot Studio client created successfully");
        
        // Now that client is initialized, set up default thread (only once)
        if (!defaultThreadInitialized.current && !conversationIds.has(DEFAULT_THREAD_ID)) {
          console.log("Initializing default thread conversation");
          defaultThreadInitialized.current = true;
          await initializeConversationForThread(DEFAULT_THREAD_ID);
        }
      } catch (error) {
        console.error("Failed to initialize Copilot Studio client:", error);
        addMessageToThread(DEFAULT_THREAD_ID, { 
          role: "assistant", 
          content: ERROR_MESSAGES.CONNECTION_ERROR 
        });
      } finally {
        clientInitializing.current = false;
      }
    };

    initClientAndDefaultThread();
  }, [addMessageToThread, initializeConversationForThread, conversationIds]);

  // Use memoization for thread list adapter to avoid unnecessary re-renders
  const threadListAdapter = useMemo<ExternalStoreThreadListAdapter>(() => {
    // Create the adapter object
    const adapter: ExternalStoreThreadListAdapter = {
      threadId: currentThreadId,
      threads: regularThreads,
      archivedThreads: archivedThreads,

      onSwitchToNewThread: async () => {
        const newThreadId = `thread-${Date.now()}`;
        
        // Update UI first for responsiveness
        setRegularThreads(prev => [
          ...prev,
          { threadId: newThreadId, status: "regular", title: "New Chat" }
        ]);
        
        setThreads(prev => new Map(prev).set(newThreadId, []));
        setCurrentThreadId(newThreadId);
        
        // Then initialize the conversation for this thread
        await initializeConversationForThread(newThreadId);
      },

      onSwitchToThread: (threadId) => {
        setCurrentThreadId(threadId);
      },

      onRename: (threadId, newTitle) => {
        // Update title in regular threads
        setRegularThreads(prev =>
          prev.map(t =>
            t.threadId === threadId ? { ...t, title: newTitle } : t
          )
        );
        
        // Also update in archived threads if present
        setArchivedThreads(prev =>
          prev.map(t =>
            t.threadId === threadId ? { ...t, title: newTitle } : t
          )
        );
      },

      onArchive: (threadId) => {
        // Instead of using this.onDelete, directly implement the delete functionality
        // Remove from both thread lists
        setRegularThreads(prev => prev.filter(t => t.threadId !== threadId));
        setArchivedThreads(prev => prev.filter(t => t.threadId !== threadId));
        
        // Clean up thread data
        setThreads(prev => {
          const next = new Map(prev);
          next.delete(threadId);
          return next;
        });
        
        setConversationIds(prev => {
          const next = new Map(prev);
          next.delete(threadId);
          return next;
        });
        
        // Switch to default if archiving current thread
        if (currentThreadId === threadId) {
          setCurrentThreadId(DEFAULT_THREAD_ID);
        }
      },

      onDelete: (threadId) => {
        // Remove from both thread lists
        setRegularThreads(prev => prev.filter(t => t.threadId !== threadId));
        setArchivedThreads(prev => prev.filter(t => t.threadId !== threadId));
        
        // Clean up thread data
        setThreads(prev => {
          const next = new Map(prev);
          next.delete(threadId);
          return next;
        });
        
        setConversationIds(prev => {
          const next = new Map(prev);
          next.delete(threadId);
          return next;
        });
        
        // Switch to default if deleting current thread
        if (currentThreadId === threadId) {
          setCurrentThreadId(DEFAULT_THREAD_ID);
        }
      }
    };
    
    return adapter;
  }, [
    currentThreadId,
    regularThreads,
    archivedThreads,
    setCurrentThreadId,
    initializeConversationForThread,
    setRegularThreads,
    setArchivedThreads,
    setThreads,
    setConversationIds
  ]);

  // Handle new message submission
  const onNew = useCallback(async (message: AppendMessage) => {
    if (message.content[0]?.type !== "text") {
      throw new Error("Only text messages are supported");
    }

    const input = message.content[0].text;
    addMessageToThread(currentThreadId, { role: "user", content: input });

    setIsRunning(true);
    try {
      if (!clientRef.current) {
        throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
      }

      // Get or create conversation ID for current thread
      let threadConversationId = conversationIds.get(currentThreadId);
      
      // If no conversation exists for this thread, create one
      if (!threadConversationId) {
        console.log(`No conversation ID for thread ${currentThreadId}, creating new conversation`);
        const newConversationId = await initializeConversationForThread(currentThreadId);
        
        if (!newConversationId) {
          throw new Error(ERROR_MESSAGES.CONVERSATION_FAILED);
        }
        
        threadConversationId = newConversationId;
      }

      console.log(`Sending message for thread ${currentThreadId} with conversation ID ${threadConversationId}: "${input}"`);
      
      // Send the message to the conversation
      const activities = await clientRef.current.askQuestionAsync(input, threadConversationId);

      let receivedMessage = false;
      for (const activity of activities) {
        console.log(`Received activity: ${activity.type}`, activity);
        if (activity.type === ActivityTypes.Message && activity.text) {
          addMessageToThread(currentThreadId, { 
            role: "assistant", 
            content: activity.text 
          });
          receivedMessage = true;
        }
      }

      if (!receivedMessage) {
        addMessageToThread(currentThreadId, { 
          role: "assistant", 
          content: ERROR_MESSAGES.NO_RESPONSE 
        });
      }
    } catch (err) {
      console.error("Error during conversation:", err);
      addMessageToThread(currentThreadId, { 
        role: "assistant", 
        content: ERROR_MESSAGES.GENERAL_ERROR 
      });
    } finally {
      setIsRunning(false);
    }
  }, [currentThreadId, conversationIds, addMessageToThread, initializeConversationForThread]);

  // Get current thread messages with memoization
  const currentMessages = useMemo(() => 
    threads.get(currentThreadId) || [], 
    [threads, currentThreadId]
  );

  // Create runtime object with memoization
  const runtime = useExternalStoreRuntime({
    isRunning,
    messages: currentMessages,
    convertMessage,
    onNew,
    adapters: {
      threadList: threadListAdapter
    }
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

// For convenience, keep the CopilotStudioChat export with the same API
export function CopilotStudioChat({ children }: { children: ReactNode }) {
  return (
    <CopilotStudioRuntimeProvider>
      {children}
    </CopilotStudioRuntimeProvider>
  );
}
