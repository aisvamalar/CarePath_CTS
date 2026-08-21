import { useEffect, useState } from 'react';
import type { Message } from '../context/AppContext';

let robotImg: string;
try { robotImg = new URL('../assets/robot.png', import.meta.url).href; }
catch { robotImg = new URL('../assets/hero.png', import.meta.url).href; }

// Claude-style cycling thinking messages
const THINKING_MESSAGES = [
  'Musing…',
  'Mulling…',
  'Figuring things out…',
  'Thinking it through…',
  'Working it out…',
  'Connecting the dots…',
  'Making sense of it…',
  'Looking into it…',
  'Piecing things together…',
  'Working through it…',
  'Reasoning…',
  'Analyzing…',
  'Exploring options…',
  'Checking possibilities…',
  'Finding the best match…',
  'Narrowing it down…',
  'Putting it together…',
  'Almost there…',
];

interface Props { message: Message; }

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const time = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`mb-row${isUser ? ' mb-row--user' : ' mb-row--assistant'}`}>
      {/* Assistant avatar — robot image */}
      {!isUser && (
        <div className="mb-avatar" aria-hidden="true">
          <img src={robotImg} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} />
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
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Fade out → advance → fade in cycle every 2.2 s
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex(i => (i + 1) % THINKING_MESSAGES.length);
        setVisible(true);
      }, 280);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mb-row mb-row--assistant">
      <div className="mb-avatar" aria-hidden="true">
        <img src={robotImg} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} />
      </div>
      <div className="mb-wrap">
        <div className="mb-bubble mb-bubble--assistant mb-bubble--typing" role="status" aria-live="polite" aria-label="CarePath is thinking">
          <div className="mb-thinking">
            <div className="mb-thinking__dots">
              {[0, 1, 2].map(i => (
                <span key={i} className="mb-typing-dot" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
            <span
              className="mb-thinking__msg"
              style={{ opacity: visible ? 1 : 0 }}
            >
              {THINKING_MESSAGES[msgIndex]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
