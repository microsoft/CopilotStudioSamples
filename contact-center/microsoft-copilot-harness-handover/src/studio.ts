import { randomUUID } from 'node:crypto';
import { Activity } from '@microsoft/agents-activity';
import { ConnectionSettings, CopilotStudioClient } from '@microsoft/agents-copilotstudio-client';
import { hash, type Studio, type StudioOutput } from './relay.js';

export function studioSettings(): ConnectionSettings {
  return new ConnectionSettings({
    environmentId: process.env.STUDIO_ENVIRONMENT_ID,
    schemaName: process.env.STUDIO_SCHEMA_NAME,
    directConnectUrl: process.env.STUDIO_DIRECT_CONNECT_URL
  });
}
export class SdkStudio implements Studio {
  private client: CopilotStudioClient;
  constructor(settings: ConnectionSettings, token: string, client = new CopilotStudioClient(settings, token)) {
    this.client = client;
  }
  async start(): Promise<{ conversationId: string; replies: string[] }> {
    const response = await this.client.startConversationWithResponse({ emitStartConversationEvent: false });
    return { conversationId: response.conversationId, replies: replies(response.activities) };
  }
  async send(conversationId: string, value: string, id: string, output: StudioOutput): Promise<void> {
    const activity = Activity.fromObject({ type: 'message', id, text: value, conversation: { id: conversationId } });
    const started = Date.now();
    const received = { typing: 0, partial: 0, message: 0 };
    let delivery = Promise.resolve();
    const failures: unknown[] = [];
    try {
      // Do not await channel I/O while reading SSE: the SDK stops reading once the connection closes.
      await forwardStudioStream(this.client.executeStreaming(activity, conversationId), conversationId, id, async event => {
        received[event.type]++;
        delivery = delivery.then(async () => {
          if (!failures.length) await output(event);
        }).catch(error => { failures.push(error); });
      });
    } catch (error) {
      failures.push(error);
    }
    await delivery;
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, 'Studio streaming and channel delivery failed');
    console.log(JSON.stringify({ event: 'studio_stream_complete', received, durationMs: Date.now() - started }));
  }
}
function replies(activities: Activity[]): string[] {
  return activities.filter(a => a.type === 'message' && !a.entities?.some(e => e.type === 'thought') && typeof a.text === 'string' && a.text.trim())
    .map(a => a.text!);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export async function forwardStudioStream(
  activities: AsyncIterable<Activity>, conversationId: string, requestId: string, output: StudioOutput
): Promise<void> {
  const streams = new Map<string, { text: string; prefix: string; final: boolean; hiddenText: boolean; sequence: number }>();
  const completedActivities = new Set<string>();
  let answered = false;
  let messageNumber = 0;
  const messageId = (key: string) => `studio-${hash(JSON.stringify([conversationId, requestId, key]))}`;
  for await (const activity of activities) {
    if (activity.conversation?.id && activity.conversation.id !== conversationId) {
      throw new Error('Studio changed the conversation ID; refusing to rebind');
    }
    const metadata = record(activity.entities?.find(entity => entity.type === 'streaminfo')) ?? record(activity.channelData);
    const streamId = typeof metadata?.streamId === 'string' ? metadata.streamId : undefined;
    const thought = activity.entities?.some(entity => entity.type === 'thought') ?? false;
    const finalActivity = activity.type === 'message' || (activity.type === 'typing' && metadata?.streamType === 'final');
    let key = streamId || activity.id;
    if (activity.type === 'typing' && !finalActivity) {
      if (metadata?.streamType !== 'streaming') {
        if (!answered) await output({ type: 'typing' });
        continue;
      }
      key ||= 'response';
      const state = streams.get(key) ?? { text: '', prefix: '', final: false, hiddenText: false, sequence: 0 };
      streams.set(key, state);
      if (state.final) continue;
      // Thought metadata and public answer chunks can share a stream ID.
      if (thought) state.hiddenText ||= Boolean(activity.text);
      if (thought || state.hiddenText) {
        if (!answered) await output({ type: 'typing' });
        continue;
      }
      const sequence = metadata?.streamSequence;
      // The first chunk uses its activity ID; the SDK starts accumulation only once streamId appears.
      if (!streamId && sequence === 1 && state.sequence === 0) state.prefix = activity.text ?? '';
      if (typeof sequence === 'number') {
        if (sequence <= state.sequence) continue;
        state.sequence = sequence;
      }
      const accumulated = typeof activity.text === 'string'
        ? (streamId ? state.prefix : '') + activity.text
        : undefined;
      if (accumulated !== undefined && accumulated !== state.text) {
        state.text = accumulated;
        await output({ type: 'partial', id: messageId(key), text: state.text });
      } else if (!state.text && !answered) {
        await output({ type: 'typing' });
      }
    } else if (finalActivity) {
      if (thought) continue;
      if (activity.id && completedActivities.has(activity.id)) continue;
      if (activity.id) completedActivities.add(activity.id);
      if (!key || !streams.has(key)) {
        const pending = [...streams].filter(([, state]) => !state.final && !state.hiddenText);
        if (!streamId && pending.length === 1) key = pending[0]![0];
      }
      key ||= `message-${messageNumber++}`;
      const state = streams.get(key) ?? { text: '', prefix: '', final: false, hiddenText: false, sequence: 0 };
      streams.set(key, state);
      if (state.final) continue;
      state.final = true;
      state.text = typeof activity.text === 'string' && activity.text.trim()
        ? activity.text : state.hiddenText ? '' : state.text;
      if (state.text.trim()) {
        await output({ type: 'message', id: messageId(key), text: state.text });
        answered = true;
      }
    }
  }
  // Some transports complete with streamed text but no separate final activity.
  for (const [key, state] of streams) {
    if (!state.final && !state.hiddenText && state.text.trim()) {
      await output({ type: 'message', id: messageId(key), text: state.text });
    }
  }
}

/** Deterministic local transport exercising the same hook and escalation contracts. */
export class MockStudio implements Studio {
  constructor(private escalate: (parameters: Record<string, unknown>) => Promise<unknown>) {}
  async start(): Promise<{ conversationId: string; replies: string[] }> {
    return {
      conversationId: `studio-${randomUUID()}`,
      replies: ['Welcome to Contoso support. Ask a question, or say "talk to a human".']
    };
  }
  async send(id: string, value: string, activityId: string, output: StudioOutput): Promise<void> {
    const reply = async (text: string) => output({ type: 'message', id: `mock-${hash(JSON.stringify([id, activityId]))}`, text });
    if (value.startsWith('Human support has ended.')) {
      return reply(`I have picked up this same conversation. Here is the human-support exchange I received:\n${value.split('\n').slice(1).join('\n')}\nHow can I help next?`);
    }
    if (/\b(human|person|escalate)\b/i.test(value)) {
      const parameters = { conversationId: 'model-supplied-wrong-id', reason: 'Customer requested human support', summary: value };
      await this.escalate({ ...parameters, conversationId: id });
      return reply('This late bot response must not be delivered after escalation.');
    }
    return reply(`You said: ${value}\nThis is the deterministic local demo. Say "talk to a human" to test handover.`);
  }
}
