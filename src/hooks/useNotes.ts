import { useSyncExternalStore } from 'react';
import { notesStore } from '../state';
import type { NotesState } from '../state/notesStore';

export const useNotesState = (): NotesState => useSyncExternalStore(notesStore.subscribe, notesStore.getState);
