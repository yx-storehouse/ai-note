import { useCallback, useState } from 'react';
import { isDict } from '../../shared/normalize';
import { ALL_CATEGORIES, type SortBy } from '../lib/notes';
import { getStorage, readJson, STORAGE_KEYS, writeJson } from '../lib/storage';

const storage = getStorage();

const readSortBy = (): SortBy => {
  const { value } = readJson(storage, STORAGE_KEYS.ui);
  return isDict(value) && value.sortBy === 'updated' ? 'updated' : 'created';
};

export const useFilters = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [tag, setTag] = useState<string | null>(null);
  const [sortBy, setSortByState] = useState<SortBy>(readSortBy);

  const setSortBy = useCallback((value: SortBy) => {
    setSortByState(value);
    try {
      writeJson(storage, STORAGE_KEYS.ui, { sortBy: value });
    } catch {
      // ignore
    }
  }, []);

  const toggleTag = useCallback((value: string) => setTag(prev => (prev === value ? null : value)), []);

  const clear = useCallback(() => {
    setSearch('');
    setCategory(ALL_CATEGORIES);
    setTag(null);
  }, []);

  const active = Boolean(search.trim()) || category !== ALL_CATEGORIES || tag !== null;

  return { search, setSearch, category, setCategory, tag, setTag, toggleTag, sortBy, setSortBy, clear, active };
};

export type Filters = ReturnType<typeof useFilters>;
