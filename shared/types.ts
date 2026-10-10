// 前端与 Worker 共用的类型。这里不能使用 DOM 或 workerd 专有的 API。

export interface NoteField {
  label: string;
  value: string;
  isCode?: boolean;
  isSecret?: boolean;
}

export interface SmartNote {
  id: string;
  title: string;
  originalText: string;
  summary: string;
  // 默认分类见 shared/categories.ts，也支持自定义
  category: string;
  tags: string[];
  fields: NoteField[]; // Structured key-value pairs extracted
  codeBlocks: string[]; // Larger blocks of code
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

// AI 分析结果中的单条笔记（尚未分配 id / 时间戳）
export type AnalyzedNote = Pick<SmartNote, 'title' | 'summary' | 'category' | 'tags' | 'fields' | 'codeBlocks'>;

export interface StatusResponse {
  ai: boolean;
  sync: boolean;
  model: string;
  gistId: string | null;
}

export interface AnalyzeRequest {
  text: string;
}

export interface AnalyzeResponse {
  notes: AnalyzedNote[];
  model: string;
}

// Gist 中 smart_notes.json 的新格式；旧格式是裸数组
export interface CloudSnapshotV2 {
  version: 2;
  updatedAt: number;
  notes: SmartNote[];
}

export interface SyncGetResponse {
  exists: boolean;
  updatedAt: number | null;
  notes: SmartNote[];
  format: 'v2' | 'legacy' | null;
}

export interface SyncPutRequest {
  notes: SmartNote[];
  // 上次看到的云端版本；云端比它新时返回 409
  baseUpdatedAt: number | null;
  force?: boolean;
}

export interface SyncPutResponse {
  updatedAt: number;
  created: boolean;
  gistId: string;
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'AUTH_NOT_CONFIGURED'
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'AI_NOT_CONFIGURED'
  | 'AI_UPSTREAM_ERROR'
  | 'AI_BAD_OUTPUT'
  | 'AI_TIMEOUT'
  | 'SYNC_NOT_CONFIGURED'
  | 'SYNC_UPSTREAM_ERROR'
  | 'SYNC_CONFLICT'
  | 'INTERNAL';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    cloudUpdatedAt?: number;
  };
}
