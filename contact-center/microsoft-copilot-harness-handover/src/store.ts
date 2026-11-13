import { DefaultAzureCredential } from '@azure/identity';
import { BlobClient, BlockBlobClient } from '@azure/storage-blob';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ConversationReference } from '@microsoft/agents-activity';

export type Mode = 'bot' | 'waiting' | 'human' | 'resuming' | 'handback_failed';
export interface Message {
  id: string;
  role: 'customer' | 'assistant' | 'human' | 'system';
  text: string;
  at: string;
  delivery?: 'pending' | 'sent' | 'uncertain';
}
export interface Session {
  id: string;
  channel: 'browser' | 'msteams';
  channelKey: string;
  browserTokenHash?: string;
  reference?: ConversationReference;
  studioId: string;
  mode: Mode;
  cycle: number;
  messages: Message[];
  turn?: { id: string; kind: 'customer' | 'handback' };
  operator?: string;
  summary?: string;
  reason?: string;
  segmentStart: number;
  handback?: {
    id: string;
    text: string;
    stage: 'prepared' | 'dispatching' | 'auth_required' | 'uncertain' | 'complete';
    error?: string;
  };
}
export interface State {
  sessions: Record<string, Session>;
  studioIndex: Record<string, string>;
}
interface Snapshot { state: State; version?: string }
export interface Backend {
  read(): Promise<Snapshot>;
  write(state: State, version?: string): Promise<boolean>;
}
const empty = (): State => ({ sessions: {}, studioIndex: {} });

export class MemoryBackend implements Backend {
  private state = empty();
  private version = 0;
  async read(): Promise<Snapshot> {
    return { state: structuredClone(this.state), version: String(this.version) };
  }

  async write(state: State, version?: string): Promise<boolean> {
    if (version !== String(this.version)) return false;
    this.state = structuredClone(state);
    this.version++;
    return true;
  }
}

/** Single-process local store; synchronous atomic replacement serializes local ETag writes. */
export class FileBackend implements Backend {
  constructor(private file: string) { mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); }
  async read(): Promise<Snapshot> {
    return existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) as Snapshot : { state: empty(), version: '0' };
  }
  async write(state: State, version?: string): Promise<boolean> {
    const current: Snapshot = existsSync(this.file)
      ? JSON.parse(readFileSync(this.file, 'utf8')) as Snapshot : { state: empty(), version: '0' };
    if (version !== current.version) return false;
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify({ state, version: String(Number(version) + 1) }), { mode: 0o600 });
    renameSync(temporary, this.file);
    return true;
  }
}

/** A bounded sample ledger keeps session/index updates in the same ETag transaction. */
export class BlobBackend implements Backend {
  private blob: BlockBlobClient;
  constructor(url: string) {
    this.blob = new BlobClient(url, new DefaultAzureCredential()).getBlockBlobClient();
  }
  async read(): Promise<Snapshot> {
    try {
      const response = await this.blob.download();
      const chunks: Buffer[] = [];
      if (!response.readableStreamBody) throw new Error('Blob response has no body');
      for await (const chunk of response.readableStreamBody) chunks.push(Buffer.from(chunk));
      return { state: JSON.parse(Buffer.concat(chunks).toString()) as State, version: response.etag };
    } catch (error) {
      if (hasStatus(error, 404)) return { state: empty() };
      throw error;
    }
  }
  async write(state: State, version?: string): Promise<boolean> {
    try {
      await this.blob.uploadData(Buffer.from(JSON.stringify(state)), {
        conditions: version ? { ifMatch: version } : { ifNoneMatch: '*' },
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });
      return true;
    } catch (error) {
      if (hasStatus(error, 409) || hasStatus(error, 412)) return false;
      throw error;
    }
  }
}
function hasStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === status;
}
export class Repository {
  constructor(private backend: Backend) {}
  async read(): Promise<State> { return (await this.backend.read()).state; }
  async change<T>(update: (state: State) => T): Promise<T> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const snapshot = await this.backend.read();
      const result = update(snapshot.state);
      if (await this.backend.write(snapshot.state, snapshot.version)) return structuredClone(result);
    }
    throw new Error('Concurrent state update could not be committed; retry the request');
  }
}
