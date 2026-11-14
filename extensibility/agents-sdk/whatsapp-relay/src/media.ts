import { createHash } from "node:crypto";
import { type Attachment } from "@microsoft/agents-activity";
import { type Fetch, RelayError, httpsUrl, readBytes, responseError } from "./common.js";
import { limits } from "./config.js";

export type MediaKind = "image" | "document" | "audio" | "video";
export interface MediaFile { bytes: Buffer; mime: string; name: string; kind: MediaKind }

const types: Record<string, [MediaKind, string]> = {
  "image/jpeg": ["image", "jpg"], "image/png": ["image", "png"],
  "application/pdf": ["document", "pdf"], "text/plain": ["document", "txt"],
  "application/msword": ["document", "doc"],
  "application/vnd.ms-excel": ["document", "xls"],
  "application/vnd.ms-powerpoint": ["document", "ppt"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["document", "docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["document", "xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["document", "pptx"],
  "audio/aac": ["audio", "aac"], "audio/amr": ["audio", "amr"],
  "audio/mpeg": ["audio", "mp3"], "audio/mp4": ["audio", "m4a"],
  "audio/ogg": ["audio", "ogg"], "video/mp4": ["video", "mp4"], "video/3gpp": ["video", "3gp"],
};

export function mediaType(mime: string): { mime: string; kind: MediaKind; extension: string; max: number } {
  const normalized = mime.split(";")[0]!.trim().toLowerCase();
  const match = types[normalized];
  if (!match) throw new RelayError("media_type", "This attachment format is not supported. Send a supported image, document, audio clip, or video.");
  return { mime: normalized, kind: match[0], extension: match[1],
    max: match[0] === "image" ? 5 * 1024 * 1024 : limits.fileBytes };
}

export function fileFromBytes(bytes: Buffer, mime: string, name?: string): MediaFile {
  const spec = mediaType(mime);
  if (!bytes.length || bytes.length > spec.max) {
    throw new RelayError("media_size", `The attachment must be nonempty and at most ${spec.max / 1024 / 1024} MiB.`);
  }
  const starts = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const header = bytes.subarray(0, 256).toString("latin1");
  const valid = spec.mime === "image/jpeg" ? starts([255, 216, 255])
    : spec.mime === "image/png" ? starts([137, 80, 78, 71, 13, 10, 26, 10])
    : spec.mime === "application/pdf" ? header.startsWith("%PDF-")
    : spec.mime.includes("openxmlformats") ? starts([80, 75, 3, 4])
    : ["application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint"].includes(spec.mime)
      ? starts([208, 207, 17, 224, 161, 177, 26, 225])
    : spec.mime === "text/plain" ? !bytes.includes(0)
    : spec.mime === "audio/amr" ? header.startsWith("#!AMR")
    : spec.mime === "audio/ogg" ? header.startsWith("OggS") && header.includes("OpusHead")
    : spec.mime === "audio/mpeg" ? header.startsWith("ID3") || (bytes[0] === 255 && ((bytes[1] ?? 0) & 224) === 224)
    : spec.mime === "audio/aac" ? bytes[0] === 255 && ((bytes[1] ?? 0) & 246) === 240
    : header.slice(4, 8) === "ftyp";
  if (!valid) throw new RelayError("media_signature", "The attachment's contents do not match its declared format.");
  const stem = (name ?? "attachment").replace(/[/\\\u0000-\u001f\u007f]/g, "_").slice(0, 100);
  const safeName = stem.toLowerCase().endsWith(`.${spec.extension}`) ? stem : `${stem}.${spec.extension}`;
  return { bytes, mime: spec.mime, name: safeName, kind: spec.kind };
}

export class MemoryBudget {
  private used = 0;
  constructor(private readonly capacity = limits.mediaMemoryBytes) {}
  async use<T>(bytes: number, operation: () => Promise<T>): Promise<T> {
    if (this.used + bytes > this.capacity) {
      throw new RelayError("memory_busy", "The relay is busy transferring files. Please try again shortly.");
    }
    this.used += bytes;
    try { return await operation(); } finally { this.used -= bytes; }
  }
}

export function attachmentKey(attachment: Attachment): string {
  return createHash("sha256").update(attachment.contentUrl ?? "").update(attachment.contentType ?? "").digest("hex");
}

export async function outgoingFile(
  attachment: Attachment, origins: string[], signal: AbortSignal, fetcher: Fetch = fetch,
): Promise<MediaFile> {
  const mime = attachment.contentType;
  const contentUrl = attachment.contentUrl;
  if (!mime || !contentUrl) throw new RelayError("attachment_content", "The agent returned an attachment without downloadable content.");
  const spec = mediaType(mime);
  if (contentUrl.startsWith("data:")) {
    const comma = contentUrl.indexOf(",");
    const header = contentUrl.slice(5, comma);
    const data = contentUrl.slice(comma + 1);
    // Repeated-group regexes can exhaust V8's stack on valid multi-megabyte files.
    const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
    if (comma < 0 || header.toLowerCase() !== `${spec.mime};base64` ||
        data.length > Math.ceil(spec.max / 3) * 4 || data.length % 4 !== 0 ||
        /[^A-Za-z0-9+/]/.test(data.slice(0, data.length - padding))) {
      throw new RelayError("attachment_encoding", "The agent returned an invalid or oversized inline attachment.");
    }
    return fileFromBytes(Buffer.from(data, "base64"), spec.mime, attachment.name);
  }
  const url = httpsUrl(contentUrl);
  if (!origins.includes(url.origin)) {
    throw new RelayError("attachment_origin", "The agent returned a file URL whose origin is not configured for this sample.");
  }
  // Only administrator-approved public/signed origins. Never forward the user's bearer token.
  const response = await fetcher(url, { signal, redirect: "error" });
  if (!response.ok) { await response.body?.cancel(); throw responseError("file", response.status); }
  const actual = response.headers.get("content-type")?.split(";")[0]?.toLowerCase();
  if (actual !== spec.mime) {
    await response.body?.cancel();
    throw new RelayError("media_type_mismatch", "The file server returned a different media type.");
  }
  return fileFromBytes(await readBytes(response, spec.max), spec.mime, attachment.name);
}
