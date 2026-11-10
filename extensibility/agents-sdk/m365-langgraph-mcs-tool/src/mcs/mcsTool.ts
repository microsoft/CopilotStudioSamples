import { tool } from "@langchain/core/tools";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { TurnContext } from "@microsoft/agents-hosting";
import { createMcsClient } from "./mcsClientFactory";
import {
  processMcsStream,
  StreamingResponseLike,
} from "./mcsActivityProcessor";
import { AuthorizationLike } from "./mcsTokenProvider";
import { logger } from "../logger";

/**
 * Shape of what must be injected via config.configurable before invoking the graph.
 * These are per-turn values that the tool needs but can't get from LangGraph state.
 */
export interface McsToolContext {
  mcsAuthorization: AuthorizationLike;
  mcsTurnContext: TurnContext;
  mcsStreamingResponse: StreamingResponseLike;
  mcsConversationId?: string;
  /** Shared mutable state — tool writes, agent.ts reads after graph completes */
  mcsSharedState: McsToolSharedState;
}

/**
 * Shared state object passed via configurable.
 * Mutated by the tool, read by agent.ts after graph completion.
 * This avoids runId-mismatch issues with Map-based side channels.
 */
export interface McsToolSharedState {
  /** Set by the tool after MCS conversation is established */
  conversationId?: string;
  /** Set to true when MCS streams content — used to suppress LLM echo */
  mcsStreamed?: boolean;
}

const inputSchema = z.object({
  userMessage: z
    .string()
    .describe("The user message to send to the Copilot Studio agent"),
});

export const mcsTool = tool(
  async (
    input: z.infer<typeof inputSchema>,
    config: RunnableConfig
  ): Promise<string> => {
    const ctx = config?.configurable as McsToolContext | undefined;
    if (
      !ctx?.mcsAuthorization ||
      !ctx?.mcsTurnContext ||
      !ctx?.mcsStreamingResponse
    ) {
      throw new Error(
        "MCS tool missing required context (mcsAuthorization, mcsTurnContext, mcsStreamingResponse). " +
          "Ensure these are passed via configurable when invoking the graph."
      );
    }

    const { userMessage } = input;
    const { mcsAuthorization, mcsTurnContext, mcsStreamingResponse } = ctx;
    const sharedState = ctx.mcsSharedState;

    // Read conversationId from ctx — may be updated by a previous tool call in this turn
    let mcsConversationId = ctx.mcsConversationId;

    logger.info(
      `MCS tool invoked. conversationId: ${mcsConversationId ?? "new"}`
    );
    mcsStreamingResponse.queueInformativeUpdate(
      "Contacting Copilot Studio agent..."
    );

    // Build a fresh client per invocation (token baked in at construction).
    // Do NOT set mcsStreamed flag until client is created and streaming starts,
    // so LLM fallback messages are not suppressed if client creation fails.
    let client;
    try {
      logger.debug("Creating MCS client...");
      client = await createMcsClient(mcsAuthorization, mcsTurnContext);
      logger.debug("MCS client created successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to create MCS client: ${msg}`);
      if (err instanceof Error && err.stack) logger.error(err.stack);
      throw err;
    }

    // If no conversation yet, start one with the greeting event (true)
    // to ensure we get a conversationId back. We consume the welcome silently.
    if (!mcsConversationId) {
      logger.debug("Starting new MCS conversation");
      const startStream = client.startConversationStreaming(
        true
      ) as AsyncGenerator<any>;

      // Drain silently — just capture the conversationId
      let startConversationId: string | undefined;
      for await (const activity of startStream) {
        if (!startConversationId && activity.conversation?.id) {
          startConversationId = activity.conversation.id;
        }
      }

      if (!startConversationId) {
        throw new Error(
          "MCS did not return a conversationId from startConversationStreaming"
        );
      }
      mcsConversationId = startConversationId;
      logger.debug(`MCS conversationId: ${mcsConversationId}`);
    }

    // Now that we have a client and conversationId, signal that MCS streaming
    // is about to begin. This suppresses LLM echo in agent.ts.
    sharedState.mcsStreamed = true;

    // Send the user's message with streaming
    const preview =
      userMessage.length > 50
        ? `${userMessage.substring(0, 50)}...`
        : userMessage;
    logger.debug(
      `Sending message to MCS conversation ${mcsConversationId}: "${preview}"`
    );

    const sendStream = client.sendActivityStreaming(
      {
        type: "message",
        text: userMessage,
        conversation: { id: mcsConversationId },
      } as any,
      mcsConversationId
    ) as AsyncGenerator<any>;

    const result = await processMcsStream(
      sendStream,
      mcsStreamingResponse,
      mcsConversationId
    );

    // Store conversationId in shared state for agent.ts to persist,
    // AND write back to ctx so subsequent tool calls in this turn see it.
    const finalConversationId = result.conversationId ?? mcsConversationId;
    sharedState.conversationId = finalConversationId;
    ctx.mcsConversationId = finalConversationId;

    return result.finalText || "(no response from Copilot Studio agent)";
  },
  {
    name: "ask_copilot_studio_agent",
    description:
      "Send a message to the Copilot Studio agent and get a response. " +
      "Use this tool when the user's question should be handled by the Copilot Studio agent.",
    schema: inputSchema,
  }
);
