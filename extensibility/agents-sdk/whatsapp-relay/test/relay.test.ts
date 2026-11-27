import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createHmac } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { Activity } from "@microsoft/agents-activity";
import { HttpClient, type HttpRequestConfig, type HttpResponse, UserTokenClient } from "@microsoft/agents-hosting";
import { WhatsAppAdapter } from "../src/adapter.js";
import { limits } from "../src/config.js";
import { GhcpClient } from "../src/ghcp.js";
import { fileFromBytes, type MediaFile } from "../src/media.js";
import { type Incoming, type MetaEvent } from "../src/meta.js";
import { Relay } from "../src/relay.js";
import { MemoryQueue } from "../src/queue.js";
import { webhookServer } from "../src/server.js";
import { config, incoming, message, sse, webhook } from "./fixtures.js";

class TokenService extends HttpClient {
  readonly requests: HttpRequestConfig[] = [];
  readonly codes = new Map<string, string>();
  readonly tokens = new Map<string, string>();
  readonly signedOut: string[] = [];
  constructor() { super({ headers: { authorization: "Bearer fixture-bot-token" } }); }
  override async request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    this.requests.push(config);
    const user = config.params?.userId;
    assert(user);
    assert.equal(config.params?.channelId, "whatsapp");
    assert.equal(config.params?.connectionName, "mcs");
    if (config.url.endsWith("/SignOut")) {
      this.tokens.delete(user);
      this.signedOut.push(user);
    } else {
      const code = config.params?.code;
      if (code && this.codes.get(code) === user) {
        this.codes.delete(code);
        this.tokens.set(user, `delegated:${user}`);
      }
    }
    const token = this.tokens.get(user);
    // The token service's success and sign-in alternatives are exercised through the real SDK client.
    const data = token ? { tokenResponse: { token } } : {
      signInResource: { signInLink: "https://token.botframework.com/api/oauth/signin?fixture", tokenExchangeResource: {}, tokenPostResource: {} },
    };
    return { data: data as T, status: 200, statusText: "OK", headers: new Headers(), config };
  }
  lastUser(): string { return this.requests.at(-1)!.params!.userId!; }
}

function fixture(now = Date.now, runner?: Pick<GhcpClient, "turn">) {
  const auth = new TokenService();
  const messages: { to: string; text: string }[] = [];
  const files: MediaFile[] = [];
  const typing: string[] = [];
  const downloads: NonNullable<Incoming["media"]>[] = [];
  const calls: { activity: Activity; token: string }[] = [];
  const meta = {
    async sendText(to: string, text: string) { messages.push({ to, text }); return ["sent"]; },
    async sendSignIn(to: string, link: string) { messages.push({ to, text: link }); return ["signin"]; },
    async sendFile(_to: string, file: MediaFile) { files.push(file); return "file"; },
    async typing(id: string) { typing.push(id); },
    async download(media: NonNullable<Incoming["media"]>) {
      downloads.push(media);
      return fileFromBytes(Buffer.from("incoming content"), "text/plain", media.name);
    },
  };
  const ghcp: Pick<GhcpClient, "turn"> = runner ?? {
    async turn(_session, activity, token, sink) {
      calls.push({ activity, token });
      await sink(Activity.fromObject({ type: "typing", text: "Do not show partial answer." }));
      await sink(Activity.fromObject({ type: "message", text: "Do not show tool status.", channelData: { streamType: "informative" } }));
      await sink(Activity.fromObject({ type: "message", text: "Do not show thought.", entities: [{ type: "thought", text: "private" }] }));
      await sink(Activity.fromObject({ id: "final", type: "message", text: "Answer", attachments: [{
        contentType: "text/plain", contentUrl: "data:text/plain;base64,aGVsbG8=", name: "hello.txt",
      }] }));
      await sink(Activity.fromObject({ id: "final", type: "message", text: "Answer" }));
    },
  };
  const adapter = new WhatsAppAdapter(config, async () => new UserTokenClient(auth));
  const relay = new Relay(config, adapter, meta, ghcp, () => false, now);
  return { auth, messages, files, typing, downloads, calls, relay, meta };
}

