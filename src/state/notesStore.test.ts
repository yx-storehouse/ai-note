import { describe, expect, it } from 'vitest';
import type { SmartNote } from '../../shared/types';
import { STORAGE_KEYS, type KeyValueStorage } from '../lib/storage';
import { isDirty } from '../lib/syncDecision';
import { createNotesStore } from './notesStore';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const note = (id: string, patch: Partial<SmartNote> = {}): SmartNote => ({
  id,
  title: id,
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

const setup = (initial?: unknown) => {
  const storage = new MemoryStorage();
  if (initial !== undefined) storage.data.set(STORAGE_KEYS.notes, typeof initial === 'string' ? initial : JSON.stringify(initial));
  let clock = 1000;
  const store = createNotesStore(storage, () => ++clock);
  const saved = () => JSON.parse(storage.getItem(STORAGE_KEYS.notes) ?? 'null');
  return { storage, store, saved };
};

describe('notesStore', () => {
  it('loads and normalizes legacy notes synchronously without writing', () => {
    const { store, storage } = setup([{ id: 'a', title: 'A', createdAt: 5 }]);
    expect(store.getState().notes[0]).toMatchObject({ id: 'a', updatedAt: 5, tags: [] });
    expect(storage.getItem(STORAGE_KEYS.syncMeta)).toBeNull();
  });

  it('flags corrupt data and keeps it until the next change', () => {
    const { store, storage } = setup('{oops');
    expect(store.getState()).toMatchObject({ notes: [], corrupt: true });
    expect(storage.getItem(STORAGE_KEYS.notes)).toBe('{oops');
    store.addNotes([note('a')]);
    expect(store.getState().corrupt).toBe(false);
  });

  it('persists every change and notifies subscribers', () => {
    const { store, saved } = setup();
    let calls = 0;
    store.subscribe(() => calls++);
    store.addNotes([note('a')]);
    store.addNotes([note('b')]);
    expect(saved().map((n: SmartNote) => n.id)).toEqual(['b', 'a']);
    expect(calls).toBe(2);
  });

  it('updates updatedAt on edit but not on pin', () => {
    const { store } = setup([note('a')]);
    store.updateNote({ ...note('a'), title: 'changed' });
    const edited = store.getState().notes[0];
    expect(edited.title).toBe('changed');
    expect(edited.updatedAt).toBeGreaterThan(1);

    store.togglePin('a');
    expect(store.getState().notes[0]).toMatchObject({ pinned: true, updatedAt: edited.updatedAt });
    store.togglePin('a');
    expect(store.getState().notes[0].pinned).toBeUndefined();
  });

  it('deletes and restores at the original position', () => {
    const { store } = setup([note('a'), note('b'), note('c')]);
    const removed = store.deleteNote('b')!;
    expect(removed.index).toBe(1);
    expect(store.getState().notes.map(n => n.id)).toEqual(['a', 'c']);
    store.restoreNote(removed.note, removed.index);
    store.restoreNote(removed.note, removed.index);
    expect(store.getState().notes.map(n => n.id)).toEqual(['a', 'b', 'c']);
    expect(store.deleteNote('missing')).toBeNull();
  });

  it('tracks unsynced changes through revisions', () => {
    const { store } = setup([note('a')]);
    const { notes, meta } = store.getState();
    expect(isDirty(notes, meta)).toBe(true);

    store.markSynced(meta.localRevision, 500);
    expect(isDirty(store.getState().notes, store.getState().meta)).toBe(false);

    const rev = store.getState().meta.localRevision;
    store.deleteNote('a');
    expect(store.getState().meta.localRevision).toBeGreaterThan(rev);
    expect(isDirty(store.getState().notes, store.getState().meta)).toBe(true);
  });

  it('stays dirty when edited during an upload', () => {
    const { store } = setup([note('a')]);
    const uploadingRevision = store.getState().meta.localRevision;
    store.addNotes([note('b')]);
    store.markSynced(uploadingRevision, 500);
    expect(isDirty(store.getState().notes, store.getState().meta)).toBe(true);
  });

  it('applies cloud data as synced and returns the previous notes', () => {
    const { store } = setup([note('local')]);
    const previous = store.applyCloud([note('cloud')], 9000);
    expect(previous.map(n => n.id)).toEqual(['local']);
    const { notes, meta } = store.getState();
    expect(notes.map(n => n.id)).toEqual(['cloud']);
    expect(meta.cloudUpdatedAt).toBe(9000);
    expect(isDirty(notes, meta)).toBe(false);

    const undone = store.replaceAll(previous);
    expect(undone.map(n => n.id)).toEqual(['cloud']);
    expect(isDirty(store.getState().notes, store.getState().meta)).toBe(true);
  });

  it('reports storage failures instead of throwing', () => {
    const { store, storage } = setup();
    const errors: unknown[] = [];
    store.onPersistError(err => errors.push(err));
    storage.failWrites = true;
    store.addNotes([note('a')]);
    expect(errors).toHaveLength(1);
    expect(store.getState().notes).toHaveLength(1);
  });

  it('reloads from storage', () => {
    const { store, storage } = setup([note('a')]);
    storage.data.set(STORAGE_KEYS.notes, JSON.stringify([note('z')]));
    store.reloadFromStorage();
    expect(store.getState().notes.map(n => n.id)).toEqual(['z']);
  });
});
