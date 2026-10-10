import { memo, useState } from 'react';
import type { NoteField, SmartNote } from '../../shared/types';
import type { SortBy } from '../lib/notes';
import { CopyButton } from './CopyButton';
import { Icons } from './Icon';

interface NoteCardProps {
  note: SmartNote;
  sortBy: SortBy;
  activeTag: string | null;
  onDelete: (id: string) => void;
  onEdit: (note: SmartNote) => void;
  onTogglePin: (id: string) => void;
  onTagClick: (tag: string) => void;
}

const FieldRow: React.FC<{ field: NoteField }> = ({ field }) => {
  // 敏感字段默认模糊；桌面端悬停可预览，触屏设备点击切换
  const [revealed, setRevealed] = useState(false);
  const secretClass = field.isSecret
    ? `transition-all cursor-pointer ${revealed ? '' : 'blur-xs hover:blur-none select-none'}`
    : '';

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm group/field hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
      <span className="text-textMuted font-medium text-xs shrink-0 mr-2">{field.label}</span>
      <div className="flex items-center gap-2 max-w-[70%] min-w-0">
        <span
          className={`truncate ${field.isCode ? 'font-mono text-xs text-white bg-surfaceHighlight px-1.5 py-0.5 rounded border border-border' : 'text-textMain'} ${secretClass}`}
          onClick={field.isSecret ? () => setRevealed(r => !r) : undefined}
          title={field.isSecret ? (revealed ? '点击隐藏' : '点击显示') : field.value}
        >
          {field.value}
        </span>
        {(field.isCode || field.isSecret) && <CopyButton text={field.value} />}
      </div>
    </div>
  );
};

const formatDate = (ts: number) => new Date(ts).toLocaleDateString('zh-CN');

export const NoteCard = memo<NoteCardProps>(({ note, sortBy, activeTag, onDelete, onEdit, onTogglePin, onTagClick }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const showUpdated = sortBy === 'updated' && note.updatedAt !== note.createdAt;

  return (
    <article
      className={`relative bg-surface border ${note.pinned ? 'border-borderHighlight' : 'border-border'} hover:border-textMuted/50 rounded-lg p-5 flex flex-col h-full group transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:-translate-y-1 duration-300`}
    >
      {/* Delete Overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-surface/95 backdrop-blur-xs z-10 rounded-lg flex flex-col items-center justify-center text-center p-4 border border-border animate-fade-in">
          <Icons.Alert className="w-8 h-8 text-white mb-2" />
          <h4 className="text-white font-semibold mb-1">确认删除?</h4>
          <p className="text-xs text-textMuted mb-4">删除后可在提示中撤销。</p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-3 py-1.5 text-xs text-white border border-border rounded hover:bg-surfaceHighlight transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="flex-1 px-3 py-1.5 text-xs bg-white text-black font-semibold rounded hover:bg-gray-200 transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-4 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-border bg-surfaceHighlight text-textMuted">
              {note.category}
            </div>
            {note.pinned && <Icons.Pin filled className="w-3.5 h-3.5 text-white" />}
          </div>
          <h3 className="text-lg font-bold text-white leading-tight tracking-tight break-words">{note.title}</h3>
        </div>
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition-all">
          <button
            onClick={() => onTogglePin(note.id)}
            className={`p-1 ${note.pinned ? 'text-white' : 'text-textMuted hover:text-white'}`}
            title={note.pinned ? '取消置顶' : '置顶'}
            aria-label={note.pinned ? '取消置顶' : '置顶'}
            aria-pressed={Boolean(note.pinned)}
          >
            <Icons.Pin filled={note.pinned} className="w-4 h-4" />
          </button>
          <button onClick={() => onEdit(note)} className="text-textMuted hover:text-white p-1" title="编辑笔记" aria-label="编辑笔记">
            <Icons.Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-textMuted hover:text-red-400 p-1"
            title="删除笔记"
            aria-label="删除笔记"
          >
            <Icons.Trash className="w-4 h-4" />
          </button>
        </div>
      </div>

      {note.summary && <p className="text-sm text-textMuted mb-5 leading-relaxed">{note.summary}</p>}

      {/* Fields */}
      {note.fields.length > 0 && (
        <div className="bg-surfaceHighlight/30 border border-border/50 rounded-lg px-3 py-2 mb-4">
          {note.fields.map((field, idx) => (
            <FieldRow key={idx} field={field} />
          ))}
        </div>
      )}

      {/* Code Blocks */}
      {note.codeBlocks.map((code, idx) => (
        <div key={idx} className="relative group/code mt-2 mb-2 last:mb-0">
          <pre className="bg-black border border-border rounded p-3 text-xs font-mono text-textMain overflow-x-auto whitespace-pre-wrap break-all shadow-inner">
            {code}
          </pre>
          <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 group-focus-within/code:opacity-100 pointer-coarse:opacity-100 transition-opacity bg-surface border border-border rounded p-0.5">
            <CopyButton text={code} />
          </div>
        </div>
      ))}

      {/* Tags & Footer */}
      <div className="mt-auto pt-4 flex flex-wrap gap-2 items-center">
        {note.tags.map(tag => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className={`text-[10px] px-2 py-0.5 rounded-xs border transition-colors ${
              activeTag === tag
                ? 'bg-white text-black border-white'
                : 'text-textMuted bg-surfaceHighlight border-border hover:border-textMuted hover:text-white'
            }`}
            title={activeTag === tag ? '取消标签筛选' : `筛选 #${tag}`}
          >
            #{tag}
          </button>
        ))}
        <div className="w-full text-[10px] text-textMuted/50 text-right mt-2 font-mono">
          {showUpdated ? `更新于 ${formatDate(note.updatedAt)}` : formatDate(note.createdAt)}
        </div>
      </div>
    </article>
  );
});
NoteCard.displayName = 'NoteCard';
