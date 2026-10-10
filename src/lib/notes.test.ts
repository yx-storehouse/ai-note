import { describe, expect, it } from 'vitest';
import type { SmartNote } from '../../shared/types';
import { ALL_CATEGORIES, buildCategoryList, filterNotes, matchesSearch, newId, parseTags, sortNotes, toSmartNotes } from './notes';

const note = (patch: Partial<SmartNote>): SmartNote => ({
  id: 'x',
  title: '',
  originalText: '',
  summary: '',
  category: '其他',
  tags: [],
  fields: [],
  codeBlocks: [],
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

describe('matchesSearch', () => {
  const n = note({
    title: 'VPS 配置',
    summary: '香港机器',
    tags: ['linux'],
    fields: [{ label: '端口', value: 22 as unknown as string }],
    codeBlocks: ['mount /dev/sdb1 /data'],
  });

  it('searches every text field, case-insensitively', () => {
    for (const term of ['vps', '香港', 'LINUX', '端口', '22', 'sdb1', '其他']) {
      expect(matchesSearch(n, term)).toBe(true);
    }
    expect(matchesSearch(n, 'nothing')).toBe(false);
    expect(matchesSearch(n, '   ')).toBe(true);
  });
});

describe('filterNotes', () => {
  const notes = [
    note({ id: '1', category: '服务器', tags: ['a'], title: 'one' }),
    note({ id: '2', category: '服务器', tags: ['b'], title: 'two' }),
    note({ id: '3', category: '命令', tags: ['a'], title: 'three' }),
  ];
  const ids = (list: SmartNote[]) => list.map(n => n.id);

  it('combines category, tag and search', () => {
    expect(ids(filterNotes(notes, { search: '', category: ALL_CATEGORIES, tag: null }))).toEqual(['1', '2', '3']);
    expect(ids(filterNotes(notes, { search: '', category: '服务器', tag: null }))).toEqual(['1', '2']);
    expect(ids(filterNotes(notes, { search: '', category: ALL_CATEGORIES, tag: 'a' }))).toEqual(['1', '3']);
    expect(ids(filterNotes(notes, { search: 'th', category: ALL_CATEGORIES, tag: 'a' }))).toEqual(['3']);
  });
});

describe('sortNotes', () => {
  const notes = [
    note({ id: 'old', createdAt: 1, updatedAt: 50 }),
    note({ id: 'new', createdAt: 10, updatedAt: 10 }),
    note({ id: 'pinned', createdAt: 0, updatedAt: 0, pinned: true }),
  ];

  it('puts pinned notes first, then sorts by the chosen time', () => {
    expect(sortNotes(notes, 'created').map(n => n.id)).toEqual(['pinned', 'new', 'old']);
    expect(sortNotes(notes, 'updated').map(n => n.id)).toEqual(['pinned', 'old', 'new']);
  });

  it('keeps the original order for ties and does not mutate', () => {
    const tied = [note({ id: 'a' }), note({ id: 'b' })];
    expect(sortNotes(tied, 'created').map(n => n.id)).toEqual(['a', 'b']);
    expect(notes[0].id).toBe('old');
  });
});

describe('buildCategoryList', () => {
  it('starts with 全部 and sorts by count, keeping default categories', () => {
    const list = buildCategoryList([note({ category: '命令' }), note({ category: '命令' }), note({ category: '自定义' })]);
    expect(list[0]).toEqual({ name: ALL_CATEGORIES, count: 3 });
    expect(list[1]).toEqual({ name: '命令', count: 2 });
    expect(list[2]).toEqual({ name: '自定义', count: 1 });
    expect(list.map(c => c.name)).toContain('服务器');
  });
});

describe('parseTags', () => {
  it('keeps typing-friendly input', () => {
    expect(parseTags('a, b,')).toEqual(['a', 'b']);
    expect(parseTags('#运维，linux, a,a')).toEqual(['运维', 'linux', 'a']);
  });
});

describe('newId / toSmartNotes', () => {
  it('creates unique UUID-shaped ids', () => {
    const a = newId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newId()).not.toBe(a);
  });

  it('adds ids, timestamps and the original text', () => {
    const [n] = toSmartNotes(
      [{ title: 't', summary: '', category: '其他', tags: [], fields: [], codeBlocks: [] }],
      'raw',
      123,
    );
    expect(n).toMatchObject({ title: 't', originalText: 'raw', createdAt: 123, updatedAt: 123 });
  });
});
