import { isDict, parseCloudFile, type ParsedCloudFile } from '../shared/normalize';
import type { CloudSnapshotV2 } from '../shared/types';
import { envValue, type Env } from './env';
import { HttpError } from './http';

// Gitee Gist 读写。Token 只存在于 Worker 环境变量中，不会发给浏览器。
const FILE_NAME = 'smart_notes.json';
const DEFAULT_BASE = 'https://gitee.com/api/v5';
const TIMEOUT_MS = 30_000;

export class CloudParseError extends HttpError {
  constructor() {
    super(502, 'SYNC_UPSTREAM_ERROR', `云端 ${FILE_NAME} 内容无法解析，可以使用「上传本地（覆盖）」修复`);
  }
}

// 未配置 GITEE_GIST_ID 时首次上传会新建 Gist，这里记住它，避免同一实例重复创建
let createdGistId: string | null = null;

export const gistId = (env: Env): string | null => envValue(env.GITEE_GIST_ID) ?? createdGistId;

const accessToken = (env: Env): string => {
  const token = envValue(env.GITEE_TOKEN);
  if (!token) throw new HttpError(503, 'SYNC_NOT_CONFIGURED', '服务端未配置 GITEE_TOKEN，云同步未启用');
  return token;
};

const giteeFetch = async (env: Env, url: string, init: RequestInit = {}): Promise<Response> => {
  const fullUrl = url.startsWith('http') ? url : `${(envValue(env.GITEE_API_BASE) ?? DEFAULT_BASE).replace(/\/+$/, '')}${url}`;
  try {
    return await fetch(fullUrl, {
      ...init,
      headers: { Accept: 'application/json', 'User-Agent': 'ai-note', ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, 'SYNC_UPSTREAM_ERROR', '无法连接 Gitee');
  }
};

const upstreamError = (res: Response, action: string): HttpError => {
  console.warn('Gitee upstream error', action, res.status);
  const hint =
    res.status === 401 || res.status === 403
      ? '，请检查 GITEE_TOKEN 是否有效并具有 gists 权限'
      : res.status === 404
        ? '，请检查 GITEE_GIST_ID'
        : '';
  return new HttpError(502, 'SYNC_UPSTREAM_ERROR', `Gitee ${action}失败（${res.status}${hint}）`);
};

export const readCloud = async (env: Env): Promise<ParsedCloudFile | null> => {
  const token = accessToken(env);
  const id = gistId(env);
  if (!id) return null;

  const res = await giteeFetch(env, `/gists/${encodeURIComponent(id)}?access_token=${encodeURIComponent(token)}`);
  if (!res.ok) throw upstreamError(res, '读取');

  const data: unknown = await res.json().catch(() => null);
  const files = isDict(data) && isDict(data.files) ? data.files : {};
  const file = files[FILE_NAME];
  if (!isDict(file)) return null;

  let content = typeof file.content === 'string' ? file.content : '';
  // 大文件可能被截断，此时从 raw_url 读取完整内容
  if (file.truncated === true && typeof file.raw_url === 'string') {
    const raw = await giteeFetch(env, file.raw_url);
    if (!raw.ok) throw upstreamError(raw, '读取');
    content = await raw.text();
  }
  if (!content.trim()) return null;

  try {
    return parseCloudFile(content, () => crypto.randomUUID());
  } catch {
    throw new CloudParseError();
  }
};

export const writeCloud = async (env: Env, snapshot: CloudSnapshotV2): Promise<{ gistId: string; created: boolean }> => {
  const token = accessToken(env);
  const id = gistId(env);
  const files = { [FILE_NAME]: { content: JSON.stringify(snapshot, null, 2) } };
  const init = (method: string, body: object): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, ...body }),
  });

  if (id) {
    const res = await giteeFetch(env, `/gists/${encodeURIComponent(id)}`, init('PATCH', { files }));
    if (!res.ok) throw upstreamError(res, '保存');
    return { gistId: id, created: false };
  }

  const res = await giteeFetch(env, '/gists', init('POST', { files, description: 'Smart Note AI Data Store', public: false }));
  if (!res.ok) throw upstreamError(res, '创建 Gist ');
  const data: unknown = await res.json().catch(() => null);
  const newId = isDict(data) && typeof data.id === 'string' ? data.id : null;
  if (!newId) throw new HttpError(502, 'SYNC_UPSTREAM_ERROR', 'Gitee 没有返回新建 Gist 的 ID');
  createdGistId = newId;
  return { gistId: newId, created: true };
};

// 仅供测试使用
export const resetCreatedGistId = (): void => {
  createdGistId = null;
};
