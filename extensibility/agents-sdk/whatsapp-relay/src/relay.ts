import { randomUUID } from "node:crypto";
import { Activity } from "@microsoft/agents-activity";
import { AgentApplication, MemoryStorage, TurnState } from "@microsoft/agents-hosting";
import { WhatsAppAdapter } from "./adapter.js";
import { log, record, RelayError, text } from "./common.js";
import { type Config, limits } from "./config.js";
import { GhcpClient, type GhcpSession } from "./ghcp.js";
import { attachmentKey, MemoryBudget, outgoingFile } from "./media.js";
import { type Incoming, type MetaClient, type MetaEvent, splitText } from "./meta.js";

interface Session {
  identity: string;
  app: AgentApplication<TurnState>;
  ghcp: GhcpSession;
  touched: number;
  lastInbound: number;
  authStarted?: number;
  incoming?: Incoming;
}
type MetaTransport = Pick<MetaClient, "sendText" | "sendSignIn" | "sendFile" | "download" | "typing">;

export class Relay {
  private readonly sessions = new Map<string, Session>();
  private readonly deliveries = new Map<string, { key: string; status: string; updated: number }>();
  private readonly shutdown = new AbortController();
  private readonly memory = new MemoryBudget();

  constructor(
    private readonly config: Config,
    private readonly adapter: WhatsAppAdapter,
    private readonly meta: MetaTransport,
    private readonly ghcp: Pick<GhcpClient, "turn">,
    private readonly isBusy: (key: string) => boolean,
    private readonly now = Date.now,
  ) {}

  abort(): void { this.shutdown.abort(); }

  sweep(): void {
    for (const [key, session] of this.sessions) {
      if (!this.isBusy(key) && this.now() - session.touched >= limits.sessionMs) this.sessions.delete(key);
    }
    for (const [id, delivery] of this.deliveries) {
      if (this.now() - delivery.updated >= limits.dedupMs) this.deliveries.delete(id);
    }
  }

