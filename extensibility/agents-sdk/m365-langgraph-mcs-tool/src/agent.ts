import { ActivityTypes } from "@microsoft/agents-activity";
import {
  AgentApplication,
  MemoryStorage,
  TurnContext,
  TurnState,
} from "@microsoft/agents-hosting";
import { HumanMessage, AIMessageChunk } from "@langchain/core/messages";

import config from "./config";
import {
  createOrchestrator,
  McsToolContext,
  McsToolSharedState,
} from "./mcs";
import { logger } from "./logger";

// Custom conversation state for persisting MCS conversationId across turns
interface CustomConversationState {
  mcsConversationId?: string;
}

type AppTurnState = TurnState<CustomConversationState>;

class ProxyAgent extends AgentApplication<AppTurnState> {
  private readonly _graph: ReturnType<typeof createOrchestrator>;

  constructor() {
    // Validate required configuration
    if (!config.mcsEnvironmentId) {
      throw new Error("MCS_ENVIRONMENT_ID is not configured.");
    }
    if (!config.mcsSchemaName) {
      throw new Error("MCS_SCHEMA_NAME is not configured.");
    }
    if (!config.azureOpenAiEndpoint) {
      throw new Error("AZURE_OPENAI_ENDPOINT is not configured.");
    }

    super({
      storage: new MemoryStorage(),
      authorization: {
        MCS: {
          name: config.mcsConnectionName,
          title: "Sign in",
          text: "Please sign in to continue",
        },
      },
    });

    // Build the LangGraph orchestrator
    this._graph = createOrchestrator();

    logger.info(
      `ProxyAgent initialized with MCS connection: ${config.mcsConnectionName}`
    );

    this.onMessage("--signout", this._handleSignOut);
    this.onActivity(ActivityTypes.Message, this._handleMessage, ["MCS"]);
  }

  private _handleSignOut = async (
    context: TurnContext,
    turnState: AppTurnState
  ): Promise<void> => {
    try {
      await this.authorization.signOut(context, turnState, "MCS");
      logger.info("User signed out successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error signing out: ${errorMessage}`);
    }
    await context.sendActivity("You have signed out");
  };

  private _handleMessage = async (
    context: TurnContext,
    turnState: AppTurnState
  ): Promise<void> => {
    const userMessage = context.activity.text || "";
    logger.info(
      `Processing message (Activity ID: ${context.activity.id})`
    );
    logger.debug(`User message: ${userMessage}`);

    let streamEnded = false;

    try {
      context.streamingResponse.queueInformativeUpdate("Just a moment...");

      const mcsConversationId = turnState?.conversation?.mcsConversationId;

      // Shared mutable state — the tool writes to it, we read after graph completes
      const mcsSharedState: McsToolSharedState = {};

      // Build the configurable context injected into tool invocations.
      // Cast to Record<string, any> to satisfy LangGraph's configurable type constraint.
      const configurable: Record<string, any> = {
        mcsAuthorization: this.authorization as unknown as McsToolContext["mcsAuthorization"],
        mcsTurnContext: context,
        mcsStreamingResponse: context.streamingResponse,
        mcsConversationId,
        mcsSharedState,
      };

      // Stream graph execution: LLM tokens + tool calls
      const stream = await this._graph.stream(
        { messages: [new HumanMessage(userMessage)] },
        {
          configurable,
          streamMode: "messages",
        }
      );

      for await (const [messageChunk, metadata] of stream as AsyncGenerator<
        [AIMessageChunk, { langgraph_node: string }]
      >) {
        // Only forward LLM tokens from the "agent" node (not tool results)
        if (
          metadata?.langgraph_node === "agent" &&
          messageChunk?.content &&
          typeof messageChunk.content === "string"
        ) {
          // Check if this is a tool call message (no text content to stream)
          if (
            messageChunk.tool_calls &&
            messageChunk.tool_calls.length > 0
          ) {
            const toolNames = messageChunk.tool_calls
              .map((tc: { name?: string }) => tc.name)
              .join(", ");
            logger.debug(`LLM calling tools: ${toolNames}`);
            continue;
          }

          // Don't forward LLM's post-tool-call commentary if MCS already streamed.
          if (mcsSharedState.mcsStreamed) {
            logger.debug(
              "Skipping LLM post-tool commentary (MCS already streamed)"
            );
            continue;
          }

          // Forward LLM reasoning tokens to the user
          context.streamingResponse.queueTextChunk(messageChunk.content);
        }
      }

      // Persist MCS conversationId from shared state
      if (mcsSharedState.conversationId && turnState?.conversation) {
        turnState.conversation.mcsConversationId = mcsSharedState.conversationId;
        logger.debug(
          `MCS conversationId persisted: ${mcsSharedState.conversationId}`
        );
      }

      await context.streamingResponse.endStream();
      streamEnded = true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack =
        error instanceof Error ? error.stack : undefined;
      logger.error(`Error processing message: ${errorMessage}`);
      if (errorStack) {
        logger.debug(`Stack trace:\n${errorStack}`);
      }
      if (!streamEnded) {
        try {
          context.streamingResponse.queueTextChunk(
            `An error occurred while processing your request. ${errorMessage}`
          );
          await context.streamingResponse.endStream();
          streamEnded = true;
        } catch (streamEndError) {
          logger.error("Error ending stream after error:", streamEndError);
        }
      }
    }
  };
}

export const agentApp = new ProxyAgent();
