export enum NoteCategoryEnum {
  SERVER = '服务器',
  NETWORK = '网络',
  COMMAND = '命令',
  CREDENTIAL = '凭据',
  CONFIG = '配置',
  LINK = '链接',
  OTHER = '其他'
}

// Allow string for custom categories
export type NoteCategory = NoteCategoryEnum | string;

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
  category: NoteCategory;
  tags: string[];
  fields: NoteField[]; // Structured key-value pairs extracted
  codeBlocks: string[]; // Larger blocks of code
  createdAt: number;
  updatedAt?: number; // Added for version comparison
}

export interface AnalysisResponse {
  notes: Array<{
    title: string;
    summary: string;
    category: string;
    tags: string[];
    fields: Array<{ label: string; value: string; isCode: boolean; isSecret: boolean }>;
    codeBlocks: string[];
  }>;
}

export interface GiteeConfig {
  access_token: string;
  gist_id: string;
}

export interface NotificationState {
  show: boolean;
  message: string;
  type: 'info' | 'success' | 'warning';
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}