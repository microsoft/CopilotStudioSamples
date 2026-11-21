import { WhatsAppAdapter } from "./adapter.js";
import { log } from "./common.js";
import { ConfigError, loadConfig, limits } from "./config.js";
import { GhcpClient } from "./ghcp.js";
import { MetaClient, type MetaEvent } from "./meta.js";
import { MemoryQueue } from "./queue.js";
import { Relay } from "./relay.js";
import { webhookServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const adapter = new WhatsAppAdapter(config);
  const meta = new MetaClient(config);
  const ghcp = new GhcpClient(config.ghcpUrl);
  const queue: MemoryQueue<MetaEvent> = new MemoryQueue(event => relay.handle(event), {
    capacity: limits.queue, perKey: limits.perSender, concurrency: limits.workers,
    dedupMs: limits.dedupMs, dedupEntries: limits.dedupEntries,
  });
  const relay = new Relay(config, adapter, meta, ghcp, key => queue.isBusy(key));
  const server = webhookServer(config, queue);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, resolve);
  });
  console.log(`Relay listening on http://${config.host}:${config.port}; webhook path: /webhook.`);
  const sweep = setInterval(() => relay.sweep(), 60_000);
  sweep.unref();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    queue.stop();
    clearInterval(sweep);
    server.close();
    let timeout: NodeJS.Timeout | undefined;
    const drained = await Promise.race([
      queue.drain().then(() => true),
      new Promise<false>(resolve => { timeout = setTimeout(() => resolve(false), limits.shutdownMs); }),
    ]);
    clearTimeout(timeout);
    relay.abort();
    server.closeAllConnections();
    if (!drained) log("shutdown_abandoned_volatile_work");
    process.exit(drained ? 0 : 1);
  };
  process.once("SIGINT", () => { void stop(); });
  process.once("SIGTERM", () => { void stop(); });
}

main().catch(error => {
  // Configuration errors name the setting, never its secret value.
  if (error instanceof ConfigError) console.error(error.message);
  else log("startup_failed", error);
  process.exitCode = 1;
});
