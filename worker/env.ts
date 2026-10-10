export interface Env {
  APP_PASSWORD?: string;
  MIMO_API_KEY?: string;
  MIMO_MODEL_NAME?: string;
  MIMO_API_URL?: string;
  GITEE_TOKEN?: string;
  GITEE_GIST_ID?: string;
  GITEE_API_BASE?: string;
}

// 空字符串或只有空白视为未配置
export const envValue = (value: string | undefined): string | undefined => value?.trim() || undefined;
