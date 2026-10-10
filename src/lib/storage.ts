// localStorage 读写。隐私模式或存储被禁用时 localStorage 可能直接抛错，这里统一兜底。

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const STORAGE_KEYS = {
  notes: 'smart-notes-data',
  syncMeta: 'smart-notes-sync-meta',
  auth: 'smart-notes-auth',
  ui: 'smart-notes-ui',
} as const;

// 旧版本把 API Key 和 Gitee Token 明文存在浏览器里，现在它们只保存在 Worker 中
const LEGACY_KEYS = ['smart-notes-gitee-config', 'smart-notes-api-config'];

export const getStorage = (): KeyValueStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const readString = (storage: KeyValueStorage | null, key: string): string | null => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

// 解析失败时返回 { ok: false }，以便区分「没有数据」和「数据损坏」
export const readJson = (storage: KeyValueStorage | null, key: string): { ok: boolean; value: unknown } => {
  const raw = readString(storage, key);
  if (raw === null) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, value: null };
  }
};

// 写入失败（例如存储空间已满）时抛出，由调用方决定如何提示
export const writeJson = (storage: KeyValueStorage | null, key: string, value: unknown): void => {
  storage?.setItem(key, JSON.stringify(value));
};

export const writeString = (storage: KeyValueStorage | null, key: string, value: string | null): void => {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // ignore
  }
};

export const cleanupLegacyKeys = (storage: KeyValueStorage | null): void => {
  for (const key of LEGACY_KEYS) writeString(storage, key, null);
};
