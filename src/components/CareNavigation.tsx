/**
 * CarePath — Care Navigation (all-in-one inline chat component)
 * Phases: Agent pipeline → Booking (3-col) → Confirmed + inline Leaflet map
 * Everything stays inside the chat scroll — no page navigation.
 *
 * Leaflet pattern: static import + ref callback → no race condition,
 * no dynamic import(), no staggered timeouts.
 */

// ── Static Leaflet import (must be at module scope) ─────────────────────────
import L from 'leaflet';
// Bundle marker icons locally — no CDN dependency
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { careService } from '../services/careService';
import type { NavigateResponse, Provider, Slot } from '../services/careService';
import { appointmentStore, type StoredAppointment } from '../services/appointmentStore';
import { toApiError } from '../services/apiClient';
import { patientAPI } from '../services/api';
import type { IntakeFeatures } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CareNavigationProps {
  mrn: string | null;
  patientId: string | null;
  intakeFeatures: IntakeFeatures | null;
  patientAge?: number | null;
  patientGender?: string | null;
  onNewConversation?: () => void;
}

interface LatLng { lat: number; lng: number; }
interface RouteData { distanceKm: number; durationMin: number; routeName: string; geometry: LatLng[]; }
type AgentStatus = 'done' | 'running' | 'pending' | 'failed';
interface Agent { id: string; label: string; sub: string; icon: React.ReactNode; status: AgentStatus; }

// ── Constants ─────────────────────────────────────────────────────────────────

const CARE_LABEL: Record<string, string> = {
  PCP: 'Primary Care', URGENT_CARE: 'Urgent Care', SPECIALIST: 'Specialist',
  TELEHEALTH: 'Telehealth', DENTISTRY: 'Dentistry',
};
const DOCTOR_PHOTOS = [
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1638202993928-7267aad84c31?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=80&h=80&fit=crop&crop=face',
];
const US_LOCS: Record<string, { lat: number; lon: number; addr: string }> = {
  'Austin, Texas':               { lat: 30.2672, lon: -97.7431, addr: 'Austin, TX' },
  'San Francisco, California':   { lat: 37.7749, lon: -122.4194, addr: 'San Francisco, CA' },
  'New York City, New York':     { lat: 40.7128, lon: -74.0060,  addr: 'New York, NY' },
  'Boston, Massachusetts':       { lat: 42.3601, lon: -71.0589,  addr: 'Boston, MA' },
};
const JOURNEY_STAGES = [
  { key: 'assessment',  label: 'Assessment\nComplete'  },
  { key: 'recommended', label: 'Care\nRecommended'    },
  { key: 'booked',      label: 'Appointment\nBooked'  },
  { key: 'on_way',      label: 'On Your Way'           },
  { key: 'arrived',     label: 'Arrived'               },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function photoForId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return DOCTOR_PHOTOS[h % DOCTOR_PHOTOS.length];
}
function initials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
async function fetchOSRMRoute(origin: LatLng, dest: LatLng): Promise<RouteData> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${dest.lng},${dest.lat}` +
    `?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found');
  const route = data.routes[0];
  const distanceKm  = Math.round((route.distance / 1000) * 10) / 10;
  const durationMin = Math.round(route.duration / 60);
  const steps = route.legs?.[0]?.steps ?? [];
  const mainRoad = steps.find((s: { name?: string }) => s.name?.trim())?.name ?? 'local roads';
  const geometry: LatLng[] = (route.geometry?.coordinates ?? []).map(
    ([lng, lat]: [number, number]) => ({ lat, lng }),
  );
  return { distanceKm, durationMin, routeName: mainRoad, geometry };
}

// ── Agent SVG icons ───────────────────────────────────────────────────────────

const A_ICONS = {
  symptom: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12l2 2 4-4 4 6 4-8 2 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  risk:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  care:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  appt:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
};

// ── Inline map state (held at module level so the map instance outlives renders)

let _leafletMap: L.Map | null = null;
let _userDot: L.Marker | null = null;
let _routePoly: L.Polyline | null = null;
let _navInterval: ReturnType<typeof setInterval> | null = null;

function destroyMap() {
  if (_navInterval) { clearInterval(_navInterval); _navInterval = null; }
  if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
  _userDot = null; _routePoly = null;
}

