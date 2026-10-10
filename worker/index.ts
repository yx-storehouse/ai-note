/**
 * Cloudflare Worker：只处理 /api/*，其余请求由静态资源（SPA）处理。
 * 所有接口都需要 `Authorization: Bearer <APP_PASSWORD>`；AI Key 与 Gitee Token 只保存在 Worker 环境变量里。
 */
import { isDict, normalizeNotes, notesEqual, type ParsedCloudFile } from '../shared/normalize';
import type { StatusResponse, SyncGetResponse, SyncPutResponse } from '../shared/types';
import { checkAuth } from './auth';
import { envValue, type Env } from './env';
import { CloudParseError, gistId, readCloud, writeCloud } from './gitee';
import { errorResponse, HttpError, json, readJsonBody } from './http';
import { analyze, MAX_TEXT_LENGTH, modelName } from './mimo';

const MAX_ANALYZE_BYTES = 256 * 1024;
const MAX_SYNC_BYTES = 2 * 1024 * 1024;

type Handler = (request: Request, env: Env) => Promise<Response>;

const handleStatus: Handler = async (_request, env) => {
  const status: StatusResponse = {
    ai: Boolean(envValue(env.MIMO_API_KEY)),
    sync: Boolean(envValue(env.GITEE_TOKEN)),
    model: modelName(env),
    gistId: gistId(env),
  };
  return json(status);
};

const handleAnalyze: Handler = async (request, env) => {
  const body = await readJsonBody(request, MAX_ANALYZE_BYTES);
  const text = isDict(body) && typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new HttpError(400, 'BAD_REQUEST', '请输入要分析的文本');
  if (text.length > MAX_TEXT_LENGTH) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', `文本过长，最多 ${MAX_TEXT_LENGTH} 个字符`);
  }
  return json(await analyze(text, env));
};

const handleSyncGet: Handler = async (_request, env) => {
  const cloud = await readCloud(env);
  const body: SyncGetResponse = cloud
    ? { exists: true, updatedAt: cloud.updatedAt, notes: cloud.notes, format: cloud.format }
    : { exists: false, updatedAt: null, notes: [], format: null };
  return json(body);
};

const handleSyncPut: Handler = async (request, env) => {
  const body = await readJsonBody(request, MAX_SYNC_BYTES);
  if (!isDict(body) || !Array.isArray(body.notes)) {
    throw new HttpError(400, 'BAD_REQUEST', '缺少 notes 数组');
  }
  const notes = normalizeNotes(body.notes, () => crypto.randomUUID());
  const base = typeof body.baseUpdatedAt === 'number' ? body.baseUpdatedAt : null;
  const force = body.force === true;

  let current: ParsedCloudFile | null;
  try {
    current = await readCloud(env);
  } catch (err) {
    // 云端文件损坏时，允许强制覆盖
    if (force && err instanceof CloudParseError) current = null;
    else throw err;
  }

  // 乐观并发：云端在上次同步之后被其他设备改过，就拒绝覆盖
  if (current && !force) {
    const conflict =
      base === null
        ? current.notes.length > 0 && !notesEqual(current.notes, notes)
        : (current.updatedAt ?? 0) > base;
    if (conflict) {
      throw new HttpError(409, 'SYNC_CONFLICT', '云端数据已在其他设备上更新', {
        ...(current.updatedAt ? { cloudUpdatedAt: current.updatedAt } : {}),
      });
    }
  }

  // 使用服务器时间，并保证单调递增，避免依赖各设备的时钟
  const updatedAt = Math.max(Date.now(), (current?.updatedAt ?? 0) + 1);
  const result = await writeCloud(env, { version: 2, updatedAt, notes });
  const response: SyncPutResponse = { updatedAt, created: result.created, gistId: result.gistId };
  return json(response);
};

const routes: Record<string, Record<string, Handler>> = {
  '/api/status': { GET: handleStatus },
  '/api/analyze': { POST: handleAnalyze },
  '/api/sync': { GET: handleSyncGet, PUT: handleSyncPut },
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    try {
      // 先鉴权再匹配路由，未登录时不暴露有哪些接口
      await checkAuth(request, env);
      const route = routes[pathname];
      if (!route) throw new HttpError(404, 'NOT_FOUND', '接口不存在');
      const handler = route[request.method];
      if (!handler) {
        throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支持的请求方法', {}, { Allow: Object.keys(route).join(', ') });
      }
      return await handler(request, env);
    } catch (err) {
      if (err instanceof HttpError) return errorResponse(err);
      console.error('Unhandled error', err instanceof Error ? err.message : err);
      return errorResponse(new HttpError(500, 'INTERNAL', '服务器内部错误'));
    }
  },
} satisfies ExportedHandler<Env>;
