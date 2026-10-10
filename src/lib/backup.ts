import { isDict, normalizeNotes } from '../../shared/normalize';
import type { SmartNote } from '../../shared/types';
import { newId } from './notes';

const pad = (n: number) => String(n).padStart(2, '0');

export const exportNotes = (notes: SmartNote[]): void => {
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const a = document.createElement('a');
  a.href = url;
  a.download = `smart_notes_backup_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

// 兼容导出的数组格式和 Gist 中的 {version: 2, notes} 格式
export const parseImport = (text: string): SmartNote[] => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('无法解析 JSON 文件');
  }
  const list = Array.isArray(data) ? data : isDict(data) && Array.isArray(data.notes) ? data.notes : null;
  if (!list) throw new Error('文件格式不正确：需要笔记数组');
  return normalizeNotes(list, newId);
};