function initMap(node: HTMLDivElement, center: L.LatLngTuple, destPos: LatLng | null, originPos: LatLng | null, providerName: string | null) {
  destroyMap();
  const map = L.map(node, { zoomControl: false }).setView(center, 13);
  _leafletMap = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  if (destPos) {
    // Red destination pin
    const icon = L.divIcon({
      html: `<svg viewBox="0 0 24 36" width="28" height="42" fill="#E85D3C" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0zm0 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/></svg>`,
      className: '',
      iconAnchor: [14, 42],
    });
    const destMarker = L.marker([destPos.lat, destPos.lng], { icon }).addTo(map);

    // Provider name popup — always open so it shows on the map
    if (providerName) {
      destMarker.bindTooltip(providerName, {
        permanent: true,
        direction: 'top',
        offset: [0, -44],
        className: 'rm-map-tooltip',
      }).openTooltip();
    }

    // Dotted straight line from user to provider (shows before OSRM route loads)
    if (originPos) {
      L.polyline(
        [[originPos.lat, originPos.lng], [destPos.lat, destPos.lng]],
        { color: '#E85D3C', weight: 2, opacity: 0.45, dashArray: '6 8' }
      ).addTo(map);

      // Fit both points in view
      const bounds = L.latLngBounds([originPos.lat, originPos.lng], [destPos.lat, destPos.lng]);
      map.fitBounds(bounds, { padding: [48, 48] });
    }
  }

  if (originPos) setUserMarker(originPos);

  requestAnimationFrame(() => map.invalidateSize());
}
function setUserMarker(pos: LatLng) {
  if (!_leafletMap) return;
  const icon = L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,.35)"></div>`,
    className: '',
    iconAnchor: [8, 8],
  });
  if (_userDot) { _userDot.setLatLng([pos.lat, pos.lng]); }
  else { _userDot = L.marker([pos.lat, pos.lng], { icon }).addTo(_leafletMap); }
}

function drawPolyline(geometry: LatLng[], originPos?: LatLng, destPosition?: LatLng) {
  if (!_leafletMap || !geometry.length) return;
  if (_routePoly) _leafletMap.removeLayer(_routePoly);
  const lls = geometry.map(p => [p.lat, p.lng] as L.LatLngTuple);
  _routePoly = L.polyline(lls, { color: '#E85D3C', weight: 5, opacity: 0.9 }).addTo(_leafletMap);

  // Build bounds from polyline + both endpoints so the full route is always visible
  const bounds = _routePoly.getBounds();
  if (originPos)   bounds.extend([originPos.lat,   originPos.lng]);
  if (destPosition) bounds.extend([destPosition.lat, destPosition.lng]);

  _leafletMap.fitBounds(bounds, { padding: [48, 48] });
}

