import { describe, expect, it } from 'vitest';
import {
  extractJson,
  maxTimestamp,
  normalizeAnalysis,
  normalizeNote,
  normalizeNotes,
  normalizeTags,
  notesEqual,
  parseCloudFile,
  UNTITLED,
} from './normalize';
import type { SmartNote } from './types';

let counter = 0;
const newId = () => `id-${++counter}`;

const note = (patch: Partial<SmartNote> = {}): SmartNote => ({
  id: 'a',
  title: 'T',
  originalText: '',
  summary: '',
  category: '服务器',
  tags: [],
  fields: [],
  codeBlocks: [],
  createdAt: 1000,
  updatedAt: 1000,
  ...patch,
});

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"notes":[]}')).toEqual({ notes: [] });
  });

  it('strips code fences and surrounding prose', () => {
    expect(extractJson('好的，结果如下：\n```json\n{"notes":[1]}\n```\n希望有帮助')).toEqual({ notes: [1] });
  });

  it('strips <think> blocks', () => {
    expect(extractJson('<think>{"draft":true}</think>{"notes":[]}')).toEqual({ notes: [] });
  });

  it('falls back to a bare array', () => {
    expect(extractJson('result: [{"title":"x"}] done')).toEqual([{ title: 'x' }]);
  });

  it('throws when nothing parses', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('normalizeTags', () => {
  it('accepts strings, strips #, trims and de-duplicates', () => {
    expect(normalizeTags('#vps, 服务器，vps ,, ')).toEqual(['vps', '服务器']);
    expect(normalizeTags(['a', 'a', ' b ', 3])).toEqual(['a', 'b', '3']);
  });

  it('respects the limit', () => {
    expect(normalizeTags(['1', '2', '3'], 2)).toEqual(['1', '2']);
  });
});

describe('normalizeAnalysis', () => {
  it('fills missing arrays and coerces numeric values', () => {
    const [n] = normalizeAnalysis({
      notes: [{ title: 'VPS', fields: [{ label: '端口', value: 22, isCode: 'true' }], tags: 'a,a,b' }],
    });
    expect(n).toEqual({
      title: 'VPS',
      summary: '',
      category: '其他',
      tags: ['a', 'b'],
      fields: [{ label: '端口', value: '22', isCode: true, isSecret: false }],
      codeBlocks: [],
    });
  });

  it('accepts a bare array or a single note', () => {
    expect(normalizeAnalysis([{ title: 'a' }, { title: 'b' }])).toHaveLength(2);
    expect(normalizeAnalysis({ title: 'single' })[0].title).toBe('single');
  });

  it('drops empty notes and names untitled ones', () => {
    const notes = normalizeAnalysis({ notes: [{}, null, { summary: 's' }, { codeBlocks: [{ code: 'ls\n' }] }] });
    expect(notes.map(n => n.title)).toEqual([UNTITLED, UNTITLED]);
    expect(notes[1].codeBlocks).toEqual(['ls']);
  });

  it('drops fields with neither label nor value', () => {
    const [n] = normalizeAnalysis({ title: 'x', fields: [{ label: '', value: ' ' }, { key: 'IP', value: '1.1.1.1' }, 'bad'] });
    expect(n.fields).toEqual([{ label: 'IP', value: '1.1.1.1', isCode: false, isSecret: false }]);
  });
});

describe('normalizeNote(s)', () => {
  it('fills defaults for legacy notes', () => {
    const n = normalizeNote({ title: 'x', createdAt: 5 }, newId, 99)!;
    expect(n.id).toMatch(/^id-/);
    expect(n.updatedAt).toBe(5);
    expect(n.category).toBe('其他');
    expect(n.pinned).toBeUndefined();
  });

  it('uses now when timestamps are missing and keeps pinned', () => {
    const n = normalizeNote({ id: 'k', pinned: true }, newId, 99)!;
    expect(n).toMatchObject({ id: 'k', createdAt: 99, updatedAt: 99, pinned: true, title: UNTITLED });
  });

  it('drops non-objects and duplicate ids', () => {
    expect(normalizeNotes([note(), 'x', note({ title: 'dup' })], newId)).toHaveLength(1);
    expect(normalizeNotes({ not: 'array' }, newId)).toEqual([]);
  });
});

describe('parseCloudFile', () => {
  it('reads the legacy bare-array format', () => {
    const parsed = parseCloudFile(JSON.stringify([note({ updatedAt: 42 })]), newId);
    expect(parsed).toMatchObject({ format: 'legacy', updatedAt: 42 });
    expect(parsed.notes).toHaveLength(1);
  });

  it('reads the v2 format', () => {
    const parsed = parseCloudFile(JSON.stringify({ version: 2, updatedAt: 7, notes: [note()] }), newId);
    expect(parsed).toMatchObject({ format: 'v2', updatedAt: 7 });
  });

  it('returns null updatedAt for an empty legacy file', () => {
    expect(parseCloudFile('[]', newId).updatedAt).toBeNull();
  });

  it('throws on unknown formats', () => {
    expect(() => parseCloudFile('{"foo":1}', newId)).toThrow();
    expect(() => parseCloudFile('not json', newId)).toThrow();
  });
});

describe('notesEqual / maxTimestamp', () => {
  it('ignores order and key order', () => {
    const a = note({ id: 'a' });
    const b = note({ id: 'b' });
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as unknown as SmartNote;
    expect(notesEqual([a, b], [b, reordered])).toBe(true);
    expect(notesEqual([a], [note({ id: 'a', title: 'changed' })])).toBe(false);
    expect(notesEqual([a], [a, b])).toBe(false);
  });

  it('returns the newest timestamp', () => {
    expect(maxTimestamp([note({ updatedAt: 3 }), note({ updatedAt: 9 })])).toBe(9);
    expect(maxTimestamp([])).toBe(0);
  });
});
