import type { ApiErrorBody, ApiErrorCode } from '../shared/types';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly extra: Omit<ApiErrorBody['error'], 'code' | 'message'> = {},
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status, headers: { ...BASE_HEADERS, ...headers } });

export const errorResponse = (err: HttpError): Response => {
  const body: ApiErrorBody = { error: { code: err.code, message: err.message, ...err.extra } };
  return json(body, err.status, err.headers);
};

export const readJsonBody = async (request: Request, maxBytes: number): Promise<unknown> => {
  const tooLarge = () => new HttpError(413, 'PAYLOAD_TOO_LARGE', '请求内容过大');
  if (Number(request.headers.get('Content-Length') ?? 0) > maxBytes) throw tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw tooLarge();
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', '请求内容不是合法的 JSON');
  }
};
