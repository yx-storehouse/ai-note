import { describe, expect, it } from 'vitest';
import type { SmartNote, SyncGetResponse } from '../../shared/types';
import { decideStartupSync, EMPTY_SYNC_META, isDirty, type SyncMeta } from './syncDecision';

const note = (id: string, updatedAt = 1000): SmartNote => ({
  id,
  title: id,
  originalText: '',
  summary: '',
  category: '其他',
  tags: [],
  fields: [],
  codeBlocks: [],
  createdAt: 1000,
  updatedAt,
});

const cloud = (notes: SmartNote[], updatedAt: number | null = 5000): SyncGetResponse => ({
  exists: true,
  updatedAt,
  notes,
  format: 'v2',
});
const missing: SyncGetResponse = { exists: false, updatedAt: null, notes: [], format: null };

const synced: SyncMeta = { localRevision: 10, syncedRevision: 10, cloudUpdatedAt: 5000, lastSyncedAt: 1 };
const dirty: SyncMeta = { ...synced, localRevision: 11 };

describe('isDirty', () => {
  it('treats never-synced notes as dirty', () => {
    expect(isDirty([note('a')], EMPTY_SYNC_META)).toBe(true);
    expect(isDirty([], EMPTY_SYNC_META)).toBe(false);
    expect(isDirty([note('a')], synced)).toBe(false);
    expect(isDirty([], dirty)).toBe(true);
  });
});

describe('decideStartupSync', () => {
  it('handles a missing cloud file', () => {
    expect(decideStartupSync([], EMPTY_SYNC_META, missing)).toEqual({ kind: 'none' });
    expect(decideStartupSync([note('a')], EMPTY_SYNC_META, missing)).toEqual({ kind: 'suggest-upload', reason: 'cloud-empty' });
  });

  it('detects equal content', () => {
    expect(decideStartupSync([note('a')], EMPTY_SYNC_META, cloud([note('a')]))).toEqual({ kind: 'in-sync' });
  });

  it('loads the cloud automatically into an empty, clean device', () => {
    expect(decideStartupSync([], EMPTY_SYNC_META, cloud([note('a')]))).toEqual({ kind: 'auto-download' });
    expect(decideStartupSync([], synced, cloud([note('a')], 6000))).toEqual({ kind: 'auto-download' });
  });

  it('compares timestamps on first sync', () => {
    expect(decideStartupSync([note('a', 1000)], EMPTY_SYNC_META, cloud([note('b')], 2000))).toEqual({ kind: 'suggest-download' });
    expect(decideStartupSync([note('a', 3000)], EMPTY_SYNC_META, cloud([note('b')], 2000))).toEqual({
      kind: 'suggest-upload',
      reason: 'local-newer',
    });
    expect(decideStartupSync([note('a', 2000)], EMPTY_SYNC_META, cloud([note('b')], 2000))).toEqual({ kind: 'conflict' });
  });

  it('uses the recorded revisions afterwards', () => {
    expect(decideStartupSync([note('a')], synced, cloud([note('b')], 6000))).toEqual({ kind: 'suggest-download' });
    expect(decideStartupSync([note('a')], dirty, cloud([note('b')], 5000))).toEqual({
      kind: 'suggest-upload',
      reason: 'local-changes',
    });
    expect(decideStartupSync([note('a')], dirty, cloud([note('b')], 6000))).toEqual({ kind: 'conflict' });
    expect(decideStartupSync([note('a')], synced, cloud([note('b')], 5000))).toEqual({ kind: 'conflict' });
  });

  it('notices deletions as local changes', () => {
    expect(decideStartupSync([], dirty, cloud([note('a')], 5000))).toEqual({ kind: 'suggest-upload', reason: 'local-changes' });
  });
});
