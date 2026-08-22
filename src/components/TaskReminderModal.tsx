/**
 * Task Reminder Modal - Interactive notification for care plan tasks
 */

import React, { useState } from 'react';
import { notificationAPI, type Notification, type TaskCompletionRequest } from '../services/api';

interface TaskReminderModalProps {
  notification: Notification;
  onClose: () => void;
  onComplete: (response: any) => void;
}

export default function TaskReminderModal({
  notification,
  onClose,
  onComplete,
}: TaskReminderModalProps) {
  const [responding, setResponding] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState('');
  const [response, setResponse] = useState<any>(null);

  const handleYes = async () => {
    if (notification.task_index === undefined || notification.task_index === null) return;

    setResponding(true);
    try {
      const request: TaskCompletionRequest = {
        task_index: notification.task_index,
        completed: true,
      };

      const result = await notificationAPI.respondToTask(request);
      setResponse(result);
      
      setTimeout(() => {
        onComplete(result);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to mark task complete:', err);
      setResponding(false);
    }
  };

  const handleNo = () => {
    setShowReasonInput(true);
  };

  const handleSubmitReason = async () => {
    if (notification.task_index === undefined || notification.task_index === null) return;

    setResponding(true);
    try {
      const request: TaskCompletionRequest = {
        task_index: notification.task_index,
        completed: false,
        reason: reason || 'Task was too difficult',
      };

      const result = await notificationAPI.respondToTask(request);
      setResponse(result);
      
      setTimeout(() => {
        onComplete(result);
        onClose();
      }, 3000);
    } catch (err) {
      console.error('Failed to reframe task:', err);
      setResponding(false);
    }
  };

  // Success state
  if (response) {
    if (response.status === 'completed') {
      return (
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content task-modal" onClick={(e) => e.stopPropagation()}>
            <div className="task-modal__success">
              <div className="task-modal__success-icon">✓</div>
              <h2>Great Job!</h2>
              <p>{response.message}</p>
            </div>
          </div>
        </div>
      );
    }

    if (response.status === 'reframed') {
      return (
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content task-modal" onClick={(e) => e.stopPropagation()}>
            <div className="task-modal__reframed">
              <div className="task-modal__reframe-icon">🤖</div>
              <h2>Task Adjusted</h2>
              <p className="task-modal__reframe-message">{response.message}</p>
              
              <div className="task-modal__comparison">
                <div className="task-modal__comparison-item task-modal__comparison-item--old">
                  <span className="task-modal__comparison-label">Original:</span>
                  <p>{response.reframing?.original_task}</p>
                </div>
                <div className="task-modal__comparison-arrow">→</div>
                <div className="task-modal__comparison-item task-modal__comparison-item--new">
                  <span className="task-modal__comparison-label">New (Easier):</span>
                  <p>{response.reframing?.reframed_task}</p>
                </div>
              </div>
              
              <p className="task-modal__reasoning">
                <strong>Why:</strong> {response.reframing?.reasoning}
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content task-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="task-modal__header">
          <div className="task-modal__icon">
            {notification.priority === 'urgent' ? '🔴' : notification.priority === 'high' ? '🟡' : '🔵'}
          </div>
          <div>
            <h2 className="task-modal__title">{notification.title}</h2>
            <p className="task-modal__time">
              {new Date(notification.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
          <button className="task-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Task */}
        <div className="task-modal__body">
          <p className="task-modal__task">{notification.task_text || notification.message}</p>

          {!showReasonInput ? (
            <>
              <p className="task-modal__question">Did you complete this task?</p>
              
              <div className="task-modal__actions">
                <button
                  className="task-modal__btn task-modal__btn--yes"
                  onClick={handleYes}
                  disabled={responding}
                >
                  <span className="task-modal__btn-icon">✓</span>
                  Yes, I did it
                </button>
                <button
                  className="task-modal__btn task-modal__btn--no"
                  onClick={handleNo}
                  disabled={responding}
                >
                  <span className="task-modal__btn-icon">✗</span>
                  No, I couldn't
                </button>
              </div>
            </>
          ) : (
            <div className="task-modal__reason">
              <p className="task-modal__reason-label">
                Help us understand why (optional):
              </p>
              <select
                className="task-modal__reason-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={responding}
              >
                <option value="">Select a reason...</option>
                <option value="I forgot">I forgot</option>
                <option value="Too difficult">Too difficult</option>
                <option value="Don't understand">Don't understand</option>
                <option value="Don't have supplies">Don't have supplies</option>
                <option value="Side effects">Side effects/discomfort</option>
                <option value="Other">Other</option>
              </select>

              <div className="task-modal__reason-actions">
                <button
                  className="task-modal__btn task-modal__btn--secondary"
                  onClick={() => setShowReasonInput(false)}
                  disabled={responding}
                >
                  Back
                </button>
                <button
                  className="task-modal__btn task-modal__btn--primary"
                  onClick={handleSubmitReason}
                  disabled={responding}
                >
                  {responding ? (
                    <>
                      <span className="task-modal__spinner" />
                      Adjusting task...
                    </>
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>

              <p className="task-modal__reason-note">
                We'll use AI to make this task easier for you.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="task-modal__footer">
          <p className="task-modal__footer-text">
            Your care manager will be notified of your response.
          </p>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .task-modal {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
          overflow: hidden;
        }

        .task-modal__header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 24px 24px 16px;
          border-bottom: 1px solid #e3e8ea;
        }

        .task-modal__icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .task-modal__title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #172b35;
          margin: 0 0 4px;
        }

        .task-modal__time {
          font-size: 0.8125rem;
          color: #6b7c84;
          margin: 0;
        }

        .task-modal__close {
          margin-left: auto;
          background: transparent;
          border: none;
          font-size: 1.25rem;
          color: #6b7c84;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .task-modal__close:hover {
          background: #f0f0f0;
        }

        .task-modal__body {
          padding: 24px;
        }

        .task-modal__task {
          font-size: 1rem;
          font-weight: 500;
          color: #172b35;
          line-height: 1.5;
          margin: 0 0 20px;
          padding: 16px;
          background: #f8fafb;
          border-left: 3px solid #e06a4f;
          border-radius: 8px;
        }

        .task-modal__question {
          font-size: 0.9375rem;
          color: #172b35;
          margin: 0 0 16px;
          text-align: center;
        }

        .task-modal__actions {
          display: flex;
          gap: 12px;
        }

        .task-modal__btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border: none;
          border-radius: 10px;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .task-modal__btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .task-modal__btn--yes {
          background: #179c88;
          color: white;
        }

        .task-modal__btn--yes:hover:not(:disabled) {
          background: #138c78;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(23, 156, 136, 0.3);
        }

        .task-modal__btn--no {
          background: #f0f0f0;
          color: #172b35;
        }

        .task-modal__btn--no:hover:not(:disabled) {
          background: #e3e8ea;
        }

        .task-modal__btn--primary {
          background: #e06a4f;
          color: white;
        }

        .task-modal__btn--primary:hover:not(:disabled) {
          background: #d15a3f;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(224, 106, 79, 0.3);
        }

        .task-modal__btn--secondary {
          background: #f0f0f0;
          color: #172b35;
        }

        .task-modal__btn-icon {
          font-size: 1.125rem;
          font-weight: bold;
        }

        .task-modal__footer {
          padding: 16px 24px;
          background: #f8fafb;
          border-top: 1px solid #e3e8ea;
        }

        .task-modal__footer-text {
          margin: 0;
          font-size: 0.8125rem;
          color: #6b7c84;
          text-align: center;
        }

        .task-modal__reason {
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .task-modal__reason-label {
          font-size: 0.9375rem;
          color: #172b35;
          margin: 0 0 12px;
          font-weight: 500;
        }

        .task-modal__reason-select {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid #e3e8ea;
          border-radius: 8px;
          font-size: 0.9375rem;
          font-family: inherit;
          color: #172b35;
          margin-bottom: 16px;
          background: white;
          cursor: pointer;
        }

        .task-modal__reason-select:focus {
          outline: none;
          border-color: #e06a4f;
        }

        .task-modal__reason-actions {
          display: flex;
          gap: 12px;
        }

        .task-modal__reason-note {
          margin: 12px 0 0;
          font-size: 0.8125rem;
          color: #6b7c84;
          text-align: center;
          font-style: italic;
        }

        .task-modal__spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .task-modal__success {
          text-align: center;
          padding: 40px 24px;
        }

        .task-modal__success-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: linear-gradient(135deg, #179c88 0%, #138c78 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          color: white;
          animation: scaleIn 0.5s ease;
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }

        .task-modal__success h2 {
          font-size: 1.5rem;
          color: #172b35;
          margin: 0 0 12px;
        }

        .task-modal__success p {
          color: #6b7c84;
          margin: 0;
        }

        .task-modal__reframed {
          padding: 32px 24px;
        }

        .task-modal__reframe-icon {
          text-align: center;
          font-size: 3rem;
          margin-bottom: 16px;
        }

        .task-modal__reframed h2 {
          text-align: center;
          font-size: 1.5rem;
          color: #172b35;
          margin: 0 0 12px;
        }

        .task-modal__reframe-message {
          text-align: center;
          color: #6b7c84;
          margin: 0 0 24px;
        }

        .task-modal__comparison {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .task-modal__comparison-item {
          flex: 1;
          padding: 16px;
          border-radius: 10px;
          min-height: 80px;
        }

        .task-modal__comparison-item--old {
          background: #fff5f5;
          border: 1px solid #fecaca;
        }

        .task-modal__comparison-item--new {
          background: #f0fdf4;
          border: 1px solid #86efac;
        }

        .task-modal__comparison-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
          color: #6b7c84;
        }

        .task-modal__comparison-item p {
          margin: 0;
          font-size: 0.875rem;
          color: #172b35;
          line-height: 1.5;
        }

        .task-modal__comparison-arrow {
          font-size: 1.5rem;
          color: #e06a4f;
          flex-shrink: 0;
        }

        .task-modal__reasoning {
          padding: 16px;
          background: #f0f9ff;
          border-left: 3px solid #3b82f6;
          border-radius: 8px;
          font-size: 0.875rem;
          color: #172b35;
          line-height: 1.5;
          margin: 0;
        }

        .task-modal__reasoning strong {
          color: #1e40af;
        }
      `}</style>
    </div>
  );
}