test("real SDK OAuth card -> code -> original request; only final outputs and files reach WhatsApp", async () => {
  const f = fixture();
  await f.relay.handle(incoming("original question"));
  assert(f.messages[0]?.text.startsWith("https://token.botframework.com/"));
  assert.equal(f.calls.length, 0);
  f.auth.codes.set("123456", f.auth.lastUser());
  await f.relay.handle(incoming("123456"));
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0]?.activity.text, "original question");
  assert.equal(f.calls[0]?.activity.conversation, undefined);
  assert(f.calls[0]?.token.startsWith("delegated:alice."));
  assert.equal(f.messages.filter(item => item.text === "Answer").length, 1);
  assert.equal(f.messages.some(item => item.text.includes("Do not show")), false);
  assert.equal(f.files.length, 1);
  assert.equal(f.typing.length, 1);
  const user = f.auth.lastUser();
  f.auth.tokens.set(user, "refreshed-token");
  await f.relay.handle(incoming("followup"));
  assert.equal(f.calls[1]?.token, "refreshed-token");
  await f.relay.handle(incoming("123456"));
  assert.equal(f.calls.length, 2);
  assert.match(f.messages.at(-1)!.text, /no pending sign-in/);
});

test("authentication and one-time codes cannot cross senders", async () => {
  const f = fixture();
  await f.relay.handle(incoming("alice question", "alice"));
  const alice = f.auth.lastUser();
  f.auth.codes.set("123456", alice);
  await f.relay.handle(incoming("bob question", "bob"));
  const bob = f.auth.lastUser();
  assert.notEqual(alice, bob);
  await f.relay.handle(incoming("123456", "bob"));
  assert.equal(f.calls.length, 0);
  await f.relay.handle(incoming("123456", "alice"));
  assert.equal(f.calls[0]?.activity.text, "alice question");
  assert.equal(f.calls[0]?.token, `delegated:${alice}`);
});

test("pending sign-in releases the worker; media is downloaded only after auth", async () => {
  const f = fixture();
  const event = incoming("inspect document");
  event.media = { id: "media", kind: "document", mime: "text/plain", name: "example.txt" };
  await f.relay.handle(event);
  assert.equal(f.downloads.length, 0);
  const user = f.auth.lastUser();
  await f.relay.handle(incoming("another request"));
  assert.match(f.messages.at(-1)!.text, /Sign-in is pending/);
  f.auth.codes.set("123456", user);
  await f.relay.handle(incoming("123456"));
  assert.equal(f.downloads.length, 1);
  assert.equal(f.calls[0]?.activity.text, "inspect document");
  assert.equal(f.calls[0]?.activity.attachments?.[0]?.contentUrl,
    `data:text/plain;base64,${Buffer.from("incoming content").toString("base64")}`);
});

test("expired codes and codes from a previous relay process cannot invoke the agent", async () => {
  let now = Date.now();
  const f = fixture(() => now);
  await f.relay.handle(incoming("request", "alice", now));
  f.auth.codes.set("123456", f.auth.lastUser());
  now += limits.authMs + 1;
  await f.relay.handle(incoming("123456", "alice", now));
  assert.equal(f.calls.length, 0);
  assert.match(f.messages.at(-1)!.text, /expired/);
  const restarted = fixture();
  await restarted.relay.handle(incoming("123456"));
  assert.equal(restarted.calls.length, 0);
  assert.equal(restarted.auth.requests.length, 0);
});

test("signout cancels pending auth; reset clears the GHCP session", async () => {
  const seen: (string | undefined)[] = [];
  const f = fixture(Date.now, {
    async turn(session, _activity, _token, sink) {
      seen.push(session.conversationId);
      session.conversationId = "remote";
      await sink(Activity.fromObject({ type: "message", text: "answer" }));
    },
  });
  await f.relay.handle(incoming("question"));
  const old = f.auth.lastUser();
  await f.relay.handle(incoming("--signout"));
  assert.deepEqual(f.auth.signedOut, [old]);
  await f.relay.handle(incoming("new question"));
  assert.notEqual(old, f.auth.lastUser());
  f.auth.codes.set("654321", f.auth.lastUser());
  await f.relay.handle(incoming("654321"));
  await f.relay.handle(incoming("followup"));
  await f.relay.handle(incoming("--reset"));
  await f.relay.handle(incoming("after reset"));
  assert.deepEqual(seen, [undefined, "remote", undefined]);
});

