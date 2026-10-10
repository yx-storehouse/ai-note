import { useState, type ReactNode } from 'react';
import type { StatusResponse } from '../../shared/types';
import type { AuthPhase } from '../hooks/useAuth';
import { Icons } from './Icon';
import { Modal } from './Modal';

interface SettingsModalProps {
  phase: AuthPhase;
  status: StatusResponse | null;
  onUnlock: (password: string) => Promise<string | null>;
  onLock: () => void;
  testing: boolean;
  onTestConnection: () => void;
  syncing: boolean;
  dirty: boolean;
  lastSyncedAt: number | null;
  onUpload: () => void;
  onDownload: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClose: () => void;
}

const Banner: React.FC<{ tone: 'ok' | 'info' | 'warn'; children: ReactNode }> = ({ tone, children }) => {
  const styles = {
    ok: 'bg-green-900/20 border-green-500/30 text-green-400',
    info: 'bg-blue-900/20 border-blue-500/30 text-blue-400',
    warn: 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400',
  };
  return <div className={`p-3 border rounded text-xs leading-relaxed ${styles[tone]}`}>{children}</div>;
};

const Section: React.FC<{ icon: ReactNode; title: string; children: ReactNode }> = ({ icon, title, children }) => (
  <div>
    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
      {icon} {title}
    </h3>
    <div className="space-y-3">{children}</div>
  </div>
);

const secondaryButton =
  'flex-1 bg-surfaceHighlight hover:bg-white/10 border border-border text-white py-2 rounded text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  phase,
  status,
  onUnlock,
  onLock,
  testing,
  onTestConnection,
  syncing,
  dirty,
  lastSyncedAt,
  onUpload,
  onDownload,
  onExport,
  onImport,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const ready = phase === 'ready' && status !== null;

  const unlock = async () => {
    if (!password || unlocking) return;
    setUnlocking(true);
    setUnlockError(null);
    const err = await onUnlock(password);
    setUnlocking(false);
    if (err) setUnlockError(err);
    else setPassword('');
  };

  return (
    <Modal title="设置 & 同步" onClose={onClose} bodyClass="p-6 space-y-6 overflow-y-auto">
      <Section icon={<Icons.Lock className="w-4 h-4" />} title="访问密码">
        {phase === 'checking' && <Banner tone="info">正在连接服务端...</Banner>}
        {phase === 'unconfigured' && (
          <Banner tone="warn">服务端未配置 APP_PASSWORD，AI 分析与云同步接口已停用。请在 Cloudflare Worker 中设置该变量后重新部署。</Banner>
        )}
        {phase === 'offline' && <Banner tone="warn">无法连接服务端（/api），只能使用本地功能。</Banner>}
        {phase === 'ready' && (
          <>
            <Banner tone="ok">✓ 已解锁。密码保存在本机浏览器中。</Banner>
            <button onClick={onLock} className={`${secondaryButton} w-full`}>
              清除本机密码
            </button>
          </>
        )}
        {phase === 'locked' && (
          <form
            onSubmit={e => {
              e.preventDefault();
              void unlock();
            }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <input
                type="password"
                autoComplete="current-password"
                placeholder="输入 APP_PASSWORD 解锁"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="flex-1 min-w-0 bg-surface border border-border rounded p-2 text-sm text-white focus:outline-hidden focus:border-white/50 font-mono"
              />
              <button
                type="submit"
                disabled={!password || unlocking}
                className="bg-white text-black hover:bg-gray-200 px-4 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {unlocking ? '...' : '解锁'}
              </button>
            </div>
            {unlockError && <p className="text-xs text-red-400">{unlockError}</p>}
            <p className="text-[10px] text-textMuted">查看、编辑、搜索本地笔记不需要密码。</p>
          </form>
        )}
      </Section>

      <hr className="border-border" />

      <Section icon={<Icons.Sparkles className="w-4 h-4" />} title="MiMo AI">
        {ready &&
          (status.ai ? (
            <Banner tone="ok">✓ API Key 已配置在 Worker 中 · 模型 {status.model}</Banner>
          ) : (
            <Banner tone="warn">服务端未配置 MIMO_API_KEY，暂时无法使用 AI 分析。</Banner>
          ))}
        {!ready && <p className="text-xs text-textMuted">解锁后显示 AI 服务状态。</p>}
        <button onClick={onTestConnection} disabled={testing || (ready && !status.ai)} className={`${secondaryButton} w-full`}>
          {testing ? '测试中...' : '测试连接'}
        </button>
      </Section>

      <hr className="border-border" />

      <Section icon={<Icons.Cloud className="w-4 h-4" />} title="Gitee 云同步">
        {ready &&
          (status.sync ? (
            <Banner tone="ok">
              ✓ Gitee Token 已配置在 Worker 中
              <br />
              Gist ID：{status.gistId ?? '未设置（首次上传时自动创建）'}
              <br />
              {dirty ? '本地有未同步的修改' : '本地与云端一致'}
              {lastSyncedAt && ` · 上次同步 ${new Date(lastSyncedAt).toLocaleString('zh-CN')}`}
            </Banner>
          ) : (
            <Banner tone="info">服务端未配置 GITEE_TOKEN，云同步未启用。笔记仍保存在本机浏览器中。</Banner>
          ))}
        {!ready && <p className="text-xs text-textMuted">解锁后显示同步状态。</p>}
        <div className="flex gap-2">
          <button onClick={onUpload} disabled={syncing || (ready && !status.sync)} className={secondaryButton}>
            {syncing ? '...' : (
              <>
                <Icons.Upload className="w-3 h-3" /> 保存到云端
              </>
            )}
          </button>
          <button onClick={onDownload} disabled={syncing || (ready && !status.sync)} className={secondaryButton}>
            {syncing ? '...' : (
              <>
                <Icons.Download className="w-3 h-3" /> 从云端恢复
              </>
            )}
          </button>
        </div>
        <p className="text-[10px] text-textMuted text-center">从云端恢复会覆盖本地数据，恢复后可撤销</p>
      </Section>

      <hr className="border-border" />

      <Section icon={<Icons.FileCode className="w-4 h-4" />} title="本地备份">
        <div className="flex gap-2">
          <button
            onClick={onExport}
            className="flex-1 bg-surface hover:bg-surfaceHighlight border border-border text-textMuted hover:text-white py-2 rounded text-sm"
          >
            导出 JSON
          </button>
          <label className="flex-1 bg-surface hover:bg-surfaceHighlight border border-border text-textMuted hover:text-white py-2 rounded text-sm text-center cursor-pointer">
            导入 JSON
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                // 清空，以便再次选择同一个文件
                e.target.value = '';
                if (file) onImport(file);
              }}
            />
          </label>
        </div>
        <p className="text-[10px] text-textMuted text-center">导入会替换当前所有笔记，导入后可撤销</p>
      </Section>
    </Modal>
  );
};
