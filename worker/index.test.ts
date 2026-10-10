import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { resetCreatedGistId } from './gitee';
import worker from './index';

const PASSWORD = '中文 密码-123';
const env: Env = {
  APP_PASSWORD: PASSWORD,
  MIMO_API_KEY: 'mimo-key',
  GITEE_TOKEN: 'gitee-token',
  GITEE_GIST_ID: 'gist1',
  GITEE_API_BASE: 'https://gitee.test/api/v5',
};

const auth = { Authorization: `Bearer ${encodeURIComponent(PASSWORD)}` };

const call = (path: string, init: RequestInit = {}, e: Env = env) =>
  worker.fetch(new Request(`https://app.test${path}`, init) as Parameters<typeof worker.fetch>[0], e);

const callJson = async (path: string, init: RequestInit = {}, e: Env = env) => {
  const res = await call(path, { ...init, headers: { ...auth, ...init.headers } }, e);
  return { res, body: (await res.json()) as any };
};

const note = (id: string, updatedAt = 1000) => ({
  id,
  title: id,
  originalText: '',
  summary: '',
  category: '其他',
  tags: [],
  fields: [],
  codeBlocks: [],
  createdAt: 1000,
  updatedAt,
});

// 内存中的假上游：MiMo + Gitee
let gistContent: string | null;
let mimoReply: () => Response;
let fetchMock: ReturnType<typeof vi.fn>;

const mimoContent = (content: string) => () =>
  Response.json({ choices: [{ message: { content } }] });

beforeEach(() => {
  resetCreatedGistId();
  gistContent = null;
  mimoReply = mimoContent('{"notes":[{"title":"VPS","fields":[{"label":"端口","value":22}],"tags":["a","a"]}]}');
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? 'GET';
    if (url.hostname === 'api.xiaomimimo.com') return mimoReply();
    if (url.hostname === 'gitee.test') {
      if (url.pathname === '/api/v5/gists/gist1' && method === 'GET') {
        if (gistContent === null) return Response.json({ files: {} });
        return Response.json({ files: { 'smart_notes.json': { content: gistContent } } });
      }
      if (url.pathname === '/api/v5/gists/gist1' && method === 'PATCH') {
        gistContent = JSON.parse(String(init?.body)).files['smart_notes.json'].content;
        return Response.json({ id: 'gist1' });
      }
      if (url.pathname === '/api/v5/gists' && method === 'POST') {
        gistContent = JSON.parse(String(init?.body)).files['smart_notes.json'].content;
        return Response.json({ id: 'new-gist' });
      }
    }
    return new Response('unexpected', { status: 500 });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auth', () => {
  it('returns 503 when APP_PASSWORD is not configured', async () => {
    const res = await call('/api/status', { headers: auth }, { ...env, APP_PASSWORD: '  ' });
    expect(res.status).toBe(503);
    expect(((await res.json()) as any).error.code).toBe('AUTH_NOT_CONFIGURED');
  });

  it('rejects missing and wrong passwords without CORS headers', async () => {
    const missing = await call('/api/status');
    expect(missing.status).toBe(401);
    expect(missing.headers.get('WWW-Authenticate')).toBe('Bearer');
    expect(missing.headers.get('Access-Control-Allow-Origin')).toBeNull();

    const wrong = await call('/api/status', { headers: { Authorization: 'Bearer nope' } });
    expect(wrong.status).toBe(401);

    const malformed = await call('/api/status', { headers: { Authorization: 'Bearer %E0%A4%A' } });
    expect(malformed.status).toBe(401);
  });

  it('accepts the right password, including non-ASCII characters', async () => {
    const { res, body } = await callJson('/api/status');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toEqual({ ai: true, sync: true, model: 'mimo-v2-flash', gistId: 'gist1' });
  });

  it('checks auth before routing', async () => {
    expect((await call('/api/config')).status).toBe(401);
    expect((await callJson('/api/config')).res.status).toBe(404);
    expect((await callJson('/api/status', { method: 'DELETE' })).res.status).toBe(405);
  });

  it('returns a plain 404 outside /api/', async () => {
    expect((await call('/missing.js')).status).toBe(404);
  });
});

