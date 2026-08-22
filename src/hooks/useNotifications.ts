/**
 * useNotifications Hook - Manages notification state with polling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationAPI, type Notification } from '../services/api';

interface UseNotificationsOptions {
  pollInterval?: number; // milliseconds, default 30000 (30 seconds)
  autoLoad?: boolean; // auto-load on mount, default true
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAsActed: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const { pollInterval = 30000, autoLoad = true } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setLoading(true);
    setError(null);

    try {
      const [listResult, countResult] = await Promise.all([
        notificationAPI.list({ limit: 50 }),
        notificationAPI.getUnreadCount(),
      ]);

      if (!isMountedRef.current) return;

      setNotifications(listResult.notifications);
      setUnreadCount(countResult.unread_count);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationAPI.updateStatus(id, 'read');
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, status: 'read', read_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  const markAsActed = useCallback(async (id: string) => {
    try {
      await notificationAPI.updateStatus(id, 'acted_upon');
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, status: 'acted_upon', acted_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as acted:', err);
    }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    try {
      await notificationAPI.updateStatus(id, 'dismissed');
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to dismiss:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (autoLoad) {
      void refresh();
    }
  }, [autoLoad, refresh]);

  // Polling
  useEffect(() => {
    if (pollInterval > 0) {
      pollTimerRef.current = setInterval(() => {
        void refresh();
      }, pollInterval);

      return () => {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
        }
      };
    }
  }, [pollInterval, refresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    markAsActed,
    dismiss,
  };
}
