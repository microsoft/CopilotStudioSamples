import { AsyncLocalStorage } from 'node:async_hooks';
import { Activity } from '@microsoft/agents-activity';
import { AgentApplication, MemoryStorage, TurnContext, TurnState } from '@microsoft/agents-hosting';
import { createAgentRequestHandler } from '@microsoft/agents-hosting-express';
import { hash, HttpError, Relay, SignInRequired, type Progress } from './relay.js';
import { SdkStudio, studioSettings } from './studio.js';
import { teamsConsentFallback } from './teams-consent.js';
import { ChannelStream } from './channel-stream.js';
import type { Message, Session } from './store.js';

export function errorCauses(error: Error): { type: string; message: string }[] {
  const causes = [];
  for (let current: unknown = error, depth = 0; current instanceof Error && depth < 5; depth++) {
    causes.push({
      type: current.name,
      message: current.message
        .replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [REDACTED]')
        .replace(/\beyJ[\w-]*\.[\w-]+\.[\w-]+\b/g, '[REDACTED]')
        .slice(0, 2000)
    });
    current = 'innerException' in current ? current.innerException : current.cause;
  }
  return causes;
}

export class Channels {
  private current = new AsyncLocalStorage<TurnContext>();
  private app: AgentApplication<TurnState>;
  private relay?: Relay;
  private streams = new Map<string, Map<string, ChannelStream>>();
  private typingAt = new Map<string, number>();
  readonly handler: ReturnType<typeof createAgentRequestHandler>;
  constructor(app = new AgentApplication<TurnState>({ storage: new MemoryStorage() })) {
    this.app = app;
    this.handler = createAgentRequestHandler(this.app);
    this.app.adapter.use(teamsConsentFallback);
    this.app.authorization.onSignInFailure(async (context, _state, handler, message) => {
      console.error(JSON.stringify({
        event: 'channel_signin_failed', activityName: context.activity.name,
        handler, errors: errorCauses(new Error(message ?? 'No sign-in failure detail was returned'))
      }));
      if (context.activity.name === 'signin/failure') {
        await context.sendActivity('Failed to sign-in. Please try again.');
      }
    });
    const defaultError = this.app.adapter.onTurnError;
    this.app.onError(async (context, error) => {
      const errors = errorCauses(error);
      console.error(JSON.stringify({
        event: 'channel_turn_failed', activityType: context.activity.type,
        activityName: context.activity.name, errors
      }));
      await defaultError(context, error);
    });
    this.app.onMessage(/^--signout$/i, async (context, state) => {
      await this.app.authorization.signOut(context, state, 'mcs');
      await context.sendActivity('Signed out of this relay. Send a message to sign in again and grant Copilot Studio access.');
    });
    this.app.onActivity('message', async context => {
      if (!this.relay) throw new Error('Relay is not initialized');
      if (context.activity.channelId !== 'msteams' || context.activity.conversation?.conversationType !== 'personal') {
        await context.sendActivity('This sample supports Teams/Microsoft 365 personal chats only.');
        return;
      }
      await this.current.run(context, async () => {
        const key = this.key(context);
        const existing = (await this.relay!.list()).find(s => s.channelKey === key);
        const s = existing ?? (await this.relay!.create(key, 'msteams', context.activity.getConversationReference())).session;
        if (existing) {
          await this.relay!.repo.change(state => {
            state.sessions[s.id]!.reference = context.activity.getConversationReference();
          });
        }
        try {
          if (s.handback?.stage === 'auth_required') {
            await this.relay!.close(s.id, s.operator!);
          }
          await this.relay!.customer(s.id, context.activity.text ?? '', context.activity.id!);
        } catch (error) {
          if (error instanceof HttpError && error.status < 500) {
            console.warn(JSON.stringify({ event: 'channel_request_rejected', status: error.status }));
            await context.sendActivity(error.message);
            return;
          }
          throw error;
        }
      });
    }, ['mcs']);
  }
  attach(relay: Relay): void { this.relay = relay; }
  async studio(s: Session): Promise<SdkStudio> {
    if (s.channel !== 'msteams') throw new HttpError(400, 'Real Studio access uses the authenticated Teams/M365 channel. Use mock mode for the browser demo.');
    let token: string | undefined;
    await this.withContext(s, async context => {
      const response = await this.app.authorization.getToken(context, 'mcs');
      token = response.token;
      if (!token) throw new SignInRequired();
    });
    if (!token) throw new SignInRequired();
    return new SdkStudio(studioSettings(), token);
  }
  async deliver(s: Session, message: Message): Promise<void> {
    if (message.role === 'system' && (s.mode === 'waiting' || s.mode === 'human')) {
      if (await this.finishStreams(s.id, message.text)) return;
    }
    const stream = message.role === 'assistant' ? this.streams.get(s.id)?.get(message.id) : undefined;
    if (stream) {
      try { await stream.finish(message.text); }
      finally { this.streams.get(s.id)?.delete(message.id); }
      return;
    }
    await this.withContext(s, async context => {
      await context.sendActivity(message.role === 'human' ? `Support: ${message.text}` : message.text);
    });
  }
  async progress(s: Session, update: Progress): Promise<void> {
    if (update.type === 'end') {
      try {
        await this.finishStreams(s.id, update.failed
          ? 'The response could not be completed. Please check with support before retrying.'
          : 'This response has ended.');
      } finally {
        this.typingAt.delete(s.id);
      }
      return;
    }
    await this.withContext(s, async context => {
      const current = await this.relay!.get(s.id);
      if (current.turn?.id !== s.turn?.id || (current.mode !== 'bot' && current.mode !== 'resuming')) return;
      if (update.type === 'typing') {
        const now = Date.now();
        if (now - (this.typingAt.get(s.id) ?? 0) >= 1000) {
          this.typingAt.set(s.id, now);
          await context.sendActivity(Activity.fromObject({ type: 'typing' }));
        }
        return;
      }
      let streams = this.streams.get(s.id);
      if (!streams) this.streams.set(s.id, streams = new Map());
      let stream = streams.get(update.id);
      if (!stream) streams.set(update.id, stream = new ChannelStream(context));
      stream.update(update.text);
    });
  }
  private async finishStreams(id: string, text: string): Promise<boolean> {
    const streams = this.streams.get(id);
    if (!streams?.size) {
      this.streams.delete(id);
      return false;
    }
    try {
      await Promise.all([...streams.values()].map(stream => stream.finish(text)));
      return true;
    } finally {
      this.streams.delete(id);
    }
  }
  private key(context: TurnContext): string {
    const { channelId, conversation, from } = context.activity;
    if (!conversation?.id || !from?.id) throw new HttpError(400, 'Channel identity is missing');
    return hash(JSON.stringify([channelId, conversation.tenantId, conversation.id, from.id]));
  }
  private async withContext(s: Session, action: (context: TurnContext) => Promise<void>): Promise<void> {
    const current = this.current.getStore();
    if (current && this.key(current) === s.channelKey) return action(current);
    if (!s.reference) throw new HttpError(409, 'No authenticated channel conversation reference');
    let failure: unknown;
    await this.app.adapter.continueConversation(this.app.adapter.getClientId()!, s.reference, async context => {
      try { await action(context); }
      catch (error) { failure = error; }
    });
    // CloudAdapter routes callback errors to onTurnError instead of rejecting its promise.
    if (failure) throw failure;
  }
}
