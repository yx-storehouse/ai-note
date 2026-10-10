import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SmartNote } from '../shared/types';
import { api, errorMessage, isUnauthorized } from './api/client';
import { EditNoteModal } from './components/EditNoteModal';
import { FilterBar } from './components/FilterBar';
import { Header } from './components/Header';
import { InputModal } from './components/InputModal';
import { NoteGrid } from './components/NoteGrid';
import { Notification } from './components/Notification';
import { PasswordModal } from './components/PasswordModal';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { SyncIndicator } from './components/SyncIndicator';
import { useAuth } from './hooks/useAuth';
import { useColumns } from './hooks/useColumns';
import { useFilters } from './hooks/useFilters';
import { useSearchShortcut } from './hooks/useKeyboardShortcuts';
import { useNotesState } from './hooks/useNotes';
import { useNotifier } from './hooks/useNotifier';
import { useSync } from './hooks/useSync';
import { exportNotes, parseImport } from './lib/backup';
import { ALL_CATEGORIES, buildCategoryList, filterNotes, sortNotes, toSmartNotes } from './lib/notes';
import { isDirty } from './lib/syncDecision';
import { notesStore } from './state';

type ModalState = { type: 'input' } | { type: 'settings' } | { type: 'edit'; note: SmartNote } | null;

const CONNECTION_TEST_TEXT = '连接测试：服务器 127.0.0.1，SSH 端口 22';

