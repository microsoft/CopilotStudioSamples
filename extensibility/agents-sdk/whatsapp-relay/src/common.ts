export class RelayError extends Error {
  constructor(
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly status?: number,
  ) {
    super(code);
  }
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RelayError("invalid_payload", "The message format is not supported.");
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown, max = 4096): string {
  if (typeof value !== "string" || value.length > max) {
    throw new RelayError("invalid_payload", "The message format is not supported.");
  }
  return value;
}

export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new RelayError("invalid_payload", "Invalid message batch.");
  return value;
}

export function log(event: string, error?: unknown): void {
  // Never include remote error bodies, activity payloads, URLs, or credentials.
  console.error(JSON.stringify({
    event,
    code: error instanceof RelayError ? error.code : error ? "unexpected_error" : undefined,
    status: error instanceof RelayError ? error.status : undefined,
  }));
}

export function httpsUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch {
    throw new RelayError("invalid_url", "A configured URL is invalid.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port) {
    throw new RelayError("invalid_url", "An HTTPS URL without credentials or a custom port is required.");
  }
  return url;
}

export type Fetch = typeof fetch;

export async function readBytes(response: Response, limit: number): Promise<Buffer> {
  if (!response.body) throw new RelayError("empty_body", "The service returned no content.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    const declared = Number(response.headers.get("content-length"));
    if (declared > limit) throw new RelayError("size_limit", "The file or response exceeds the sample's size limit.");
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > limit) throw new RelayError("size_limit", "The file or response exceeds the sample's size limit.");
      chunks.push(item.value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    await reader.cancel().catch(error => log("body_cancel_failed", error));
    reader.releaseLock();
  }
}

export async function readJson(response: Response, limit = 256 * 1024): Promise<unknown> {
  const bytes = await readBytes(response, limit);
  try { return JSON.parse(bytes.toString("utf8")) as unknown; } catch {
    throw new RelayError("invalid_json", "A service returned an invalid response.");
  }
}

export function responseError(service: string, status: number): RelayError {
  const message = status === 401 ? "Authentication expired or was rejected. Use --signout and sign in again."
    : status === 403 ? "Access was denied. Check the app permissions and your access to the agent."
    : status === 404 ? "The agent or file was not found. Check publication and the configured endpoint."
    : status === 429 ? "The service is rate limited. Please try again later."
    : "The service request failed. Its outcome may be uncertain; it was not automatically retried.";
  return new RelayError(`${service}_http`, message, status);
}
