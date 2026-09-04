import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types';
import {
  subscribeToDerivedNotifications,
  fetchDerivedNotifications,
  markNotificationAsRead as markAsReadService,
  markAllNotificationsAsRead as markAllAsReadService,
} from '../lib/notificationService';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshNotifications = async () => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      const notifs = await fetchDerivedNotifications(user.uid);
      setNotifications(notifs);
    } catch (err) {
      console.warn('[NotificationContext] Error refreshing notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToDerivedNotifications(user.uid, (updatedNotifs) => {
      setNotifications(updatedNotifs);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  const markAsRead = (notificationId: string) => {
    if (!user?.uid || !notificationId) return;
    markAsReadService(user.uid, notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    if (!user?.uid || !notifications.length) return;
    const allIds = notifications.map((n) => n.id);
    markAllAsReadService(user.uid, allIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

const defaultNotificationContext: NotificationContextType = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  markAsRead: () => {},
  markAllAsRead: () => {},
  refreshNotifications: async () => {},
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    return defaultNotificationContext;
  }
  return context;
};
