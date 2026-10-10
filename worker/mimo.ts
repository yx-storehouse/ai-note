import { DEFAULT_CATEGORIES } from '../shared/categories';
import { extractJson, isDict, normalizeAnalysis } from '../shared/normalize';
import type { AnalyzeResponse } from '../shared/types';
import { envValue, type Env } from './env';
import { HttpError } from './http';

// 小米 MiMo 大模型（OpenAI 兼容格式）
// 文档: https://platform.xiaomimimo.com/#/docs/quick-start/first-api-call
export const DEFAULT_MODEL = 'mimo-v2.6-flash';
export const DEFAULT_MIMO_URL = 'https://api.xiaomimimo.com/v1/chat/completions';
export const MAX_TEXT_LENGTH = 20_000;
const TIMEOUT_MS = 90_000;

export const modelName = (env: Env): string => envValue(env.MIMO_MODEL_NAME) ?? DEFAULT_MODEL;

const SYSTEM_PROMPT = `
你是一位专家级的数据整理和DevOps助手。
请分析提供的原始文本，其中可能包含服务器配置、命令、凭据、URL链接或个人笔记等混合内容。

你的目标是将这些原始文本拆分成清晰、合乎逻辑的独立"笔记"。
例如，如果文本包含一个 VPS 配置，然后是另一段挂载命令，这应该是两个分开的笔记。

对于每个笔记：
1. 给出一个简洁的中文 'title'。
2. 写一个一句话的中文 'summary'（摘要）。
3. 从以下列表中分配一个 'category'（分类）：${DEFAULT_CATEGORIES.join(', ')}。
4. 生成 1~5 个相关的 'tags'（标签），不要带 # 号。
5. 将关键细节提取到 'fields'（字段）中（例如：用户名、IP、端口）。将 'label' 设为中文，'value' 一律使用字符串。对于技术字符串（如IP、路径）将 'isCode' 设为 true。对于密码、Token、私钥、API Key 将 'isSecret' 设为 true。
6. 将多行脚本或命令提取到 'codeBlocks'，保持原样，不要改写。

只输出 JSON，不要使用 Markdown 代码块，也不要输出任何解释文字。格式如下：
{
  "notes": [
    {
      "title": "笔记标题",
      "summary": "笔记摘要",
      "category": "分类",
      "tags": ["标签1", "标签2"],
      "fields": [
        { "label": "字段名", "value": "字段值", "isCode": false, "isSecret": false }
      ],
      "codeBlocks": ["代码块1"]
    }
  ]
}
`.trim();

const upstreamDetail = async (res: Response): Promise<string> => {
  const text = await res.text().catch(() => '');
  try {
    const data: unknown = JSON.parse(text);
    if (isDict(data)) {
      const err = data.error;
      const message = isDict(err) ? err.message : (err ?? data.message);
      if (typeof message === 'string') return message.slice(0, 300);
    }
  } catch {
    // not JSON
  }
  return text.slice(0, 300);
};

export const analyze = async (text: string, env: Env): Promise<AnalyzeResponse> => {
  const apiKey = envValue(env.MIMO_API_KEY);
  if (!apiKey) throw new HttpError(503, 'AI_NOT_CONFIGURED', '服务端未配置 MIMO_API_KEY');

  const model = modelName(env);
  let res: Response;
  try {
    res = await fetch(envValue(env.MIMO_API_URL) ?? DEFAULT_MIMO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `原始文本内容：\n${text}` },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new HttpError(504, 'AI_TIMEOUT', 'AI 服务响应超时，请稍后重试或缩短文本');
    }
    throw new HttpError(502, 'AI_UPSTREAM_ERROR', '无法连接 AI 服务');
  }

  // 只记录状态码，不记录请求或响应正文（里面可能有用户的密码）
  if (!res.ok) {
    console.warn('MiMo upstream error', res.status);
    const hint =
      res.status === 401 || res.status === 403
        ? '，请检查 MIMO_API_KEY'
        : res.status === 402
          ? '，MiMo 账户余额不足，请到小米 MiMo 开放平台充值'
          : res.status === 400
            ? '，请检查 MIMO_MODEL_NAME'
            : '';
    const detail = await upstreamDetail(res);
    throw new HttpError(502, 'AI_UPSTREAM_ERROR', `AI 服务返回 ${res.status}${hint}${detail ? `：${detail}` : ''}`);
  }

  let content: unknown;
  try {
    const data: unknown = await res.json();
    const choice = isDict(data) && Array.isArray(data.choices) ? data.choices[0] : undefined;
    content = isDict(choice) && isDict(choice.message) ? choice.message.content : isDict(data) ? data.content : undefined;
  } catch {
    throw new HttpError(502, 'AI_BAD_OUTPUT', 'AI 服务返回的不是合法的 JSON');
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new HttpError(502, 'AI_BAD_OUTPUT', 'AI 返回内容为空');
  }

  let notes;
  try {
    notes = normalizeAnalysis(extractJson(content));
  } catch {
    throw new HttpError(502, 'AI_BAD_OUTPUT', '无法解析 AI 返回的 JSON，请重试');
  }
  if (notes.length === 0) throw new HttpError(502, 'AI_BAD_OUTPUT', 'AI 没有从文本中识别出笔记');

  return { notes, model };
};