test("closed service windows, statuses, and unsupported inputs never invoke the agent", async () => {
  const f = fixture();
  await f.relay.handle(incoming("old", "alice", Date.now() - limits.windowMs - 1));
  await f.relay.handle({ kind: "status", key: "alice", id: "status", messageId: "out", sender: "alice", status: "delivered", timestamp: Date.now() });
  await f.relay.handle({ ...incoming(""), unsupported: true });
  assert.equal(f.calls.length, 0);
  assert.equal(f.auth.requests.length, 0);
  assert.match(f.messages.at(-1)!.text, /Other WhatsApp message types/);
});

test("signed webhook -> queue -> SDK auth -> GHCP SSE -> final output, with prompt ACK and dedup", async t => {
  let calls = 0, release: (() => void) | undefined, started!: () => void;
  const startedTurn = new Promise<void>(resolve => { started = resolve; });
  const runtime = new GhcpClient(config.ghcpUrl, async (_url, init) => {
    calls++;
    if (calls === 1) return sse([{ type: "typing" }], "conversation-id");
    assert.equal(JSON.parse(String(init?.body)).activity.text, "original");
    await new Promise<void>(resolve => { release = resolve; started(); });
    return sse([{ type: "message", text: "completed" }, { type: "event", name: "turn.complete" }]);
  });
  const f = fixture(Date.now, runtime);
  const queue = new MemoryQueue<MetaEvent>(event => f.relay.handle(event), {
    capacity: 10, perKey: 4, concurrency: 2, dedupMs: 10000, dedupEntries: 100,
  });
  const server = webhookServer(config, queue);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { release?.(); f.relay.abort(); queue.stop(); server.closeAllConnections(); server.close(); });
  const address = server.address();
  assert(address && typeof address !== "string");
  const post = async (value: string, id: string) => {
    const body = JSON.stringify(webhook([message(value, id)]));
    return fetch(`http://127.0.0.1:${address.port}/webhook`, {
      method: "POST", body, signal: AbortSignal.timeout(2000),
      headers: { "Content-Type": "application/json",
        "X-Hub-Signature-256": `sha256=${createHmac("sha256", config.metaSecret).update(body).digest("hex")}` },
    });
  };
  assert.equal((await post("original", "original-id")).status, 200);
  await queue.drain();
  f.auth.codes.set("123456", f.auth.lastUser());
  assert.equal((await post("123456", "code-id")).status, 200);
  await startedTurn;
  assert.equal((await post("123456", "code-id")).status, 200);
  assert.equal(calls, 2);
  release!();
  await queue.drain();
  assert.equal(f.messages.filter(item => item.text === "completed").length, 1);
});

test("typing refresh is throttled and stops after the final answer", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let now = Date.now();
  const f = fixture(() => now, {
    async turn(_session, _activity, _token, sink) {
      await sink(new Activity("typing"));
      await sink(new Activity("typing"));
      assert.equal(f.typing.length, 1);
      now += limits.typingMs;
      t.mock.timers.tick(limits.typingMs);
      await setImmediate();
      await sink(new Activity("typing"));
      assert.equal(f.typing.length, 2);
      await sink(Activity.fromObject({ type: "message", text: "done" }));
    },
  });
  await f.relay.handle(incoming("question", "alice", now));
  f.auth.codes.set("123456", f.auth.lastUser());
  await f.relay.handle(incoming("123456", "alice", now));
  now += limits.typingMs;
  t.mock.timers.tick(limits.typingMs);
  await setImmediate();
  assert.equal(f.typing.length, 2);
});

test("typing failures do not replay or discard the completed answer", async () => {
  const f = fixture();
  f.meta.typing = async () => { throw new Error("fixture failure"); };
  await f.relay.handle(incoming("question"));
  f.auth.codes.set("123456", f.auth.lastUser());
  await f.relay.handle(incoming("123456"));
  assert.equal(f.calls.length, 1);
  assert.equal(f.messages.at(-1)!.text, "Answer");
});

test("idle expiry changes the SDK identity and shutdown stops new turns", async () => {
  let now = Date.now();
  const f = fixture(() => now);
  await f.relay.handle(incoming("question", "alice", now));
  const old = f.auth.lastUser();
  now += limits.sessionMs + 1;
  await f.relay.handle(incoming("new", "alice", now));
  assert.notEqual(f.auth.lastUser(), old);
  const count = f.auth.requests.length;
  f.relay.abort();
  await f.relay.handle(incoming("ignored", "bob", now));
  assert.equal(f.auth.requests.length, count);
});
