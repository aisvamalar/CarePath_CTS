/**
 * CarePath — Patients page
 * Full CRUD against /api/v1/ehr/patients plus readmission prediction.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CareManagerLayout from '../../components/care_manager/CareManagerLayout';
import PatientForm, {
  emptyPatientForm, fromPatient, toPayload, validate,
  type PatientFormValues,
} from '../../components/care_manager/PatientForm';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import RiskBadge, { riskFromScore } from '../../components/ui/RiskBadge';
import { ErrorState, EmptyState, SkeletonTable, Skeleton } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { ehrService, type PatientListItem } from '../../services/ehrService';
import { careManagerService } from '../../services/careManagerService';
import { toApiError } from '../../services/apiClient';

type RiskFilter = 'all' | 'high' | 'medium' | 'low' | 'unrated';

const PAGE_SIZE = 12;

export default function PatientsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState<RiskFilter>('all');
  const [page, setPage] = useState(0);

  /** Risk scores fetched lazily for the rows currently on screen. */
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const scoreReqs = useRef<Set<string>>(new Set());

  // Dialog state
  const [createOpen, setCreateOpen] = useState(params.get('new') === '1');
  const [editTarget, setEditTarget] = useState<PatientListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatientListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [formValues, setFormValues] = useState<PatientFormValues>(emptyPatientForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editInitial, setEditInitial] = useState<PatientFormValues | null>(null);
  const [predicting, setPredicting] = useState<string | null>(null);

  // ── Load roster ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await ehrService.list({ limit: 500 });
      setRows(list ?? []);
    } catch (err) {
      setError(toApiError(err).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Filter + paginate ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;

    if (q) {
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.mrn?.toLowerCase().includes(q) ||
          p.patient_id?.toLowerCase().includes(q) ||
          p.date_of_birth?.includes(q),
      );
    }

    if (risk !== 'all') {
      list = list.filter((p) => {
        const s = scores[p.patient_id];
        const level = s === undefined ? 'unrated' : riskFromScore(s);
        return risk === 'unrated' ? level === 'unknown' || s === null : level === risk;
      });
    }
    return list;
  }, [rows, search, risk, scores]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  useEffect(() => { setPage(0); }, [search, risk]);

  // ── Lazily fetch risk scores for visible rows ──
  useEffect(() => {
    const pending = visible
      .map((p) => p.patient_id)
      .filter((id) => id && !(id in scores) && !scoreReqs.current.has(id));

    if (pending.length === 0) return;
    pending.forEach((id) => scoreReqs.current.add(id));

    let cancelled = false;
    void (async () => {
      const settled = await Promise.allSettled(
        pending.map(async (id) => ({ id, res: await careManagerService.getReadmission(id) })),
      );
      if (cancelled) return;
      const next: Record<string, number | null> = {};
      settled.forEach((s, i) => {
        const id = pending[i];
        next[id] = s.status === 'fulfilled' ? s.value.res.risk_score : null;
      });
      setScores((prev) => ({ ...prev, ...next }));
    })();

    return () => { cancelled = true; };
  }, [visible, scores]);

  // ── Summary metrics from real records ──
  const summary = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 30);
    return {
      total: rows.length,
      newThisMonth: rows.filter((p) => new Date(p.created_at) >= cutoff).length,
      active: rows.filter((p) => p.is_active === 1).length,
    };
  }, [rows]);

  // ── Create ──
  const openCreate = () => {
    setFormValues(emptyPatientForm);
    setFormErrors({});
    setEditInitial(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    if (params.get('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
  };

  const submitCreate = async () => {
    const errs = validate(formValues);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      const created = await ehrService.create(toPayload(formValues));
      toast.success(`${created.name} created — MRN ${created.mrn}`);
      closeCreate();
      await load();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Update ──
  const openEdit = async (p: PatientListItem) => {
    setEditTarget(p);
    setEditInitial(null);
    setFormErrors({});
    try {
      const detail = await ehrService.getById(p.id);
      const vals = fromPatient(detail);
      setEditInitial(vals);
      setFormValues(vals);
    } catch (err) {
      toast.error(toApiError(err).message);
      setEditTarget(null);
    }
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    const errs = validate(formValues);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      await ehrService.update(editTarget.id, toPayload(formValues));
      toast.success('Patient updated successfully');
      setEditTarget(null);
      setEditInitial(null);
      await load();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Delete ──
  const submitDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await ehrService.remove(deleteTarget.id);
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Predict ──
  const runPredict = async (p: PatientListItem) => {
    setPredicting(p.patient_id);
    try {
      const res = await careManagerService.predictReadmission(p.patient_id);
      setScores((prev) => ({ ...prev, [p.patient_id]: res.risk_score }));
      toast.success(`${p.name}: ${res.risk_level} risk (${Math.round(res.risk_score * 100)}%)`);
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setPredicting(null);
    }
  };

  return (
    <CareManagerLayout breadcrumb="Patients">
      <div className="cmp-head">
        <div>
          <h1 className="cmp-head__title">Patients</h1>
          <p className="cmp-head__sub">Patient records — MRN, name, date of birth and risk status.</p>
        </div>
        <button className="cp-btn cp-btn--primary" onClick={() => navigate('/care-manager/patients/new')}>
          <span aria-hidden="true">+</span> Create Patient
        </button>
      </div>

      {/* Summary */}
      <div className="cmp-kpis cmp-kpis--three">
        <SummaryCard tone="coral" label="Total Patients" value={summary.total} hint="All registered" loading={loading} />
        <SummaryCard tone="rose" label="New This Month" value={summary.newThisMonth} hint="Last 30 days" loading={loading} />
        <SummaryCard tone="peach" label="Active Records" value={summary.active} hint="Currently active" loading={loading} />
      </div>

      <section className="cmp-panel">
        {/* Toolbar */}
        <div className="cmp-toolbar">
          <div className="cmp-searchbox">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, MRN, date of birth..."
              aria-label="Search patients"
            />
          </div>

          <div className="cmp-chips" role="group" aria-label="Filter by risk">
            {([
              { key: 'all', label: 'All' },
              { key: 'low', label: 'Low' },
              { key: 'medium', label: 'Medium' },
              { key: 'high', label: 'High Risk' },
              { key: 'unrated', label: 'Unrated' },
            ] as { key: RiskFilter; label: string }[]).map((f) => (
              <button
                key={f.key}
                className={`cmp-chip${risk === f.key ? ' cmp-chip--on' : ''}`}
                onClick={() => setRisk(f.key)}
                aria-pressed={risk === f.key}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <ErrorState title="Unable to load patient data" message={error} onRetry={load} />
        ) : loading ? (
          <SkeletonTable rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🗂️"
            title="No patient records found"
            message="Create your first patient record to begin managing care pathways."
            actionLabel="Create Patient"
            onAction={openCreate}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No patients match your filters"
            message="Try a different search term or risk filter."
            actionLabel="Clear filters"
            onAction={() => { setSearch(''); setRisk('all'); }}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="cmp-tablewrap">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th scope="col">MRN</th>
                    <th scope="col">Patient</th>
                    <th scope="col">Date of Birth</th>
                    <th scope="col">Age</th>
                    <th scope="col">Registered</th>
                    <th scope="col">Risk</th>
                    <th scope="col" className="cmp-table__right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const score = scores[p.patient_id];
                    return (
                      <tr key={p.id} className="cmp-table__row" onClick={() => navigate(`/care-manager/patients/${p.id}`)}>
                        <td className="cmp-mono">{p.mrn}</td>
                        <td>
                          <span className="cmp-person">
                            <span className="cmp-person__avatar">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                            <span className="cmp-person__text">
                              <span className="cmp-person__name">{p.name}</span>
                              <span className="cmp-person__id">{p.gender}</span>
                            </span>
                          </span>
                        </td>
                        <td className="cmp-muted">{p.date_of_birth}</td>
                        <td className="cmp-muted">{p.age}</td>
                        <td className="cmp-muted">
                          {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td>
                          {score === undefined ? (
                            <Skeleton height={18} width={64} radius={20} />
                          ) : score === null ? (
                            <span className="cmp-muted">Not scored</span>
                          ) : (
                            <RiskBadge score={score} showScore />
                          )}
                        </td>
                        <td className="cmp-table__right">
                          <div className="cmp-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="cp-btn cp-btn--sm cp-btn--primary"
                              onClick={() => runPredict(p)}
                              disabled={predicting === p.patient_id}
                            >
                              {predicting === p.patient_id ? <><span className="cp-btn__spinner" /> …</> : 'Predict'}
                            </button>
                            <button className="cp-btn cp-btn--sm cp-btn--ghost" onClick={() => openEdit(p)}>
                              Update
                            </button>
                            <button
                              className="cmp-iconaction cmp-iconaction--danger"
                              onClick={() => setDeleteTarget(p)}
                              aria-label={`Delete ${p.name}`}
                              title="Delete patient"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="cmp-cardlist">
              {visible.map((p) => {
                const score = scores[p.patient_id];
                return (
                  <div key={p.id} className="cmp-pcard cmp-pcard--static">
                    <button className="cmp-pcard__top cmp-pcard__hit" onClick={() => navigate(`/care-manager/patients/${p.id}`)}>
                      <span className="cmp-person__avatar">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                      <span className="cmp-person__text">
                        <span className="cmp-person__name">{p.name}</span>
                        <span className="cmp-person__id">{p.mrn}</span>
                      </span>
                      {score !== undefined && score !== null && <RiskBadge score={score} />}
                    </button>
                    <span className="cmp-pcard__meta">
                      <span>DOB {p.date_of_birth}</span>
                      <span>Age {p.age}</span>
                    </span>
                    <div className="cmp-pcard__actions">
                      <button className="cp-btn cp-btn--sm cp-btn--primary" onClick={() => runPredict(p)} disabled={predicting === p.patient_id}>
                        {predicting === p.patient_id ? 'Predicting…' : 'Predict'}
                      </button>
                      <button className="cp-btn cp-btn--sm cp-btn--ghost" onClick={() => openEdit(p)}>Update</button>
                      <button className="cp-btn cp-btn--sm cp-btn--dangerghost" onClick={() => setDeleteTarget(p)}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {pageCount > 1 && (
              <div className="cmp-pager">
                <button className="cp-btn cp-btn--sm cp-btn--ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  ← Previous
                </button>
                <span className="cmp-pager__info">Page {page + 1} of {pageCount}</span>
                <button className="cp-btn cp-btn--sm cp-btn--ghost" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Create modal ── */}
      <Modal
        open={createOpen}
        title="Create Patient"
        subtitle="Register a new patient record. MRN is generated automatically."
        onClose={closeCreate}
        width={720}
        footer={
          <>
            <button className="cp-btn cp-btn--ghost" onClick={closeCreate} disabled={busy}>Cancel</button>
            <button className="cp-btn cp-btn--primary" onClick={submitCreate} disabled={busy}>
              {busy ? <><span className="cp-btn__spinner" /> Creating…</> : 'Create Patient'}
            </button>
          </>
        }
      >
        <PatientForm errors={formErrors} onChange={setFormValues} />
      </Modal>

      {/* ── Edit modal ── */}
      <Modal
        open={Boolean(editTarget)}
        title={`Update ${editTarget?.name ?? 'Patient'}`}
        subtitle={editTarget ? `MRN ${editTarget.mrn}` : undefined}
        onClose={() => { setEditTarget(null); setEditInitial(null); }}
        width={720}
        footer={
          <>
            <button className="cp-btn cp-btn--ghost" onClick={() => { setEditTarget(null); setEditInitial(null); }} disabled={busy}>
              Cancel
            </button>
            <button className="cp-btn cp-btn--primary" onClick={submitEdit} disabled={busy || !editInitial}>
              {busy ? <><span className="cp-btn__spinner" /> Saving…</> : 'Save changes'}
            </button>
          </>
        }
      >
        {editInitial ? (
          <PatientForm key={editTarget?.id} initial={editInitial} errors={formErrors} onChange={setFormValues} />
        ) : (
          <div className="pf__loading">
            <Skeleton height={14} width="40%" />
            <Skeleton height={38} />
            <Skeleton height={38} />
            <Skeleton height={38} width="70%" />
          </div>
        )}
      </Modal>

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Patient?"
        message={`Are you sure you want to remove ${deleteTarget?.name ?? 'this patient'}'s record? This action cannot be undone.`}
        confirmLabel="Delete Patient"
        danger
        busy={busy}
        onConfirm={submitDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </CareManagerLayout>
  );
}

function SummaryCard({
  label, value, hint, tone, loading,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'coral' | 'rose' | 'peach';
  loading: boolean;
}) {
  return (
    <div className="kpi">
      <span className={`kpi__icon kpi__icon--${tone}`} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="7" cy="6" r="2.7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1.8 15c0-2.9 2.3-4.6 5.2-4.6s5.2 1.7 5.2 4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="kpi__body">
        <span className="kpi__label">{label}</span>
        {loading ? <Skeleton height={26} width="50%" /> : <span className="kpi__value">{value.toLocaleString()}</span>}
        <span className="kpi__hint">{hint}</span>
      </span>
    </div>
  );
}