function startInlineNav(geometry: LatLng[], onStep: (i: number) => void, onDone: () => void) {
  if (!_leafletMap || !geometry.length) return;
  if (_navInterval) clearInterval(_navInterval);
  const step = Math.max(1, Math.floor(geometry.length / 12));
  const waypoints = geometry.filter((_, i) => i % step === 0);
  let idx = 0;
  _navInterval = setInterval(() => {
    if (!_leafletMap || idx >= waypoints.length) {
      clearInterval(_navInterval!); _navInterval = null; onDone(); return;
    }
    _leafletMap.panTo([waypoints[idx].lat, waypoints[idx].lng], { animate: true, duration: 0.5 });
    onStep(idx);
    idx++;
  }, 800);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CareNavigation({
  mrn, patientId, intakeFeatures, patientAge, patientGender, onNewConversation,
}: CareNavigationProps) {
  const selectedLocation = 'Austin, Texas';

  // agents
  const [agents, setAgents] = useState<Agent[]>([
    { id: 'symptom', label: 'Symptom',     sub: 'Analyzer',    icon: A_ICONS.symptom, status: 'done'    },
    { id: 'risk',    label: 'Risk',        sub: 'Evaluator',   icon: A_ICONS.risk,    status: 'done'    },
    { id: 'care',    label: 'Care',        sub: 'Recommender', icon: A_ICONS.care,    status: 'running' },
    { id: 'appt',    label: 'Appointment', sub: 'Matcher',     icon: A_ICONS.appt,    status: 'pending' },
  ]);
  const [agentMsg, setAgentMsg]     = useState('Finding the best care option for you…');
  const [agentsDone, setAgentsDone] = useState(false);

  // booking
  const [nav, setNav]               = useState<NavigateResponse | null>(null);
  const [error, setError]           = useState('');
  const [visitType, setVisitType]   = useState<string | null>(null);
  const [step, setStep]             = useState<1|2|3|4>(1);
  const [provider, setProvider]     = useState<Provider | null>(null);
  const [slots, setSlots]           = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [appt, setAppt]             = useState<StoredAppointment | null>(null);

  // route / map
  const [showRoute, setShowRoute]   = useState(false);
  const [userPos, setUserPos]       = useState<LatLng | null>(null);
  const [geoState, setGeoState]     = useState<'waiting'|'ok'|'denied'|'na'>('waiting');
  const [destPos, setDestPos]       = useState<LatLng | null>(null);
  const [routeData, setRouteData]   = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [mapView, setMapView]       = useState<'map'|'steps'>('map');
  const [stageIndex, setStageIndex] = useState(2);
  const [navActive, setNavActive]   = useState(false);
  const [navStep, setNavStep]       = useState(0);

  const ran = useRef(false);
  const geoWatchId = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => () => {
    destroyMap();
    if (geoWatchId.current != null) navigator.geolocation?.clearWatch(geoWatchId.current);
  }, []);

  // ── ref callback — map initialises the instant the DOM node exists ──────────
  const FIXED_ORIGIN: LatLng = { lat: 30.2880, lng: -97.7653 };

  const mapRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const origin = userPos ?? FIXED_ORIGIN;
      const center: L.LatLngTuple = destPos
        ? [destPos.lat, destPos.lng]
        : [origin.lat, origin.lng];
      initMap(node, center, destPos, origin, appt?.provider_name ?? null);
      if (routeData) drawPolyline(routeData.geometry, origin, destPos ?? undefined);
    } else {
      destroyMap();
    }
  }, [destPos, userPos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── draw polyline whenever route arrives (via state update path) ─────────
  useEffect(() => { if (routeData && userPos && destPos) drawPolyline(routeData.geometry, userPos, destPos); }, [routeData, userPos, destPos]);

  // ── agents ────────────────────────────────────────────────────────────────
  const setAgent = (id: string, s: AgentStatus) =>
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: s } : a));

  const runNavigate = useCallback(async () => {
    setError(''); setAgent('care', 'running'); setAgentMsg('Classifying your care needs…');
    try {
      let resolvedMrn = mrn;
      if (!resolvedMrn) {
        try { const d = await patientAPI.dashboard(); resolvedMrn = d?.patient?.mrn ?? null; } catch { /* ignore */ }
      }
      if (!resolvedMrn) throw new Error('no-mrn');
      setAgentMsg('Discovering nearby providers…');
      const loc = US_LOCS[selectedLocation] ?? US_LOCS['Austin, Texas'];
      const res = await careService.navigate({
        mrn: resolvedMrn,
        patient: {
          primary_symptom_category: intakeFeatures?.chief_complaint?.trim() || 'general',
          pain_level_self_reported: intakeFeatures?.pain_scale ?? null,
          pain_location: intakeFeatures?.location ?? null,
          pain_onset: intakeFeatures?.symptom_onset ?? null,
          age: patientAge ?? null, gender: patientGender ?? null,
        },
        location: { latitude: loc.lat, longitude: loc.lon, address: loc.addr, radius_km: 25 },
      });
      setAgent('care', 'done'); setAgent('appt', 'running');
      setAgentMsg('Matching appointment availability…');
      await new Promise(r => setTimeout(r, 600));
      setAgent('appt', 'done'); setAgentMsg('Your care options are ready');
      setAgentsDone(true); setNav(res); setVisitType(res.decision.destination); setStep(2);
    } catch (err) {
      setAgent('care', 'failed');
      setError(err instanceof Error && err.message === 'no-mrn'
        ? 'Could not find your medical record number.'
        : toApiError(err).message);
      setAgentsDone(true);
    }
  }, [mrn, intakeFeatures, patientAge, patientGender, selectedLocation]);

  useEffect(() => { if (!ran.current) { ran.current = true; void runNavigate(); } }, [runNavigate]);

  const loadSlots = useCallback(async (p: Provider) => {
    if (!nav) return;
    setProvider(p); setSelectedSlot(null); setSlots([]); setSlotsLoading(true); setStep(3);
    try {
      const r = await careService.availability({ recommendation_id: nav.recommendation_id, provider_id: p.provider_id, patient_id: patientId ?? undefined });
      setSlots(r.available_slots ?? []);
    } catch (err) { setError(toApiError(err).message); }
    finally { setSlotsLoading(false); }
  }, [nav, patientId]);

  const confirmBooking = useCallback(async () => {
    if (!nav || !provider || !selectedSlot || !patientId) return;
    setConfirming(true); setError(''); setStep(4);
    try {
      const res = await careService.book({ patient_id: patientId, recommendation_id: nav.recommendation_id, provider_id: provider.provider_id, slot_id: selectedSlot.slot_id });
      const coords = provider.latitude != null && provider.longitude != null
        ? { lat: provider.latitude, lng: provider.longitude, address: provider.address ?? null } : null;
      const saved = appointmentStore.upsertFromResponse(res, nav.recommendation_id, coords);
      setAppt(saved);
      if (coords) setDestPos({ lat: coords.lat, lng: coords.lng });
    } catch (err) { setError(toApiError(err).message); setStep(3); }
    finally { setConfirming(false); }
  }, [nav, provider, selectedSlot, patientId]);

  const startRoute = useCallback(() => {
    setShowRoute(true); setStageIndex(3);

    // Fixed Austin demo — never use GPS, always route within Austin
    const ORIGIN: LatLng = { lat: 30.2880, lng: -97.7653 }; // 2507 Enfield Rd, Austin TX
    const DEST: LatLng   = { lat: 30.2849, lng: -97.7341 }; // Austin Regional Clinic South

    const finalDest = destPos ?? DEST;
    if (!destPos) setDestPos(finalDest);
    setUserPos(ORIGIN);
    setGeoState('ok');

    // Fetch real OSRM route immediately — no GPS needed
    setRouteLoading(true); setRouteError(null); setRouteData(null);
    fetchOSRMRoute(ORIGIN, finalDest)
      .then(r => {
        setRouteData(r);
        setRouteLoading(false);
        // Draw directly on map (already mounted via ref callback)
        // Short delay so ref callback has time to init the map
        setTimeout(() => {
          setUserMarker(ORIGIN);
          drawPolyline(r.geometry, ORIGIN, finalDest);
        }, 150);
      })
      .catch(e => { setRouteError(String(e?.message ?? e)); setRouteLoading(false); });
  }, [destPos]); // eslint-disable-line react-hooks/exhaustive-deps

  const startNavigation = useCallback(() => {
    if (!routeData?.geometry.length || !_leafletMap) return;
    setNavActive(true); setNavStep(0);
    startInlineNav(
      routeData.geometry,
      idx => setNavStep(idx),
      () => { setNavActive(false); setStageIndex(4); },
    );
  }, [routeData]);

  const completedAgents = agents.filter(a => a.status === 'done').length;
  const progress = (completedAgents / agents.length) * 100;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="cn3-root">

      {/* ── Agent Pipeline ── */}
      {!agentsDone && (
        <div className="cn3-agents fade-in">
          <div className="cn3-agents__hd">
            <span className="cn3-agents__spark">🐾</span>
            <span className="cn3-agents__title">AI Agents are analyzing your responses…</span>
          </div>
          <div className="cn3-agents__track">
            {agents.map((a, i) => (
              <div key={a.id} className="cn3-agent-wrap">
                <div className={`cn3-agent cn3-agent--${a.status}`}>{a.icon}</div>
                <div className="cn3-agent__label">{a.label}<br />{a.sub}</div>
                <div className={`cn3-agent__stat cn3-agent__stat--${a.status}`}>
                  {a.status === 'done'    && 'Completed'}
                  {a.status === 'running' && <><span className="cn3-dot"/><span className="cn3-dot cn3-dot--2"/><span className="cn3-dot cn3-dot--3"/> Progres</>}
                  {a.status === 'pending' && 'Pending'}
                  {a.status === 'failed'  && '! Failed'}
                </div>
                {i < agents.length - 1 && (
                  <div className={`cn3-connector ${agents[i].status === 'done' ? 'cn3-connector--done' : ''}`}>
                    <div className="cn3-connector__line"/>
                    <div className={`cn3-connector__dot ${agents[i].status === 'done' ? 'cn3-connector__dot--done' : ''}`}/>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="cn3-progress"><div className="cn3-progress__bar" style={{ width: `${progress}%` }}/></div>
          <p className="cn3-agents__msg">🐾 {agentMsg}</p>
        </div>
      )}

      {error && (
        <div className="cn3-error">
          <p>{error}</p>
          {mrn && <button className="cn3-btn--sm" onClick={() => { ran.current = false; void runNavigate(); }}>Retry</button>}
        </div>
      )}

      {/* ── Booking flow ── */}
      {nav && !appt && (
        <>
          <div className="cn3-decision fade-in">
            <div className="cn3-decision__head">
              <span className="cn3-decision__badge">{CARE_LABEL[nav.decision.destination] ?? nav.decision.destination}</span>
              {nav.decision.specialty && <span className="cn3-decision__spec">{nav.decision.specialty}</span>}
            </div>
            <p className="cn3-decision__text">{nav.decision.explanation}</p>
          </div>

          <div className="cn3-booking fade-in">
            <div className="cn3-booking__hd">
              <div className="cn3-booking__hd-left">
                <span className="cn3-booking__hd-icon">📅</span>
                <div><h2 className="cn3-booking__hd-title">Book Your Appointment</h2><p className="cn3-booking__hd-sub">Get the right care at the right time</p></div>
              </div>
              <div className="cn3-stepper">
                {['Select Type','Choose Provider','Pick Time','Confirm'].map((label, i) => {
                  const n = i+1; const done = step > n; const active = step === n;
                  return (
                    <div key={label} className="cn3-step">
                      <div className={`cn3-step__circle ${done ? 'cn3-step__circle--done' : active ? 'cn3-step__circle--active' : ''}`}>{done ? '✓' : n}</div>
                      <span className={`cn3-step__label ${active ? 'cn3-step__label--active' : ''}`}>{label}</span>
                      {i < 3 && <div className={`cn3-step__line ${done ? 'cn3-step__line--done' : ''}`}/>}
                    </div>
                  );
                })}
              </div>
              <div className="cn3-avail-badge">📅 Available Today</div>
            </div>

            <div className="cn3-cols">
              {/* Col 1: Visit type */}
              <div className="cn3-col">
                <h3 className="cn3-col__title">Select Visit Type</h3>
                {[
                  { key: 'TELEHEALTH',  label: 'Video Consultation', desc: 'Talk to a doctor from home',      icon: '📹' },
                  { key: 'URGENT_CARE', label: 'In-Clinic Visit',    desc: 'Visit a nearby care center',      icon: '🏥' },
                  { key: 'PCP',         label: 'Urgent Care',        desc: 'Same-day urgent evaluation',      icon: '⚡' },
                ].map(vt => (
                  <button key={vt.key} className={`cn3-vtype ${visitType === vt.key ? 'cn3-vtype--active' : ''}`} onClick={() => setVisitType(vt.key)}>
                    <span className="cn3-vtype__icon">{vt.icon}</span>
                    <div className="cn3-vtype__info"><span className="cn3-vtype__name">{vt.label}</span><span className="cn3-vtype__desc">{vt.desc}</span></div>
                    <span className={`cn3-vtype__radio ${visitType === vt.key ? 'cn3-vtype__radio--on' : ''}`}>{visitType === vt.key ? '✓' : ''}</span>
                  </button>
                ))}
              </div>

              {/* Col 2: Providers */}
              <div className="cn3-col">
                <h3 className="cn3-col__title">Choose a Provider</h3>
                {nav.top_providers.slice(0, 4).map((p, idx) => (
                  <button key={p.provider_id} className={`cn3-pcard ${provider?.provider_id === p.provider_id ? 'cn3-pcard--active' : ''}`} onClick={() => void loadSlots(p)}>
                    <div className="cn3-pcard__photo-wrap">
                      <img src={photoForId(p.provider_id)} className="cn3-pcard__photo" alt={p.name}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; if (e.currentTarget.nextSibling) (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex'; }} />
                      <div className="cn3-pcard__photo-fallback" style={{ display: 'none' }}>{initials(p.name)}</div>
                    </div>
                    <div className="cn3-pcard__info">
                      <div className="cn3-pcard__name-row">
                        <span className="cn3-pcard__name">{p.name}</span>
                        {idx === 0 && <span className="cn3-pcard__badge">Top Rated</span>}
                      </div>
                      <span className="cn3-pcard__spec">
                        {p.specialty ?? CARE_LABEL[p.destination_type] ?? p.destination_type}
                        {p.distance_km != null ? ` · ${p.distance_km.toFixed(1)} km` : ''}
                      </span>
                      <div className="cn3-pcard__stars">★★★★★</div>
                    </div>
                    <div className={`cn3-pcard__radio ${provider?.provider_id === p.provider_id ? 'cn3-pcard__radio--on' : ''}`}>
                      {provider?.provider_id === p.provider_id ? '✓' : ''}
                    </div>
                  </button>
                ))}
                {nav.top_providers.length > 4 && <button className="cn3-more-providers">View more providers →</button>}
              </div>

              {/* Col 3: Calendar */}
              <div className="cn3-col">
                <h3 className="cn3-col__title">Select Date &amp; Time</h3>
                {slotsLoading ? (
                  <div className="cn3-loading"><div className="cn3-spinner"/> Loading…</div>
                ) : !provider && slots.length === 0 ? (
                  <p className="cn3-muted">Select a provider to see times.</p>
                ) : (
                  <RealCalendar slots={slots} selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot}/>
                )}
                <button className="cn3-confirm-btn" disabled={!selectedSlot || confirming} onClick={() => void confirmBooking()}>
                  {confirming ? 'Confirming your appointment…' : 'Confirm Appointment →'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Appointment Confirmed + Route ── */}
      {appt && (
        <div className="rm-inline fade-in">
          {/* Banner */}
          <div className="rm-banner">
            <div className="rm-banner__left">
              <span className="rm-banner__icon">🎉</span>
              <div>
                <h2 className="rm-banner__title">Appointment Confirmed!</h2>
                <p className="rm-banner__sub">You're all set. Here are your appointment details and directions.</p>
              </div>
            </div>
            <span style={{ fontSize: '2.5rem', opacity: 0.35 }}>📅✓</span>
          </div>

          {/* Doctor card */}
          <div className="rm-doc-card">
            <div className="rm-doc-card__left">
              <div className="rm-doc-avatar">
                {provider && <img src={photoForId(provider.provider_id)} alt={appt.provider_name ?? ''} className="rm-doc-avatar__img" onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}/>}
                <span className="rm-doc-avatar__init">{initials(appt.provider_name ?? 'Dr')}</span>
              </div>
              <div className="rm-doc-info">
                <h3 className="rm-doc-info__name">{appt.provider_name ?? 'Your Provider'}</h3>
                {appt.specialty && <p className="rm-doc-info__spec">{appt.specialty}</p>}
                <div className="rm-doc-info__meta">
                  {appt.slot?.start_time && (
                    <span className="rm-doc-meta-item">
                      <span>📅</span>
                      <span><b>Today</b><br/>{new Date(appt.slot.start_time).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</span>
                    </span>
                  )}
                  <span className="rm-doc-meta-item">
                    <span>🕐</span>
                    <span>{appt.slot?.start_time ? new Date(appt.slot.start_time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : appt.time ?? '—'}</span>
                  </span>
                  {(appt.hospital_name || appt.provider_name) && (
                    <span className="rm-doc-meta-item"><span>📍</span><span>{appt.hospital_name ?? appt.provider_name}</span></span>
                  )}
                </div>
              </div>
            </div>
            <div className="rm-doc-card__right">
              <div className="rm-arrive-hint"><span>🕐</span> Arrive 10 minutes early</div>
              <div className="rm-doc-address">
                {appt.provider_address ?? (destPos ? `${destPos.lat.toFixed(4)}, ${destPos.lng.toFixed(4)}` : 'Address unavailable')}
              </div>
              <button className="rm-appt-details-btn">Appointment Details →</button>
            </div>
          </div>

          {/* Care Journey stepper */}
          <div className="rm-journey">
            <div className="rm-journey__header">
              <h3 className="rm-journey__title">Your Care Journey</h3>
              {routeData && (
                <div className="rm-trip-chip">
                  <span>🚗</span>
                  <span className="rm-trip-chip__text">{routeData.durationMin} min ({routeData.distanceKm} km) via {routeData.routeName}</span>
                  <span className="rm-trip-chip__traffic">● Light traffic</span>
                </div>
              )}
            </div>
            <div className="rm-stepper">
              {JOURNEY_STAGES.map((s, i) => {
                const done = i < stageIndex; const active = i === stageIndex;
                return (
                  <div key={s.key} className="rm-step-wrap">
                    <div className={`rm-step ${done?'rm-step--done':active?'rm-step--active':'rm-step--pending'}`}>
                      {done
                        ? <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="#22c55e"/><path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : active ? <span style={{fontSize:'1rem'}}>🚗</span>
                        : <div className="rm-step__ring"/>}
                    </div>
                    <span className={`rm-step__label ${active?'rm-step__label--active':''}`}>{s.label}</span>
                    {i < JOURNEY_STAGES.length-1 && (
                      <div className={`rm-connector ${done?'rm-connector--done':active?'rm-connector--active':''}`}/>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Get Route CTA */}
          {!showRoute && (
            <button className="rm-getroute-btn" onClick={startRoute}>
              📍 Get Route to Appointment
            </button>
          )}

          {/* Inline map + Route Overview */}
          {showRoute && (
            <div className="rm-main-inline fade-in">
              <div className="rm-map-panel">
                <div className="rm-view-toggle">
                  <button className={`rm-view-btn ${mapView==='map'?'rm-view-btn--active':''}`} onClick={()=>setMapView('map')}>🗺 Map View</button>
                  <button className={`rm-view-btn ${mapView==='steps'?'rm-view-btn--active':''}`} onClick={()=>setMapView('steps')}>☰ Steps</button>
                </div>

                {mapView === 'map' ? (
                  <div className="rm-map-container">
                    {/* ref callback — L.map() runs synchronously when node mounts */}
                    <div ref={mapRefCallback} className="rm-leaflet"/>

                    {geoState === 'denied'  && <div className="rm-geo-banner rm-geo-banner--warn">📍 Location access denied.</div>}
                    {geoState === 'na'      && <div className="rm-geo-banner rm-geo-banner--warn">📍 Geolocation unavailable.</div>}
                    {geoState === 'waiting' && <div className="rm-geo-banner">📍 Requesting location…</div>}

                    {routeLoading && <div className="rm-route-loading"><span className="rm-spinner"/> Calculating route…</div>}
                    {routeError   && (
                      <div className="rm-route-error">
                        {routeError}
                        <button className="rm-retry" onClick={() => { setRouteData(null); setRouteError(null); }}>Retry</button>
                      </div>
                    )}

                    <div className="rm-zoom-controls">
                      <button onClick={() => _leafletMap?.zoomIn()}>+</button>
                      <button onClick={() => _leafletMap?.zoomOut()}>−</button>
                    </div>
                    <button className="rm-recenter" onClick={() => { if (userPos) _leafletMap?.setView([userPos.lat, userPos.lng], 15); }} disabled={!userPos}>
                      ◈ Re-center
                    </button>

                    {userPos  && <div className="rm-label rm-label--user">You<br/><small>Current Location</small></div>}
                    {destPos && appt.provider_name && <div className="rm-label rm-label--dest">{appt.provider_name}</div>}
                  </div>
                ) : (
                  <div className="rm-steps-view">
                    {routeData
                      ? <><h3>Route: {routeData.routeName}</h3><p>{routeData.distanceKm} km · ~{routeData.durationMin} min</p><p className="rm-muted">Use Start Navigation to pan through the route.</p></>
                      : routeLoading ? <div><span className="rm-spinner"/> Loading…</div>
                      : <p className="rm-muted">Route unavailable.</p>}
                  </div>
                )}
              </div>

              <div className="rm-overview">
                <h3 className="rm-overview__title">Route Overview</h3>
                <div className="rm-overview__rows">
                  <div className="rm-overview__row"><span>Distance</span><strong>{routeData ? `${routeData.distanceKm} km` : routeLoading ? '…' : '—'}</strong></div>
                  <div className="rm-overview__row"><span>Estimated Time</span><strong>{routeData ? `${routeData.durationMin} min` : routeLoading ? '…' : '—'}</strong></div>
                  <div className="rm-overview__row"><span>Traffic</span><strong className="rm-overview__na">Not available</strong></div>
                </div>
                <button className="rm-nav-btn" disabled={!routeData || navActive} onClick={startNavigation}>
                  {navActive ? `Navigating… (step ${navStep + 1})` : '▶ Start Navigation'}
                </button>
                <button className="rm-share-btn" disabled={!destPos}
                  onClick={() => destPos && navigator.clipboard?.writeText(
                    `https://www.google.com/maps/dir/?api=1&destination=${destPos.lat},${destPos.lng}`
                  )}>
                  ↗ Share Directions
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="rm-footer-inline">
            <div className="rm-footer__tip">
              <span>💡</span>
              <div><strong>Helpful Tip</strong><p>Please carry your ID and insurance card. If you need to reschedule, use the appointment details.</p></div>
            </div>
            <div className="rm-footer__right">
              <span>🎧</span>
              <div><strong>Need Help?</strong><a href="mailto:support@carepath.health" className="rm-footer__support">Contact Support</a></div>
            </div>
          </div>
          <p className="rm-hipaa">🔒 Your data is secure and encrypted. HIPAA Compliant.</p>

          {onNewConversation && (
            <button className="cn3-btn--outline rm-new-assess" onClick={onNewConversation}>
              Start New Assessment
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Real Calendar ─────────────────────────────────────────────────────────────
function RealCalendar({ slots, selectedSlot, onSelectSlot }: {
  slots: Slot[]; selectedSlot: Slot | null; onSelectSlot: (s: Slot | null) => void;
}) {
  const avail = new Set(slots.map(s => { const d = new Date(s.start_time); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }));
  const today = new Date();
  const [yr, setYr] = React.useState(() => slots.length ? new Date(slots[0].start_time).getFullYear() : today.getFullYear());
  const [mo, setMo] = React.useState(() => slots.length ? new Date(slots[0].start_time).getMonth() : today.getMonth());
  const [selKey, setSelKey] = React.useState<string | null>(() => {
    if (!slots.length) return null;
    const d = new Date(slots[0].start_time); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  });
  React.useEffect(() => {
    if (slots.length && !selKey) {
      const d = new Date(slots[0].start_time);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      setSelKey(k); setYr(d.getFullYear()); setMo(d.getMonth()); onSelectSlot(slots[0]);
    }
  }, [slots, selKey, onSelectSlot]);
  const dim   = new Date(yr, mo + 1, 0).getDate();
  const fdow  = new Date(yr, mo, 1).getDay();
  const prev  = () => mo === 0 ? (setMo(11), setYr(y => y-1)) : setMo(m => m-1);
  const next  = () => mo === 11 ? (setMo(0), setYr(y => y+1)) : setMo(m => m+1);
  const dateSlots = selKey ? slots.filter(s => { const d = new Date(s.start_time); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === selKey; }) : [];
  return (
    <div className="cn3-calendar">
      <div className="cn3-cal-hd">
        <span className="cn3-cal-month">{new Date(yr, mo, 1).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span>
        <div className="cn3-cal-nav"><button onClick={prev}>‹</button><button onClick={next}>›</button></div>
      </div>
      <div className="cn3-week">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d}>{d}</span>)}</div>
      <div className="cn3-dates">
        {Array.from({length: fdow}).map((_,i) => <span key={`e${i}`}/>)}
        {Array.from({length: dim}).map((_,i) => {
          const day = i+1; const key = `${yr}-${mo}-${day}`;
          const a = avail.has(key); const sel = selKey === key;
          const isToday = today.getFullYear()===yr && today.getMonth()===mo && today.getDate()===day;
          return (
            <button key={day}
              className={['cn3-day', sel?'cn3-day--active':'', isToday&&!sel?'cn3-day--today':'', !a?'cn3-day--disabled':''].filter(Boolean).join(' ')}
              disabled={!a}
              onClick={() => {
                setSelKey(key);
                onSelectSlot(slots.find(s => { const d = new Date(s.start_time); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === key; }) ?? null);
              }}>
              {day}{a && !sel && <span className="cn3-day__dot"/>}
            </button>
          );
        })}
      </div>
      {dateSlots.length > 0 && (
        <div className="cn3-time-section">
          <p className="cn3-time-section__label">Available times</p>
          <div className="cn3-times">
            {dateSlots.map(s => {
              const t = new Date(s.start_time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
              const active = selectedSlot?.slot_id === s.slot_id;
              return <button key={s.slot_id} className={`cn3-time-chip ${active?'cn3-time-chip--active':''}`} onClick={() => onSelectSlot(s)}>{t}</button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
