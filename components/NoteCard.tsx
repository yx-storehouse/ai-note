import React, { useState } from 'react';
import { SmartNote, NoteField } from '../types';
import { Icons } from './Icon';

interface NoteCardProps {
  note: SmartNote;
  onDelete: (id: string) => void;
  onEdit: (note: SmartNote) => void;
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  return (
    <button 
      onClick={handleCopy} 
      className="text-textMuted hover:text-white transition-colors p-1"
      title="复制到剪贴板"
    >
      {copied ? <Icons.Check className="w-3.5 h-3.5 text-white" /> : <Icons.Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const FieldRow: React.FC<{ field: NoteField }> = ({ field }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm group/field hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
    <span className="text-textMuted font-medium text-xs">{field.label}</span>
    <div className="flex items-center gap-2 max-w-[70%]">
      <span className={`truncate ${field.isCode ? 'font-mono text-xs text-white bg-surfaceHighlight px-1.5 py-0.5 rounded border border-border' : 'text-textMain'} ${field.isSecret ? 'blur-sm hover:blur-none transition-all cursor-pointer' : ''}`}>
        {field.value}
      </span>
      {(field.isCode || field.isSecret) && <CopyButton text={field.value} />}
    </div>
  </div>
);

export const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete, onEdit }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete(note.id);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div className="relative bg-surface border border-border hover:border-textMuted/50 rounded-lg p-5 flex flex-col h-full group transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:-translate-y-1 duration-300">
      
      {/* Delete Overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-surface/95 backdrop-blur-sm z-10 rounded-lg flex flex-col items-center justify-center text-center p-4 border border-border animate-fade-in">
          <Icons.Alert className="w-8 h-8 text-white mb-2" />
          <h4 className="text-white font-semibold mb-1">确认删除?</h4>
          <p className="text-xs text-textMuted mb-4">此操作无法撤销。</p>
          <div className="flex gap-2 w-full">
            <button 
              onClick={handleCancelDelete}
              className="flex-1 px-3 py-1.5 text-xs text-white border border-border rounded hover:bg-surfaceHighlight transition-colors"
            >
              取消
            </button>
            <button 
              onClick={handleConfirmDelete}
              className="flex-1 px-3 py-1.5 text-xs bg-white text-black font-semibold rounded hover:bg-gray-200 transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-border bg-surfaceHighlight text-textMuted mb-2">
            {note.category}
          </div>
          <h3 className="text-lg font-bold text-white leading-tight tracking-tight">{note.title}</h3>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button 
            onClick={() => onEdit(note)}
            className="text-textMuted hover:text-white p-1"
            title="编辑笔记"
          >
            <Icons.Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={handleDeleteClick}
            className="text-textMuted hover:text-red-400 p-1"
            title="删除笔记"
          >
            <Icons.Trash className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-sm text-textMuted mb-5 leading-relaxed">{note.summary}</p>

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
          <pre className="bg-black border border-border rounded p-3 text-xs font-mono text-textMain overflow-x-auto whitespace-pre-wrap break-all scrollbar-hide shadow-inner">
            {code}
          </pre>
          <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-surface border border-border rounded p-0.5">
            <CopyButton text={code} />
          </div>
        </div>
      ))}

      {/* Tags & Footer */}
      <div className="mt-auto pt-4 flex flex-wrap gap-2 items-center">
        {note.tags.map(tag => (
          <span key={tag} className="text-[10px] text-textMuted bg-surfaceHighlight px-2 py-0.5 rounded-sm border border-border hover:border-textMuted transition-colors cursor-default">
            #{tag}
          </span>
        ))}
        <div className="w-full text-[10px] text-textMuted/50 text-right mt-2 font-mono">
          {new Date(note.createdAt).toLocaleDateString('zh-CN')}
        </div>
      </div>
    </div>
  );
};