import { FALLBACK_CATEGORY } from './categories';
import type { AnalyzedNote, NoteField, SmartNote } from './types';

// 大模型的输出、旧版本的数据、导入的文件都可能缺字段或类型不对，
// 进入应用前统一经过这里整理成稳定的结构。

export const UNTITLED = '未命名笔记';
const MAX_AI_TAGS = 10;

type Dict = Record<string, unknown>;

export const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

const toStr = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
};

const toBool = (v: unknown): boolean => v === true || v === 'true';

const toTimestamp = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;

export const normalizeTags = (v: unknown, limit = Infinity): string[] => {
  const raw = Array.isArray(v) ? v.map(toStr) : typeof v === 'string' ? v.split(/[,，]/) : [];
  const seen = new Set<string>();
  for (const item of raw) {
    const tag = item.trim().replace(/^#+/, '').trim();
    if (tag && !seen.has(tag)) seen.add(tag);
    if (seen.size >= limit) break;
  }
  return [...seen];
};

export const normalizeFields = (v: unknown): NoteField[] => {
  if (!Array.isArray(v)) return [];
  const fields: NoteField[] = [];
  for (const item of v) {
    if (!isDict(item)) continue;
    const label = toStr(item.label ?? item.key ?? item.name).trim();
    const value = toStr(item.value);
    if (!label && !value.trim()) continue;
    fields.push({ label, value, isCode: toBool(item.isCode), isSecret: toBool(item.isSecret) });
  }
  return fields;
};

export const normalizeCodeBlocks = (v: unknown): string[] => {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
  return list
    .map(item => (isDict(item) ? toStr(item.code ?? item.content) : toStr(item)))
    .map(code => code.replace(/^\n+/, '').replace(/\s+$/, ''))
    .filter(Boolean);
};

// 从大模型回复中取出 JSON：兼容 <think> 段落、```json 代码围栏和前后多余的文字
export const extractJson = (content: string): unknown => {
  const text = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const candidates = [text];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());

  // 对象和数组都试一下，先出现的优先
  const slices: Array<[number, string]> = [];
  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start !== -1 && end > start) slices.push([start, text.slice(start, end + 1)]);
  }
  candidates.push(...slices.sort((a, b) => a[0] - b[0]).map(([, slice]) => slice));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }
  throw new Error('无法从 AI 回复中解析出 JSON');
};

const normalizeAnalyzedNote = (raw: unknown): AnalyzedNote | null => {
  if (!isDict(raw)) return null;
  const note: AnalyzedNote = {
    title: toStr(raw.title).trim(),
    summary: toStr(raw.summary).trim(),
    category: toStr(raw.category).trim() || FALLBACK_CATEGORY,
    tags: normalizeTags(raw.tags, MAX_AI_TAGS),
    fields: normalizeFields(raw.fields),
    codeBlocks: normalizeCodeBlocks(raw.codeBlocks),
  };
  if (!note.title && !note.summary && note.fields.length === 0 && note.codeBlocks.length === 0) return null;
  if (!note.title) note.title = UNTITLED;
  return note;
};

// 接受 {notes: [...]}、裸数组或单个笔记对象
export const normalizeAnalysis = (raw: unknown): AnalyzedNote[] => {
  const list = Array.isArray(raw)
    ? raw
    : isDict(raw) && Array.isArray(raw.notes)
      ? raw.notes
      : isDict(raw)
        ? [raw]
        : [];
  return list.map(normalizeAnalyzedNote).filter((n): n is AnalyzedNote => n !== null);
};

export const normalizeNote = (raw: unknown, newId: () => string, now = Date.now()): SmartNote | null => {
  if (!isDict(raw)) return null;
  const createdAt = toTimestamp(raw.createdAt) ?? now;
  const note: SmartNote = {
    id: toStr(raw.id).trim() || newId(),
    title: toStr(raw.title).trim() || UNTITLED,
    originalText: toStr(raw.originalText),
    summary: toStr(raw.summary),
    category: toStr(raw.category).trim() || FALLBACK_CATEGORY,
    tags: normalizeTags(raw.tags),
    fields: normalizeFields(raw.fields),
    codeBlocks: normalizeCodeBlocks(raw.codeBlocks),
    createdAt,
    updatedAt: toTimestamp(raw.updatedAt) ?? createdAt,
  };
  if (toBool(raw.pinned)) note.pinned = true;
  return note;
};

// 非数组返回空数组；重复 id 只保留第一条
export const normalizeNotes = (raw: unknown, newId: () => string, now = Date.now()): SmartNote[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const notes: SmartNote[] = [];
  for (const item of raw) {
    const note = normalizeNote(item, newId, now);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    notes.push(note);
  }
  return notes;
};

export const maxTimestamp = (notes: SmartNote[]): number =>
  notes.reduce((max, n) => Math.max(max, n.updatedAt || n.createdAt || 0), 0);

export interface ParsedCloudFile {
  format: 'v2' | 'legacy';
  updatedAt: number | null;
  notes: SmartNote[];
}

// 解析 Gist 中的 smart_notes.json：v2 为 {version:2, updatedAt, notes}，旧版本是裸数组
export const parseCloudFile = (content: string, newId: () => string): ParsedCloudFile => {
  const data: unknown = JSON.parse(content);
  if (Array.isArray(data)) {
    const notes = normalizeNotes(data, newId);
    return { format: 'legacy', updatedAt: maxTimestamp(notes) || null, notes };
  }
  if (isDict(data) && data.version === 2 && Array.isArray(data.notes)) {
    return { format: 'v2', updatedAt: toTimestamp(data.updatedAt), notes: normalizeNotes(data.notes, newId) };
  }
  throw new Error('云端数据格式无法识别');
};

const canonical = (notes: SmartNote[]): string =>
  JSON.stringify(
    notes
      .map(n => normalizeNote(n, () => ''))
      .filter((n): n is SmartNote => n !== null)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  );

// 内容相同（忽略顺序与字段先后）即视为相等
export const notesEqual = (a: SmartNote[], b: SmartNote[]): boolean =>
  a.length === b.length && canonical(a) === canonical(b);
