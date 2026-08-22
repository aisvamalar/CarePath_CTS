/**
 * Notification Badge - Shows unread count with animation
 */

import React, { useEffect, useState } from 'react';

interface NotificationBadgeProps {
  count: number;
  onClick?: () => void;
  className?: string;
}

export default function NotificationBadge({ count, onClick, className = '' }: NotificationBadgeProps) {
  const [prevCount, setPrevCount] = useState(count);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (count > prevCount && count > 0) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(timer);
    }
    setPrevCount(count);
  }, [count, prevCount]);

  if (count === 0) return null;

  return (
    <button
      className={`notification-badge ${animate ? 'notification-badge--animate' : ''} ${className}`}
      onClick={onClick}
      aria-label={`${count} unread notifications`}
      title={`${count} unread notification${count !== 1 ? 's' : ''}`}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="notification-badge__icon">
        <path
          d="M10 2a6 6 0 00-6 6c0 2.5-1 3.5-1 5h14s-1-2.5-1-5a6 6 0 00-6-6zM8 17a2 2 0 104 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="notification-badge__count">{count > 99 ? '99+' : count}</span>

      <style jsx>{`
        .notification-badge {
          position: relative;
          background: transparent;
          border: none;
          padding: 8px;
          cursor: pointer;
          border-radius: 8px;
          transition: background 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .notification-badge:hover {
          background: rgba(224, 106, 79, 0.1);
        }

        .notification-badge__icon {
          color: #172b35;
        }

        .notification-badge__count {
          position: absolute;
          top: 4px;
          right: 4px;
          background: #e06a4f;
          color: white;
          font-size: 0.6875rem;
          font-weight: 700;
          line-height: 1;
          padding: 3px 5px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(224, 106, 79, 0.3);
        }

        .notification-badge--animate .notification-badge__count {
          animation: badgePop 0.6s ease;
        }

        @keyframes badgePop {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.3);
          }
          100% {
            transform: scale(1);
          }
        }

        .notification-badge--animate .notification-badge__icon {
          animation: bellRing 0.6s ease;
        }

        @keyframes bellRing {
          0%, 100% {
            transform: rotate(0deg);
          }
          10%, 30%, 50%, 70% {
            transform: rotate(-10deg);
          }
          20%, 40%, 60%, 80% {
            transform: rotate(10deg);
          }
        }
      `}</style>
    </button>
  );
}
