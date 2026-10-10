import { isDict, normalizeNotes } from '../../shared/normalize';
import type { SmartNote } from '../../shared/types';
import { newId } from '../lib/notes';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStorage } from '../lib/storage';
import { EMPTY_SYNC_META, type SyncMeta } from '../lib/syncDecision';

export interface NotesState {
  notes: SmartNote[];
  meta: SyncMeta;
  // localStorage 中的笔记无法解析（不会被覆盖，直到下一次修改）
  corrupt: boolean;
}

export interface NotesStore {
  getState(): NotesState;
  subscribe(listener: () => void): () => void;
  onPersistError(listener: (err: unknown) => void): () => void;
  addNotes(notes: SmartNote[]): void;
  updateNote(note: SmartNote): void;
  togglePin(id: string): void;
  deleteNote(id: string): { note: SmartNote; index: number } | null;
  restoreNote(note: SmartNote, index: number): void;
  replaceAll(notes: SmartNote[]): SmartNote[];
  applyCloud(notes: SmartNote[], cloudUpdatedAt: number | null): SmartNote[];
  markSynced(revision: number, cloudUpdatedAt: number | null): void;
  reloadFromStorage(): void;
}

const toNumberOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const readMeta = (storage: KeyValueStorage | null): SyncMeta => {
  const { value } = readJson(storage, STORAGE_KEYS.syncMeta);
  if (!isDict(value)) return EMPTY_SYNC_META;
  return {
    localRevision: toNumberOrNull(value.localRevision) ?? 0,
    syncedRevision: toNumberOrNull(value.syncedRevision),
    cloudUpdatedAt: toNumberOrNull(value.cloudUpdatedAt),
    lastSyncedAt: toNumberOrNull(value.lastSyncedAt),
  };
};

const load = (storage: KeyValueStorage | null): NotesState => {
  const { ok, value } = readJson(storage, STORAGE_KEYS.notes);
  return { notes: normalizeNotes(value, newId), meta: readMeta(storage), corrupt: !ok };
};

// 笔记状态在创建时同步读取一次 localStorage，之后每次修改立即写回。
// 不再依赖 useEffect 加载/保存，从根本上避免 StrictMode 下的覆盖问题。
export const createNotesStore = (storage: KeyValueStorage | null, now: () => number = Date.now): NotesStore => {
  let state = load(storage);
  const listeners = new Set<() => void>();
  const errorListeners = new Set<(err: unknown) => void>();

  const emit = () => listeners.forEach(l => l());

  const persist = (notesChanged: boolean) => {
    try {
      if (notesChanged) writeJson(storage, STORAGE_KEYS.notes, state.notes);
      writeJson(storage, STORAGE_KEYS.syncMeta, state.meta);
    } catch (err) {
      errorListeners.forEach(l => l(err));
    }
  };

  const setMeta = (patch: Partial<SyncMeta>) => {
    state = { ...state, meta: { ...state.meta, ...patch } };
    persist(false);
    emit();
  };

  // 所有对笔记的修改都走这里：递增本地版本号并保存
  const commit = (notes: SmartNote[], metaPatch: (revision: number) => Partial<SyncMeta> = () => ({})) => {
    const revision = Math.max(state.meta.localRevision + 1, now());
    state = { notes, meta: { ...state.meta, localRevision: revision, ...metaPatch(revision) }, corrupt: false };
    persist(true);
    emit();
  };

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    onPersistError(listener) {
      errorListeners.add(listener);
      return () => errorListeners.delete(listener);
    },

    addNotes(notes) {
      if (notes.length > 0) commit([...notes, ...state.notes]);
    },

    updateNote(note) {
      if (!state.notes.some(n => n.id === note.id)) return;
      const updated = { ...note, updatedAt: now() };
      commit(state.notes.map(n => (n.id === note.id ? updated : n)));
    },

    // 置顶不算内容修改，不改变 updatedAt
    togglePin(id) {
      commit(
        state.notes.map(n => {
          if (n.id !== id) return n;
          const { pinned, ...rest } = n;
          return pinned ? rest : { ...rest, pinned: true };
        }),
      );
    },

    deleteNote(id) {
      const index = state.notes.findIndex(n => n.id === id);
      if (index === -1) return null;
      const note = state.notes[index];
      commit(state.notes.filter(n => n.id !== id));
      return { note, index };
    },

    restoreNote(note, index) {
      if (state.notes.some(n => n.id === note.id)) return;
      const notes = [...state.notes];
      notes.splice(Math.min(index, notes.length), 0, note);
      commit(notes);
    },

    replaceAll(notes) {
      const previous = state.notes;
      commit(notes);
      return previous;
    },

    applyCloud(notes, cloudUpdatedAt) {
      const previous = state.notes;
      commit(notes, revision => ({ syncedRevision: revision, cloudUpdatedAt, lastSyncedAt: now() }));
      return previous;
    },

    markSynced(revision, cloudUpdatedAt) {
      setMeta({ syncedRevision: revision, cloudUpdatedAt, lastSyncedAt: now() });
    },

    // 其他标签页修改了 localStorage 时重新读取
    reloadFromStorage() {
      state = load(storage);
      emit();
    },
  };
};
