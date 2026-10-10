import { useCallback, useRef, useState } from 'react';

export type NotificationType = 'info' | 'success' | 'warning';

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface NotificationItem {
  id: number;
  message: string;
  type: NotificationType;
  actions?: NotificationAction[];
  // 毫秒；不设置时成功提示 3 秒后关闭，其余一直显示直到用户关闭
  duration?: number;
}

export type Notify = (
  message: string,
  type: NotificationType,
  options?: { actions?: NotificationAction[]; duration?: number },
) => void;

export const useNotifier = () => {
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const nextId = useRef(0);

  const notify = useCallback<Notify>((message, type, options) => {
    setNotification({ id: ++nextId.current, message, type, ...options });
  }, []);

  const dismiss = useCallback(() => setNotification(null), []);

  return { notification, notify, dismiss };
};
