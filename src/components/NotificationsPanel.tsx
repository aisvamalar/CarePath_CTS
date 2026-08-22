/**
 * Notifications Panel - Dropdown list of notifications
 */

import React, { useState } from 'react';
import type { Notification } from '../services/api';
import TaskReminderModal from './TaskReminderModal';

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export default function NotificationsPanel({
  notifications,
  onMarkAsRead,
  onDismiss,
  onRefresh,
  loading = false,
}: NotificationsPanelProps) {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const handleNotificationClick = (notification: Notification) => {
    if (notification.notification_type === 'task_reminder') {
      setSelectedNotification(notification);
    }
    if (notification.status === 'pending') {
      onMarkAsRead(notification.id);
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    if (priority === 'urgent') return '🔴';
    if (priority === 'high') return '🟡';
    
    switch (type) {
      case 'task_reminder': return '📋';
      case 'appointment_reminder': return '📅';
      case 'care_manager_message': return '💬';
      case 'task_reframed': return '🤖';
      case 'followup_scheduled': return '✅';
      default: return '🔔';
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <>
      <div className="notifications-panel">
        {/* Header */}
        <div className="notifications-panel__header">
          <h3 className="notifications-panel__title">Notifications</h3>
          <button 
            className="notifications-panel__refresh" 
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh notifications"
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              fill="none"
              className={loading ? 'notifications-panel__refresh-icon--spinning' : ''}
            >
              <path
                d="M14 8a6 6 0 11-9-5.2M8 2v4l2-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="notifications-panel__list">
          {notifications.length === 0 ? (
            <div className="notifications-panel__empty">
              <div className="notifications-panel__empty-icon">🔕</div>
              <p className="notifications-panel__empty-text">No notifications</p>
              <p className="notifications-panel__empty-sub">You're all caught up!</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${
                  notification.status === 'pending' ? 'notification-item--unread' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-item__icon">
                  {getNotificationIcon(notification.notification_type, notification.priority)}
                </div>
                
                <div className="notification-item__content">
                  <div className="notification-item__header">
                    <h4 className="notification-item__title">{notification.title}</h4>
                    <span className="notification-item__time">
                      {formatTime(notification.created_at)}
                    </span>
                  </div>
                  <p className="notification-item__message">{notification.message}</p>
                  
                  {notification.notification_type === 'task_reminder' && (
                    <span className="notification-item__cta">Tap to respond →</span>
                  )}
                </div>

                {notification.status === 'pending' && (
                  <button
                    className="notification-item__dismiss"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(notification.id);
                    }}
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Reminder Modal */}
      {selectedNotification && (
        <TaskReminderModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
          onComplete={(response) => {
            console.log('Task completed:', response);
            onRefresh();
          }}
        />
      )}

      <style jsx>{`
        .notifications-panel {
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          width: 380px;
          max-width: calc(100vw - 32px);
          max-height: 500px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .notifications-panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e3e8ea;
        }

        .notifications-panel__title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #172b35;
          margin: 0;
        }

        .notifications-panel__refresh {
          background: transparent;
          border: none;
          padding: 6px;
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7c84;
        }

        .notifications-panel__refresh:hover:not(:disabled) {
          background: #f0f0f0;
        }

        .notifications-panel__refresh:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .notifications-panel__refresh-icon--spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .notifications-panel__list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .notifications-panel__list::-webkit-scrollbar {
          width: 6px;
        }

        .notifications-panel__list::-webkit-scrollbar-thumb {
          background: #e3e8ea;
          border-radius: 3px;
        }

        .notifications-panel__empty {
          text-align: center;
          padding: 60px 20px;
        }

        .notifications-panel__empty-icon {
          font-size: 3rem;
          margin-bottom: 12px;
        }

        .notifications-panel__empty-text {
          font-size: 1rem;
          font-weight: 600;
          color: #172b35;
          margin: 0 0 6px;
        }

        .notifications-panel__empty-sub {
          font-size: 0.875rem;
          color: #6b7c84;
          margin: 0;
        }

        .notification-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s;
          position: relative;
          margin-bottom: 4px;
        }

        .notification-item:hover {
          background: #f8fafb;
        }

        .notification-item--unread {
          background: #fff5f5;
        }

        .notification-item--unread:hover {
          background: #fee2e2;
        }

        .notification-item__icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .notification-item__content {
          flex: 1;
          min-width: 0;
        }

        .notification-item__header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .notification-item__title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #172b35;
          margin: 0;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .notification-item__time {
          font-size: 0.75rem;
          color: #9ca3af;
          flex-shrink: 0;
        }

        .notification-item__message {
          font-size: 0.875rem;
          color: #6b7c84;
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .notification-item__cta {
          display: inline-block;
          margin-top: 6px;
          font-size: 0.8125rem;
          color: #e06a4f;
          font-weight: 500;
        }

        .notification-item__dismiss {
          position: absolute;
          top: 8px;
          right: 8px;
          background: white;
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 0.875rem;
          color: #6b7c84;
          opacity: 0;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .notification-item:hover .notification-item__dismiss {
          opacity: 1;
        }

        .notification-item__dismiss:hover {
          background: #fee2e2;
          color: #dc2626;
        }
      `}</style>
    </>
  );
}
