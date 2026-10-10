import { cleanupLegacyKeys, getStorage, STORAGE_KEYS } from '../lib/storage';
import { createNotesStore } from './notesStore';

const storage = getStorage();
cleanupLegacyKeys(storage);

export const notesStore = createNotesStore(storage);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === null || e.key === STORAGE_KEYS.notes || e.key === STORAGE_KEYS.syncMeta) {
      notesStore.reloadFromStorage();
    }
  });
}
