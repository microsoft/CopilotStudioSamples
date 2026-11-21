import assert from "node:assert/strict";
import { test } from "node:test";
import { Activity } from "@microsoft/agents-activity";
import { GhcpClient, conversationUrl, type GhcpSession } from "../src/ghcp.js";
import { config, signal, sse } from "./fixtures.js";
import { limits } from "../src/config.js";

const done = { type: "event", name: "turn.complete" };
test("starts once without a startup event, captures header-only ID, and uses the delegated token on every turn", async () => {
  const calls: { url: URL; body: unknown; token: string | null }[] = [];
  const client = new GhcpClient(config.ghcpUrl, async (input, init) => {
    calls.push({ url: new URL(String(input)), body: JSON.parse(String(init?.body)),
      token: new Headers(init?.headers).get("Authorization") });
    return calls.length === 1 ? sse([{ type: "typing" }], "conversation")
      : sse([{ type: "message", text: "answer" }, done]);
  });
  const session: GhcpSession = { uncertain: false };
  const messages: string[] = [];
  const sink = async (activity: Activity) => { if (activity.text) messages.push(activity.text); };
  await client.turn(session, Activity.fromObject({ type: "message", text: "hello" }), "alice-token", sink, signal());
  await client.turn(session, Activity.fromObject({ type: "message", text: "again" }), "refreshed-alice-token", sink, signal());
  assert.equal(calls.length, 3);
  assert(calls[0]!.url.pathname.endsWith("/conversations"));
  assert.deepEqual(calls[0]!.body, { emitStartConversationEvent: false });
  assert(calls[1]!.url.pathname.endsWith("/conversations/conversation"));
  assert.equal(calls[2]!.token, "Bearer refreshed-alice-token");
  assert.equal(calls[2]!.url.searchParams.get("api-version"), "1");
  assert.deepEqual(calls[1]!.body, { activity: { type: "message", text: "hello" } });
  assert.deepEqual(messages, ["answer", "answer"]);
  assert.equal(conversationUrl(config.ghcpUrl, "a/b").pathname.split("/").at(-1), "a%2Fb");
});

test("handles UTF-8 and CRLF split at every byte; cancels the stream at completion", async () => {
  const wire = Buffer.from(`event: activity\r\ndata: {"type":"message","text":"\u{1f600}"}\r\n\r\nevent: activity\r\ndata: ${JSON.stringify(done)}\r\n\r\n`);
  let index = 0, cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(wire.subarray(index, ++index)); },
    cancel() { cancelled = true; },
  });
  const client = new GhcpClient(config.ghcpUrl, async () => new Response(body, { headers: { "Content-Type": "text/event-stream" } }));
  const output: string[] = [];
  await client.turn({ conversationId: "id", uncertain: false }, new Activity("message"), "token",
    async item => { if (item.text) output.push(item.text); }, signal());
  assert.deepEqual(output, ["\u{1f600}"]);
  assert(cancelled);
});

for (const [name, response] of [
  ["HTTP error", () => new Response("sensitive remote error", { status: 403 })],
  ["non-SSE", () => new Response("{}")],
  ["truncated turn", () => sse([{ type: "message", text: "partial" }])],
  ["explicit stream error", () => new Response("event: error\ndata: private\n\n", { headers: { "Content-Type": "text/event-stream" } })],
  ["conflicting conversation", () => sse([done], "other")],
] as const) {
  test(`${name} is not retried and makes the session uncertain`, async () => {
    let calls = 0;
    const client = new GhcpClient(config.ghcpUrl, async () => { calls++; return response(); });
    const session = { conversationId: "id", uncertain: false };
    await assert.rejects(client.turn(session, new Activity("message"), "token", async () => {}, signal()));
    assert(session.uncertain);
    await assert.rejects(client.turn(session, new Activity("message"), "token", async () => {}, signal()), /uncertain_turn/);
    assert.equal(calls, 1);
  });
}

test("turn cancellation reaches fetch without replay", async () => {
  const controller = new AbortController();
  let received: AbortSignal | null | undefined;
  const client = new GhcpClient(config.ghcpUrl, async (_input, init) => {
    received = init?.signal;
    return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
  });
  const run = client.turn({ conversationId: "id", uncertain: false }, new Activity("message"), "token", async () => {}, controller.signal);
  controller.abort(new Error("cancelled"));
  await assert.rejects(run, /cancelled/);
  assert.equal(received, controller.signal);
});

test("oversized streams are cancelled, not buffered without limit", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(limits.responseBytes / 2 + 1).fill(32)); },
    cancel() { cancelled = true; },
  });
  const client = new GhcpClient(config.ghcpUrl, async () => new Response(body, { headers: { "Content-Type": "text/event-stream" } }));
  await assert.rejects(client.turn({ conversationId: "id", uncertain: false }, new Activity("message"),
    "token", async () => {}, signal()), /response_limit/);
  assert(cancelled);
});

test("endOfConversation clears the conversation; a start without an ID is rejected", async () => {
  const session: GhcpSession = { conversationId: "id", uncertain: false };
  const client = new GhcpClient(config.ghcpUrl, async () => sse([{ type: "endOfConversation" }]));
  await client.turn(session, new Activity("message"), "token", async () => {}, signal());
  assert.equal(session.conversationId, undefined);
  const missing = new GhcpClient(config.ghcpUrl, async () => sse([{ type: "typing" }]));
  await assert.rejects(missing.turn({ uncertain: false }, new Activity("message"),
    "token", async () => {}, signal()), /missing_conversation/);
});
