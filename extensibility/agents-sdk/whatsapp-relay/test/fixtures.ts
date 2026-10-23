import { randomUUID } from "node:crypto";
import { loadConfig } from "../src/config.js";
import { type Incoming } from "../src/meta.js";

export const env = {
  META_GRAPH_VERSION: "v25.0", META_ACCESS_TOKEN: "fixture-meta-token",
  META_APP_SECRET: "fixture-secret", META_VERIFY_TOKEN: "fixture-verify", META_PHONE_NUMBER_ID: "123",
  META_WABA_ID: "456", BOT_CLIENT_ID: "00000000-0000-0000-0000-000000000001",
  BOT_TENANT_ID: "00000000-0000-0000-0000-000000000002", BOT_CLIENT_SECRET: "fixture-bot-secret",
  BOT_OAUTH_CONNECTION: "mcs", GHCP_CLOUD: "Prod",
  GHCP_DIRECT_CONNECT_URL: "https://example.com/copilotstudio/agenticruntime/3p/dataverse-backed/authenticated/bots/test?api-version=1",
};
export const config = loadConfig(env);
export const signal = () => AbortSignal.timeout(5000);
export function incoming(value: string, sender = "alice", timestamp = Date.now()): Incoming {
  return { kind: "message", key: sender, id: randomUUID(), sender, timestamp, text: value };
}
export function webhook(messages: unknown[] = [], statuses: unknown[] = []) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: config.accountId, changes: [{ field: "messages", value: {
      metadata: { phone_number_id: config.phoneId }, messages, statuses,
    } }] }],
  };
}
export function message(body = "hello", id = "mid") {
  return { from: "sender", id, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body } };
}
export function sse(activities: object[], id?: string): Response {
  return new Response(activities.map(activity => `event: activity\ndata: ${JSON.stringify(activity)}\n\n`).join(""), {
    headers: { "Content-Type": "text/event-stream", ...(id ? { "x-ms-conversationid": id } : {}) },
  });
}
