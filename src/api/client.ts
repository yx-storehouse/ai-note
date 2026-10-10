import { isDict } from '../../shared/normalize';
import type {
  AnalyzeResponse,
  ApiErrorCode,
  StatusResponse,
  SyncGetResponse,
  SyncPutRequest,
  SyncPutResponse,
} from '../../shared/types';
import { getStorage, readString, STORAGE_KEYS, writeString } from '../lib/storage';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'NETWORK' | 'TIMEOUT',
    message: string,
    readonly cloudUpdatedAt?: number,
  ) {
    super(message);
  }
}

export const isUnauthorized = (err: unknown): boolean => err instanceof ApiError && err.code === 'UNAUTHORIZED';

export const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

// 访问密码只保存在本机浏览器
const storage = getStorage();
let password: string | null = readString(storage, STORAGE_KEYS.auth);

export const hasPassword = (): boolean => Boolean(password);

export const setPassword = (value: string | null): void => {
  password = value;
  writeString(storage, STORAGE_KEYS.auth, value);
};

interface RequestOptions {
  body?: unknown;
  timeoutMs?: number;
  // 解锁时用候选密码试探，成功后才保存
  password?: string;
}

const request = async <T>(method: string, path: string, options: RequestOptions = {}): Promise<T> => {
  const { body, timeoutMs = 30_000 } = options;
  const pw = options.password ?? password;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (pw) headers.Authorization = `Bearer ${encodeURIComponent(pw)}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new ApiError(0, 'TIMEOUT', '请求超时，请稍后重试');
    }
    throw new ApiError(0, 'NETWORK', '网络连接失败，请检查网络');
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = isDict(data) && isDict(data.error) ? data.error : {};
    const code = typeof e.code === 'string' ? (e.code as ApiErrorCode) : res.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL';
    const message = typeof e.message === 'string' ? e.message : `请求失败（${res.status}）`;
    throw new ApiError(res.status, code, message, typeof e.cloudUpdatedAt === 'number' ? e.cloudUpdatedAt : undefined);
  }
  // 没有部署 Worker 时 /api/* 可能返回 index.html
  if (data === null) throw new ApiError(res.status, 'NETWORK', '接口不可用：没有收到 JSON 响应');
  return data as T;
};

export const api = {
  status: (pw?: string) => request<StatusResponse>('GET', '/api/status', { password: pw }),
  analyze: (text: string) => request<AnalyzeResponse>('POST', '/api/analyze', { body: { text }, timeoutMs: 120_000 }),
  getSync: () => request<SyncGetResponse>('GET', '/api/sync'),
  putSync: (body: SyncPutRequest) => request<SyncPutResponse>('PUT', '/api/sync', { body, timeoutMs: 60_000 }),
};
