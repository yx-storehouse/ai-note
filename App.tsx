import React, { useState, useEffect, useCallback, useRef } from 'react';
import { analyzeText } from './services/mimoService';
import { getGist, createGist, updateGist } from './services/giteeService';
import { SmartNote, NoteCategoryEnum, AnalysisResponse, GiteeConfig, ApiConfig, NotificationState } from './types';
import { Icons } from './components/Icon';
import { NoteCard } from './components/NoteCard';
import { Notification } from './components/Notification';

const STORAGE_KEY = 'smart-notes-data';
const GITEE_CONFIG_KEY = 'smart-notes-gitee-config';
const API_CONFIG_KEY = 'smart-notes-api-config';

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
  
  const [giteeConfig, setGiteeConfig] = useState<GiteeConfig>({ access_token: '', gist_id: '' });
  const [apiConfig, setApiConfig] = useState<ApiConfig>({ apiKey: '', apiEndpoint: '', modelName: '' });
  
  // Notification State
  const [notification, setNotification] = useState<NotificationState | null>(null);

  // Masonry Layout State
  const [numColumns, setNumColumns] = useState<number>(3);
  
  // 标记是否已完成初始化，防止初始化时覆盖 localStorage
  const isInitialized = useRef(false);

  // Helper to trigger notification
  const showNotification = (
    message: string, 
    type: 'info' | 'success' | 'warning', 
    actionLabel?: string, 
    onAction?: () => void
  ) => {
    setNotification({ show: true, message, type, actionLabel, onAction, onClose: () => setNotification(null) });
  };

  // Helper: Get latest timestamp from notes
  const getLatestTimestamp = (notesArr: SmartNote[]) => {
    if (!notesArr || notesArr.length === 0) return 0;
    return Math.max(...notesArr.map(n => n.updatedAt || n.createdAt));
  };

  // Handle Resize for Masonry Layout
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setNumColumns(3);
      } else if (window.innerWidth >= 768) {
        setNumColumns(2);
      } else {
        setNumColumns(1);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initial Load
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedGiteeConfig = localStorage.getItem(GITEE_CONFIG_KEY);
    const savedApiConfig = localStorage.getItem(API_CONFIG_KEY);
    
    let localNotes: SmartNote[] = [];
    if (saved) {
      try {
        localNotes = JSON.parse(saved);
        setNotes(localNotes);
      } catch (e) {
        console.error("Failed to parse saved notes");
      }
    }

    if (savedGiteeConfig) {
      try {
        const config = JSON.parse(savedGiteeConfig);
        // 只有当配置中有实际值时才设置，避免用空值覆盖
        if (config && (config.access_token || config.gist_id)) {
          setGiteeConfig(config);
          
          // Startup Check: Compare Local vs Cloud if config exists
          if (config.access_token && config.gist_id) {
            checkCloudUpdates(config, localNotes);
          }
        }
      } catch (e) {
        console.error("Failed to parse saved Gitee config", e);
      }
    }

    if (savedApiConfig) {
      try {
        const config = JSON.parse(savedApiConfig);
        // 只有当配置中有实际值时才设置，避免用空值覆盖
        if (config && config.apiKey) {
          setApiConfig(config);
        }
      } catch (e) {
        console.error("Failed to parse saved API config", e);
      }
    }
    
    // 标记初始化完成，之后的状态变化才会保存到 localStorage
    isInitialized.current = true;
  }, []);

  // Save to local storage
  // 使用 ref 标记是否已初始化，避免初始化时覆盖已有数据
  useEffect(() => {
    // 只在初始化完成后才保存
    if (isInitialized.current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes]);

  useEffect(() => {
    if (isInitialized.current) {
      // 只有当配置中有实际值时才保存，避免保存空值覆盖已有数据
      if (giteeConfig.access_token || giteeConfig.gist_id) {
        localStorage.setItem(GITEE_CONFIG_KEY, JSON.stringify(giteeConfig));
      }
    }
  }, [giteeConfig]);

  useEffect(() => {
    if (isInitialized.current) {
      // 只有当配置中有实际值时才保存，避免保存空值覆盖已有数据
      if (apiConfig.apiKey) {
        localStorage.setItem(API_CONFIG_KEY, JSON.stringify(apiConfig));
      }
    }
  }, [apiConfig]);

  // Check Cloud Updates Logic
  const checkCloudUpdates = async (config: GiteeConfig, currentLocalNotes: SmartNote[]) => {
    try {
      const cloudNotes = await getGist(config.gist_id, config.access_token);
      
      const localTs = getLatestTimestamp(currentLocalNotes);
      const cloudTs = getLatestTimestamp(cloudNotes);

      // Simple string comparison for content equality
      const isContentDifferent = JSON.stringify(currentLocalNotes) !== JSON.stringify(cloudNotes);

      if (isContentDifferent) {
        if (cloudTs > localTs) {
           showNotification("发现云端有更新的版本", "info", "从云端恢复", () => {
              setNotes(cloudNotes);
              showNotification("已同步为最新云端版本", "success");
           });
        } else if (localTs > cloudTs) {
           showNotification("本地数据较新，尚未同步", "info", "上传到云端", () => {
             handleGiteeSync('upload', currentLocalNotes);
           });
        } else {
           // Timestamps match (or 0) but content differs (rare case, maybe manual edit)
           // Default to asking user
           showNotification("本地与云端数据不一致", "warning", "从云端覆盖", () => {
             setNotes(cloudNotes);
             showNotification("已恢复", "success");
           });
        }
      }
    } catch (e) {
      console.warn("Startup sync check failed", e);
    }
  };

  // Modified Gitee Sync to accept notes argument
  const handleGiteeSync = async (direction: 'upload' | 'download', notesToUpload?: SmartNote[]) => {
    if (!giteeConfig.access_token) {
      showNotification("请先在设置中配置 Gitee Access Token", "warning", "去设置", () => setSettingsMode(true));
      return;
    }
    setIsSyncing(true);

    try {
      if (direction === 'upload') {
        const payload = notesToUpload || notes;
        if (!giteeConfig.gist_id) {
          const newGistId = await createGist(payload, giteeConfig.access_token);
          setGiteeConfig(prev => ({ ...prev, gist_id: newGistId }));
          showNotification("创建并上传成功！", "success");
        } else {
          await updateGist(giteeConfig.gist_id, payload, giteeConfig.access_token);
          showNotification("同步到云端成功！", "success");
        }
      } else {
        if (!giteeConfig.gist_id) {
           showNotification("未设置 Gist ID，无法下载", "warning");
        } else {
          const cloudNotes = await getGist(giteeConfig.gist_id, giteeConfig.access_token);
          setNotes(cloudNotes);
          showNotification("从云端恢复成功！", "success");
        }
      }
    } catch (err: any) {
      showNotification(`同步失败: ${err.message}`, "warning");
    } finally {
      setIsSyncing(false);
    }
  };

  // AI Processing
  const handleProcess = async () => {
    if (!inputText.trim()) return;
    
    // 开发环境需要 API Key，生产环境由 Worker 处理
    const isDev = import.meta.env.DEV;
    if (isDev && !apiConfig.apiKey) {
      setErrorMsg("开发环境需要配置 MIMO API Key，请在设置中输入");
      setInputMode(false);
      setSettingsMode(true);
      return;
    }
    
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // 生产环境传 null，API Key 在 Worker 中
      const apiKeyForRequest = isDev ? apiConfig.apiKey : null;
      const response: AnalysisResponse = await analyzeText(inputText, apiKeyForRequest, apiConfig.apiEndpoint, apiConfig.modelName);
      const timestamp = Date.now();

      const newNotes: SmartNote[] = response.notes.map(n => ({
        id: crypto.randomUUID(),
        title: n.title,
        category: n.category,
        originalText: inputText,
        summary: n.summary,
        tags: n.tags,
        fields: n.fields,
        codeBlocks: n.codeBlocks,
        createdAt: timestamp,
        updatedAt: timestamp
      }));

      const updatedAllNotes = [...newNotes, ...notes];
      setNotes(updatedAllNotes);
      setInputText('');
      setInputMode(false);

      // Prompt for sync after adding
      if (giteeConfig.access_token) {
        showNotification("笔记已添加，是否同步？", "info", "立即同步", () => handleGiteeSync('upload', updatedAllNotes));
      }

    } catch (err: any) {
      console.error("处理失败:", err);
      const errorMessage = err.message || "分析失败，请检查 API Key 或重试。";
      setErrorMsg(errorMessage);
      // 如果错误信息很长，也显示通知
      if (errorMessage.length > 50) {
        showNotification(errorMessage.substring(0, 100) + "...", "warning");
      } else {
        showNotification(errorMessage, "warning");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = useCallback((id: string) => {
    setNotes(prev => {
       const updated = prev.filter(n => n.id !== id);
       if (giteeConfig.access_token) {
         // Use setTimeout to avoid state update conflict during render cycle
         setTimeout(() => showNotification("笔记已删除，是否同步？", "info", "立即同步", () => handleGiteeSync('upload', updated)), 100);
       }
       return updated;
    });
  }, [giteeConfig.access_token]);

  const handleEdit = (note: SmartNote) => {
    setEditingNote({ ...note });
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    if (editingNote) {
      const timestamp = Date.now();
      const updatedNote = { ...editingNote, updatedAt: timestamp };
      
      const updatedNotes = notes.map(n => n.id === editingNote.id ? updatedNote : n);
      setNotes(updatedNotes);
      setEditMode(false);
      setEditingNote(null);

      // Prompt for sync after edit
      if (giteeConfig.access_token) {
        showNotification("笔记已修改，是否同步？", "info", "立即同步", () => handleGiteeSync('upload', updatedNotes));
      }
    }
  };

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
            showNotification("导入成功！", "success");
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

  // Organize notes into columns for Masonry layout
  const masonryColumns = Array.from({ length: numColumns }, () => [] as SmartNote[]);
  filteredNotes.forEach((note, index) => {
    masonryColumns[index % numColumns].push(note);
  });

  // Dynamic Categories: Get distinct categories, sort by count descending
  const getCategoryList = () => {
    const counts: Record<string, number> = {};
    notes.forEach(n => {
      counts[n.category] = (counts[n.category] || 0) + 1;
    });

    const distinctCats = Array.from(new Set([
      ...Object.values(NoteCategoryEnum), 
      ...Object.keys(counts)
    ]));

    return ['全部', ...distinctCats].sort((a, b) => {
       if (a === '全部') return -1;
       if (b === '全部') return 1;
       // Sort by count desc
       const countA = counts[a] || 0;
       const countB = counts[b] || 0;
       return countB - countA; 
    });
  };

  const categories = getCategoryList();

  return (
    <div className="flex h-screen overflow-hidden bg-dot-pattern text-textMain relative">
      <div className="absolute inset-0 pointer-events-none vignette z-0"></div>
      
      {/* Toast Notification */}
      {notification && notification.show && (
        <Notification 
          message={notification.message}
          type={notification.type}
          actionLabel={notification.actionLabel}
          onAction={notification.onAction}
          onClose={notification.onClose!}
        />
      )}

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
          <h3 className="text-[10px] font-bold text-textMuted uppercase tracking-widest mb-4 px-2 flex justify-between">
            <span>FILTER BY</span>
            <span className="text-[9px] opacity-50">SORTED BY COUNT</span>
          </h3>
          <nav className="space-y-1">
            {categories.map(cat => {
              const count = cat === '全部' ? notes.length : notes.filter(n => n.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-all border border-transparent group flex justify-between items-center ${
                    selectedCategory === cat 
                      ? 'bg-surfaceHighlight text-white border-border shadow-sm' 
                      : 'text-textMuted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{cat}</span>
                  <span className={`text-xs ${selectedCategory === cat ? 'text-white' : 'text-textMuted/50 group-hover:text-textMuted'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="p-4 text-[10px] text-textMuted/30 text-center border-t border-border">
          SMART NOTE AI v1.3
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
          
          {/* Notes Grid (Masonry Layout) */}
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
              // Masonry Container
              <div className="flex gap-6 pb-20 items-start w-full">
                 {masonryColumns.map((colNotes, colIndex) => (
                   <div key={colIndex} className="flex-1 flex flex-col gap-6 min-w-0">
                      {colNotes.map(note => (
                        <NoteCard key={note.id} note={note} onDelete={handleDelete} onEdit={handleEdit} />
                      ))}
                   </div>
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
                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                   {/* API Configuration Section */}
                   <div>
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                         <Icons.Sparkles className="w-4 h-4" /> MIMO AI 配置
                      </h3>
                      <div className="space-y-3">
                         {import.meta.env.DEV ? (
                            // 开发环境：需要用户输入 API Key
                            <div>
                               <label className="text-xs text-textMuted block mb-1">API Key * (仅开发环境)</label>
                               <input 
                                  type="password" 
                                  placeholder="请输入 MIMO API Key" 
                                  value={apiConfig.apiKey}
                                  onChange={(e) => setApiConfig(prev => ({...prev, apiKey: e.target.value}))}
                                  className="w-full bg-surface border border-border rounded p-2 text-sm text-white focus:outline-none focus:border-white/50 font-mono"
                               />
                               <p className="text-[10px] text-textMuted mt-1">开发环境需要配置 API Key</p>
                            </div>
                         ) : (
                            // 生产环境：API Key 在 Worker 中配置
                            <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded text-xs text-blue-400">
                               ✓ 生产环境：API Key 已配置在 Cloudflare Worker 中，无需在此输入
                            </div>
                         )}
                         <div>
                            <label className="text-xs text-textMuted block mb-1">模型名称 (可选)</label>
                            <input 
                               type="text" 
                               placeholder="留空使用默认模型 (mimo-1)" 
                               value={apiConfig.modelName || ''}
                               onChange={(e) => setApiConfig(prev => ({...prev, modelName: e.target.value}))}
                               className="w-full bg-surface border border-border rounded p-2 text-sm text-white focus:outline-none focus:border-white/50 font-mono"
                            />
                            <p className="text-[10px] text-textMuted mt-1">如果遇到 "Param Incorrect" 错误，请尝试不同的模型名称</p>
                         </div>
                         <div>
                            <label className="text-xs text-textMuted block mb-1">API Endpoint (可选)</label>
                            <input 
                               type="text" 
                               placeholder="留空使用默认端点" 
                               value={apiConfig.apiEndpoint || ''}
                               onChange={(e) => setApiConfig(prev => ({...prev, apiEndpoint: e.target.value}))}
                               className="w-full bg-surface border border-border rounded p-2 text-sm text-white focus:outline-none focus:border-white/50 font-mono"
                            />
                            <p className="text-[10px] text-textMuted mt-1">
                              开发环境: 自动使用代理 (/api/mimo)<br/>
                              生产环境: https://api.xiaomimimo.com/v1/chat/completions<br/>
                              <span className="text-yellow-400">⚠️ 生产环境如遇 CORS 错误，请使用 Cloudflare Workers 代理</span>
                            </p>
                         </div>
                         <div className="flex gap-2 pt-2">
                            <button
                               onClick={() => {
                                  localStorage.setItem(API_CONFIG_KEY, JSON.stringify(apiConfig));
                                  showNotification("API 配置已保存到浏览器本地", "success");
                               }}
                               className="flex-1 bg-white text-black hover:bg-gray-200 py-2 rounded text-sm font-semibold transition-all"
                            >
                               保存配置
                            </button>
                            <button
                               onClick={async () => {
                                  const isDev = import.meta.env.DEV;
                                  if (isDev && !apiConfig.apiKey) {
                                    showNotification("开发环境请先输入 API Key", "warning");
                                    return;
                                  }
                                  try {
                                    setIsProcessing(true);
                                    const apiKeyForTest = isDev ? apiConfig.apiKey : null;
                                    const testResponse = await analyzeText("测试", apiKeyForTest, apiConfig.apiEndpoint, apiConfig.modelName);
                                    showNotification("API 连接测试成功！", "success");
                                  } catch (err: any) {
                                    showNotification(`测试失败: ${err.message}`, "warning");
                                  } finally {
                                    setIsProcessing(false);
                                  }
                               }}
                               disabled={isProcessing || (import.meta.env.DEV && !apiConfig.apiKey)}
                               className="flex-1 bg-surfaceHighlight hover:bg-white/10 border border-border text-white py-2 rounded text-sm transition-all disabled:opacity-50"
                            >
                               测试连接
                            </button>
                         </div>
                         {import.meta.env.DEV && apiConfig.apiKey && (
                            <div className="p-2 bg-green-900/20 border border-green-500/30 rounded text-xs text-green-400">
                               ✓ 开发环境 API Key 已配置（长度: {apiConfig.apiKey?.length || 0} 字符）
                            </div>
                         )}
                      </div>
                   </div>

                   <hr className="border-border" />

                   {/* Gitee Section */}
                   <div>
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                         <Icons.Cloud className="w-4 h-4" /> Gitee 云同步
                      </h3>
                      <div className="space-y-3">
                         <div>
                            <label className="text-xs text-textMuted block mb-1">Access Token</label>
                            <input 
                               type="password" 
                               placeholder="Gitee Access Token" 
                               value={giteeConfig.access_token}
                               onChange={(e) => setGiteeConfig(prev => ({...prev, access_token: e.target.value}))}
                               className="w-full bg-surface border border-border rounded p-2 text-sm text-white focus:outline-none focus:border-white/50 font-mono"
                            />
                         </div>
                         <div>
                            <label className="text-xs text-textMuted block mb-1">Gist ID</label>
                            <input 
                               type="text" 
                               placeholder="Gist ID (留空则自动创建)" 
                               value={giteeConfig.gist_id}
                               onChange={(e) => setGiteeConfig(prev => ({...prev, gist_id: e.target.value}))}
                               className="w-full bg-surface border border-border rounded p-2 text-sm text-white focus:outline-none focus:border-white/50 font-mono"
                            />
                         </div>
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
                         <p className="text-[10px] text-textMuted text-center">注意：云端恢复将覆盖本地所有数据</p>
                         {giteeConfig.access_token && (
                            <div className="p-2 bg-green-900/20 border border-green-500/30 rounded text-xs text-green-400">
                               ✓ Gitee Token 已保存（存储在浏览器本地）
                            </div>
                         )}
                         <button
                            onClick={() => {
                              localStorage.setItem(GITEE_CONFIG_KEY, JSON.stringify(giteeConfig));
                              showNotification("Gitee 配置已保存", "success");
                            }}
                            className="w-full bg-surfaceHighlight hover:bg-white/10 border border-border text-white py-2 rounded text-sm transition-all"
                         >
                            保存 Gitee 配置
                         </button>
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
                        <label className="text-xs text-textMuted block mb-1">分类 (支持自定义)</label>
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