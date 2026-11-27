import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { log, RelayError } from "./common.js";
import { type Config, limits } from "./config.js";
import { type MetaEvent, parseWebhook } from "./meta.js";

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifySignature(body: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  return equal(signature.toLowerCase(), `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
}

function rawBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limits.bodyBytes) {
        chunks.length = 0;
        reject(new RelayError("body_limit", "Webhook body too large.", 413));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (size <= limits.bodyBytes) resolve(Buffer.concat(chunks, size));
    });
    request.on("error", reject);
    request.on("aborted", () => reject(new RelayError("body_aborted", "Webhook upload interrupted.", 400)));
  });
}

export function webhookServer(config: Config, queue: { accept(events: MetaEvent[]): boolean }) {
  const server = createServer({ requestTimeout: 10_000, headersTimeout: 10_000 }, (request, response) => {
    const reply = (status: number, body = "") => {
      response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      response.end(body);
    };
    void (async () => {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/health") { reply(200, "ok"); return; }
      if (url.pathname !== "/webhook") { reply(404); return; }
      if (request.method === "GET") {
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        if (url.searchParams.get("hub.mode") !== "subscribe" ||
            !equal(url.searchParams.get("hub.verify_token") ?? "", config.verifyToken) ||
            !challenge || challenge.length > 256) { reply(403); return; }
        reply(200, challenge);
        return;
      }
      if (request.method !== "POST") { reply(405); return; }
      if (request.headers["content-type"]?.split(";")[0]?.trim() !== "application/json") {
        request.resume(); reply(415); return;
      }
      const signature = request.headers["x-hub-signature-256"];
      if (typeof signature !== "string") { request.resume(); reply(401); return; }
      const body = await rawBody(request);
      if (!verifySignature(body, signature, config.metaSecret)) { reply(401); return; }
      let parsed: unknown;
      try { parsed = JSON.parse(body.toString("utf8")); } catch {
        throw new RelayError("webhook_json", "Invalid webhook JSON.", 400);
      }
      const events = parseWebhook(parsed, config);
      if (!queue.accept(events)) {
        response.setHeader("Retry-After", "5");
        reply(503, "busy");
        return;
      }
      // Admission is atomic, but intentionally volatile. Do not wait for auth or agent execution.
      reply(200, "accepted");
    })().catch(error => {
      log("webhook_failed", error);
      if (!response.headersSent && !response.destroyed) reply(error instanceof RelayError ? error.status ?? 400 : 500, "Webhook rejected.");
    });
  });
  server.maxConnections = 64;
  server.maxHeadersCount = 64;
  server.setTimeout(10_000, socket => socket.destroy());
  return server;
}
