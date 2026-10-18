import { createHash } from "node:crypto";
import { array, type Fetch, httpsUrl, readBytes, readJson, record, RelayError, responseError, text } from "./common.js";
import { type Config, limits } from "./config.js";
import { fileFromBytes, type MediaFile, type MediaKind, mediaType } from "./media.js";

export interface Incoming {
  kind: "message";
  key: string;
  id: string;
  sender: string;
  timestamp: number;
  text: string;
  media?: { id: string; mime: string; name?: string; kind: MediaKind };
  unsupported?: boolean;
}
export interface Delivery {
  kind: "status"; key: string; id: string; messageId: string;
  sender: string; status: string; timestamp: number;
}
export type MetaEvent = Incoming | Delivery;

export function parseWebhook(value: unknown, config: Pick<Config, "accountId" | "phoneId">): MetaEvent[] {
  const root = record(value);
  if (root.object !== "whatsapp_business_account") throw new RelayError("webhook_object", "Unsupported webhook.");
  const output: MetaEvent[] = [];
  for (const entryValue of array(root.entry)) {
    const entry = record(entryValue);
    if (entry.id !== config.accountId) throw new RelayError("wrong_account", "Unexpected business account.");
    for (const changeValue of array(entry.changes)) {
      const change = record(changeValue);
      if (change.field !== "messages") continue;
      const payload = record(change.value);
      if (record(payload.metadata).phone_number_id !== config.phoneId) throw new RelayError("wrong_phone", "Unexpected business number.");
      const key = (sender: string) => createHash("sha256").update(JSON.stringify([config.accountId, config.phoneId, sender])).digest("hex");
      for (const messageValue of payload.messages === undefined ? [] : array(payload.messages)) {
        const message = record(messageValue);
        const sender = text(message.from, 256);
        const timestamp = Number(text(message.timestamp, 16)) * 1000;
        if (!sender || !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > Date.now() + 5 * 60_000) {
          throw new RelayError("invalid_sender_time", "Invalid message metadata.");
        }
        const item: Incoming = { kind: "message", key: key(sender), id: text(message.id, 512), sender, timestamp, text: "" };
        if (!item.id) throw new RelayError("missing_id", "The message has no ID.");
        if (message.type === "text") item.text = text(record(message.text).body, 16_384);
        else if (message.type === "image" || message.type === "document" || message.type === "audio" || message.type === "video") {
          const media = record(message[message.type]);
          item.media = { kind: message.type, id: text(media.id, 256), mime: text(media.mime_type, 256) };
          if (!item.media.id) throw new RelayError("missing_media_id", "The attachment has no media ID.");
          if (media.filename !== undefined) item.media.name = text(media.filename, 512);
          if (media.caption !== undefined) item.text = text(media.caption, 4096);
        } else item.unsupported = true;
        output.push(item);
      }
      for (const statusValue of payload.statuses === undefined ? [] : array(payload.statuses)) {
        const status = record(statusValue);
        const sender = text(status.recipient_id, 256);
        const messageId = text(status.id, 512);
        const state = text(status.status, 64);
        const timestamp = Number(text(status.timestamp, 16)) * 1000;
        if (!sender || !messageId || !state || !Number.isFinite(timestamp) || timestamp <= 0 ||
            timestamp > Date.now() + 5 * 60_000) throw new RelayError("invalid_status", "Invalid delivery status.");
        output.push({ kind: "status", key: key(sender), id: `${messageId}:${state}:${timestamp}`, messageId, sender, status: state, timestamp });
      }
      if (payload.errors !== undefined && !payload.messages) {
        throw new RelayError("meta_webhook_error", "Meta reported a messaging error.");
      }
    }
  }
  return output;
}

export function splitText(value: string, max = 4096): string[] {
  if (!Number.isInteger(max) || max < 1) throw new RangeError("Chunk length must be positive.");
  const chunks: string[] = [];
  let start = 0, offset = 0, count = 0;
  for (const char of value) {
    if (chunks.length >= limits.outboundMessages) throw new RelayError("message_limit", "The agent's answer is too long for this sample.");
    offset += char.length;
    if (++count === max) {
      chunks.push(value.slice(start, offset));
      start = offset;
      count = 0;
    }
  }
  if (count) chunks.push(value.slice(start));
  return chunks;
}

export class MetaClient {
  constructor(private readonly config: Config, private readonly fetcher: Fetch = fetch) {}

