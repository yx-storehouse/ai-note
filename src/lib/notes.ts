import { DEFAULT_CATEGORIES } from '../../shared/categories';
import { normalizeTags } from '../../shared/normalize';
import type { AnalyzedNote, SmartNote } from '../../shared/types';

export const ALL_CATEGORIES = '全部';

export type SortBy = 'created' | 'updated';

export interface NoteFilter {
  search: string;
  category: string;
  tag: string | null;
}

// crypto.randomUUID 只在 HTTPS / localhost 下可用，局域网 http 访问时退回 getRandomValues
export const newId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export const matchesSearch = (note: SmartNote, term: string): boolean => {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    note.title,
    note.summary,
    note.category,
    ...note.tags,
    ...note.fields.flatMap(f => [f.label, String(f.value)]),
    ...note.codeBlocks,
  ];
  return haystack.some(text => text.toLowerCase().includes(q));
};

export const filterNotes = (notes: SmartNote[], { search, category, tag }: NoteFilter): SmartNote[] =>
  notes.filter(
    note =>
      (category === ALL_CATEGORIES || note.category === category) &&
      (!tag || note.tags.includes(tag)) &&
      matchesSearch(note, search),
  );

// 置顶在前，其余按创建或更新时间倒序（同一批添加的笔记保持原有顺序）
export const sortNotes = (notes: SmartNote[], sortBy: SortBy): SmartNote[] => {
  const key = (n: SmartNote) => (sortBy === 'updated' ? n.updatedAt : n.createdAt);
  return [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || key(b) - key(a));
};

export interface CategoryCount {
  name: string;
  count: number;
}

// 「全部」在最前，其余按笔记数倒序；默认分类即使为 0 也保留
export const buildCategoryList = (notes: SmartNote[]): CategoryCount[] => {
  const counts = new Map<string, number>();
  for (const n of notes) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
  const names = Array.from(new Set<string>([...DEFAULT_CATEGORIES, ...counts.keys()]));
  const sorted = names
    .map(name => ({ name, count: counts.get(name) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  return [{ name: ALL_CATEGORIES, count: notes.length }, ...sorted];
};

// 支持英文逗号、中文逗号，自动去掉 # 和重复项
export const parseTags = (input: string): string[] => normalizeTags(input);

export const toSmartNotes = (analyzed: AnalyzedNote[], originalText: string, now: number): SmartNote[] =>
  analyzed.map(n => ({ id: newId(), ...n, originalText, createdAt: now, updatedAt: now }));
