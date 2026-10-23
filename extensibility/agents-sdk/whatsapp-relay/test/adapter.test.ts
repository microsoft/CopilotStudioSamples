import assert from "node:assert/strict";
import { test } from "node:test";
import { Activity } from "@microsoft/agents-activity";
import { HttpClient, UserTokenClient } from "@microsoft/agents-hosting";
import { WhatsAppAdapter } from "../src/adapter.js";
import { limits } from "../src/config.js";
import { config } from "./fixtures.js";

class TokenAdapter extends WhatsAppAdapter {
  readonly tokens = new UserTokenClient(new HttpClient({
    baseURL: "https://tokens.example.test",
    headers: { authorization: "Bearer fixture" },
  }));

  constructor() { super(config); }

  // Replace credential bootstrap, not the production HTTP-client wrapping path.
  protected override async createUserTokenClient(): Promise<UserTokenClient> { return this.tokens; }
}

test("token-service requests abort at the request deadline without cancelling the turn", async t => {
  const turn = new AbortController();
  const deadline = new AbortController();
  const reason = new DOMException("Token request timed out", "TimeoutError");
  const timeout = t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    assert.equal(milliseconds, limits.requestMs);
    return deadline.signal;
  });
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    assert.equal(timeout.mock.callCount(), 1);
    const signal = init?.signal;
    assert(signal);
    assert.notEqual(signal, turn.signal);
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      queueMicrotask(() => deadline.abort(reason));
    });
  });
  const adapter = new TokenAdapter();
  await assert.rejects(adapter.processActivity(new Activity("message"), async () => {}, async () => {
    await adapter.tokens.getUserToken(config.oauthConnection, "whatsapp", "user");
  }, turn.signal), error => error === reason);
  assert.equal(turn.signal.aborted, false);
});

test("turn cancellation aborts a token-service request before its own deadline", async t => {
  const turn = new AbortController();
  const deadline = new AbortController();
  const reason = new Error("Turn cancelled");
  t.mock.method(AbortSignal, "timeout", () => deadline.signal);
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const signal = init?.signal;
    assert(signal);
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      queueMicrotask(() => turn.abort(reason));
    });
  });
  const adapter = new TokenAdapter();
  await assert.rejects(adapter.processActivity(new Activity("message"), async () => {}, async () => {
    await adapter.tokens.getUserToken(config.oauthConnection, "whatsapp", "user");
  }, turn.signal), error => error === reason);
  assert.equal(deadline.signal.aborted, false);
});

test("each token-service request gets a fresh deadline and preserves SDK HTTP configuration", async t => {
  const turn = new AbortController();
  const deadlines: AbortController[] = [];
  const signals: AbortSignal[] = [];
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    assert.equal(milliseconds, limits.requestMs);
    const deadline = new AbortController();
    deadlines.push(deadline);
    return deadline.signal;
  });
  t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://tokens.example.test");
    assert.equal(url.pathname, "/api/usertoken/GetToken");
    assert.equal(url.searchParams.get("connectionName"), config.oauthConnection);
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fixture");
    const signal = init?.signal;
    assert(signal);
    assert.equal(signal.aborted, false);
    signals.push(signal);
    return Response.json({ token: "delegated-fixture" });
  });
  const adapter = new TokenAdapter();
  await adapter.processActivity(new Activity("message"), async () => {}, async () => {
    assert.equal((await adapter.tokens.getUserToken(config.oauthConnection, "whatsapp", "user")).token, "delegated-fixture");
    assert.equal(deadlines.length, 1);
    deadlines[0]!.abort(new DOMException("Previous request deadline expired", "TimeoutError"));
    assert.equal((await adapter.tokens.getUserToken(config.oauthConnection, "whatsapp", "user")).token, "delegated-fixture");
  }, turn.signal);
  assert.equal(deadlines.length, 2);
  assert.equal(signals.length, 2);
  assert.notEqual(signals[0], signals[1]);
  assert.equal(turn.signal.aborted, false);
});