  private async request(path: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
    const response = await this.fetcher(`https://graph.facebook.com/${this.config.graphVersion}/${path}`, {
      ...init, redirect: "error",
      headers: { Authorization: `Bearer ${this.config.metaToken}`, ...init.headers },
      signal: AbortSignal.any([signal, AbortSignal.timeout(limits.requestMs)]),
    });
    if (!response.ok) { await response.body?.cancel(); throw responseError("meta", response.status); }
    return readJson(response);
  }

  private async send(to: string, body: object, signal: AbortSignal): Promise<string> {
    const result = record(await this.request(`${this.config.phoneId}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...body }),
    }, signal));
    const id = text(record(array(result.messages)[0]).id, 512);
    if (!id) throw new RelayError("meta_send_id", "Meta did not return an outbound message ID.");
    return id;
  }

  async sendText(to: string, value: string, signal: AbortSignal): Promise<string[]> {
    const chunks = splitText(value);
    const ids: string[] = [];
    for (const body of chunks) ids.push(await this.send(to, { type: "text", text: { body } }, signal));
    return ids;
  }

  async sendSignIn(to: string, link: string, signal: AbortSignal): Promise<string[]> {
    const url = httpsUrl(link);
    if (url.hostname !== "token.botframework.com") throw new RelayError("oauth_link", "The OAuth service returned an unexpected sign-in URL.");
    return [await this.send(to, {
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: {
          text: "Sign in to continue. Only use this button if you requested sign-in.\n\nAfter signing in, send the six-digit verification code here. Use --signout to cancel.",
        },
        action: {
          name: "cta_url",
          parameters: { display_text: "Sign in", url: link },
        },
      },
    }, signal)];
  }

  async typing(messageId: string, signal: AbortSignal): Promise<void> {
    await this.request(`${this.config.phoneId}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } }),
    }, signal);
  }

  async download(media: NonNullable<Incoming["media"]>, signal: AbortSignal): Promise<MediaFile> {
    const spec = mediaType(media.mime);
    if (spec.kind !== media.kind) throw new RelayError("media_type_mismatch", "The attachment type does not match its metadata.");
    const metadata = record(await this.request(`${encodeURIComponent(media.id)}?phone_number_id=${this.config.phoneId}`, { method: "GET" }, signal));
    const size = Number(metadata.file_size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > spec.max || mediaType(text(metadata.mime_type)).mime !== spec.mime) {
      throw new RelayError("media_size_type", "The attachment exceeds the size limit or has inconsistent metadata.");
    }
    const url = httpsUrl(text(metadata.url, 8192));
    if (!["lookaside.fbsbx.com", "lookaside.facebook.com"].includes(url.hostname)) {
      throw new RelayError("meta_media_origin", "Meta returned an unexpected media host.");
    }
    const response = await this.fetcher(url, {
      headers: { Authorization: `Bearer ${this.config.metaToken}` }, redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(limits.requestMs)]),
    });
    if (!response.ok) { await response.body?.cancel(); throw responseError("meta_media", response.status); }
    const bytes = await readBytes(response, spec.max);
    if (bytes.length !== size) throw new RelayError("media_size_mismatch", "The downloaded file size does not match its metadata.");
    if (metadata.sha256 !== undefined) {
      const hash = text(metadata.sha256, 64);
      const digest = createHash("sha256").update(bytes).digest();
      const matches = /^[\da-f]{64}$/i.test(hash) ? digest.toString("hex") === hash.toLowerCase()
        : digest.toString("base64") === hash;
      if (!matches) throw new RelayError("media_digest", "Attachment integrity validation failed.");
    }
    return fileFromBytes(bytes, spec.mime, media.name);
  }

  async sendFile(to: string, file: MediaFile, signal: AbortSignal): Promise<string> {
    const form = new FormData();
    form.set("messaging_product", "whatsapp");
    form.set("type", file.mime);
    form.set("file", new Blob([new Uint8Array(file.bytes)], { type: file.mime }), file.name);
    const uploaded = record(await this.request(`${this.config.phoneId}/media`, { method: "POST", body: form }, signal));
    const id = text(uploaded.id, 256);
    if (!id) throw new RelayError("meta_upload_id", "Meta did not return an uploaded media ID.");
    return this.send(to, {
      type: file.kind,
      [file.kind]: { id, ...(file.kind === "document" ? { filename: file.name } : {}) },
    }, signal);
  }
}
