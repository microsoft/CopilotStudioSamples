import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { limits } from "../src/config.js";
import { fileFromBytes, MemoryBudget, outgoingFile } from "../src/media.js";
import { MetaClient } from "../src/meta.js";
import { readBytes } from "../src/common.js";
import { config, signal } from "./fixtures.js";

export const samples = [
  { mime: "image/png", kind: "image", bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]) },
  { mime: "application/pdf", kind: "document", bytes: Buffer.from("%PDF-1.7\nfixture") },
  { mime: "audio/ogg", kind: "audio", bytes: Buffer.from("OggS fixture OpusHead") },
  { mime: "video/mp4", kind: "video", bytes: Buffer.from("\0\0\0\x18ftypmp42") },
] as const;

for (const sample of samples) {
  test(`${sample.kind}: authenticated download, inline decode, upload then message`, async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const client = new MetaClient(config, async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.includes("/media-id?")) return Response.json({
        url: "https://lookaside.fbsbx.com/media", mime_type: sample.mime, file_size: sample.bytes.length,
        sha256: createHash("sha256").update(sample.bytes).digest("hex"),
      });
      if (url.startsWith("https://lookaside.fbsbx.com")) {
        assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${config.metaToken}`);
        return new Response(new Uint8Array(sample.bytes));
      }
      if (url.endsWith("/media")) {
        assert(init?.body instanceof FormData);
        const blob = init.body.get("file");
        assert(blob instanceof Blob);
        assert.equal(blob.type, sample.mime);
        assert.deepEqual(Buffer.from(await blob.arrayBuffer()), sample.bytes);
        return Response.json({ id: "uploaded-id" });
      }
      assert.deepEqual(JSON.parse(String(init?.body))[sample.kind].id, "uploaded-id");
      return Response.json({ messages: [{ id: "sent-id" }] });
    });
    const file = await client.download({ id: "media-id", mime: sample.mime, kind: sample.kind }, signal());
    assert.deepEqual(file.bytes, sample.bytes);
    const inline = await outgoingFile({
      contentType: sample.mime, name: "../fixture", contentUrl: `data:${sample.mime};base64,${file.bytes.toString("base64")}`,
    }, [], signal());
    assert(!inline.name.includes("/"));
    assert.equal(await client.sendFile("user", inline, signal()), "sent-id");
    assert.equal(requests.length, 4);
    assert(requests.every(item => item.init?.redirect === "error"));
  });
}

test("rejects bad signatures, unsupported types, empty and oversized files", async () => {
  assert.throws(() => fileFromBytes(Buffer.from("wrong"), "image/png"));
  assert.throws(() => fileFromBytes(Buffer.from("text"), "application/javascript"));
  assert.throws(() => fileFromBytes(Buffer.alloc(0), "text/plain"));
  assert.throws(() => fileFromBytes(Buffer.alloc(limits.fileBytes + 1, 32), "text/plain"));
  await assert.rejects(outgoingFile({ contentType: "text/plain", contentUrl: "data:text/plain;base64,###" }, [], signal()));
  await assert.rejects(outgoingFile({ contentType: "text/plain", contentUrl: "data:application/pdf;base64,YQ==" }, [], signal()));
});

for (const { sample, size } of [
  { sample: samples[0], size: 5 * 1024 * 1024 },
  { sample: samples[1], size: 5 * 1024 * 1024 },
  { sample: samples[1], size: limits.fileBytes },
]) {
  test(`${sample.kind}: inline attachments preserve all ${size} bytes`, async () => {
    const bytes = Buffer.alloc(size, 65);
    sample.bytes.copy(bytes);
    const file = await outgoingFile({
      contentType: sample.mime, contentUrl: `data:${sample.mime};base64,${bytes.toString("base64")}`,
    }, [], signal());
    assert.deepEqual(file.bytes, bytes);
  });
}

for (const { sample, size } of [
  { sample: samples[0], size: 5 * 1024 * 1024 + 1 },
  { sample: samples[1], size: limits.fileBytes + 1 },
]) {
  test(`${sample.kind}: inline attachments one byte over the size limit are rejected`, async () => {
    const bytes = Buffer.alloc(size, 65);
    sample.bytes.copy(bytes);
    await assert.rejects(outgoingFile({
      contentType: sample.mime, contentUrl: `data:${sample.mime};base64,${bytes.toString("base64")}`,
    }, [], signal()), /attachment_encoding|media_size/);
  });
}

test("inline base64 accepts all padding lengths without changing decoded content", async () => {
  for (const [data, expected] of [["YQ==", "a"], ["YWI=", "ab"], ["YWJj", "abc"]]) {
    const file = await outgoingFile({
      contentType: "text/plain", contentUrl: `data:text/plain;base64,${data}`,
    }, [], signal());
    assert.equal(file.bytes.toString(), expected);
  }
});

test("inline base64 rejects invalid lengths, misplaced padding, and non-base64 characters", async () => {
  for (const data of [
    "YQ", "YQ=", "YQ===", "Y===", "====", "Y=Q=", "YQ==YWJj",
    "YW J", "YWJj\n", "YWJ_", "YWJ-", "YWJ\u0000", "YWJ\u00e9",
  ]) {
    await assert.rejects(outgoingFile({
      contentType: "text/plain", contentUrl: `data:text/plain;base64,${data}`,
    }, [], signal()), /attachment_encoding/);
  }
});

test("external files require an exact allowlisted origin; no credential forwarding", async () => {
  const file = { contentType: "text/plain", contentUrl: "https://files.example.org/file?sig=fixture" };
  await assert.rejects(outgoingFile(file, [], signal()), /attachment_origin/);
  await assert.rejects(outgoingFile({ ...file, contentUrl: "https://files.example.org.evil.com/x" },
    ["https://files.example.org"], signal()), /attachment_origin/);
  const result = await outgoingFile(file, ["https://files.example.org"], signal(), async (_url, init) => {
    assert.equal(init?.headers, undefined);
    assert.equal(init?.redirect, "error");
    return new Response("hello", { headers: { "Content-Type": "text/plain" } });
  });
  assert.equal(result.bytes.toString(), "hello");
});

test("metadata limits, unexpected download hosts, and digest mismatches are rejected", async () => {
  for (const change of [
    { file_size: limits.fileBytes + 1 }, { url: "https://untrusted.example.org/file" },
    { sha256: "0".repeat(64) },
  ]) {
    const client = new MetaClient(config, async input => String(input).includes("graph.facebook.com")
      ? Response.json({ file_size: 5, mime_type: "text/plain", url: "https://lookaside.fbsbx.com/file", ...change })
      : new Response("hello"));
    await assert.rejects(client.download({ id: "1", mime: "text/plain", kind: "document" }, signal()));
  }
});

test("working memory reservations are released after success and failure", async () => {
  const budget = new MemoryBudget();
  await budget.use(limits.mediaMemoryBytes, async () => {
    await assert.rejects(budget.use(1, async () => {}), /memory_busy/);
  });
  await assert.rejects(budget.use(limits.mediaMemoryBytes, async () => { throw new Error("failure"); }));
  await budget.use(limits.mediaMemoryBytes, async () => {});
});

test("typing uses the native Meta read/typing payload", async () => {
  const client = new MetaClient(config, async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), {
      messaging_product: "whatsapp", status: "read", message_id: "incoming-id", typing_indicator: { type: "text" },
    });
    return Response.json({ success: true });
  });
  await client.typing("incoming-id", signal());
});

test("download limits apply to streamed bytes even without content-length", async () => {
  await assert.rejects(readBytes(new Response("oversize"), 3), /size_limit/);
  await assert.rejects(readBytes(new Response("small", { headers: { "Content-Length": "100" } }), 10), /size_limit/);
});

test("sign-in sends one native URL button with the unchanged SDK link, not a raw text link", async () => {
  const link = "https://token.botframework.com/api/oauth/signin?state=fixture%2Bvalue%2Fvalue%3D&nonce=fixture";
  let calls = 0;
  const client = new MetaClient(config, async (url, init) => {
    calls++;
    assert.equal(String(url), `https://graph.facebook.com/${config.graphVersion}/${config.phoneId}/messages`);
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, {
      messaging_product: "whatsapp", recipient_type: "individual", to: "user",
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: {
          text: "Sign in to continue. Only use this button if you requested sign-in.\n\nAfter signing in, send the six-digit verification code here. Use --signout to cancel.",
        },
        action: { name: "cta_url", parameters: { display_text: "Sign in", url: link } },
      },
    });
    assert(body.interactive.body.text.length <= 1024);
    assert(body.interactive.action.parameters.display_text.length <= 20);
    return Response.json({ messages: [{ id: "signin-id" }] });
  });
  assert.deepEqual(await client.sendSignIn("user", link, signal()), ["signin-id"]);
  assert.equal(calls, 1);
});

test("failed sign-in button sends are surfaced without retrying or sending a raw-link fallback", async () => {
  let calls = 0;
  const client = new MetaClient(config, async () => {
    calls++;
    return new Response("private remote error", { status: 503 });
  });
  await assert.rejects(client.sendSignIn("user", "https://token.botframework.com/api/oauth/signin?fixture", signal()), /meta_http/);
  assert.equal(calls, 1);
});

test("sign-in buttons require HTTPS and the exact trusted OAuth host", async () => {
  const client = new MetaClient(config, async () => { throw new Error("Must not send."); });
  for (const link of [
    "https://untrusted.example.org/login",
    "https://token.botframework.com.untrusted.example.org/login",
    "http://token.botframework.com/api/oauth/signin",
    "https://token.botframework.com:444/api/oauth/signin",
  ]) await assert.rejects(client.sendSignIn("user", link, signal()), /oauth_link|invalid_url/);
});
