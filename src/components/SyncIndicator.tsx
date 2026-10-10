import type { AuthPhase } from '../hooks/useAuth';
import { Icons } from './Icon';

interface SyncIndicatorProps {
  phase: AuthPhase;
  syncEnabled: boolean;
  syncing: boolean;
  dirty: boolean;
  lastSyncedAt: number | null;
  onUpload: () => void;
  onUnlock: () => void;
  compact?: boolean;
}

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  phase,
  syncEnabled,
  syncing,
  dirty,
  lastSyncedAt,
  onUpload,
  onUnlock,
  compact = false,
}) => {
  let label: string;
  let dot = 'bg-textMuted/50';
  let onClick: (() => void) | undefined;

  if (phase === 'checking') {
    label = '连接中...';
  } else if (phase === 'locked') {
    label = '云同步 · 未解锁';
    onClick = onUnlock;
  } else if (phase === 'unconfigured') {
    label = '服务端未设置密码';
    dot = 'bg-yellow-400';
  } else if (phase === 'offline') {
    label = '离线 · 仅本地';
    dot = 'bg-yellow-400';
  } else if (!syncEnabled) {
    label = '仅保存在本机';
  } else if (syncing) {
    label = '同步中...';
    dot = 'bg-blue-400 animate-pulse';
  } else if (dirty) {
    label = '有未同步的修改';
    dot = 'bg-yellow-400';
    onClick = onUpload;
  } else {
    label = lastSyncedAt ? `已同步 · ${formatTime(lastSyncedAt)}` : '已同步';
    dot = 'bg-green-400';
  }

  const title = onClick ? (phase === 'locked' ? '输入访问密码' : '点击上传到云端') : label;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        title={title}
        aria-label={label}
        className="relative text-white p-2 disabled:cursor-default"
      >
        <Icons.Cloud className="w-5 h-5" />
        <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${dot}`} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={title}
      className="w-full flex items-center justify-center gap-2 text-[11px] text-textMuted enabled:hover:text-white transition-colors disabled:cursor-default"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </button>
  );
};
