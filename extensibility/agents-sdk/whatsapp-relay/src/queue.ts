import { log } from "./common.js";

export interface Work {
  key: string;
  id: string;
}

interface Job<T> { item: T; identity: string }

export class MemoryQueue<T extends Work> {
  private readonly waiting: Job<T>[] = [];
  private readonly busy = new Set<string>();
  private readonly pending = new Map<string, number>();
  private readonly seen = new Map<string, number>();
  private running = 0;
  private accepting = true;
  private readonly idle: (() => void)[] = [];

  constructor(
    private readonly handler: (item: T) => Promise<void>,
    private readonly options: {
      capacity: number; perKey: number; concurrency: number; dedupMs: number; dedupEntries: number;
    },
    private readonly now = Date.now,
  ) {}

  get size(): number { return this.waiting.length + this.running; }

  accept(items: T[]): boolean {
    if (!this.accepting) return false;
    const timestamp = this.now();
    for (const [id, expires] of this.seen) if (expires <= timestamp) this.seen.delete(id);
    const unique = new Map<string, T>();
    for (const item of items) {
      const identity = JSON.stringify([item.key, item.id]);
      if (!this.seen.has(identity)) unique.set(identity, item);
    }
    if (this.size + unique.size > this.options.capacity ||
        this.seen.size + unique.size > this.options.dedupEntries) return false;
    const additions = new Map<string, number>();
    for (const item of unique.values()) {
      const count = (additions.get(item.key) ?? 0) + 1;
      if (count + (this.pending.get(item.key) ?? 0) > this.options.perKey) return false;
      additions.set(item.key, count);
    }
    for (const [identity, item] of unique) {
      this.seen.set(identity, Infinity);
      this.pending.set(item.key, (this.pending.get(item.key) ?? 0) + 1);
      this.waiting.push({ item, identity });
    }
    queueMicrotask(() => this.pump());
    return true;
  }

  isBusy(key: string): boolean { return this.pending.has(key); }
  stop(): void { this.accepting = false; }
  drain(): Promise<void> {
    return this.size === 0 ? Promise.resolve() : new Promise(resolve => this.idle.push(resolve));
  }

  private pump(): void {
    while (this.running < this.options.concurrency) {
      const index = this.waiting.findIndex(job => !this.busy.has(job.item.key));
      if (index < 0) break;
      const job = this.waiting.splice(index, 1)[0]!;
      this.running++;
      this.busy.add(job.item.key);
      void this.handler(job.item).catch(error => log("worker_failed", error)).finally(() => {
        this.busy.delete(job.item.key);
        this.running--;
        const left = (this.pending.get(job.item.key) ?? 1) - 1;
        if (left) this.pending.set(job.item.key, left); else this.pending.delete(job.item.key);
        // Failed turns are also remembered: replay could repeat a remote tool action.
        this.seen.set(job.identity, this.now() + this.options.dedupMs);
        this.pump();
        if (!this.size) this.idle.splice(0).forEach(resolve => resolve());
      });
    }
  }
}