describe('POST /api/analyze', () => {
  const analyze = (body: unknown) => callJson('/api/analyze', { method: 'POST', body: JSON.stringify(body) });

  it('validates the text', async () => {
    expect((await analyze({ text: '   ' })).res.status).toBe(400);
    expect((await analyze({ model: 'evil', messages: [] })).res.status).toBe(400);
    expect((await analyze({ text: 'x'.repeat(20_001) })).res.status).toBe(413);
    const bad = await call('/api/analyze', { method: 'POST', headers: auth, body: 'not json' });
    expect(bad.status).toBe(400);
  });

  it('builds the upstream request itself and ignores client-supplied fields', async () => {
    const { res, body } = await analyze({ text: 'server 1.2.3.4', model: 'evil', messages: [{ role: 'system', content: 'x' }] });
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe('mimo-v2-flash');
    expect(sent.messages).toHaveLength(2);
    expect(sent.messages[1].content).toContain('server 1.2.3.4');
    expect(init.headers['api-key']).toBe('mimo-key');
    expect(body.notes[0]).toMatchObject({ title: 'VPS', tags: ['a'], fields: [{ label: '端口', value: '22' }] });
  });

  it('uses MIMO_MODEL_NAME and MIMO_API_URL', async () => {
    const custom = { ...env, MIMO_MODEL_NAME: 'mimo-pro', MIMO_API_URL: 'https://api.xiaomimimo.com/custom' };
    const { body } = await callJson('/api/analyze', { method: 'POST', body: JSON.stringify({ text: 'x' }) }, custom);
    expect(body.model).toBe('mimo-pro');
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.xiaomimimo.com/custom');
  });

  it('parses fenced output', async () => {
    mimoReply = mimoContent('```json\n{"notes":[{"title":"fenced"}]}\n```');
    expect((await analyze({ text: 'x' })).body.notes[0].title).toBe('fenced');
  });

  it('maps upstream auth failures to 502, not 401', async () => {
    mimoReply = () => Response.json({ error: { message: 'Invalid API Key' } }, { status: 401 });
    const { res, body } = await analyze({ text: 'x' });
    expect(res.status).toBe(502);
    expect(body.error.code).toBe('AI_UPSTREAM_ERROR');
    expect(body.error.message).toContain('Invalid API Key');
  });

  it('reports unusable output', async () => {
    mimoReply = mimoContent('sorry, I cannot help');
    expect((await analyze({ text: 'x' })).body.error.code).toBe('AI_BAD_OUTPUT');
    mimoReply = mimoContent('{"notes":[]}');
    expect((await analyze({ text: 'x' })).res.status).toBe(502);
  });

  it('returns 503 without MIMO_API_KEY', async () => {
    const { res, body } = await callJson('/api/analyze', { method: 'POST', body: '{"text":"x"}' }, { ...env, MIMO_API_KEY: '' });
    expect(res.status).toBe(503);
    expect(body.error.code).toBe('AI_NOT_CONFIGURED');
  });
});

describe('/api/sync', () => {
  const put = (body: unknown) => callJson('/api/sync', { method: 'PUT', body: JSON.stringify(body) });

  it('reports a missing cloud file', async () => {
    const { body } = await callJson('/api/sync');
    expect(body).toEqual({ exists: false, updatedAt: null, notes: [], format: null });
  });

  it('reads the legacy format', async () => {
    gistContent = JSON.stringify([note('a', 500)]);
    const { body } = await callJson('/api/sync');
    expect(body).toMatchObject({ exists: true, format: 'legacy', updatedAt: 500 });
  });

  it('writes the v2 wrapper and never goes backwards in time', async () => {
    gistContent = JSON.stringify({ version: 2, updatedAt: 9e15, notes: [note('a')] });
    const { res, body } = await put({ notes: [note('a'), note('b')], baseUpdatedAt: 9e15 });
    expect(res.status).toBe(200);
    expect(body.updatedAt).toBe(9e15 + 1);
    const stored = JSON.parse(gistContent!);
    expect(stored.version).toBe(2);
    expect(stored.notes.map((n: any) => n.id)).toEqual(['a', 'b']);
  });

  it('rejects stale uploads with 409 unless forced', async () => {
    gistContent = JSON.stringify({ version: 2, updatedAt: 2000, notes: [note('a')] });
    const stale = await put({ notes: [note('b')], baseUpdatedAt: 1000 });
    expect(stale.res.status).toBe(409);
    expect(stale.body.error).toMatchObject({ code: 'SYNC_CONFLICT', cloudUpdatedAt: 2000 });

    const unknownBase = await put({ notes: [note('b')], baseUpdatedAt: null });
    expect(unknownBase.res.status).toBe(409);

    const sameContent = await put({ notes: [note('a')], baseUpdatedAt: null });
    expect(sameContent.res.status).toBe(200);

    const forced = await put({ notes: [note('b')], baseUpdatedAt: 1000, force: true });
    expect(forced.res.status).toBe(200);
  });

  it('allows forcing over a corrupt cloud file', async () => {
    gistContent = '{broken';
    expect((await callJson('/api/sync')).res.status).toBe(502);
    expect((await put({ notes: [], baseUpdatedAt: null })).res.status).toBe(502);
    expect((await put({ notes: [], baseUpdatedAt: null, force: true })).res.status).toBe(200);
  });

  it('creates a private gist when GITEE_GIST_ID is not set', async () => {
    const noGist = { ...env, GITEE_GIST_ID: undefined };
    const { body } = await callJson('/api/sync', { method: 'PUT', body: JSON.stringify({ notes: [], baseUpdatedAt: null }) }, noGist);
    expect(body).toMatchObject({ created: true, gistId: 'new-gist' });
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!;
    expect(JSON.parse(init.body).public).toBe(false);
  });

  it('validates the body', async () => {
    expect((await put({ notes: 'nope' })).res.status).toBe(400);
  });

  it('returns 503 without GITEE_TOKEN', async () => {
    const { res, body } = await callJson('/api/sync', {}, { ...env, GITEE_TOKEN: undefined });
    expect(res.status).toBe(503);
    expect(body.error.code).toBe('SYNC_NOT_CONFIGURED');
  });
});
