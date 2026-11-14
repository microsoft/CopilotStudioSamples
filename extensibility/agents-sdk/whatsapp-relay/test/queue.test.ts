import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { MemoryQueue, type Work } from "../src/queue.js";

const options = { capacity: 4, perKey: 2, concurrency: 2, dedupMs: 100, dedupEntries: 20 };

test("serializes each sender while allowing independent senders", async () => {
  const started: string[] = [];
  const releases = new Map<string, () => void>();
  const queue = new MemoryQueue<Work>(item => new Promise(resolve => {
    started.push(item.id); releases.set(item.id, resolve);
  }), options);
  assert(queue.accept([{ key: "a", id: "a1" }, { key: "a", id: "a2" }, { key: "b", id: "b1" }]));
  await setImmediate();
  assert.deepEqual(started, ["a1", "b1"]);
  releases.get("a1")!();
  await setImmediate();
  assert.deepEqual(started, ["a1", "b1", "a2"]);
  releases.get("b1")!(); releases.get("a2")!();
  await queue.drain();
  assert.equal(queue.size, 0);
  assert.equal(queue.isBusy("a"), false);
});

test("batch admission is atomic, bounded, and duplicate aware", async () => {
  const handled: string[] = [];
  const queue = new MemoryQueue<Work>(async item => { handled.push(item.id); }, options);
  assert.equal(queue.accept([{ key: "a", id: "1" }, { key: "a", id: "2" }, { key: "a", id: "3" }]), false);
  assert.equal(queue.size, 0);
  assert(queue.accept([{ key: "a", id: "1" }, { key: "a", id: "1" }]));
  assert(queue.accept([{ key: "a", id: "1" }]));
  assert(queue.accept([{ key: "b", id: "1" }]));
  await queue.drain();
  assert.deepEqual(handled, ["1", "1"]);
  queue.stop();
  assert.equal(queue.accept([]), false);
});

test("active jobs do not expire; completed dedup records do", async () => {
  let now = 0, count = 0, finish!: () => void;
  const queue = new MemoryQueue<Work>(() => {
    count++;
    return new Promise(resolve => { finish = resolve; });
  }, { ...options, capacity: 1, dedupEntries: 1 }, () => now);
  const item = { key: "a", id: "1" };
  assert(queue.accept([item]));
  await setImmediate();
  now = 500;
  assert(queue.accept([item]));
  assert.equal(queue.accept([{ key: "a", id: "2" }]), false);
  finish(); await queue.drain();
  assert(queue.accept([item]));
  await setImmediate();
  assert.equal(count, 1);
  assert.equal(queue.accept([{ key: "b", id: "2" }]), false);
  now += 101;
  assert(queue.accept([item]));
  await setImmediate();
  assert.equal(count, 2);
  finish(); await queue.drain();
});

test("failed jobs are not automatically replayed", async () => {
  let count = 0;
  const queue = new MemoryQueue<Work>(async () => { count++; throw new Error("fixture"); }, options);
  assert(queue.accept([{ key: "a", id: "1" }]));
  await queue.drain();
  assert(queue.accept([{ key: "a", id: "1" }]));
  await queue.drain();
  assert.equal(count, 1);
});
