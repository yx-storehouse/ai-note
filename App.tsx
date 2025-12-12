import React, { useState, useEffect, useCallback } from 'react';
import { analyzeText } from './services/geminiService';
import { getGist, createGist, updateGist } from './services/giteeService';
import { SmartNote, NoteCategoryEnum, AnalysisResponse, GiteeConfig } from './types';
import { Icons } from './components/Icon';
import { NoteCard } from './components/NoteCard';

const STORAGE_KEY = 'smart-notes-data';
const GITEE_CONFIG_KEY = 'smart-notes-gitee-config';

export default function App() {
  const [inputMode, setInputMode] = useState<boolean>(false);
  const [settingsMode, setSettingsMode] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<SmartNote | null>(null);

  const [inputText, setInputText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  const [notes, setNotes] = useState<SmartNote[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const [giteeConfig, setGiteeConfig] = useState<GiteeConfig>({ access_token: '', gist_id: '' });

  // Load data
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved notes");
      }
    }
    const savedConfig = localStorage.getItem(GITEE_CONFIG_KEY);
    if (savedConfig) {
      try {
        setGiteeConfig(JSON.parse(savedConfig));
      } catch (e) {}
    }
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(GITEE_CONFIG_KEY, JSON.stringify(giteeConfig));
  }, [giteeConfig]);

  // AI Processing
  const handleProcess = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const response: AnalysisResponse = await analyzeText(inputText);
      
      const newNotes: SmartNote[] = response.notes.map(n => ({
        id: crypto.randomUUID(),
        title: n.title,
        category: n.category,
        originalText: inputText,
        summary: n.summary,
        tags: n.tags,
        fields: n.fields,
        codeBlocks: n.codeBlocks,
        createdAt: Date.now()
      }));

      setNotes(prev => [...newNotes, ...prev]);
      setInputText('');
      setInputMode(false);
    } catch (err: any) {
      setErrorMsg(err.message || "分析失败，请检查 API Key 或重试。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleEdit = (note: SmartNote) => {
    setEditingNote({ ...note });
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    if (editingNote) {
      setNotes(prev => prev.map(n => n.id === editingNote.id ? editingNote : n));
      setEditMode(false);
      setEditingNote(null);
    }
  };

  // Gitee Sync
  const handleGiteeSync = async (direction: 'upload' | 'download') => {
    if (!giteeConfig.access_token) {
      setSyncMsg("错误：请先设置 Gitee Access Token");
      return;
    }
    setIsSyncing(true);
    setSyncMsg(null);

    try {
      if (direction === 'upload') {
        if (!giteeConfig.gist_id) {
          const newGistId = await createGist(notes, giteeConfig.access_token);
          setGiteeConfig(prev => ({ ...prev, gist_id: newGistId }));
          setSyncMsg("创建 Gist 并上传成功！");
        } else {
          await updateGist(giteeConfig.gist_id, notes, giteeConfig.access_token);
          setSyncMsg("同步到云端成功！");
        }
      } else {
        if (!giteeConfig.gist_id) {
           setSyncMsg("错误：没有设置 Gist ID，无法下载");
        } else {
          const cloudNotes = await getGist(giteeConfig.gist_id, giteeConfig.access_token);
          setNotes(cloudNotes);
          setSyncMsg("从云端恢复成功！");
        }
      }
    } catch (err: any) {
      setSyncMsg(`同步失败: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Local Import/Export
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "smart_notes_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          if (Array.isArray(imported)) {
            setNotes(imported);
            setSettingsMode(false);
          } else {
            alert("文件格式不正确");
          }
        } catch (e) {
          alert("无法解析 JSON 文件");
        }
      };
      reader.readAsText(file);
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
      note.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.fields.some(f => f.value.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === '全部' || note.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Dynamic Categories
  const existingCategories = Array.from(new Set(notes.map(n => n.category)));
  const defaultCategories = Object.values(NoteCategoryEnum) as string[];
  const categories = ['全部', ...Array.from(new Set([...defaultCategories, ...existingCategories]))];

  return (
    <div className="flex h-screen overflow-hidden bg-dot-pattern text-textMain relative">
      <div className="absolute inset-0 pointer-events-none vignette z-0"></div>
      
      {/* Sidebar / Navigation */}
      <aside className="w-64 bg-surface/50 border-r border-border backdrop-blur-sm flex flex-col shrink-0 hidden md:flex z-10">
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center">
                 <Icons.Sparkles className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold text-white tracking-wide">AI NOTES</h1>
            </div>
            <button onClick={() => setSettingsMode(true)} className="text-textMuted hover:text-white transition-colors">
              <Icons.Settings className="w-5 h-5" />
            </button>
          </div>
          
          <button 
            onClick={() => setInputMode(true)}
            className="w-full bg-white text-black hover:bg-gray-200 py-2.5 px-4 rounded font-semibold transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 group"
          >
            <span className="group-hover:scale-110 transition-transform duration-200">+</span>
            <span>新建笔记</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <h3 className="text-[10px] font-bold text-textMuted uppercase tracking-widest mb-4 px-2">FILTER BY</h3>
          <nav className="space-y-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-all border border-transparent ${
                  selectedCategory === cat 
                    ? 'bg-surfaceHighlight text-white border-border shadow-sm' 
                    : 'text-textMuted hover:text-white hover:bg-white/5'
                }`}
              >
                {cat}
                {cat !== '全部' && (
                  <span className={`float-right text-xs ${selectedCategory === cat ? 'text-white' : 'text-textMuted/50'}`}>
                    {notes.filter(n => n.category === cat).length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="p-4 text-[10px] text-textMuted/30 text-center border-t border-border">
          SMART NOTE AI v1.1
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden z-10">
        
        {/* Mobile Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur sticky top-0 z-20">
          <div className="md:hidden flex items-center gap-2 text-white">
             <div className="w-6 h-6 bg-white text-black rounded flex items-center justify-center">
                <Icons.Sparkles className="w-4 h-4" />
             </div>
             <span className="font-bold tracking-wide">AI NOTES</span>
          </div>

          <div className="flex-1 max-w-xl mx-auto relative hidden md:block group">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted group-focus-within:text-white transition-colors" />
            <input 
              type="text" 
              placeholder="搜索关键词、标签或命令..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-border rounded-full py-2.5 pl-10 pr-4 text-sm text-textMain focus:outline-none focus:border-white/50 focus:bg-surfaceHighlight transition-all placeholder:text-textMuted/50"
            />
          </div>

          <div className="flex items-center gap-2 md:hidden">
             <button onClick={() => setSettingsMode(true)} className="text-white p-2">
                <Icons.Settings className="w-5 h-5" />
             </button>
             <button onClick={() => setInputMode(true)} className="text-white border border-border px-3 py-1 rounded bg-surface">
                +
             </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* Notes Grid */}
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6 md:hidden">
                 <input 
                  type="text" 
                  placeholder="搜索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg py-2 px-4 text-sm text-white"
                />
            </div>

            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 opacity-60">
                <div className="w-20 h-20 border border-border rounded-2xl flex items-center justify-center mb-6 bg-surfaceHighlight/50">
                   <Icons.Sparkles className="w-8 h-8 text-textMuted" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">暂无笔记</h3>
                <p className="text-textMuted mt-2 max-w-sm text-center">系统待机中。输入您的原始数据片段，AI 将进行结构化处理。</p>
                <button onClick={() => setInputMode(true)} className="mt-8 border-b border-white pb-0.5 hover:opacity-70 transition-opacity">
                  初始化第一条笔记
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {filteredNotes.map(note => (
                  <NoteCard key={note.id} note={note} onDelete={handleDelete} onEdit={handleEdit} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Settings Modal */}
        {settingsMode && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
             <div className="bg-background border border-border rounded-xl w-full max-w-lg shadow-2xl flex flex-col">
                <div className="p-5 border-b border-border flex justify-between items-center bg-surface/50">
                   <h2 className="font-bold text-white text-lg">设置 & 同步</h2>
                   <button onClick={() => setSettingsMode(false)} className="text-textMuted hover:text-white">
                      <Icons.X className="w-5 h-5" />
                   </button>
                </div>
                <div className="p-6 space-y-6">
                   {/* Gitee Section */}
                   <div>
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                         <Icons.Cloud className="w-4 h-4" /> Gitee 云同步
                      </h3>
                      <div className="space-y-3">
                         <input 
                            type="text" 
                            placeholder="Gitee Access Token" 
                            value={giteeConfig.access_token}
                            onChange={(e) => setGiteeConfig(prev => ({...prev, access_token: e.target.value}))}
                            className="w-full bg-surface border border-border rounded p-2 text-sm text-white focus:outline-none focus:border-white/50"
                         />
                         <input 
                            type="text" 
                            placeholder="Gist ID (留空则自动创建)" 
                            value={giteeConfig.gist_id}
                            onChange={(e) => setGiteeConfig(prev => ({...prev, gist_id: e.target.value}))}
                            className="w-full bg-surface border border-border rounded p-2 text-sm text-white focus:outline-none focus:border-white/50"
                         />
                         <div className="flex gap-2 pt-2">
                            <button 
                               onClick={() => handleGiteeSync('upload')}
                               disabled={isSyncing}
                               className="flex-1 bg-surfaceHighlight hover:bg-white/10 border border-border text-white py-2 rounded text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                               {isSyncing ? '...' : <><Icons.Upload className="w-3 h-3" /> 保存到云端</>}
                            </button>
                            <button 
                               onClick={() => handleGiteeSync('download')}
                               disabled={isSyncing}
                               className="flex-1 bg-surfaceHighlight hover:bg-white/10 border border-border text-white py-2 rounded text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                               {isSyncing ? '...' : <><Icons.Download className="w-3 h-3" /> 从云端恢复</>}
                            </button>
                         </div>
                         {syncMsg && <p className="text-xs text-textMuted text-center">{syncMsg}</p>}
                         <p className="text-[10px] text-textMuted text-center">注意：云端恢复将覆盖本地所有数据</p>
                      </div>
                   </div>

                   <hr className="border-border" />

                   {/* Local Section */}
                   <div>
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                         <Icons.FileCode className="w-4 h-4" /> 本地备份
                      </h3>
                      <div className="flex gap-2">
                         <button onClick={handleExportJSON} className="flex-1 bg-surface hover:bg-surfaceHighlight border border-border text-textMuted hover:text-white py-2 rounded text-sm">
                            导出 JSON
                         </button>
                         <label className="flex-1 bg-surface hover:bg-surfaceHighlight border border-border text-textMuted hover:text-white py-2 rounded text-sm text-center cursor-pointer">
                            导入 JSON
                            <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
                         </label>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Edit Note Modal */}
        {editMode && editingNote && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-background border border-border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
               <div className="p-5 border-b border-border flex justify-between items-center bg-surface/50">
                   <h2 className="font-bold text-white text-lg">编辑笔记</h2>
                   <button onClick={() => setEditMode(false)} className="text-textMuted hover:text-white">
                      <Icons.X className="w-5 h-5" />
                   </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4">
                   <div>
                      <label className="text-xs text-textMuted block mb-1">标题</label>
                      <input 
                         type="text" 
                         value={editingNote.title}
                         onChange={e => setEditingNote({...editingNote, title: e.target.value})}
                         className="w-full bg-surface border border-border rounded p-2 text-white text-sm focus:outline-none focus:border-white/50"
                      />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-textMuted block mb-1">分类</label>
                        <input 
                           type="text" 
                           list="category-suggestions"
                           value={editingNote.category}
                           onChange={e => setEditingNote({...editingNote, category: e.target.value})}
                           className="w-full bg-surface border border-border rounded p-2 text-white text-sm focus:outline-none focus:border-white/50"
                        />
                        <datalist id="category-suggestions">
                           {categories.filter(c => c !== '全部').map(c => <option key={c} value={c} />)}
                        </datalist>
                      </div>
                      <div>
                        <label className="text-xs text-textMuted block mb-1">标签 (逗号分隔)</label>
                        <input 
                           type="text" 
                           value={editingNote.tags.join(', ')}
                           onChange={e => setEditingNote({...editingNote, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                           className="w-full bg-surface border border-border rounded p-2 text-white text-sm focus:outline-none focus:border-white/50"
                        />
                      </div>
                   </div>

                   <div>
                      <label className="text-xs text-textMuted block mb-1">摘要</label>
                      <textarea 
                         value={editingNote.summary}
                         onChange={e => setEditingNote({...editingNote, summary: e.target.value})}
                         className="w-full bg-surface border border-border rounded p-2 text-white text-sm focus:outline-none focus:border-white/50 h-20 resize-none"
                      />
                   </div>

                   <div>
                      <label className="text-xs text-textMuted block mb-1">字段 (Fields)</label>
                      <div className="space-y-2">
                         {editingNote.fields.map((field, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                               <input 
                                  value={field.label}
                                  onChange={(e) => {
                                     const newFields = [...editingNote.fields];
                                     newFields[idx].label = e.target.value;
                                     setEditingNote({...editingNote, fields: newFields});
                                  }}
                                  className="w-1/3 bg-surface border border-border rounded p-1.5 text-xs text-textMuted focus:text-white focus:outline-none"
                               />
                               <input 
                                  value={field.value}
                                  onChange={(e) => {
                                     const newFields = [...editingNote.fields];
                                     newFields[idx].value = e.target.value;
                                     setEditingNote({...editingNote, fields: newFields});
                                  }}
                                  className="flex-1 bg-surface border border-border rounded p-1.5 text-xs text-white font-mono focus:outline-none"
                               />
                               <button 
                                  onClick={() => {
                                     const newFields = editingNote.fields.filter((_, i) => i !== idx);
                                     setEditingNote({...editingNote, fields: newFields});
                                  }}
                                  className="text-textMuted hover:text-red-400"
                               >
                                  <Icons.X className="w-4 h-4" />
                               </button>
                            </div>
                         ))}
                         <button 
                            onClick={() => setEditingNote({...editingNote, fields: [...editingNote.fields, {label: 'New', value: '', isCode: false}]})}
                            className="text-xs text-white/50 hover:text-white border border-dashed border-border w-full py-1.5 rounded"
                         >
                            + 添加字段
                         </button>
                      </div>
                   </div>
                </div>
                <div className="p-5 border-t border-border bg-surface/50 rounded-b-xl flex justify-end gap-3">
                   <button 
                      onClick={() => setEditMode(false)}
                      className="px-5 py-2 text-textMuted hover:text-white text-sm"
                   >
                      取消
                   </button>
                   <button 
                      onClick={handleSaveEdit}
                      className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded font-bold text-sm"
                   >
                      保存修改
                   </button>
                </div>
            </div>
          </div>
        )}

        {/* Floating Input Modal/Panel */}
        {inputMode && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-background border border-border rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-border flex justify-between items-center bg-surface/50">
                <div>
                   <h2 className="font-bold text-white text-lg">数据输入终端</h2>
                   <p className="text-xs text-textMuted mt-0.5">粘贴原始文本，AI 将自动识别并分类</p>
                </div>
                <button onClick={() => setInputMode(false)} className="text-textMuted hover:text-white transition-colors">
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-0 flex-1 relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="> 在此粘贴内容..."
                  className="w-full h-full min-h-[300px] md:min-h-[400px] bg-background p-6 text-textMain font-mono text-sm focus:outline-none resize-none placeholder:text-textMuted/30 leading-relaxed"
                ></textarea>
                
                {errorMsg && (
                  <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded backdrop-blur-sm">
                    ⚠️ {errorMsg}
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-border bg-surface/50 rounded-b-xl flex justify-end gap-3">
                <button 
                  onClick={() => setInputMode(false)}
                  className="px-5 py-2.5 text-textMuted hover:text-white text-sm transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleProcess}
                  disabled={isProcessing || !inputText.trim()}
                  className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded font-bold transition-all flex items-center gap-2 text-sm"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                      正在处理...
                    </>
                  ) : (
                    <>
                      <Icons.Sparkles className="w-4 h-4" />
                      开始分析
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}