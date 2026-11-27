import { logger } from "../logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyActivity = any;

export interface StreamingResponseLike {
  queueInformativeUpdate(text: string): void;
  queueTextChunk(text: string): void;
}

export interface McsStreamResult {
  finalText: string;
  conversationId: string | undefined;
}

/**
 * Processes the Activity stream from MCS and forwards streaming text to the
 * M365 streaming response.
 *
 * The SDK accumulates text internally — each typing activity with streaming info
 * has activity.text set to the FULL accumulated text so far. We extract just the
 * new delta by comparing with the previous accumulated text, then forward the
 * delta via queueTextChunk.
 */
export async function processMcsStream(
  stream: AsyncGenerator<AnyActivity>,
  streamingResponse: StreamingResponseLike,
  initialConversationId?: string
): Promise<McsStreamResult> {
  let conversationId: string | undefined = initialConversationId;
  let lastText = "";
  let finalText = "";

  for await (const activity of stream) {
    // Full activity dump for debugging
    logger.info(`MCS RAW ACTIVITY: ${JSON.stringify({
      type: activity.type,
      text: activity.text ?? null,
      textLen: activity.text?.length ?? 0,
      channelData: activity.channelData ?? null,
      entities: activity.entities ?? null,
      conversationId: activity.conversation?.id ?? null,
    })}`);

    const channelData = (activity.channelData ?? {}) as Record<string, unknown>;
    const entities = (activity.entities ?? []) as Array<Record<string, unknown>>;
    const streamingEntity = entities.find(
      (e) => e.type === "streaminfo" && e.streamType === "streaming"
    );

    // Capture conversationId
    if (!conversationId && activity.conversation?.id) {
      conversationId = activity.conversation.id;
    }

    // Streaming text (typing with streaminfo or channelData delta/streaming)
    if (activity.type === "typing") {
      if (
        streamingEntity ||
        channelData.chunkType === "delta" ||
        channelData.streamType === "streaming"
      ) {
        // activity.text is the accumulated text so far — extract delta.
        // Normally monotonically growing, but handle revision/reset gracefully.
        const accumulated = activity.text ?? "";
        if (accumulated.length > lastText.length) {
          const delta = accumulated.substring(lastText.length);
          streamingResponse.queueTextChunk(delta);
          logger.debug(
            `MCS chunk: +${delta.length} chars (total: ${accumulated.length})`
          );
        } else if (accumulated.length < lastText.length && accumulated.length > 0) {
          // Non-monotonic text — SDK sent a revision or reset. Log and re-send full text.
          logger.warn(
            `MCS text revision: ${lastText.length} -> ${accumulated.length} chars, re-sending`
          );
          streamingResponse.queueTextChunk(accumulated);
        }
        lastText = accumulated;
        continue;
      }

      // Informative status
      if (channelData.streamType === "informative" && activity.text) {
        streamingResponse.queueInformativeUpdate(activity.text);
        continue;
      }

      continue;
    }

    // Final message
    if (activity.type === "message") {
      finalText = activity.text ?? "";
      // If nothing was streamed yet, send the full text as one chunk
      if (!lastText && finalText) {
        streamingResponse.queueTextChunk(finalText);
      }
      continue;
    }

    if (activity.type === "endOfConversation") {
      logger.debug("MCS conversation ended");
    }
  }

  // Use streamed text if final message was empty or absent
  if (!finalText && lastText) {
    finalText = lastText;
  }

  logger.debug(
    `MCS stream complete. Text length: ${finalText.length}, conversationId: ${conversationId}`
  );
  return { finalText, conversationId };
}
