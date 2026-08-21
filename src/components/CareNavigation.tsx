/**
 * CarePath — Care Navigation panel
 *
 * The agentic "find + book the right care" flow that runs after the
 * ED-avoidability model returns a non-emergency verdict.
 *
 *   navigate → pick provider → availability → book → confirmation
 *
 * Booked appointments are saved to the local appointment store so they
 * appear on the Appointments page and in the sidebar badge. A free-text
 * box also talks to the /care/chat agent for a conversational path.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { careService } from '../services/careService';
import type {
  NavigateResponse,
  Provider,
  Slot,
  LocationInput,
} from '../services/careService';
import { appointmentStore, type StoredAppointment } from '../services/appointmentStore';
import { toApiError } from '../services/apiClient';
import { patientAPI } from '../services/api';
import type { IntakeFeatures } from '../services/api';
import { useApp } from '../context/AppContext';

interface CareNavigationProps {
  mrn: string | null;
  patientId: string | null;
  intakeFeatures: IntakeFeatures | null;
  patientAge?: number | null;
  patientGender?: string | null;
  onNewConversation?: () => void;
}

const CARE_TYPE_LABEL: Record<string, string> = {
  PCP: 'Primary Care',
  URGENT_CARE: 'Urgent Care',
  SPECIALIST: 'Specialist',
  TELEHEALTH: 'Telehealth',
  DENTISTRY: 'Dentistry',
};

/** Get location from app context (user-selected US location with coordinates). */
function getLocationFromContext(selectedLocation: string): LocationInput {
  // Map location names to coordinates and addresses
  const locationMap: Record<string, { latitude: number; longitude: number; address: string }> = {
    'Austin, Texas': { latitude: 30.2672, longitude: -97.7431, address: 'Austin, TX 78701' },
    'San Francisco, California': { latitude: 37.7749, longitude: -122.4194, address: 'San Francisco, CA 94102' },
    'New York City, New York': { latitude: 40.7128, longitude: -74.0060, address: 'New York, NY 10001' },
    'Boston, Massachusetts': { latitude: 42.3601, longitude: -71.0589, address: 'Boston, MA 02108' },
    'Seattle, Washington': { latitude: 47.6062, longitude: -122.3321, address: 'Seattle, WA 98101' },
    'Chicago, Illinois': { latitude: 41.8781, longitude: -87.6298, address: 'Chicago, IL 60601' },
    'Miami, Florida': { latitude: 25.7617, longitude: -80.1918, address: 'Miami, FL 33101' },
  };
  
  const loc = locationMap[selectedLocation] || locationMap['Austin, Texas'];
  
  return {
    latitude: loc.latitude,
    longitude: loc.longitude,
    address: loc.address,
    radius_km: 25,
  };
}

