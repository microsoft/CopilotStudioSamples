import { httpsUrl } from "./common.js";

const MiB = 1024 * 1024;
export const limits = {
  bodyBytes: 256 * 1024,
  queue: 100,
  perSender: 8,
  workers: 4,
  sessions: 100,
  sessionMs: 30 * 60_000,
  authMs: 10 * 60_000,
  dedupMs: 60 * 60_000,
  dedupEntries: 10_000,
  requestMs: 20_000,
  turnMs: 120_000,
  shutdownMs: 25_000,
  fileBytes: 16 * MiB,
  mediaMemoryBytes: 512 * MiB,
  responseBytes: 32 * MiB,
  attachments: 4,
  outboundMessages: 32,
  typingMs: 25_000,
  windowMs: 24 * 60 * 60_000,
} as const;

export interface Config {
  port: number;
  host: "127.0.0.1" | "0.0.0.0";
  metaToken: string;
  metaSecret: string;
  verifyToken: string;
  phoneId: string;
  accountId: string;
  graphVersion: string;
  botId: string;
  botSecret: string;
  tenantId: string;
  oauthConnection: string;
  ghcpUrl: string;
  cloud: "Prod" | "Test" | "Preprod" | "Dev";
  fileOrigins: string[];
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const required = (key: string): string => {
    const value = env[key]?.trim();
    if (!value || value.startsWith("<")) throw new ConfigError(`Configure ${key} before starting.`);
    return value;
  };
  const cloud = required("GHCP_CLOUD");
  if (cloud !== "Prod" && cloud !== "Test" && cloud !== "Preprod" && cloud !== "Dev") {
    throw new ConfigError("GHCP_CLOUD must be Prod, Test, Preprod, or Dev.");
  }
  const url = httpsUrl(required("GHCP_DIRECT_CONNECT_URL"));
  if (!url.searchParams.has("api-version") || /\/conversations(?:\/|$)/.test(url.pathname)) {
    throw new ConfigError("GHCP_DIRECT_CONNECT_URL must be the bot base URL with api-version, without /conversations.");
  }
  const graphVersion = required("META_GRAPH_VERSION");
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new ConfigError("META_GRAPH_VERSION must look like v25.0.");
  const port = Number(env.PORT ?? 3978);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError("Invalid PORT.");
  const host = env.RELAY_HOST ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "0.0.0.0") {
    throw new ConfigError("RELAY_HOST must be 127.0.0.1 or 0.0.0.0.");
  }
  const id = (key: string) => {
    const value = required(key);
    if (!/^\d+$/.test(value)) throw new ConfigError(`${key} must be a numeric Meta ID.`);
    return value;
  };
  const guid = (key: string) => {
    const value = required(key);
    if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)) throw new ConfigError(`${key} must be a GUID.`);
    return value;
  };
  const fileOrigins = (env.GHCP_FILE_ORIGINS ?? "").split(",").filter(Boolean).map(value => {
    const origin = httpsUrl(value.trim());
    if (origin.pathname !== "/" || origin.search) throw new ConfigError("GHCP_FILE_ORIGINS accepts exact HTTPS origins only.");
    return origin.origin;
  });
  return {
    port, host, cloud, ghcpUrl: url.toString(), graphVersion, fileOrigins,
    metaToken: required("META_ACCESS_TOKEN"), metaSecret: required("META_APP_SECRET"),
    verifyToken: required("META_VERIFY_TOKEN"), phoneId: id("META_PHONE_NUMBER_ID"),
    accountId: id("META_WABA_ID"), botId: guid("BOT_CLIENT_ID"),
    tenantId: guid("BOT_TENANT_ID"), botSecret: required("BOT_CLIENT_SECRET"),
    oauthConnection: required("BOT_OAUTH_CONNECTION"),
  };
}
