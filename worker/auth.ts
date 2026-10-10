import { envValue, type Env } from './env';
import { HttpError } from './http';

const sha256 = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));

// 比较摘要而不是原文，耗时与密码内容无关
export const safeEqual = async (given: string, expected: string): Promise<boolean> => {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
};

// 前端发送 `Authorization: Bearer <encodeURIComponent(密码)>`，以便密码可以包含中文
export const checkAuth = async (request: Request, env: Env): Promise<void> => {
  const expected = envValue(env.APP_PASSWORD);
  if (!expected) {
    throw new HttpError(503, 'AUTH_NOT_CONFIGURED', '服务端未配置访问密码（APP_PASSWORD），接口已停用');
  }

  const match = (request.headers.get('Authorization') ?? '').match(/^Bearer\s+(\S+)\s*$/i);
  let given = '';
  if (match) {
    try {
      given = decodeURIComponent(match[1]);
    } catch {
      given = '';
    }
  }

  if (!given || !(await safeEqual(given, expected))) {
    throw new HttpError(401, 'UNAUTHORIZED', '访问密码错误', {}, { 'WWW-Authenticate': 'Bearer' });
  }
};
