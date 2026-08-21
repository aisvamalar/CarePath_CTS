/**
 * CarePath — Header search.
 *
 * Only searches resources the backend actually exposes:
 *   • Patients — GET /ehr/patients (filtered client-side; backend has no search param)
 *   • Chats    — GET /chat/search
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ehrService, type PatientListItem } from '../../services/ehrService';
import { chatAPI } from '../../services/api';

interface ChatHit { session_id: string; title: string }

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [chats, setChats] = useState<ChatHit[]>([]);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Patient list is cached once per session; the backend has no search endpoint. */
  const cache = useRef<PatientListItem[] | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();

    if (q.length < 2) {
      setPatients([]);
      setChats([]);
      setBusy(false);
      setFailed(false);
      return;
    }

    setBusy(true);
    setFailed(false);

    timer.current = setTimeout(async () => {
      const needle = q.toLowerCase();
      let anyFailure = false;

      // Patients
      try {
        if (!cache.current) cache.current = await ehrService.list({ limit: 500 });
        setPatients(
          cache.current
            .filter(
              (p) =>
                p.name?.toLowerCase().includes(needle) ||
                p.mrn?.toLowerCase().includes(needle) ||
                p.patient_id?.toLowerCase().includes(needle) ||
                p.date_of_birth?.includes(needle),
            )
            .slice(0, 5),
        );
      } catch {
        anyFailure = true;
        setPatients([]);
      }

      // Chats
      try {
        const res = await chatAPI.search(q, { limit: 4 });
        const results = (res?.results ?? []) as Record<string, unknown>[];
        setChats(
          results.map((r) => ({
            session_id: (r.session_id as string) ?? '',
            title: (r.title as string) ?? 'Untitled chat',
          })),
        );
      } catch {
        setChats([]);
      }

      setFailed(anyFailure);
      setBusy(false);
    }, 350);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const hasResults = patients.length > 0 || chats.length > 0;
  const showPanel = open && query.trim().length >= 2;

  return (
    <div className="cmx-search" ref={boxRef}>
      <span className="cmx-search__icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11l3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <input
        className="cmx-search__input"
        type="search"
        placeholder="Search patients, tasks, appointments..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        aria-label="Search CarePath"
      />
      {busy && <span className="cmx-search__spinner" aria-hidden="true" />}

      {showPanel && (
        <div className="cmx-search__panel" role="listbox">
          {!busy && !hasResults && !failed && (
            <p className="cmx-search__empty">No matches for “{query.trim()}”.</p>
          )}
          {failed && (
            <p className="cmx-search__empty cmx-search__empty--err">
              Search is unavailable — cannot reach the server.
            </p>
          )}

          {patients.length > 0 && (
            <>
              <p className="cmx-search__group">Patients</p>
              {patients.map((p) => (
                <button
                  key={p.id}
                  className="cmx-search__row"
                  role="option"
                  aria-selected={false}
                  onClick={() => { setOpen(false); setQuery(''); navigate(`/care-manager/patients/${p.id}`); }}
                >
                  <span className="cmx-search__avatar">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                  <span className="cmx-search__rowtext">
                    <span className="cmx-search__rowtitle">{p.name}</span>
                    <span className="cmx-search__rowsub">{p.mrn} · Age {p.age}</span>
                  </span>
                </button>
              ))}
            </>
          )}

          {chats.length > 0 && (
            <>
              <p className="cmx-search__group">Chats</p>
              {chats.map((c) => (
                <button
                  key={c.session_id}
                  className="cmx-search__row"
                  role="option"
                  aria-selected={false}
                  onClick={() => { setOpen(false); setQuery(''); navigate('/chat'); }}
                >
                  <span className="cmx-search__avatar cmx-search__avatar--chat">💬</span>
                  <span className="cmx-search__rowtext">
                    <span className="cmx-search__rowtitle">{c.title}</span>
                    <span className="cmx-search__rowsub">Conversation</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
