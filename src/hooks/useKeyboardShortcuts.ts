import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

// 中文输入法组字时按下的回车 / Esc 不应触发快捷键
export const isComposing = (e: KeyboardEvent | ReactKeyboardEvent): boolean => {
  const native = 'nativeEvent' in e ? e.nativeEvent : e;
  return native.isComposing || native.keyCode === 229;
};

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

interface ModalHandlers {
  onClose: () => void;
  onSubmit?: () => void;
}

// 打开的弹窗按顺序入栈，Esc / Ctrl+Enter 只作用于最上层的弹窗
const modalStack: Array<{ current: ModalHandlers }> = [];

const handleModalKeys = (e: KeyboardEvent) => {
  if (isComposing(e)) return;
  const top = modalStack[modalStack.length - 1]?.current;
  if (!top) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    top.onClose();
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && top.onSubmit) {
    e.preventDefault();
    top.onSubmit();
  }
};

export const isModalOpen = (): boolean => modalStack.length > 0;

export const useModalShortcuts = (handlers: ModalHandlers): void => {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (modalStack.length === 0) window.addEventListener('keydown', handleModalKeys);
    modalStack.push(ref);
    return () => {
      const index = modalStack.lastIndexOf(ref);
      if (index !== -1) modalStack.splice(index, 1);
      if (modalStack.length === 0) window.removeEventListener('keydown', handleModalKeys);
    };
  }, []);
};

// 没有弹窗、也没在输入时，按 / 聚焦搜索框
export const useSearchShortcut = (focusSearch: () => void): void => {
  const ref = useRef(focusSearch);
  ref.current = focusSearch;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isComposing(e)) return;
      if (isModalOpen() || isTypingTarget(e.target)) return;
      e.preventDefault();
      ref.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
};
