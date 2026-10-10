import { useId, type ReactNode } from 'react';
import { useModalShortcuts } from '../hooks/useKeyboardShortcuts';
import { Icons } from './Icon';

interface ModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  // Ctrl/Cmd + Enter
  onSubmit?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  widthClass?: string;
  // 叠在其他弹窗上方时使用更高的层级
  layerClass?: string;
  bodyClass?: string;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  subtitle,
  onClose,
  onSubmit,
  footer,
  children,
  widthClass = 'max-w-lg',
  layerClass = 'z-50',
  bodyClass = 'p-6 overflow-y-auto',
}) => {
  const titleId = useId();
  useModalShortcuts({ onClose, onSubmit });

  return (
    <div className={`absolute inset-0 bg-black/80 backdrop-blur-md ${layerClass} flex items-center justify-center p-4 animate-fade-in`}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-background border border-border rounded-xl w-full ${widthClass} shadow-2xl flex flex-col max-h-[90dvh]`}
      >
        <div className="p-5 border-b border-border flex justify-between items-center bg-surface/50 rounded-t-xl">
          <div>
            <h2 id={titleId} className="font-bold text-white text-lg">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-textMuted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors" aria-label="关闭" title="关闭 (Esc)">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <div className={`flex-1 min-h-0 ${bodyClass}`}>{children}</div>
        {footer && <div className="p-5 border-t border-border bg-surface/50 rounded-b-xl flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
};

export const Kbd: React.FC<{ children: ReactNode }> = ({ children }) => (
  <kbd className="px-1.5 py-0.5 rounded border border-border bg-surfaceHighlight text-[10px] font-mono text-textMuted">{children}</kbd>
);

// Mac 上显示 ⌘，其他系统显示 Ctrl
export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
