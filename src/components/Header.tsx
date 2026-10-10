import { forwardRef, type ReactNode } from 'react';
import { isComposing } from '../hooks/useKeyboardShortcuts';
import { Icons } from './Icon';
import { Kbd } from './Modal';

interface HeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onNewNote: () => void;
  onOpenSettings: () => void;
  syncIndicator: ReactNode;
}

// 在搜索框里按 Esc：清空并取消聚焦
export const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, onSearchChange: (value: string) => void) => {
  if (e.key === 'Escape' && !isComposing(e)) {
    onSearchChange('');
    e.currentTarget.blur();
  }
};

export const Header = forwardRef<HTMLInputElement, HeaderProps>(
  ({ search, onSearchChange, onNewNote, onOpenSettings, syncIndicator }, ref) => (
    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="md:hidden flex items-center gap-2 text-white">
        <div className="w-6 h-6 bg-white text-black rounded flex items-center justify-center">
          <Icons.Sparkles className="w-4 h-4" />
        </div>
        <span className="font-bold tracking-wide">AI NOTES</span>
      </div>

      <div className="flex-1 max-w-xl mx-auto relative hidden md:block group">
        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted group-focus-within:text-white transition-colors" />
        <input
          ref={ref}
          type="search"
          placeholder="搜索标题、标签、字段或命令..."
          aria-label="搜索笔记"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          onKeyDown={e => handleSearchKeyDown(e, onSearchChange)}
          className="w-full bg-surface border border-border rounded-full py-2.5 pl-10 pr-10 text-sm text-textMain focus:outline-hidden focus:border-white/50 focus:bg-surfaceHighlight transition-all placeholder:text-textMuted/50"
        />
        {!search && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:hidden">
            <Kbd>/</Kbd>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 md:hidden">
        {syncIndicator}
        <button onClick={onOpenSettings} className="text-white p-2" aria-label="设置">
          <Icons.Settings className="w-5 h-5" />
        </button>
        <button onClick={onNewNote} className="text-white border border-border px-3 py-1 rounded bg-surface" aria-label="新建笔记">
          +
        </button>
      </div>
    </header>
  ),
);
Header.displayName = 'Header';
