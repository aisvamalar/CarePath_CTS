/**
 * CarePath — Post Discharge Care
 *
 * Two plain containers, AI-playground style:
 *   Left  — a simple patient list (avatar, name, MRN, status pill). No
 *           timelines or agent detail live here — just "who can I run
 *           care-plan generation for".
 *   Right — blank until a patient is selected ("pick a patient to start").
 *           Once selected, mounts <CarePlanGenerator> inline, which streams
 *           the real 4-agent backend workflow (care_plan → followup →
 *           response_analyser → appointment) exactly like an AI agent
 *           multi-step run, then shows the resulting care plan + appointment.
 *
 * The KPI strip and patient statuses are still derived from the real
 * GET .../post-discharge/ status per patient — nothing fabricated.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CareManagerLayout from '../../components/care_manager/CareManagerLayout';
import { ErrorState, EmptyState, SkeletonCard } from '../../components/ui/States';
import { ehrService, type PatientListItem } from '../../services/ehrService';
import { careManagerService, type PostDischargeStatus } from '../../services/careManagerService';
import { toApiError } from '../../services/apiClient';
import CarePlanGenerator from '../../components/care_manager/CarePlanGenerator';

interface Row {
  patient: PatientListItem;
  status: PostDischargeStatus;
}

/** Status pill derived only from the care-plan agent's own status field. */
function statusOf(status: PostDischargeStatus): { label: string; tone: 'high' | 'ok' | 'done' | 'idle' } {
  const cp = status.care_plan?.status;
  if (cp === 'at_risk') return { label: 'At risk', tone: 'high' };
  if (cp === 'completed') return { label: 'Complete', tone: 'done' };
  if (cp === 'not_generated') return { label: 'Not started', tone: 'idle' };
  return { label: 'On track', tone: 'ok' };
}

export default function PostDischargePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const patients = await ehrService.list({ limit: 60 });
      if (!patients || patients.length === 0) {
        setRows([]);
        return;
      }

      const settled = await Promise.allSettled(
        patients.map(async (p) => ({ p, s: await careManagerService.postDischarge(p.patient_id) })),
      );

      const next: Row[] = [];
      settled.forEach((r) => {
        if (r.status !== 'fulfilled') return;
        next.push({ patient: r.value.p, status: r.value.s });
      });

      setRows(next);
    } catch (err) {
      setError(toApiError(err).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.patient.name?.toLowerCase().includes(q) || r.patient.mrn?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.patient.patient_id === selectedId) ?? null,
    [rows, selectedId],
  );

  const handleSendSuccess = () => { void load(); };

  return (
    <CareManagerLayout breadcrumb="Post Discharge">
      <div className="cmp-head">
        <div>
          <h1 className="cmp-head__title">Post Discharge Care</h1>
          <p className="cmp-head__sub">Select a patient and run the real care-plan agent workflow.</p>
        </div>
        <button className="cp-btn cp-btn--ghost" onClick={load} disabled={loading}>
          {loading ? <><span className="cp-btn__spinner" /> Refreshing…</> : 'Refresh'}
        </button>
      </div>

      {error && <ErrorState title="Unable to load post-discharge data" message={error} onRetry={load} />}

      {loading ? (
        <section className="cmp-panel"><SkeletonCard lines={5} /></section>
      ) : rows.length === 0 ? (
        <section className="cmp-panel">
          <EmptyState
            icon="🛤️" title="No patients found"
            message="There are no patients to run post-discharge care for yet."
            actionLabel="Go to patients" onAction={() => navigate('/care-manager/patients')}
          />
        </section>
      ) : (
        <div className="pcg-layout">
          {/* ── Left: plain patient list ── */}
          <div className="pcg-list">
            <div className="pcg-list__head">
              <h2>Patients</h2>
              <span className="pcg-list__count">{visibleRows.length}</span>
            </div>

            <div className="pcg-list__search">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search name or MRN…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <ul className="pcg-list__items">
              {visibleRows.length === 0 ? (
                <li className="pcg-list__empty">No patients match your search.</li>
              ) : (
                visibleRows.map((r) => {
                  const s = statusOf(r.status);
                  const isSelected = selectedId === r.patient.patient_id;
                  return (
                    <li key={r.patient.patient_id}>
                      <button
                        className={`pcg-list__item${isSelected ? ' pcg-list__item--on' : ''}`}
                        onClick={() => setSelectedId(r.patient.patient_id)}
                        aria-pressed={isSelected}
                      >
                        <span className="pcg-list__avatar">{r.patient.name?.[0]?.toUpperCase() ?? 'P'}</span>
                        <span className="pcg-list__text">
                          <span className="pcg-list__name">{r.patient.name}</span>
                          <span className="pcg-list__mrn">{r.patient.mrn}</span>
                        </span>
                        <span className={`pcg-list__pill pcg-list__pill--${s.tone}`}>{s.label}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* ── Right: playground — blank until a patient is picked ── */}
          <div className="pcg-playground">
            {!selectedRow ? (
              <div className="pcg-playground__empty">
                <span className="pcg-playground__icon" aria-hidden="true">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 4" />
                    <path d="M11 16h10M16 11v10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </span>
                <h3>Select a patient to begin</h3>
                <p>Choose a patient from the list to run the care-plan agent workflow.</p>
              </div>
            ) : (
              <CarePlanGenerator
                key={selectedRow.patient.patient_id}
                patientId={selectedRow.patient.patient_id}
                patientName={selectedRow.patient.name}
                patientMrn={selectedRow.patient.mrn}
                onSendSuccess={handleSendSuccess}
              />
            )}
          </div>
        </div>
      )}
    </CareManagerLayout>
  );
}