function formatSlot(slot: Slot): { day: string; time: string } {
  const start = new Date(slot.start_time);
  return {
    day: start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

export default function CareNavigation({
  mrn,
  patientId,
  intakeFeatures,
  patientAge,
  patientGender,
  onNewConversation,
}: CareNavigationProps) {
  const { state } = useApp();
  const [stage, setStage] = useState<'navigating' | 'ready' | 'error'>('navigating');
  const [error, setError] = useState('');
  const [nav, setNav] = useState<NavigateResponse | null>(null);

  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [appointment, setAppointment] = useState<StoredAppointment | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Agent chat
  const [agentInput, setAgentInput] = useState('');
  const [agentLog, setAgentLog] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);

  const ranOnce = useRef(false);
  const isNavigating = useRef(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('Initializing...');

  const runNavigate = useCallback(async () => {
    // Prevent duplicate calls
    if (isNavigating.current) {
      console.log('[CareNavigation] Already navigating, skipping duplicate call');
      return;
    }
    
    isNavigating.current = true;
    setStage('navigating');
    setError('');
    setLoadingStatus('Analyzing your symptoms...');
    
    try {
      // Resolve MRN: use the prop, or lazily fetch from the patient dashboard
      // (which queries the EHR table by patient_id on the backend).
      setLoadingStatus('Retrieving your medical records...');
      let resolvedMrn = mrn;
      if (!resolvedMrn) {
        try {
          const dash = await patientAPI.dashboard();
          resolvedMrn = dash?.patient?.mrn ?? null;
        } catch { /* dashboard unavailable */ }
      }
      if (!resolvedMrn) {
        throw new Error('no-mrn');
      }
      
      setLoadingStatus('Determining the right type of care for you...');
      const location = getLocationFromContext(state.selectedLocation);
      
      // Add a small delay to show the status
      await new Promise(resolve => setTimeout(resolve, 300));
      setLoadingStatus('Finding nearby healthcare providers...');
      
      const res = await careService.navigate({
        mrn: resolvedMrn,
        patient: {
          primary_symptom_category: intakeFeatures?.chief_complaint?.trim() || 'general',
          pain_level_self_reported: intakeFeatures?.pain_scale ?? null,
          pain_location: intakeFeatures?.location ?? null,
          pain_onset: intakeFeatures?.symptom_onset ?? null,
          age: patientAge ?? null,
          gender: patientGender ?? null,
        },
        location,
      });
      
      setLoadingStatus('Ranking providers by distance and availability...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setNav(res);
      setStage('ready');
    } catch (err) {
      if (err instanceof Error && err.message === 'no-mrn') {
        setError('We could not find your medical record number, so care routing is unavailable. Please contact your care team.');
      } else {
        setError(toApiError(err).message);
      }
      setStage('error');
    } finally {
      isNavigating.current = false;
    }
  }, [mrn, intakeFeatures, patientAge, patientGender, state.selectedLocation]);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    void runNavigate();
  }, [runNavigate]);

  const loadSlots = useCallback(
    async (provider: Provider) => {
      if (!nav) return;
      setSelectedProvider(provider);
      setSelectedSlotId(null);
      setSlots(null);
      setSlotsLoading(true);
      setLoadingStatus('Checking appointment availability...');
      
      try {
        const res = await careService.availability({
          recommendation_id: nav.recommendation_id,
          provider_id: provider.provider_id,
          patient_id: patientId ?? undefined,
        });
        setSlots(res.available_slots ?? []);
      } catch (err) {
        setError(toApiError(err).message);
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    [nav, patientId],
  );

  const confirmBooking = useCallback(async () => {
    if (!nav || !selectedProvider || !selectedSlotId || !patientId) return;
    setBooking(true);
    setError('');
    setLoadingStatus('Booking your appointment...');
    
    try {
      const res = await careService.book({
        patient_id: patientId,
        recommendation_id: nav.recommendation_id,
        provider_id: selectedProvider.provider_id,
        slot_id: selectedSlotId,
      });
      setLoadingStatus('Confirming your booking...');
      const saved = appointmentStore.upsertFromResponse(res, nav.recommendation_id);
      setAppointment(saved);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBooking(false);
    }
  }, [nav, selectedProvider, selectedSlotId, patientId]);

  const cancelAppointment = useCallback(async () => {
    if (!appointment || !patientId) return;
    setActionBusy(true);
    try {
      const res = await careService.cancel({
        patient_id: patientId,
        appointment_id: appointment.appointment_id,
      });
      appointmentStore.updateStatus(appointment.appointment_id, res.status);
      setAppointment((prev) => (prev ? { ...prev, status: res.status } : prev));
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setActionBusy(false);
    }
  }, [appointment, patientId]);

  const startReschedule = useCallback(() => {
    // Re-open the slot picker for the same provider.
    setAppointment(null);
    if (selectedProvider) void loadSlots(selectedProvider);
  }, [selectedProvider, loadSlots]);

  const sendAgent = useCallback(async () => {
    const msg = agentInput.trim();
    if (!msg || !nav || agentBusy) return;
    setAgentInput('');
    setAgentLog((l) => [...l, { role: 'user', text: msg }]);
    setAgentBusy(true);
    try {
      const res = await careService.chat(nav.recommendation_id, msg);
      setAgentLog((l) => [...l, { role: 'assistant', text: res.response }]);
      // Reflect any structured progress the agent made.
      if (res.available_slots && res.available_slots.length > 0) {
        setSlots(res.available_slots);
        if (res.selected_provider_id) {
          const p = nav.top_providers.find((x) => x.provider_id === res.selected_provider_id);
          if (p) setSelectedProvider(p);
        }
      }
      if (res.selected_slot_id) setSelectedSlotId(res.selected_slot_id);
      if (res.appointment_id && patientId) {
        try {
          const status = await careService.getStatus(res.appointment_id, patientId);
          const saved = appointmentStore.upsertFromResponse(
            {
              appointment_id: status.appointment_id,
              patient_id: status.patient_id,
              status: status.status,
              provider_id: status.provider_id ?? res.selected_provider_id ?? '',
              provider_name: status.provider_name ?? res.selected_provider_name ?? null,
              care_type: status.care_type ?? null,
              slot: status.slot ?? { slot_id: res.selected_slot_id ?? '', provider_id: status.provider_id ?? '', start_time: '', end_time: '' },
            },
            nav.recommendation_id,
          );
          setAppointment(saved);
        } catch { /* status fetch is best-effort */ }
      }
    } catch (err) {
      setAgentLog((l) => [...l, { role: 'assistant', text: toApiError(err).message }]);
    } finally {
      setAgentBusy(false);
    }
  }, [agentInput, nav, agentBusy, patientId]);

  // ── Render ──

  if (stage === 'navigating') {
    return (
      <div style={styles.panel} className="fade-in">
        <div style={styles.loadingRow}>
          <span style={styles.spinner} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={styles.loadingText}>{loadingStatus}</span>
            <span style={{ ...styles.loadingText, fontSize: '0.85rem', opacity: 0.6 }}>
              This may take 30-60 seconds...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div style={styles.panel} className="fade-in">
        <p style={styles.errorText}>{error}</p>
        {mrn && (
          <button style={styles.retryBtn} onClick={() => void runNavigate()}>Try again</button>
        )}
      </div>
    );
  }

  if (!nav) return null;

  const dest = nav.decision.destination;

  return (
    <div style={styles.panel} className="fade-in">
      {/* Decision */}
      <div style={styles.decisionCard}>
        <div style={styles.decisionHead}>
          <span style={styles.destBadge}>{CARE_TYPE_LABEL[dest] ?? dest}</span>
          {nav.decision.specialty && <span style={styles.specialty}>{nav.decision.specialty}</span>}
        </div>
        <p style={styles.decisionText}>{nav.decision.explanation}</p>
      </div>

      {/* Booked confirmation takes over once we have an appointment */}
      {appointment ? (
        <AppointmentConfirmation
          appointment={appointment}
          busy={actionBusy}
          onCancel={cancelAppointment}
          onReschedule={startReschedule}
          onNewAssessment={onNewConversation}
        />
      ) : (
        <>
          {/* Providers */}
          <h3 style={styles.sectionTitle}>Recommended providers</h3>
          {nav.top_providers.length === 0 ? (
            <p style={styles.muted}>No nearby providers were found for this care type.</p>
          ) : (
            <div style={styles.providerList}>
              {nav.top_providers.map((p) => {
                const active = selectedProvider?.provider_id === p.provider_id;
                return (
                  <div key={p.provider_id} style={{ ...styles.providerCard, ...(active ? styles.providerCardActive : {}) }}>
                    <div style={styles.providerInfo}>
                      <span style={styles.providerName}>{p.name}</span>
                      <span style={styles.providerMeta}>
                        {(p.specialty ?? CARE_TYPE_LABEL[p.destination_type] ?? p.destination_type)}
                        {p.distance_km != null && ` · ${p.distance_km.toFixed(1)} km`}
                      </span>
                      {p.address && <span style={styles.providerAddr}>{p.address}</span>}
                    </div>
                    <button
                      style={styles.viewTimesBtn}
                      onClick={() => void loadSlots(p)}
                      disabled={slotsLoading && active}
                    >
                      {active && slotsLoading ? 'Loading…' : active ? 'Selected' : 'View times'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Slots */}
          {selectedProvider && (
            <div style={styles.slotsWrap}>
              <h3 style={styles.sectionTitle}>
                Available times · {selectedProvider.name}
              </h3>
              {slotsLoading ? (
                <div style={styles.loadingRow}>
                  <span style={styles.spinner} />
                  <span style={styles.loadingText}>{loadingStatus}</span>
                </div>
              ) : slots && slots.length > 0 ? (
                <>
                  <div style={styles.slotGrid}>
                    {slots.map((s) => {
                      const { day, time } = formatSlot(s);
                      const active = selectedSlotId === s.slot_id;
                      return (
                        <button
                          key={s.slot_id}
                          style={{ ...styles.slotChip, ...(active ? styles.slotChipActive : {}) }}
                          onClick={() => setSelectedSlotId(s.slot_id)}
                        >
                          <span style={styles.slotDay}>{day}</span>
                          <span style={styles.slotTime}>{time}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    style={{ ...styles.bookBtn, ...(!selectedSlotId || booking ? styles.bookBtnDisabled : {}) }}
                    onClick={() => void confirmBooking()}
                    disabled={!selectedSlotId || booking}
                  >
                    {booking ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={styles.spinner} />
                        {loadingStatus}
                      </span>
                    ) : 'Confirm booking'}
                  </button>
                </>
              ) : (
                <p style={styles.muted}>No open times for this provider right now.</p>
              )}
            </div>
          )}
        </>
      )}

      {error && <p style={styles.inlineError}>{error}</p>}

      {/* Agent chat */}
      <div style={styles.agentWrap}>
        <h3 style={styles.sectionTitle}>Ask CarePath</h3>
        {agentLog.length > 0 && (
          <div style={styles.agentLog}>
            {agentLog.map((m, i) => (
              <div
                key={i}
                style={{ ...styles.agentMsg, ...(m.role === 'user' ? styles.agentMsgUser : styles.agentMsgBot) }}
              >
                {m.text}
              </div>
            ))}
            {agentBusy && <div style={{ ...styles.agentMsg, ...styles.agentMsgBot }}>…</div>}
          </div>
        )}
        <div style={styles.agentInputRow}>
          <input
            style={styles.agentInput}
            value={agentInput}
            onChange={(e) => setAgentInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void sendAgent(); }}
            placeholder="e.g. book the earliest morning slot"
            disabled={agentBusy}
          />
          <button style={styles.agentSend} onClick={() => void sendAgent()} disabled={agentBusy || !agentInput.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function AppointmentConfirmation({
  appointment,
  busy,
  onCancel,
  onReschedule,
  onNewAssessment,
}: {
  appointment: StoredAppointment;
  busy: boolean;
  onCancel: () => void;
  onReschedule: () => void;
  onNewAssessment?: () => void;
}) {
  const cancelled = appointment.status === 'CANCELLED';
  const slotStart = appointment.slot?.start_time ? new Date(appointment.slot.start_time) : null;
  const when = slotStart
    ? slotStart.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : [appointment.date, appointment.time].filter(Boolean).join(' · ') || 'Time to be confirmed';

  return (
    <div style={{ ...styles.confirmCard, ...(cancelled ? styles.confirmCardCancelled : {}) }}>
      <div style={styles.confirmHead}>
        <span style={styles.confirmIcon}>{cancelled ? '✕' : '✓'}</span>
        <div>
          <h3 style={styles.confirmTitle}>
            {cancelled ? 'Appointment cancelled' : 'Appointment booked'}
          </h3>
          <span style={styles.confirmStatus}>{appointment.status}</span>
        </div>
      </div>
      <div style={styles.confirmBody}>
        {appointment.provider_name && <div><strong>{appointment.provider_name}</strong></div>}
        {(appointment.specialty || appointment.care_type) && (
          <div style={styles.muted}>
            {appointment.specialty ?? CARE_TYPE_LABEL[appointment.care_type ?? ''] ?? appointment.care_type}
          </div>
        )}
        <div style={styles.muted}>{when}</div>
        <div style={styles.confirmId}>Ref: {appointment.appointment_id}</div>
      </div>
      {!cancelled && (
        <div style={styles.confirmActions}>
          <button style={styles.ghostBtn} onClick={onReschedule} disabled={busy}>Reschedule</button>
          <button style={styles.dangerBtn} onClick={onCancel} disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
      )}
      
      {/* New Assessment Prompt */}
      {!cancelled && onNewAssessment && (
        <div style={styles.newAssessmentSection}>
          <div style={styles.divider} />
          <p style={styles.helpText}>Do you have any other health concerns?</p>
          <button style={styles.newAssessmentBtn} onClick={onNewAssessment}>
            <span style={styles.btnIcon}>📋</span>
            Start New Assessment
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '100%',
    maxWidth: '700px',
    margin: '0 auto',
    padding: '0 16px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  loadingRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0' },
  spinner: {
    width: 16, height: 16, borderRadius: '50%',
    border: '2px solid rgba(242,132,107,0.3)', borderTopColor: '#e06a4f',
    display: 'inline-block', animation: 'spin 0.8s linear infinite',
  },
  loadingText: { fontSize: '0.9375rem', color: '#6b7c84' },
  errorText: { fontSize: '0.9375rem', color: '#d92d20' },
  inlineError: { fontSize: '0.875rem', color: '#d92d20', margin: 0 },
  retryBtn: {
    alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 10, border: 'none',
    background: '#e06a4f', color: '#fff', fontWeight: 600, cursor: 'pointer',
  },
  decisionCard: {
    padding: '18px 20px', borderRadius: 16,
    background: 'linear-gradient(135deg, #fff2ec 0%, #ffe6db 100%)',
    border: '1px solid rgba(242,132,107,0.25)',
  },
  decisionHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  destBadge: {
    fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
    color: '#fff', background: '#e06a4f', padding: '4px 10px', borderRadius: 20,
  },
  specialty: { fontSize: '0.8125rem', color: '#6b7c84', fontWeight: 600 },
  decisionText: { fontSize: '0.9375rem', color: '#2d2d2d', margin: 0, lineHeight: 1.5 },
  sectionTitle: {
    fontSize: '0.8125rem', fontWeight: 700, color: '#172b35', textTransform: 'uppercase',
    letterSpacing: '0.05em', margin: '4px 0 0',
  },
  muted: { fontSize: '0.8125rem', color: '#8a8a8a' },
  providerList: { display: 'flex', flexDirection: 'column', gap: 10 },
  providerCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '14px 16px', borderRadius: 14, background: '#fffaf7',
    border: '1px solid rgba(242,132,107,0.15)',
  },
  providerCardActive: { border: '1.5px solid #e06a4f', background: '#fff2ec' },
  providerInfo: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  providerName: { fontSize: '0.9375rem', fontWeight: 700, color: '#2d2d2d' },
  providerMeta: { fontSize: '0.8125rem', color: '#6b7c84' },
  providerAddr: { fontSize: '0.75rem', color: '#a8a8a8' },
  viewTimesBtn: {
    flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: '1px solid #e06a4f',
    background: 'transparent', color: '#e06a4f', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
  },
  slotsWrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  slotGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 },
  slotChip: {
    display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 8px', borderRadius: 10,
    border: '1px solid rgba(242,132,107,0.2)', background: '#fffaf7', cursor: 'pointer', textAlign: 'center',
  },
  slotChipActive: { border: '1.5px solid #e06a4f', background: '#fff2ec' },
  slotDay: { fontSize: '0.6875rem', color: '#6b7c84', fontWeight: 600 },
  slotTime: { fontSize: '0.875rem', color: '#2d2d2d', fontWeight: 700 },
  bookBtn: {
    alignSelf: 'flex-start', padding: '10px 22px', borderRadius: 12, border: 'none',
    background: '#e06a4f', color: '#fff', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
  },
  bookBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  confirmCard: {
    padding: '18px 20px', borderRadius: 16, background: '#f0fdf4', border: '1.5px solid #179c88',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  confirmCardCancelled: { background: '#fff5f5', border: '1.5px solid #d92d20' },
  confirmHead: { display: 'flex', alignItems: 'center', gap: 12 },
  confirmIcon: {
    width: 32, height: 32, borderRadius: '50%', background: '#179c88', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0,
  },
  confirmTitle: { fontSize: '1rem', fontWeight: 800, color: '#172b35', margin: 0 },
  confirmStatus: { fontSize: '0.75rem', fontWeight: 700, color: '#6b7c84', letterSpacing: '0.05em' },
  confirmBody: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9375rem', color: '#2d2d2d' },
  confirmId: { fontSize: '0.75rem', color: '#a8a8a8', fontFamily: 'monospace' },
  confirmActions: { display: 'flex', gap: 10 },
  ghostBtn: {
    padding: '8px 16px', borderRadius: 10, border: '1px solid #cbd5d9', background: 'transparent',
    color: '#172b35', fontWeight: 600, cursor: 'pointer',
  },
  dangerBtn: {
    padding: '8px 16px', borderRadius: 10, border: '1px solid #d92d20', background: 'transparent',
    color: '#d92d20', fontWeight: 600, cursor: 'pointer',
  },
  divider: {
    height: '1px',
    backgroundColor: '#e3e8ea',
    margin: '20px 0',
  },
  newAssessmentSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginTop: '8px',
  },
  helpText: {
    fontSize: '0.9375rem',
    color: '#6b7c84',
    textAlign: 'center',
    margin: 0,
  },
  newAssessmentBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    borderRadius: 12,
    border: '2px solid #e06a4f',
    backgroundColor: '#fff',
    color: '#e06a4f',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  btnIcon: {
    fontSize: '1.125rem',
  },
  agentWrap: {
    display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8,
    borderTop: '1px solid rgba(242,132,107,0.12)',
  },
  agentLog: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' },
  agentMsg: { padding: '8px 12px', borderRadius: 12, fontSize: '0.875rem', maxWidth: '85%', lineHeight: 1.4 },
  agentMsgUser: { alignSelf: 'flex-end', background: '#e06a4f', color: '#fff' },
  agentMsgBot: { alignSelf: 'flex-start', background: '#f3f4f6', color: '#2d2d2d' },
  agentInputRow: { display: 'flex', gap: 8 },
  agentInput: {
    flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(242,132,107,0.25)',
    fontSize: '0.9375rem', outline: 'none', fontFamily: 'inherit',
  },
  agentSend: {
    padding: '10px 18px', borderRadius: 12, border: 'none', background: '#e06a4f', color: '#fff',
    fontWeight: 700, cursor: 'pointer',
  },
};
