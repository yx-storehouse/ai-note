import type { ReactNode } from 'react';
import type { CategoryCount } from '../lib/notes';
import { Icons } from './Icon';

interface SidebarProps {
  categories: CategoryCount[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onNewNote: () => void;
  onOpenSettings: () => void;
  syncIndicator: ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  onNewNote,
  onOpenSettings,
  syncIndicator,
}) => (
  <aside className="w-64 bg-surface/50 border-r border-border backdrop-blur-xs hidden md:flex flex-col shrink-0 z-10">
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center">
            <Icons.Sparkles className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-wide">AI NOTES</h1>
        </div>
        <button onClick={onOpenSettings} className="text-textMuted hover:text-white transition-colors" title="设置" aria-label="设置">
          <Icons.Settings className="w-5 h-5" />
        </button>
      </div>

      <button
        onClick={onNewNote}
        className="w-full bg-white text-black hover:bg-gray-200 py-2.5 px-4 rounded font-semibold transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 group"
      >
        <span className="group-hover:scale-110 transition-transform duration-200">+</span>
        <span>新建笔记</span>
      </button>
    </div>

    <div className="flex-1 overflow-y-auto px-4 py-2">
      <h3 className="text-[10px] font-bold text-textMuted uppercase tracking-widest mb-4 px-2 flex justify-between">
        <span>FILTER BY</span>
        <span className="text-[9px] opacity-50">SORTED BY COUNT</span>
      </h3>
      <nav className="space-y-1">
        {categories.map(({ name, count }) => (
          <button
            key={name}
            onClick={() => onSelectCategory(name)}
            aria-current={selectedCategory === name ? 'true' : undefined}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-all border border-transparent group flex justify-between items-center ${
              selectedCategory === name
                ? 'bg-surfaceHighlight text-white border-border shadow-xs'
                : 'text-textMuted hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="truncate">{name}</span>
            <span className={`text-xs ${selectedCategory === name ? 'text-white' : 'text-textMuted/50 group-hover:text-textMuted'}`}>
              {count}
            </span>
          </button>
        ))}
      </nav>
    </div>

    <div className="p-4 border-t border-border space-y-2">
      {syncIndicator}
      <div className="text-[10px] text-textMuted/30 text-center">SMART NOTE AI v{__APP_VERSION__}</div>
    </div>
  </aside>
);
