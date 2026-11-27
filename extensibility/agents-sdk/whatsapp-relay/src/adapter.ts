import { randomUUID } from "node:crypto";
import { Activity, type ConversationReference } from "@microsoft/agents-activity";
import {
  CloudAdapter, HttpClient, type HttpRequestConfig, type HttpResponse,
  TurnContext, type UserTokenClient,
} from "@microsoft/agents-hosting";
import { type Config, limits } from "./config.js";
import { RelayError } from "./common.js";

export type SendActivities = (activities: Activity[]) => Promise<void>;
export type TokenClientFactory = () => Promise<UserTokenClient>;

class BoundedTokenHttpClient extends HttpClient {
  constructor(client: HttpClient, private readonly signal: AbortSignal) {
    super({ baseURL: client.baseURL, headers: client.defaultHeaders });
  }
  override request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    return super.request<T>({
      ...config,
      signal: AbortSignal.any([this.signal, AbortSignal.timeout(limits.requestMs)]),
    });
  }
}

export class WhatsAppAdapter extends CloudAdapter {
  private readonly output = Symbol("whatsapp-output");
  readonly signalKey = Symbol("whatsapp-signal");

  constructor(private readonly config: Config, private readonly tokenFactory?: TokenClientFactory) {
    super({
      clientId: config.botId, tenantId: config.tenantId, clientSecret: config.botSecret,
      connectionName: "default", authType: "ClientSecret",
    });
    this.onTurnError = async (_context, error) => { throw error; };
  }

  async processActivity(
    activity: Activity, send: SendActivities, run: (context: TurnContext) => Promise<void>,
    signal: AbortSignal = AbortSignal.timeout(limits.turnMs),
  ): Promise<void> {
    // Only call this after verifying Meta's signature and constructing the activity
    // locally. No public Bot Connector endpoint accepts a caller-supplied identity.
    const context = new TurnContext(this, activity, CloudAdapter.createIdentity(this.config.botId));
    const tokenClient = this.tokenFactory
      ? await this.tokenFactory()
      : await this.createUserTokenClient(CloudAdapter.createIdentity(this.config.botId));
    if (!this.tokenFactory) {
      tokenClient.client = new BoundedTokenHttpClient(tokenClient.client, signal);
    }
    this.setUserTokenClient(context, tokenClient);
    context.turnState.set(this.output, send);
    context.turnState.set(this.signalKey, signal);
    signal.throwIfAborted();
    await this.runMiddleware(context, run);
  }

  override async sendActivities(context: TurnContext, activities: Activity[]): Promise<{ id: string }[]> {
    await context.turnState.get<SendActivities>(this.output)(activities);
    return activities.map(() => ({ id: randomUUID() }));
  }

  override async updateActivity(): Promise<never> {
    throw new RelayError("update_not_supported", "WhatsApp message updates are not supported.");
  }
  override async deleteActivity(): Promise<never> {
    throw new RelayError("delete_not_supported", "WhatsApp message deletion is not supported.");
  }
  override async continueConversation(
    _identity: Parameters<CloudAdapter["continueConversation"]>[0],
    _reference: Partial<ConversationReference>,
    _logic: (context: TurnContext) => Promise<void>,
  ): Promise<never> {
    throw new RelayError("proactive_not_supported", "Unsolicited/proactive turns are outside this sample.");
  }
}
