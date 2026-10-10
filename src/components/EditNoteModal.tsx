import { useState } from 'react';
import type { NoteField, SmartNote } from '../../shared/types';
import { parseTags } from '../lib/notes';
import { CopyButton } from './CopyButton';
import { Icons } from './Icon';
import { Kbd, Modal, MOD_KEY } from './Modal';

interface EditNoteModalProps {
  note: SmartNote;
  categories: string[];
  onSave: (note: SmartNote) => void;
  onClose: () => void;
}

const inputClass = 'w-full bg-surface border border-border rounded p-2 text-white text-sm focus:outline-hidden focus:border-white/50';

const ToggleButton: React.FC<{ active: boolean; onClick: () => void; title: string; children: React.ReactNode }> = ({
  active,
  onClick,
  title,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className={`p-1.5 rounded border transition-colors shrink-0 ${
      active ? 'bg-white text-black border-white' : 'text-textMuted border-border hover:text-white'
    }`}
  >
    {children}
  </button>
);

const codeRows = (code: string) => Math.min(12, Math.max(3, code.split('\n').length));

export const EditNoteModal: React.FC<EditNoteModalProps> = ({ note, categories, onSave, onClose }) => {
  // 编辑的是一份深拷贝，取消时原笔记不受影响
  const [draft, setDraft] = useState<SmartNote>(() => structuredClone(note));
  // 标签以原始字符串编辑，保存时再解析，输入逗号不会被吞掉
  const [tagsInput, setTagsInput] = useState(() => note.tags.join(', '));
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (changes: Partial<SmartNote>) => setDraft(d => ({ ...d, ...changes }));

  const patchField = (idx: number, changes: Partial<NoteField>) =>
    setDraft(d => ({ ...d, fields: d.fields.map((f, i) => (i === idx ? { ...f, ...changes } : f)) }));

  const patchCode = (idx: number, code: string) =>
    setDraft(d => ({ ...d, codeBlocks: d.codeBlocks.map((c, i) => (i === idx ? code : c)) }));

  const save = () => {
    const title = draft.title.trim();
    if (!title) {
      setError('标题不能为空');
      return;
    }
    onSave({
      ...draft,
      title,
      category: draft.category.trim() || '其他',
      tags: parseTags(tagsInput),
      fields: draft.fields.filter(f => f.label.trim() || f.value.trim()),
      codeBlocks: draft.codeBlocks.map(c => c.replace(/\s+$/, '')).filter(Boolean),
    });
  };

  return (
    <Modal
      title="编辑笔记"
      onClose={onClose}
      onSubmit={save}
      widthClass="max-w-2xl"
      bodyClass="p-6 overflow-y-auto space-y-4"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <span className="text-[10px] text-textMuted/60 hidden sm:inline">
            <Kbd>{MOD_KEY}</Kbd> + <Kbd>Enter</Kbd> 保存
          </span>
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-5 py-2 text-textMuted hover:text-white text-sm">
              取消
            </button>
            <button onClick={save} className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded font-bold text-sm">
              保存修改
            </button>
          </div>
        </div>
      }
    >
      <div>
        <label className="text-xs text-textMuted block mb-1" htmlFor="edit-title">
          标题
        </label>
        <input
          id="edit-title"
          type="text"
          value={draft.title}
          onChange={e => {
            patch({ title: e.target.value });
            setError(null);
          }}
          className={inputClass}
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-textMuted block mb-1" htmlFor="edit-category">
            分类 (支持自定义)
          </label>
          <input
            id="edit-category"
            type="text"
            list="category-suggestions"
            value={draft.category}
            onChange={e => patch({ category: e.target.value })}
            className={inputClass}
          />
          <datalist id="category-suggestions">
            {categories.map(c => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-xs text-textMuted block mb-1" htmlFor="edit-tags">
            标签 (逗号分隔)
          </label>
          <input id="edit-tags" type="text" value={tagsInput} onChange={e => setTagsInput(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="text-xs text-textMuted block mb-1" htmlFor="edit-summary">
          摘要
        </label>
        <textarea
          id="edit-summary"
          value={draft.summary}
          onChange={e => patch({ summary: e.target.value })}
          className={`${inputClass} h-20 resize-none`}
        />
      </div>

      <div>
        <label className="text-xs text-textMuted block mb-1">字段 (Fields)</label>
        <div className="space-y-2">
          {draft.fields.map((field, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                value={field.label}
                onChange={e => patchField(idx, { label: e.target.value })}
                aria-label="字段名"
                className="w-1/4 sm:w-1/3 min-w-0 bg-surface border border-border rounded p-1.5 text-xs text-textMuted focus:text-white focus:outline-hidden"
              />
              <input
                value={field.value}
                onChange={e => patchField(idx, { value: e.target.value })}
                aria-label="字段值"
                className="flex-1 min-w-0 bg-surface border border-border rounded p-1.5 text-xs text-white font-mono focus:outline-hidden"
              />
              <ToggleButton active={Boolean(field.isCode)} onClick={() => patchField(idx, { isCode: !field.isCode })} title="代码样式">
                <Icons.FileCode className="w-3.5 h-3.5" />
              </ToggleButton>
              <ToggleButton
                active={Boolean(field.isSecret)}
                onClick={() => patchField(idx, { isSecret: !field.isSecret })}
                title="敏感信息（默认模糊显示）"
              >
                <Icons.Lock className="w-3.5 h-3.5" />
              </ToggleButton>
              <button
                type="button"
                onClick={() => patch({ fields: draft.fields.filter((_, i) => i !== idx) })}
                className="text-textMuted hover:text-red-400 shrink-0"
                aria-label="删除字段"
                title="删除字段"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patch({ fields: [...draft.fields, { label: '', value: '', isCode: false, isSecret: false }] })}
            className="text-xs text-white/50 hover:text-white border border-dashed border-border w-full py-1.5 rounded"
          >
            + 添加字段
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs text-textMuted block mb-1">代码块</label>
        <div className="space-y-2">
          {draft.codeBlocks.map((code, idx) => (
            <div key={idx} className="relative">
              <textarea
                value={code}
                onChange={e => patchCode(idx, e.target.value)}
                rows={codeRows(code)}
                spellCheck={false}
                aria-label={`代码块 ${idx + 1}`}
                className="w-full bg-black border border-border rounded p-3 pr-9 text-xs font-mono text-textMain focus:outline-hidden focus:border-white/50 resize-y"
              />
              <button
                type="button"
                onClick={() => patch({ codeBlocks: draft.codeBlocks.filter((_, i) => i !== idx) })}
                className="absolute top-2 right-2 text-textMuted hover:text-red-400"
                aria-label="删除代码块"
                title="删除代码块"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patch({ codeBlocks: [...draft.codeBlocks, ''] })}
            className="text-xs text-white/50 hover:text-white border border-dashed border-border w-full py-1.5 rounded"
          >
            + 添加代码块
          </button>
        </div>
      </div>

      {note.originalText && (
        <div className="border border-border rounded">
          <button
            type="button"
            onClick={() => setShowOriginal(v => !v)}
            aria-expanded={showOriginal}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-textMuted hover:text-white"
          >
            <span>原始文本</span>
            <Icons.ChevronDown className={`w-4 h-4 transition-transform ${showOriginal ? 'rotate-180' : ''}`} />
          </button>
          {showOriginal && (
            <div className="relative border-t border-border">
              <pre className="p-3 pr-9 text-xs font-mono text-textMuted whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                {note.originalText}
              </pre>
              <div className="absolute top-2 right-2 bg-surface border border-border rounded p-0.5">
                <CopyButton text={note.originalText} />
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