  async handle(event: MetaEvent): Promise<void> {
    if (this.shutdown.signal.aborted) return;
    if (event.kind === "status") {
      const previous = this.deliveries.get(event.messageId);
      const ranks: Record<string, number> = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
      if (previous?.key === event.key && event.timestamp >= previous.updated &&
          (ranks[event.status] ?? -1) >= (ranks[previous.status] ?? -1)) {
        this.deliveries.set(event.messageId, { ...previous, status: event.status, updated: event.timestamp });
        if (event.status === "failed") log("meta_delivery_failed", new RelayError("delivery_failed", "WhatsApp delivery failed."));
      }
      return;
    }
    const signal = AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(limits.turnMs)]);
    let session: Session | undefined;
    try {
      this.sweep();
      session = this.sessions.get(event.key);
      if (this.now() - Math.max(event.timestamp, session?.lastInbound ?? 0) >= limits.windowMs) {
        throw new RelayError("window_closed", "The WhatsApp service window has closed.");
      }
      if (session?.authStarted !== undefined && this.now() - session.authStarted >= limits.authMs) {
        this.sessions.delete(event.key);
        session = undefined;
        if (/^\d{6}$/.test(event.text.trim())) {
          await this.meta.sendText(event.sender, "That sign-in request expired. Send your original request again.", signal);
          return;
        }
      }
      if (!session) {
        if (this.sessions.size >= limits.sessions) throw new RelayError("sessions_full", "The relay has reached its session limit. Please try again later.");
        session = this.createSession(event);
        this.sessions.set(event.key, session);
      }
      session.touched = this.now();
      session.lastInbound = Math.max(session.lastInbound, event.timestamp);
      this.requireWindow(session);
      if (event.unsupported) {
        await this.meta.sendText(event.sender, "Send text, an image, a document, an audio clip, or a video. Other WhatsApp message types are not supported.", signal);
        return;
      }
      if (/^\d{6}$/.test(event.text.trim()) && session.authStarted === undefined) {
        await this.meta.sendText(event.sender, "There is no pending sign-in for this conversation. Send your request first.", signal);
        return;
      }
      if (session.authStarted !== undefined && !/^\d{6}$/.test(event.text.trim()) &&
          !["--signout", "--reset"].includes(event.text.trim())) {
        await this.meta.sendText(event.sender, "Sign-in is pending. Send the six-digit code, or --signout to cancel.", signal);
        return;
      }
      const current = session;
      const activity = Activity.fromObject({
        type: "message", channelId: "whatsapp", id: event.id,
        from: { id: current.identity }, recipient: { id: this.config.botId },
        conversation: { id: current.identity, isGroup: false, conversationType: "personal" },
        text: /^\d{6}$/.test(event.text.trim()) ? event.text.trim() : event.text,
      });
      const send = async (activities: Activity[]) => {
        for (const response of activities) await this.sendActivity(response, event, current, signal);
      };
      await this.adapter.processActivity(activity, send, async context => {
        if (event.text.trim() === "--signout") {
          await current.app.authorization.signOut(context, new TurnState(), "MCS");
          this.sessions.delete(event.key);
          await this.meta.sendText(event.sender, "Signed out. Your relay conversation was cleared.", signal);
          return;
        }
        if (event.text.trim() === "--reset") {
          current.ghcp = { uncertain: false };
          // If sign-in was pending, discard the old SDK auth correlation as well.
          if (current.authStarted !== undefined) this.sessions.delete(event.key);
          await this.meta.sendText(event.sender, "Conversation reset. Send your next request.", signal);
          return;
        }
        if (current.authStarted === undefined) current.incoming = event;
        await current.app.run(context);
        if (/^\d{6}$/.test(event.text.trim()) && current.authStarted !== undefined) {
          this.sessions.delete(event.key);
        }
      }, signal);
    } catch (error) {
      log("turn_failed", error);
      if (session?.authStarted !== undefined) this.sessions.delete(event.key);
      if (this.shutdown.signal.aborted) return;
      if (this.now() - Math.max(event.timestamp, session?.lastInbound ?? 0) >= limits.windowMs) return;
      const message = error instanceof RelayError ? error.publicMessage
        : "The relay could not complete this request. Check its configuration and use --reset before retrying.";
      try {
        await this.meta.sendText(event.sender, message, AbortSignal.timeout(limits.requestMs));
      } catch (sendError) { log("error_reply_failed", sendError); }
    }
  }

  private createSession(event: Incoming): Session {
    const identity = `${event.key}.${randomUUID()}`;
    const session: Session = {
      identity, ghcp: { uncertain: false }, touched: this.now(), lastInbound: event.timestamp,
      app: new AgentApplication({
        adapter: this.adapter, agentAppId: this.config.botId, storage: new MemoryStorage(),
        startTypingTimer: false, longRunningMessages: false, fileDownloaders: [],
        authorization: {
          MCS: {
            azureBotOAuthConnectionName: this.config.oauthConnection, enableSso: false,
            title: "Sign in", text: "Sign in, then send the six-digit verification code in WhatsApp.",
            invalidSignInRetryMax: 3,
            invalidSignInRetryMessage: "The code was rejected. Send your original request to start a new sign-in.",
          },
        },
      }),
    };
    session.app.onActivity("message", async context => {
      session.authStarted = undefined;
      const { token } = await session.app.authorization.getToken(context, "MCS");
      if (!token) throw new RelayError("missing_token", "Sign-in did not produce a delegated token.");
      const incoming = session.incoming;
      if (!incoming || context.activity.id !== incoming.id) {
        throw new RelayError("auth_correlation", "Sign-in no longer matches the original request. Use --signout and start again.");
      }
      session.incoming = undefined;
      // SDK authorization restores the initiating activity after code verification.
      const signal = context.turnState.get<AbortSignal>(this.adapter.signalKey);
      let sent = 0;
      let lastTyping = -Infinity;
      let typingEnabled = true;
      let attachmentCount = 0;
      const files = new Set<string>();
      const messages = new Set<string>();
      const typing = async () => {
        if (!typingEnabled || this.now() - lastTyping < limits.typingMs) return;
        lastTyping = this.now();
        try {
          this.requireWindow(session);
          await this.meta.typing(incoming.id, signal);
        } catch (error) { log("typing_failed", error); }
      };
      await this.memory.use(limits.responseBytes * 6 + limits.fileBytes * 4, async () => {
        const timer = setInterval(() => { void typing(); }, limits.typingMs);
        timer.unref();
        try {
          const request = Activity.fromObject({ type: "message", text: incoming.text });
          await typing();
          if (incoming.media) {
            const file = await this.meta.download(incoming.media, signal);
            request.attachments = [{
              contentType: file.mime, name: file.name,
              contentUrl: `data:${file.mime};base64,${file.bytes.toString("base64")}`,
            }];
          }
          await this.ghcp.turn(session.ghcp, request, token, async activity => {
            if (activity.type === "typing") { await typing(); return; }
            if (activity.type !== "message" || !this.isFinal(activity)) return;
            if (activity.id && messages.has(activity.id)) return;
            if (activity.id) messages.add(activity.id);
            typingEnabled = false;
            sent += splitText(activity.text ?? "").length + (activity.attachments?.length ?? 0);
            if (sent > limits.outboundMessages) throw new RelayError("message_limit", "The agent returned too many messages.");
            if (activity.text) {
              this.requireWindow(session);
              this.track(incoming.key, await this.meta.sendText(incoming.sender, activity.text, signal));
            }
            for (const attachment of activity.attachments ?? []) {
              const key = attachmentKey(attachment);
              if (files.has(key)) continue;
              if (++attachmentCount > limits.attachments) throw new RelayError("attachment_limit", "The agent returned too many attachments.");
              files.add(key);
              const file = await outgoingFile(attachment, this.config.fileOrigins, signal);
              this.requireWindow(session);
              this.track(incoming.key, [await this.meta.sendFile(incoming.sender, file, signal)]);
            }
          }, signal);
          if (!sent) throw new RelayError("empty_answer", "The agent completed without a supported answer.");
        } finally {
          typingEnabled = false;
          clearInterval(timer);
        }
      });
    }, ["MCS"]);
    return session;
  }

  private isFinal(activity: Activity): boolean {
    const channel: unknown = activity.channelData;
    const kind = channel && typeof channel === "object" ? record(channel).streamType : undefined;
    if (kind !== undefined && kind !== "final") return false;
    return !(activity.entities ?? []).some(entity =>
      entity.type === "thought" || (entity.type === "streaminfo" &&
        (entity.streamType === "streaming" || entity.streamType === "informative")));
  }

  private async sendActivity(
    activity: Activity, incoming: Incoming, session: Session, signal: AbortSignal,
  ): Promise<void> {
    if (activity.type === "trace" || activity.type === "invokeResponse" || activity.type === "typing") return;
    if (activity.type !== "message") throw new RelayError("activity_type", "The SDK returned an unsupported activity.");
    this.requireWindow(session);
    if (activity.text) this.track(incoming.key, await this.meta.sendText(incoming.sender, activity.text, signal));
    for (const attachment of activity.attachments ?? []) {
      if (attachment.contentType !== "application/vnd.microsoft.card.oauth") {
        throw new RelayError("card_type", "This card cannot be displayed in WhatsApp.");
      }
      const content: unknown = attachment.content;
      const buttons = record(content).buttons;
      if (!Array.isArray(buttons)) throw new RelayError("oauth_card", "The sign-in card is missing its link.");
      const button: unknown = buttons.find((item: unknown) => record(item).type === "signin");
      const link = text(record(button).value, 8192);
      session.authStarted ??= this.now();
      this.track(incoming.key, await this.meta.sendSignIn(incoming.sender, link, signal));
    }
  }

  private track(key: string, ids: string[]): void {
    for (const id of ids) {
      if (this.deliveries.size >= limits.dedupEntries) {
        const first = this.deliveries.keys().next().value;
        if (first) this.deliveries.delete(first);
      }
      this.deliveries.set(id, { key, status: "accepted", updated: Math.floor(this.now() / 1000) * 1000 });
    }
  }

  private requireWindow(session: Session): void {
    if (this.now() - session.lastInbound >= limits.windowMs) {
      throw new RelayError("window_closed", "The WhatsApp service window has closed. Send a new message to continue.");
    }
  }
}
