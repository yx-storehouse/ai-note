import { useEffect } from 'react';
import type { NotificationItem } from '../hooks/useNotifier';
import { Icons } from './Icon';

interface NotificationProps {
  notification: NotificationItem;
  onClose: () => void;
}

const COLORS = {
  info: 'bg-surface border-border',
  success: 'bg-surface border-green-900/50 text-green-400',
  warning: 'bg-surface border-yellow-900/50 text-yellow-400',
};

// 显示在左下角，避免挡住弹窗右下角的操作按钮。渲染时以 notification.id 作为 key，新通知会重置计时器
export const Notification: React.FC<NotificationProps> = ({ notification, onClose }) => {
  const { message, type, actions = [] } = notification;
  // 成功提示默认 3 秒后关闭；警告和带操作的提示一直显示，直到用户处理
  const duration = notification.duration ?? (type === 'success' && actions.length === 0 ? 3000 : undefined);

  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-full sm:max-w-sm z-[70] animate-fade-in"
      role={type === 'warning' ? 'alert' : 'status'}
    >
      <div className={`flex items-start p-4 rounded-lg border shadow-2xl backdrop-blur-md ${COLORS[type]}`}>
        <div className="flex-1 mr-3 min-w-0">
          <p className={`text-sm font-medium break-words whitespace-pre-line ${type === 'info' ? 'text-white' : ''}`}>{message}</p>
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {actions.map(action => (
                <button
                  key={action.label}
                  onClick={() => {
                    onClose();
                    action.onClick();
                  }}
                  className="text-xs font-bold px-3 py-1.5 rounded bg-white text-black hover:bg-gray-200 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-textMuted hover:text-white transition-colors" aria-label="关闭通知">
          <Icons.X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
