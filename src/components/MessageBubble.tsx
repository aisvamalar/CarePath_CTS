import type { Message } from '../context/AppContext';

interface Props { message: Message; }

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const time = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`mb-row${isUser ? ' mb-row--user' : ' mb-row--assistant'}`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="mb-avatar" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 56 56" fill="none">
            <rect width="56" height="56" rx="14" fill="white" fillOpacity="0.9"/>
            <path d="M28 11C28 11 16.5 18 16.5 27C16.5 34.5 22 40 28 42.5C34 40 39.5 34.5 39.5 27C39.5 18 28 11 28 11Z"
              fill="#2e9b8a" fillOpacity="0.85"/>
            <path d="M22 27.5L26.5 32L34 22.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Bubble + timestamp */}
      <div className="mb-wrap">
        <div className={`mb-bubble${isUser ? ' mb-bubble--user' : ' mb-bubble--assistant'}`}
          role="article"
          aria-label={isUser ? 'Your message' : 'CarePath response'}>
          <p className="mb-text">{message.content}</p>
        </div>
        <div className={`mb-meta${isUser ? ' mb-meta--user' : ''}`}>
          <span className="mb-time">{time}</span>
          {isUser && (
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true" className="mb-tick">
              <path d="M1 5l3.5 3.5L13 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 5l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="mb-row mb-row--assistant">
      <div className="mb-avatar" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 56 56" fill="none">
          <rect width="56" height="56" rx="14" fill="white" fillOpacity="0.9"/>
          <path d="M28 11C28 11 16.5 18 16.5 27C16.5 34.5 22 40 28 42.5C34 40 39.5 34.5 39.5 27C39.5 18 28 11 28 11Z"
            fill="#2e9b8a" fillOpacity="0.85"/>
        </svg>
      </div>
      <div className="mb-wrap">
        <div className="mb-bubble mb-bubble--assistant mb-bubble--typing">
          <span className="mb-typing-label">CarePath is thinking</span>
          <div className="mb-typing-dots" role="status" aria-label="Thinking">
            {[0, 1, 2].map(i => (
              <span key={i} className="mb-typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
