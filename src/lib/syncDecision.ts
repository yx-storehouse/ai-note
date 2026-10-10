import { maxTimestamp, notesEqual } from '../../shared/normalize';
import type { SmartNote, SyncGetResponse } from '../../shared/types';

export interface SyncMeta {
  // 每次本地修改都会递增
  localRevision: number;
  // 最近一次与云端一致时的 localRevision；null 表示从未同步过
  syncedRevision: number | null;
  // 最近一次看到的云端版本
  cloudUpdatedAt: number | null;
  lastSyncedAt: number | null;
}

export const EMPTY_SYNC_META: SyncMeta = {
  localRevision: 0,
  syncedRevision: null,
  cloudUpdatedAt: null,
  lastSyncedAt: null,
};

export const isDirty = (notes: SmartNote[], meta: SyncMeta): boolean =>
  meta.syncedRevision === null ? notes.length > 0 : meta.syncedRevision !== meta.localRevision;

export type StartupDecision =
  | { kind: 'none' }
  | { kind: 'in-sync' }
  | { kind: 'auto-download' }
  | { kind: 'suggest-download' }
  | { kind: 'suggest-upload'; reason: 'cloud-empty' | 'local-newer' | 'local-changes' }
  | { kind: 'conflict' };

// 打开应用时比较本地与云端，决定提示用户做什么
export const decideStartupSync = (local: SmartNote[], meta: SyncMeta, cloud: SyncGetResponse): StartupDecision => {
  if (!cloud.exists) {
    return local.length > 0 ? { kind: 'suggest-upload', reason: 'cloud-empty' } : { kind: 'none' };
  }
  if (notesEqual(local, cloud.notes)) return { kind: 'in-sync' };

  const localChanged = isDirty(local, meta);
  if (local.length === 0 && !localChanged) return { kind: 'auto-download' };

  // 第一次在这台设备上同步（或刚从旧版本升级）：只能比较时间戳
  if (meta.cloudUpdatedAt === null) {
    const localTs = maxTimestamp(local);
    const cloudTs = cloud.updatedAt ?? 0;
    if (cloudTs > localTs) return { kind: 'suggest-download' };
    if (localTs > cloudTs) return { kind: 'suggest-upload', reason: 'local-newer' };
    return { kind: 'conflict' };
  }

  const cloudChanged = cloud.updatedAt !== meta.cloudUpdatedAt;
  if (cloudChanged && localChanged) return { kind: 'conflict' };
  if (cloudChanged) return { kind: 'suggest-download' };
  if (localChanged) return { kind: 'suggest-upload', reason: 'local-changes' };
  // 两边都没记录到修改，内容却不同（例如手动改过 Gist）
  return { kind: 'conflict' };
};
