import { randomUUID, timingSafeEqual } from 'node:crypto';
import express, { type Request, type RequestHandler } from 'express';
import { fileURLToPath } from 'node:url';
import { Channels } from './channels.js';
import { hash, HttpError, Relay, text } from './relay.js';
import { MockStudio } from './studio.js';
import { BlobBackend, FileBackend, MemoryBackend, Repository, type Session } from './store.js';

export function publicSession(s: Session): object {
  return {
    id: s.id, studioId: s.studioId, channel: s.channel, mode: s.mode, cycle: s.cycle,
    messages: s.messages, summary: s.summary, reason: s.reason, operator: s.operator,
    handback: s.handback && { stage: s.handback.stage, error: s.handback.error }
  };
}
function equal(actual: string | undefined, expected: string): boolean {
  const a = Buffer.from(actual ?? ''), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createWebApp(options: { mode: 'mock' | 'studio'; hosting?: 'local' | 'azure'; repository?: Repository }) {
  const mock = options.mode === 'mock';
  const azure = options.hosting === 'azure';
  if (!mock && azure && !process.env.BLOB_STATE_URL) throw new Error('BLOB_STATE_URL is required on Azure');
  const channels = mock ? undefined : new Channels();
  const repo = options.repository ?? new Repository(mock ? new MemoryBackend() : azure
    ? new BlobBackend(process.env.BLOB_STATE_URL!)
    : new FileBackend(fileURLToPath(new URL('../.local/state.json', import.meta.url))));
  let relay: Relay;
  const mockStudio = new MockStudio(parameters => relay.escalate(parameters));
  relay = new Relay(repo, s => mock ? Promise.resolve(mockStudio) : channels!.studio(s),
    (s, message) => channels!.deliver(s, message),
    (s, progress) => channels!.progress(s, progress));
  channels?.attach(relay);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));
  app.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer'
    });
    next();
  });
  const sameOrigin: RequestHandler = (req, _res, next) => {
    const expected = `${azure ? 'https' : 'http'}://${req.get('host')}`;
    if (req.method !== 'GET' && req.get('origin') !== expected) return next(new HttpError(403, 'A same-origin browser request is required'));
    next();
  };
  // Every console visitor shares one mock operator; this is not an authenticated identity.
  const operator = 'local-support';
  const customer: RequestHandler = async (req, _res, next) => {
    try {
      const s = await relay.get(String(req.params.id));
      const token = req.get('authorization')?.replace(/^Bearer /, '');
      if (s.channel !== 'browser' || !token || !equal(hash(token), s.browserTokenHash!)) throw new HttpError(403, 'Invalid customer session');
      next();
    } catch (error) { next(error); }
  };
  app.get('/health', async (_req, res) => {
    await repo.read();
    res.json({ status: 'ok', mode: options.mode });
  });
  if (channels) app.post('/api/messages', channels.handler);
  else app.post('/api/messages', (_req, res) => res.status(503).json({ error: 'SDK channel is disabled in local mock mode' }));
  app.post('/api/escalate', async (req, res) => {
    res.json(await relay.escalate(req.body));
  });
  app.post('/api/customer', sameOrigin, async (_req, res) => {
    if (!mock) throw new HttpError(400, 'Browser customer chat is a local mock demo. Test the real agent in Teams/M365.');
    const created = await relay.create(randomUUID(), 'browser');
    res.status(201).json({ session: publicSession(created.session), token: created.token });
  });
  app.get('/api/customer/:id', customer, async (req, res) => res.json(publicSession(await relay.get(String(req.params.id)))));
  app.post('/api/customer/:id/messages', sameOrigin, customer, async (req, res) => {
    res.json(publicSession(await relay.customer(String(req.params.id), text(req.body.text, 'text'), text(req.body.requestId, 'requestId', 100))));
  });
  app.use('/api/support', sameOrigin);
  app.get('/api/support', async (_req, res) => res.json((await relay.list()).map(publicSession)));
  app.get('/api/support/me', (_req, res) => res.json({ id: operator }));
  app.post('/api/support/:id/claim', async (req, res) => res.json(publicSession(await relay.claim(String(req.params.id), operator))));
  app.post('/api/support/:id/messages', async (req, res) => {
    res.json(publicSession(await relay.human(String(req.params.id), operator, text(req.body.text, 'text'), text(req.body.requestId, 'requestId', 100))));
  });
  app.post('/api/support/:id/close', async (req, res) => res.json(publicSession(await relay.close(String(req.params.id), operator))));
  app.get('/api/config', (_req, res) => res.json({ mode: options.mode, hosting: azure ? 'azure' : 'local' }));
  app.get('/privacy', (_req, res) => res.type('text').send('Handover sample: conversation transcripts are stored in the sample-owned relay state and shared with Copilot Studio. The mock support console has no authentication: anyone who can reach it can read transcripts and act as support. Use synthetic data only. The sample owner must define retention and delete test data after use.'));
  app.get('/terms', (_req, res) => res.type('text').send('This is a demonstration, not a production support service. Use synthetic test data only. See the repository MIT license and sample README.'));
  app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url))));
  app.use((error: unknown, _req: Request, res: express.Response, _next: express.NextFunction) => {
    const status = error instanceof HttpError ? error.status : 500;
    console.error(JSON.stringify({ event: 'request_failed', status, type: error instanceof Error ? error.name : 'Unknown' }));
    res.status(status).json({ error: error instanceof HttpError ? error.message : 'Request failed. Inspect sanitized server diagnostics.' });
  });
  return { app, relay };
}