export default function App() {
  const { notes, meta, corrupt } = useNotesState();
  const { notification, notify, dismiss } = useNotifier();
  const auth = useAuth(notify);
  const sync = useSync(auth, notify);
  const filters = useFilters();
  const columns = useColumns();

  const [modal, setModal] = useState<ModalState>(null);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  const closeModal = useCallback(() => setModal(null), []);
  const openInput = useCallback(() => setModal({ type: 'input' }), []);
  const openSettings = useCallback(() => setModal({ type: 'settings' }), []);

  useEffect(() => notesStore.onPersistError(() => notify('保存到本地失败：浏览器存储空间可能已满，请导出备份', 'warning')), [notify]);

  useEffect(() => {
    if (corrupt) notify('本地笔记数据已损坏，无法读取。新的修改会覆盖它，如需找回请先从云端恢复', 'warning');
  }, [corrupt, notify]);

  // 按 / 聚焦当前可见的搜索框
  useSearchShortcut(() => {
    const input = [desktopSearchRef.current, mobileSearchRef.current].find(el => el && el.offsetParent !== null);
    input?.focus();
  });

  // 新增 / 修改笔记后的提示里附带「立即同步」
  const syncAction = sync.enabled
    ? { actions: [{ label: '立即同步', onClick: () => sync.upload() }], duration: 6000 }
    : undefined;

  // ---- AI 分析 ----
  const handleAnalyze = useCallback(() => {
    const text = inputText.trim();
    if (!text || isProcessing) return;

    const run = async () => {
      if (!auth.getStatus()?.ai) {
        setErrorMsg('服务端未配置 MIMO_API_KEY，暂时无法使用 AI 分析');
        return;
      }
      setIsProcessing(true);
      setErrorMsg(null);
      try {
        const res = await api.analyze(text);
        const created = toSmartNotes(res.notes, text, Date.now());
        notesStore.addNotes(created);
        setInputText('');
        setModal(null);
        notify(`已添加 ${created.length} 条笔记`, 'success', syncAction);
      } catch (err) {
        if (isUnauthorized(err)) auth.handleUnauthorized(() => void run());
        else setErrorMsg(errorMessage(err));
      } finally {
        setIsProcessing(false);
      }
    };
    auth.requireAuth(() => void run());
  }, [inputText, isProcessing, auth, notify, syncAction]);

  const handleTestConnection = useCallback(() => {
    const run = async () => {
      setTesting(true);
      try {
        const res = await api.analyze(CONNECTION_TEST_TEXT);
        notify(`AI 连接正常（模型 ${res.model}）`, 'success');
      } catch (err) {
        if (isUnauthorized(err)) auth.handleUnauthorized(() => void run());
        else notify(`测试失败：${errorMessage(err)}`, 'warning');
      } finally {
        setTesting(false);
      }
    };
    auth.requireAuth(() => void run());
  }, [auth, notify]);

  // ---- 笔记操作 ----
  const handleDelete = useCallback(
    (id: string) => {
      const removed = notesStore.deleteNote(id);
      if (!removed) return;
      notify(`已删除「${removed.note.title}」`, 'info', {
        actions: [{ label: '撤销', onClick: () => notesStore.restoreNote(removed.note, removed.index) }],
        duration: 6000,
      });
    },
    [notify],
  );

  const handleEdit = useCallback((note: SmartNote) => setModal({ type: 'edit', note }), []);

  const handleSaveEdit = useCallback(
    (note: SmartNote) => {
      notesStore.updateNote(note);
      setModal(null);
      notify('笔记已修改', 'success', syncAction);
    },
    [notify, syncAction],
  );

  const handleTogglePin = useCallback((id: string) => notesStore.togglePin(id), []);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const imported = parseImport(await file.text());
        const previous = notesStore.replaceAll(imported);
        setModal(null);
        notify(`已导入 ${imported.length} 条笔记`, 'success', {
          actions: [{ label: '撤销', onClick: () => notesStore.replaceAll(previous) }],
          duration: 8000,
        });
      } catch (err) {
        notify(`导入失败：${errorMessage(err)}`, 'warning');
      }
    },
    [notify],
  );

  // ---- 派生数据 ----
  const categories = useMemo(() => buildCategoryList(notes), [notes]);
  const visibleNotes = useMemo(
    () => sortNotes(filterNotes(notes, { search: filters.search, category: filters.category, tag: filters.tag }), filters.sortBy),
    [notes, filters.search, filters.category, filters.tag, filters.sortBy],
  );
  const dirty = isDirty(notes, meta);

  const syncIndicatorProps = {
    phase: auth.phase,
    syncEnabled: sync.enabled,
    syncing: sync.syncing,
    dirty,
    lastSyncedAt: meta.lastSyncedAt,
    onUpload: () => sync.upload(),
    onUnlock: auth.openPrompt,
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-dot-pattern text-textMain relative">
      <div className="absolute inset-0 pointer-events-none vignette z-0"></div>

      {notification && <Notification key={notification.id} notification={notification} onClose={dismiss} />}

      <Sidebar
        categories={categories}
        selectedCategory={filters.category}
        onSelectCategory={filters.setCategory}
        onNewNote={openInput}
        onOpenSettings={openSettings}
        syncIndicator={<SyncIndicator {...syncIndicatorProps} />}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden z-10">
        <Header
          ref={desktopSearchRef}
          search={filters.search}
          onSearchChange={filters.setSearch}
          onNewNote={openInput}
          onOpenSettings={openSettings}
          syncIndicator={<SyncIndicator {...syncIndicatorProps} compact />}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <FilterBar
              ref={mobileSearchRef}
              search={filters.search}
              onSearchChange={filters.setSearch}
              categories={categories}
              category={filters.category}
              onCategoryChange={filters.setCategory}
              tag={filters.tag}
              onClearTag={() => filters.setTag(null)}
              sortBy={filters.sortBy}
              onSortChange={filters.setSortBy}
              resultCount={visibleNotes.length}
              totalCount={notes.length}
              filtersActive={filters.active}
              onClearFilters={filters.clear}
            />

            <NoteGrid
              notes={visibleNotes}
              totalCount={notes.length}
              columns={columns}
              sortBy={filters.sortBy}
              activeTag={filters.tag}
              onNewNote={openInput}
              onClearFilters={filters.clear}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onTogglePin={handleTogglePin}
              onTagClick={filters.toggleTag}
            />
          </div>
        </div>

        {modal?.type === 'settings' && (
          <SettingsModal
            phase={auth.phase}
            status={auth.status}
            onUnlock={auth.unlock}
            onLock={auth.lock}
            testing={testing}
            onTestConnection={handleTestConnection}
            syncing={sync.syncing}
            dirty={dirty}
            lastSyncedAt={meta.lastSyncedAt}
            onUpload={() => sync.upload()}
            onDownload={sync.download}
            onExport={() => exportNotes(notesStore.getState().notes)}
            onImport={file => void handleImport(file)}
            onClose={closeModal}
          />
        )}

        {modal?.type === 'edit' && (
          <EditNoteModal
            key={modal.note.id}
            note={modal.note}
            categories={categories.map(c => c.name).filter(c => c !== ALL_CATEGORIES)}
            onSave={handleSaveEdit}
            onClose={closeModal}
          />
        )}

        {modal?.type === 'input' && (
          <InputModal
            text={inputText}
            onTextChange={text => {
              setInputText(text);
              if (errorMsg) setErrorMsg(null);
            }}
            isProcessing={isProcessing}
            errorMsg={errorMsg}
            onAnalyze={handleAnalyze}
            onClose={closeModal}
          />
        )}

        {auth.promptOpen && <PasswordModal onUnlock={auth.unlock} onClose={auth.cancelPrompt} />}
      </main>
    </div>
  );
}
