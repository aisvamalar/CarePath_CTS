import React, { useState, useRef, useEffect } from 'react';

interface Props {
  onSend: (msg: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled = false, placeholder = 'Ask chatbot...' }: Props) {
  const [value, setValue] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  const send = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Voice Recording ─────────────────────────────────────────────────────
  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    // Request mic permission first
    navigator.mediaDevices?.getUserMedia({ audio: true }).then(() => {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        setTranscript(text);
      };

      recognition.onerror = (e: any) => {
        console.error('Speech recognition error:', e.error);
        if (e.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access in your browser settings.');
        }
        stopRecording();
      };

      recognition.onend = () => {
        // Auto-restart if still recording (continuous mode can stop)
        if (recording && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch { setRecording(false); }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setRecording(true);
      setTranscript('');
    }).catch(() => {
      alert('Microphone access denied. Please allow microphone access to use voice input.');
    });
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setRecording(false);
    // Put transcript into the input
    if (transcript.trim()) {
      setValue(prev => prev ? prev + ' ' + transcript.trim() : transcript.trim());
    }
    setTranscript('');
  };

  const cancelRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setRecording(false);
    setTranscript('');
  };

  const hasText = value.trim().length > 0;

  return (
    <>
      {/* ── Voice Recording Screen (overlay) ── */}
      {recording && (
        <div className="vr-overlay">
          {/* Top bar */}
          <div className="vr-top">
            <button className="vr-back" onClick={cancelRecording} aria-label="Go back">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 4L6 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Status text */}
          <p className="vr-status">Go Ahead, I am saying...</p>

          {/* 3D Orb visual */}
          <div className="vr-orb-area">
            <div className="vr-orb">
              <div className="vr-orb__inner" />
              <div className="vr-orb__pulse" />
              <div className="vr-orb__pulse vr-orb__pulse--2" />
            </div>
          </div>

          {/* Transcript card */}
          <div className="vr-transcript-card">
            <p className="vr-transcript-text">
              {transcript || <span className="vr-transcript-placeholder">Listening for your voice...</span>}
            </p>
          </div>

          {/* Bottom controls — 3 buttons */}
          <div className="vr-controls">
            <button className="vr-ctrl vr-ctrl--wave" disabled aria-label="Audio levels">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2 10h1M5 7v6M8 5v10M11 7v6M14 4v12M17 7v6M20 10h-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="vr-ctrl vr-ctrl--mic" onClick={stopRecording} aria-label="Stop and use text">
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                <rect x="7" y="2" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4 10a6 6 0 0012 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 16v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="vr-ctrl vr-ctrl--close" onClick={cancelRecording} aria-label="Cancel">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Chat Input Bar ── */}
      <div className="ci-bar">
        <div className={`ci-pill${disabled ? ' ci-pill--disabled' : ''}`}>
          {/* Mic on LEFT */}
          <button
            className="ci-mic-btn"
            type="button"
            onClick={startRecording}
            disabled={disabled}
            aria-label="Voice input"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect x="7" y="2" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 10a6 6 0 0012 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 16v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Text input */}
          <textarea
            ref={ref}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={onKey}
            placeholder={disabled ? 'CarePath is thinking...' : placeholder}
            disabled={disabled}
            rows={1}
            className="ci-input"
            aria-label="Type your message"
          />

          {/* Send button */}
          <button
            className={`ci-send-btn${hasText && !disabled ? ' ci-send-btn--active' : ''}`}
            onClick={send}
            disabled={disabled || !hasText}
            aria-label="Send message"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M16 9L2 2l3 7-3 7 14-7z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
