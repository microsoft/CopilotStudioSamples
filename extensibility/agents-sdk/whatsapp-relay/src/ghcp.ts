import { Activity } from "@microsoft/agents-activity";
import { ExecuteTurnRequest } from "@microsoft/agents-copilotstudio-client";
import { type Fetch, log, record, RelayError, responseError, text } from "./common.js";
import { limits } from "./config.js";

export interface GhcpSession { conversationId?: string; uncertain: boolean }
export type ActivitySink = (activity: Activity) => Promise<void>;

export function conversationUrl(base: string, id?: string): URL {
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/conversations${id ? `/${encodeURIComponent(id)}` : ""}`;
  return url;
}

// Unlike CopilotStudioClient's current public API, this transport can cancel the
// underlying fetch and bound SSE bytes, while retaining SDK request/activity types.
export class GhcpClient {
  constructor(private readonly base: string, private readonly fetcher: Fetch = fetch) {}

  async turn(
    session: GhcpSession, activity: Activity, token: string,
    sink: ActivitySink, signal: AbortSignal,
  ): Promise<void> {
    if (session.uncertain) throw new RelayError("uncertain_turn", "The previous turn was interrupted. Send --reset before starting a new conversation.");
    try {
      if (!session.conversationId) {
        await this.stream(session, { emitStartConversationEvent: false }, token, sink, signal, true);
        if (!session.conversationId) throw new RelayError("missing_conversation", "The agent did not return a conversation ID.");
      }
      await this.stream(session, new ExecuteTurnRequest(activity), token, sink, signal, false);
    } catch (error) {
      session.uncertain = true;
      throw error;
    }
  }

  private async stream(
    session: GhcpSession, body: unknown, token: string,
    sink: ActivitySink, signal: AbortSignal, starting: boolean,
  ): Promise<void> {
    const response = await this.fetcher(conversationUrl(this.base, starting ? undefined : session.conversationId), {
      method: "POST", redirect: "error", signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
    });
    if (!response.ok) { await response.body?.cancel(); throw responseError("ghcp", response.status); }
    if (!response.headers.get("content-type")?.toLowerCase().startsWith("text/event-stream") || !response.body) {
      await response.body?.cancel();
      throw new RelayError("not_sse", "The configured agent endpoint did not return an event stream.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let pending = "";
    let bytes = 0;
    let complete = false;
    const emit = async (frame: string): Promise<void> => {
      let event = "message";
      const data: string[] = [];
      for (const line of frame.split(/\r\n|\r|\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (event === "error") throw new RelayError("agent_stream_error", "The agent reported a stream error. Send --reset before retrying.");
      if (event === "end") { complete = true; return; }
      if (event !== "activity" || !data.length) return;
      let decoded: unknown;
      try { decoded = JSON.parse(data.join("\n")); } catch {
        throw new RelayError("invalid_sse", "The agent returned an invalid activity.");
      }
      const payload = record(decoded);
      text(payload.type, 64);
      const activity = Activity.fromObject(payload);
      if (activity.type === "event" && activity.name === "error") {
        throw new RelayError("agent_turn_error", "The agent reported a turn error. Send --reset before retrying.");
      }
      if (activity.conversation?.id) this.setConversation(session, activity.conversation.id);
      if (activity.type === "event" && activity.name === "turn.complete") {
        complete = true;
        return;
      }
      if (activity.type === "endOfConversation") {
        session.conversationId = undefined;
        complete = true;
        return;
      }
      await sink(activity);
    };
    try {
      const headerId = response.headers.get("x-ms-conversationid");
      if (headerId) this.setConversation(session, headerId);
      while (!complete) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) {
          pending += decoder.decode();
          if (pending.trim()) await emit(pending);
          if (!starting && !complete) throw new RelayError("incomplete_stream", "The agent stream ended before the turn completed. Send --reset before retrying.");
          break;
        }
        bytes += chunk.value.byteLength;
        if (bytes > limits.responseBytes) throw new RelayError("response_limit", "The streamed response exceeds this sample's memory limit.");
        pending += decoder.decode(chunk.value, { stream: true });
        let boundary: RegExpExecArray | null;
        while (!complete && (boundary = /\r\n\r\n|\n\n|\r\r/.exec(pending))) {
          const frame = pending.slice(0, boundary.index);
          pending = pending.slice(boundary.index + boundary[0].length);
          await emit(frame);
        }
      }
    } finally {
      await reader.cancel().catch(error => log("stream_cancel_failed", error));
      reader.releaseLock();
    }
  }

  private setConversation(session: GhcpSession, id: string): void {
    if (!id || id.length > 512 || /[\u0000-\u001f]/.test(id) ||
        (session.conversationId && session.conversationId !== id)) {
      throw new RelayError("conversation_mismatch", "The agent returned an inconsistent conversation ID.");
    }
    session.conversationId = id;
  }
}
