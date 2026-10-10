import { useCallback, useEffect, useRef, useState } from 'react';
import type { StatusResponse } from '../../shared/types';
import { api, ApiError, errorMessage, hasPassword, setPassword } from '../api/client';
import type { Notify } from './useNotifier';

// checking: 正在检查；ready: 已解锁；locked: 需要密码；
// unconfigured: 服务端没有设置 APP_PASSWORD；offline: 无法连接服务端
export type AuthPhase = 'checking' | 'ready' | 'locked' | 'unconfigured' | 'offline';

type Action = () => void;

export const useAuth = (notify: Notify) => {
  const [phase, setPhase] = useState<AuthPhase>('checking');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  // 解锁后要继续执行的操作（例如用户点了「开始分析」才弹出的密码框）
  const pending = useRef<Action | null>(null);
  // 待执行操作在 setState 之后立刻运行，需要同步读到最新状态
  const statusRef = useRef<StatusResponse | null>(null);
  const phaseRef = useRef<AuthPhase>('checking');

  const apply = useCallback((nextPhase: AuthPhase, nextStatus: StatusResponse | null) => {
    phaseRef.current = nextPhase;
    statusRef.current = nextStatus;
    setPhase(nextPhase);
    setStatus(nextStatus);
  }, []);

  const applyError = useCallback(
    (err: unknown) => {
      const code = err instanceof ApiError ? err.code : null;
      apply(code === 'UNAUTHORIZED' ? 'locked' : code === 'AUTH_NOT_CONFIGURED' ? 'unconfigured' : 'offline', null);
    },
    [apply],
  );

  const refresh = useCallback(async () => {
    // 本机没有保存密码时不必请求，等用户需要时再弹出密码框
    if (!hasPassword()) {
      apply('locked', null);
      return;
    }
    try {
      apply('ready', await api.status());
    } catch (err) {
      applyError(err);
    }
  }, [apply, applyError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 需要访问 /api 的操作都通过它执行：已解锁直接运行，否则先弹出密码框
  const requireAuth = useCallback(
    (action: Action) => {
      switch (phaseRef.current) {
        case 'ready':
          action();
          return;
        case 'unconfigured':
          notify('服务端未配置访问密码（APP_PASSWORD），AI 分析与云同步不可用', 'warning');
          return;
        case 'checking':
        case 'offline':
          // 还在检查，或者可能只是暂时断网：重新检查一次再决定
          void (async () => {
            await refresh();
            if (phaseRef.current === 'ready') action();
            else if (phaseRef.current === 'locked') {
              pending.current = action;
              setPromptOpen(true);
            } else if (phaseRef.current === 'unconfigured') {
              notify('服务端未配置访问密码（APP_PASSWORD），AI 分析与云同步不可用', 'warning');
            } else notify('无法连接服务端，请检查网络', 'warning');
          })();
          return;
        default:
          pending.current = action;
          setPromptOpen(true);
      }
    },
    [notify, refresh],
  );

  // 请求返回 401（密码在服务端被修改了）：清掉本机密码，重新输入后重试
  const handleUnauthorized = useCallback(
    (retry: Action) => {
      setPassword(null);
      apply('locked', null);
      pending.current = retry;
      setPromptOpen(true);
    },
    [apply],
  );

  const unlock = useCallback(
    async (candidate: string): Promise<string | null> => {
      try {
        const next = await api.status(candidate);
        setPassword(candidate);
        apply('ready', next);
        setPromptOpen(false);
        const action = pending.current;
        pending.current = null;
        action?.();
        return null;
      } catch (err) {
        if (err instanceof ApiError && err.code === 'UNAUTHORIZED') return '密码错误';
        if (err instanceof ApiError && err.code === 'AUTH_NOT_CONFIGURED') applyError(err);
        return errorMessage(err);
      }
    },
    [apply, applyError],
  );

  const lock = useCallback(() => {
    setPassword(null);
    apply('locked', null);
  }, [apply]);

  const cancelPrompt = useCallback(() => {
    pending.current = null;
    setPromptOpen(false);
  }, []);

  const openPrompt = useCallback(() => setPromptOpen(true), []);

  const getStatus = useCallback(() => statusRef.current, []);

  return { phase, status, promptOpen, requireAuth, handleUnauthorized, unlock, lock, cancelPrompt, openPrompt, getStatus };
};

export type Auth = ReturnType<typeof useAuth>;
