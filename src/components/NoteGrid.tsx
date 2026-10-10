import type { SmartNote } from '../../shared/types';
import type { SortBy } from '../lib/notes';
import { Icons } from './Icon';
import { NoteCard } from './NoteCard';

interface NoteGridProps {
  notes: SmartNote[];
  totalCount: number;
  columns: number;
  sortBy: SortBy;
  activeTag: string | null;
  onNewNote: () => void;
  onClearFilters: () => void;
  onDelete: (id: string) => void;
  onEdit: (note: SmartNote) => void;
  onTogglePin: (id: string) => void;
  onTagClick: (tag: string) => void;
}

export const NoteGrid: React.FC<NoteGridProps> = ({ notes, totalCount, columns, onNewNote, onClearFilters, ...cardProps }) => {
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 opacity-60">
        <div className="w-20 h-20 border border-border rounded-2xl flex items-center justify-center mb-6 bg-surfaceHighlight/50">
          <Icons.Sparkles className="w-8 h-8 text-textMuted" />
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight">暂无笔记</h3>
        <p className="text-textMuted mt-2 max-w-sm text-center">系统待机中。输入您的原始数据片段，AI 将进行结构化处理。</p>
        <button onClick={onNewNote} className="mt-8 border-b border-white pb-0.5 hover:opacity-70 transition-opacity">
          初始化第一条笔记
        </button>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 opacity-60">
        <Icons.Search className="w-8 h-8 text-textMuted mb-4" />
        <h3 className="text-lg font-bold text-white tracking-tight">没有匹配的笔记</h3>
        <button onClick={onClearFilters} className="mt-6 border-b border-white pb-0.5 hover:opacity-70 transition-opacity">
          清除筛选
        </button>
      </div>
    );
  }

  // 瀑布流：按顺序轮流放进各列
  const masonryColumns = Array.from({ length: columns }, () => [] as SmartNote[]);
  notes.forEach((note, index) => masonryColumns[index % columns].push(note));

  return (
    <div className="flex gap-6 pb-20 items-start w-full">
      {masonryColumns.map((colNotes, colIndex) => (
        <div key={colIndex} className="flex-1 flex flex-col gap-6 min-w-0">
          {colNotes.map(note => (
            <NoteCard key={note.id} note={note} {...cardProps} />
          ))}
        </div>
      ))}
    </div>
  );
};
