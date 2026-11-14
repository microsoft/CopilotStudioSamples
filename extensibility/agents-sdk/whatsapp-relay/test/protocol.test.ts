import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { request } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { loadConfig, limits } from "../src/config.js";
import { parseWebhook, splitText } from "../src/meta.js";
import { webhookServer, verifySignature } from "../src/server.js";
import { config, env, message, webhook } from "./fixtures.js";

test("requires explicit endpoint/version, cloud, IDs, and safe file origins", () => {
  assert.equal(loadConfig(env).cloud, "Prod");
  assert.equal(loadConfig(env).host, "127.0.0.1");
  assert.equal(loadConfig({ ...env, RELAY_HOST: "0.0.0.0", PORT: "8080" }).port, 8080);
  assert.equal(loadConfig({ ...env, RELAY_HOST: "0.0.0.0" }).host, "0.0.0.0");
  for (const change of [
    { GHCP_CLOUD: "Unknown" }, { BOT_CLIENT_ID: "wrong" }, { META_PHONE_NUMBER_ID: "abc" },
    { GHCP_DIRECT_CONNECT_URL: "https://example.com/bot" },
    { GHCP_DIRECT_CONNECT_URL: "https://example.com/bot/conversations?api-version=1" },
    { GHCP_DIRECT_CONNECT_URL: "http://example.com/bot?api-version=1" },
    { GHCP_DIRECT_CONNECT_URL: "https://user:pass@example.com/bot?api-version=1" },
    { GHCP_FILE_ORIGINS: "https://example.com/path" }, { META_ACCESS_TOKEN: "" },
    { RELAY_HOST: "external.example.org" },
  ]) assert.throws(() => loadConfig({ ...env, ...change }));
});

test("parses batches, ignores status turns, and rejects another account/number", () => {
  const payload = webhook([message("one", "1"), message("two", "2")], [{
    recipient_id: "sender", id: "out", status: "delivered", timestamp: String(Math.floor(Date.now() / 1000)),
  }]);
  const events = parseWebhook(payload, config);
  assert.equal(events.length, 3);
  assert.equal(events[0]?.key, events[2]?.key);
  assert.equal(events[2]?.kind, "status");
  assert.throws(() => parseWebhook(payload, { ...config, accountId: "different" }));
  assert.throws(() => parseWebhook(payload, { ...config, phoneId: "different" }));
});

test("signature covers exact raw bytes", () => {
  const body = Buffer.from('{"entry": []}');
  const signature = `sha256=${createHmac("sha256", config.metaSecret).update(body).digest("hex")}`;
  assert(verifySignature(body, signature, config.metaSecret));
  assert.equal(verifySignature(Buffer.from('{"entry":[]}'), signature, config.metaSecret), false);
  for (const bad of [undefined, "", "sha256=invalid", `sha256=${"0".repeat(64)}`]) {
    assert.equal(verifySignature(body, bad, config.metaSecret), false);
  }
});

test("splits text on Unicode codepoints without corrupting emoji", () => {
  const text = "\u{1f600}".repeat(4097);
  const chunks = splitText(text);
  assert.equal(chunks.length, 2);
  assert.equal(Array.from(chunks[0]!).length, 4096);
  assert.equal(chunks.join(""), text);
  assert.throws(() => splitText("x".repeat(4096 * limits.outboundMessages + 1)), /message_limit/);
  assert.throws(() => splitText("x", 0));
});

test("HTTP handshake, signature validation, atomic admission, and body limits", async t => {
  let admitted = 0, accepting = true;
  const server = webhookServer(config, { accept(events) { admitted += events.length; return accepting; } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/health`)).status, 200);
  const handshake = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=${config.verifyToken}&hub.challenge=12345`);
  assert.equal(await handshake.text(), "12345");
  assert.equal((await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123`)).status, 403);
  const body = JSON.stringify(webhook([message()]));
  const post = (signature: string) => fetch(`${base}/webhook`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature }, body,
  });
  assert.equal((await post("bad")).status, 401);
  assert.equal(admitted, 0);
  const signature = `sha256=${createHmac("sha256", config.metaSecret).update(body).digest("hex")}`;
  assert.equal((await post(signature)).status, 200);
  assert.equal(admitted, 1);
  accepting = false;
  assert.equal((await post(signature)).status, 503);
  const oversize = await new Promise<number>(resolve => {
    const req = request(`${base}/webhook`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature },
    }, res => { res.resume(); resolve(res.statusCode!); });
    req.end(Buffer.alloc(limits.bodyBytes + 1));
  });
  assert.equal(oversize, 413);
});
