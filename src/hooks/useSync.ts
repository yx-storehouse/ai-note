import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, errorMessage, isUnauthorized } from '../api/client';
import { decideStartupSync } from '../lib/syncDecision';
import { notesStore } from '../state';
import type { Auth } from './useAuth';
import type { Notify } from './useNotifier';

export const useSync = (auth: Auth, notify: Notify) => {
  const [syncing, setSyncing] = useState(false);
  // 本次会话中看到的云端版本，用于首次同步时作为上传的基准
  const seenCloudUpdatedAt = useRef<number | null>(null);
  const startupChecked = useRef(false);
  const { requireAuth, handleUnauthorized, getStatus } = auth;

  // 先确认已解锁且服务端启用了同步
  const whenEnabled = useCallback(
    (action: () => void) =>
      requireAuth(() => {
        if (!getStatus()?.sync) {
          notify('云同步未启用：服务端未配置 GITEE_TOKEN', 'warning');
          return;
        }
        action();
      }),
    [requireAuth, getStatus, notify],
  );

  const download = useCallback(() => {
    const run = async () => {
      setSyncing(true);
      try {
        const cloud = await api.getSync();
        if (!cloud.exists) {
          notify('云端暂无数据', 'warning');
          return;
        }
        seenCloudUpdatedAt.current = cloud.updatedAt;
        const previous = notesStore.applyCloud(cloud.notes, cloud.updatedAt);
        notify(`已从云端恢复 ${cloud.notes.length} 条笔记`, 'success', {
          actions: [{ label: '撤销', onClick: () => notesStore.replaceAll(previous) }],
          duration: 8000,
        });
      } catch (err) {
        if (isUnauthorized(err)) handleUnauthorized(run);
        else notify(`同步失败：${errorMessage(err)}`, 'warning');
      } finally {
        setSyncing(false);
      }
    };
    whenEnabled(() => void run());
  }, [whenEnabled, handleUnauthorized, notify]);

  const upload = useCallback(
    (force = false) => {
      const run = async () => {
        const { notes, meta } = notesStore.getState();
        // 上传期间如果又有修改，localRevision 会变大，状态仍是「未同步」
        const revision = meta.localRevision;
        setSyncing(true);
        try {
          const res = await api.putSync({
            notes,
            baseUpdatedAt: meta.cloudUpdatedAt ?? seenCloudUpdatedAt.current,
            force,
          });
          seenCloudUpdatedAt.current = res.updatedAt;
          notesStore.markSynced(revision, res.updatedAt);
          if (res.created) {
            notify(`已新建 Gist 并上传。请把 GITEE_GIST_ID 设置为 ${res.gistId}，否则重新部署后会再新建一个`, 'info');
          } else {
            notify('已同步到云端', 'success');
          }
        } catch (err) {
          if (isUnauthorized(err)) handleUnauthorized(run);
          else if (err instanceof ApiError && err.code === 'SYNC_CONFLICT') {
            notify('云端数据已在其他设备上更新，请选择保留哪一份', 'warning', {
              actions: [
                { label: '使用云端', onClick: download },
                { label: '上传本地（覆盖）', onClick: () => upload(true) },
              ],
            });
          } else notify(`同步失败：${errorMessage(err)}`, 'warning');
        } finally {
          setSyncing(false);
        }
      };
      whenEnabled(() => void run());
    },
    [whenEnabled, handleUnauthorized, notify, download],
  );

  // 解锁后检查一次云端，提示用户下载或上传（侧边栏的同步状态会一直显示，所以建议类提示 10 秒后自动消失）
  const ready = auth.phase === 'ready' && Boolean(auth.status?.sync);
  useEffect(() => {
    if (!ready || startupChecked.current) return;
    startupChecked.current = true;

    void (async () => {
      try {
        const cloud = await api.getSync();
        seenCloudUpdatedAt.current = cloud.updatedAt;
        const { notes, meta } = notesStore.getState();
        const decision = decideStartupSync(notes, meta, cloud);
        switch (decision.kind) {
          case 'none':
            break;
          case 'in-sync':
            notesStore.markSynced(meta.localRevision, cloud.updatedAt);
            break;
          case 'auto-download':
            notesStore.applyCloud(cloud.notes, cloud.updatedAt);
            notify(`已从云端加载 ${cloud.notes.length} 条笔记`, 'success');
            break;
          case 'suggest-download':
            notify('发现云端有更新的版本', 'info', { actions: [{ label: '从云端恢复', onClick: download }], duration: 10000 });
            break;
          case 'suggest-upload':
            notify(decision.reason === 'cloud-empty' ? '云端还没有数据' : '本地有尚未同步的修改', 'info', {
              actions: [{ label: '上传到云端', onClick: () => upload() }],
              duration: 10000,
            });
            break;
          case 'conflict':
            notify('本地与云端的数据不一致', 'warning', {
              actions: [
                { label: '使用云端', onClick: download },
                { label: '上传本地（覆盖）', onClick: () => upload(true) },
              ],
            });
            break;
        }
      } catch (err) {
        console.warn('Startup sync check failed:', errorMessage(err));
      }
    })();
  }, [ready, download, upload, notify]);

  return { syncing, upload, download, enabled: ready };
};

export type Sync = ReturnType<typeof useSync>;
