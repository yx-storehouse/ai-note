import { useState } from 'react';
import { Modal } from './Modal';

interface PasswordModalProps {
  onUnlock: (password: string) => Promise<string | null>;
  onClose: () => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ onUnlock, onClose }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (!password || checking) return;
    setChecking(true);
    setError(null);
    const err = await onUnlock(password);
    setChecking(false);
    if (err) setError(err);
  };

  return (
    <Modal
      title="输入访问密码"
      subtitle="AI 分析和云同步需要访问密码"
      onClose={onClose}
      onSubmit={submit}
      layerClass="z-[60]"
      widthClass="max-w-sm"
      footer={
        <>
          <button onClick={onClose} className="px-5 py-2 text-textMuted hover:text-white text-sm">
            取消
          </button>
          <button
            onClick={submit}
            disabled={!password || checking}
            className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded font-bold text-sm"
          >
            {checking ? '验证中...' : '解锁'}
          </button>
        </>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="APP_PASSWORD"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-surface border border-border rounded p-2 text-sm text-white focus:outline-hidden focus:border-white/50 font-mono"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <p className="text-[10px] text-textMuted leading-relaxed">
          即部署时在 Cloudflare Worker 中设置的 APP_PASSWORD。密码只保存在本机浏览器，可在设置中清除。查看和编辑本地笔记不需要密码。
        </p>
      </form>
    </Modal>
  );
};
