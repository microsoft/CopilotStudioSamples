import { Activity } from '@microsoft/agents-activity';
import { StreamingResponse, StreamingResponseResult, TurnContext } from '@microsoft/agents-hosting';

class StreamContext extends TurnContext {
  failure?: unknown;
  finalText?: string;
  override async sendActivity(...args: Parameters<TurnContext['sendActivity']>) {
    try {
      const result = await super.sendActivity(...args);
      const activity = args[0];
      if (typeof activity !== 'string' && activity.type === 'message') this.finalText = activity.text;
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('badargument') && message.includes('streaming api is not enabled')) {
        console.warn(JSON.stringify({ event: 'channel_streaming_unavailable', fallback: 'final-message' }));
      } else {
        this.failure = error;
      }
      throw error;
    }
  }
  override async updateActivity(...args: Parameters<TurnContext['updateActivity']>) {
    try {
      const result = await super.updateActivity(...args);
      if (args[0].type === 'message') this.finalText = args[0].text;
      return result;
    } catch (error) {
      this.failure = error;
      throw error;
    }
  }
}

export class ChannelStream {
  private context: StreamContext;
  private response: StreamingResponse;
  private prefix = '';
  private revised = false;
  private completion?: Promise<void>;
  constructor(context: TurnContext) {
    this.context = new StreamContext(context);
    this.response = new StreamingResponse(this.context);
  }
  update(text: string): void {
    if (this.completion) return;
    if (!text.startsWith(this.prefix)) this.revised = true;
    if (!this.revised && text.length > this.prefix.length) {
      this.response.queueTextChunk(text.slice(this.prefix.length));
      this.prefix = text;
    }
  }
  finish(text: string): Promise<void> {
    if (!this.completion) {
      this.response.setFinalMessage(Activity.fromObject({ type: 'message', text }));
      this.completion = this.end(text);
    }
    return this.completion;
  }
  private async end(text: string): Promise<void> {
    const result = await this.response.endStream();
    if (this.context.failure) throw this.context.failure;
    if (result !== StreamingResponseResult.Success) throw new Error(`Channel stream was not delivered: ${result}`);
    // The SDK can switch to buffered delivery while an already-queued final is being drained.
    if (this.context.finalText !== text && !this.response.isStreamingChannel) {
      await this.context.sendActivity(Activity.fromObject({ type: 'message', text }));
    }
    if (this.context.finalText !== text) throw new Error('The channel did not receive the completed response');
  }
}
