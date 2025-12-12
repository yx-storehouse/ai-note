import React, { useEffect } from 'react';
import { Icons } from './Icon';

interface NotificationProps {
  message: string;
  type: 'info' | 'success' | 'warning';
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ message, type, actionLabel, onAction, onClose }) => {
  // Auto-close success messages, but keep warnings/prompts until acted upon
  useEffect(() => {
    if (type === 'success') {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [type, onClose]);

  const bgColors = {
    info: 'bg-surface border-border',
    success: 'bg-surface border-green-900/50 text-green-400',
    warning: 'bg-surface border-yellow-900/50 text-yellow-400',
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 max-w-sm w-full animate-fade-in`}>
      <div className={`flex items-start p-4 rounded-lg border shadow-2xl backdrop-blur-md ${bgColors[type]}`}>
        <div className="flex-1 mr-3">
          <p className={`text-sm font-medium ${type === 'info' ? 'text-white' : ''}`}>{message}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {actionLabel && onAction && (
            <button
              onClick={() => {
                onAction();
                onClose();
              }}
              className="text-xs font-bold px-3 py-1.5 rounded bg-white text-black hover:bg-gray-200 transition-colors"
            >
              {actionLabel}
            </button>
          )}
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};