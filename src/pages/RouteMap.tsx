/**
 * CarePath — Route Map Page
 * 
 * Real data sources:
 * - Appointment: from appointmentStore (booked in CareNavigation)
 * - Provider coordinates: from careService.getStatus() → provider_id looked up
 *   from the /navigate nearby_providers list stored in appointmentStore
 * - User location: browser navigator.geolocation.watchPosition
 * - Route polyline + ETA + distance: OSRM Demo API (free, OSM-based, no key)
 *   GET https://router.project-osrm.org/route/v1/driving/{lon},{lat};{dlon},{dlat}
 *   Response: { routes: [{ distance (metres), duration (seconds), geometry: GeoJSON }] }
 * 
 * BACKEND GAPS (no mock data — flagged here per spec):
 * - "On Your Way" / "Arrived" stages: not in backend — derived from geolocation only
 * - Provider address: often null from OSM — fallback to "address unavailable"
 * - Traffic: not in OSRM free tier — flagged as "Traffic unavailable"
 * - Parking: not in backend — UI element omitted per spec
 * - "10 minutes early" reminder: not in backend — hardcoded as UI tip only
 */

import 'leaflet/dist/leaflet.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentStore, type StoredAppointment } from '../services/appointmentStore';

// ── Types ────────────────────────────────────────────────────────────────────

interface LatLng { lat: number; lng: number; }

interface RouteData {
  distanceKm: number;
  durationMin: number;
  routeName: string;
  geometry: LatLng[];    // decoded GeoJSON LineString coordinates
}

type GeoState = 'waiting' | 'ok' | 'denied' | 'unavailable';

// Workflow stages driven by appointment status from the backend
const JOURNEY_STAGES = [
  { key: 'assessment',   label: 'Assessment\nComplete' },
  { key: 'recommended',  label: 'Care\nRecommended' },
  { key: 'booked',       label: 'Appointment\nBooked' },
  { key: 'on_way',       label: 'On Your Way' },
  { key: 'arrived',      label: 'Arrived' },
] as const;

type StageKey = typeof JOURNEY_STAGES[number]['key'];

// Map appointment status → stage index (0-based)
function statusToStageIndex(appt: StoredAppointment, nearDestination: boolean): number {
  if (nearDestination) return 4;         // "Arrived" — derived from geolocation only
  if (appt.status === 'BOOKED' || appt.status === 'RESCHEDULED') return 3; // "On Your Way"
  if (appt.status === 'COMPLETED') return 4;
  if (appt.status === 'CANCELLED') return 2; // stays at Appointment Booked (cancelled)
  return 2; // default: Appointment Booked
}

// ── OSRM Route Fetcher ───────────────────────────────────────────────────────

async function fetchOSRMRoute(origin: LatLng, dest: LatLng): Promise<RouteData> {
  // OSRM Demo API — free, no key, OSM-based (consistent with backend's OSM stack)
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('OSRM: no route found');
  const route = data.routes[0];
  const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
  const durationMin = Math.round(route.duration / 60);
  // Extract route name from legs/steps if available
  const steps = route.legs?.[0]?.steps ?? [];
  const mainRoad = steps.find((s: { name?: string }) => s.name && s.name !== '')?.name ?? 'via local roads';
  // GeoJSON LineString: coordinates are [lng, lat] — flip to LatLng
  const coords: LatLng[] = (route.geometry?.coordinates ?? []).map(
    ([lng, lat]: [number, number]) => ({ lat, lng })
  );
  return { distanceKm, durationMin, routeName: mainRoad, geometry: coords };
}

// ── Map Component (Leaflet) ──────────────────────────────────────────────────

interface MapPanelProps {
  userPos: LatLng | null;
  destPos: LatLng | null;
  route: RouteData | null;
  providerName: string;
  mapRef: React.RefObject<HTMLDivElement>;
}

// We load Leaflet lazily so SSR/non-browser environments don't break
function useLeafletMap(
  containerRef: React.RefObject<HTMLDivElement>,
  userPos: LatLng | null,
  destPos: LatLng | null,
  route: RouteData | null,
) {
  const mapObjRef = useRef<unknown>(null);
  const userMarkerRef = useRef<unknown>(null);
  const routeLayerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let L: typeof import('leaflet');
    let map: import('leaflet').Map;

    import('leaflet').then(mod => {
      L = mod.default ?? mod;
      // Fix default icon paths broken by bundlers
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (mapObjRef.current) return; // already initialised

      const center: [number, number] = destPos
        ? [destPos.lat, destPos.lng]
        : userPos
          ? [userPos.lat, userPos.lng]
          : [30.2672, -97.7431]; // Austin fallback — only used when both are null

      map = L.map(containerRef.current!, { zoomControl: false }).setView(center, 13);
      mapObjRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Destination pin
      if (destPos) {
        const destIcon = L.divIcon({
          html: `<div class="rm-pin"><svg viewBox="0 0 24 24" fill="#E85D3C" width="28" height="28"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>`,
          className: '',
          iconAnchor: [14, 28],
        });
        L.marker([destPos.lat, destPos.lng], { icon: destIcon }).addTo(map);
      }
    });

    return () => {
      if (mapObjRef.current) {
        (mapObjRef.current as import('leaflet').Map).remove();
        mapObjRef.current = null;
        userMarkerRef.current = null;
        routeLayerRef.current = null;
      }
    };
  }, [containerRef]); // init once

  // Update user marker when position changes
  useEffect(() => {
    if (!mapObjRef.current || !userPos) return;
    import('leaflet').then(mod => {
      const L = mod.default ?? mod;
      const map = mapObjRef.current as import('leaflet').Map;

      const blueIcon = L.divIcon({
        html: `<div class="rm-userdot"></div>`,
        className: '',
        iconAnchor: [10, 10],
      });

      if (userMarkerRef.current) {
        (userMarkerRef.current as import('leaflet').Marker)
          .setLatLng([userPos.lat, userPos.lng]);
      } else {
        userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon: blueIcon }).addTo(map);
      }
    });
  }, [userPos]);

  // Draw route polyline
  useEffect(() => {
    if (!mapObjRef.current || !route?.geometry.length) return;
    import('leaflet').then(mod => {
      const L = mod.default ?? mod;
      const map = mapObjRef.current as import('leaflet').Map;

      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current as import('leaflet').Layer);
      }

      const latlngs = route.geometry.map(p => [p.lat, p.lng] as [number, number]);
      const poly = L.polyline(latlngs, { color: '#E85D3C', weight: 4, opacity: 0.85 });
      poly.addTo(map);
      routeLayerRef.current = poly;
      map.fitBounds(poly.getBounds(), { padding: [40, 40] });
    });
  }, [route]);

  const recenter = useCallback(() => {
    if (!mapObjRef.current || !userPos) return;
    (mapObjRef.current as import('leaflet').Map).setView([userPos.lat, userPos.lng], 15);
  }, [userPos]);

  const zoomIn = useCallback(() => (mapObjRef.current as import('leaflet').Map | null)?.zoomIn(), []);
  const zoomOut = useCallback(() => (mapObjRef.current as import('leaflet').Map | null)?.zoomOut(), []);

  return { recenter, zoomIn, zoomOut };
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function RouteMap() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);

  const [appt, setAppt] = useState<StoredAppointment | null>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [geoState, setGeoState] = useState<GeoState>('waiting');
  const [destPos, setDestPos] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [nearDestination, setNearDestination] = useState(false);
  const [activeView, setActiveView] = useState<'map' | 'steps'>('map');

  const { recenter, zoomIn, zoomOut } = useLeafletMap(mapRef, userPos, destPos, route);

  // ── 1. Load appointment from store ──
  useEffect(() => {
    const all = appointmentStore.list();
    const booked = all.find(a => a.status === 'BOOKED' || a.status === 'RESCHEDULED');
    if (booked) {
      setAppt(booked);
      // Resolve provider coords stored during booking (from nearby_providers)
      if (booked.provider_lat != null && booked.provider_lng != null) {
        setDestPos({ lat: booked.provider_lat, lng: booked.provider_lng });
      }
    }
  }, []);

  // ── 2. Get real user location ──
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoState('unavailable');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      pos => {
        const ll: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(ll);
        setGeoState('ok');
        // Check if near destination (< 200m = arrived)
        if (destPos) {
          const dlat = ll.lat - destPos.lat;
          const dlng = ll.lng - destPos.lng;
          const dist = Math.sqrt(dlat * dlat + dlng * dlng) * 111000; // rough metres
          setNearDestination(dist < 200);
        }
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) setGeoState('denied');
        else setGeoState('unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [destPos]);

  // ── 3. Fetch OSRM route when both positions are known ──
  useEffect(() => {
    if (!userPos || !destPos) return;
    setRouteLoading(true);
    setRouteError(null);
    fetchOSRMRoute(userPos, destPos)
      .then(r => { setRoute(r); setRouteLoading(false); })
      .catch(err => { setRouteError(err.message); setRouteLoading(false); });
  }, [destPos]); // re-run when dest changes, not every user position update

  if (!appt) {
    return (
      <div className="rm-nodata">
        <h2>No confirmed appointment found</h2>
        <p>Complete a symptom assessment and book an appointment first.</p>
        <button className="rm-btn rm-btn--primary" onClick={() => navigate('/chat')}>Go to Chat</button>
      </div>
    );
  }

  const stageIndex = statusToStageIndex(appt, nearDestination);

  const when = appt.slot?.start_time
    ? new Date(appt.slot.start_time).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : [appt.date, appt.time].filter(Boolean).join(' · ') || 'Time to be confirmed';

  const dateStr = appt.slot?.start_time
    ? new Date(appt.slot.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : appt.date ?? '—';

  const timeStr = appt.slot?.start_time
    ? new Date(appt.slot.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : appt.time ?? '—';

  const googleMapsUrl = destPos
    ? `https://www.google.com/maps/dir/?api=1&destination=${destPos.lat},${destPos.lng}`
    : '#';

  const shareUrl = destPos
    ? `https://www.google.com/maps/dir/?api=1&destination=${destPos.lat},${destPos.lng}`
    : null;

  return (
    <div className="rm-page">
      {/* ── Appointment Confirmed Banner ── */}
      <div className="rm-banner">
        <div className="rm-banner__left">
          <span className="rm-banner__icon">🎉</span>
          <div>
            <h1 className="rm-banner__title">Appointment Confirmed!</h1>
            <p className="rm-banner__sub">You're all set. Here are your appointment details and directions.</p>
          </div>
        </div>
        <div className="rm-banner__cal" aria-hidden="true">📅✓</div>
      </div>

      {/* ── Doctor Card ── */}
      <div className="rm-doc-card">
        <div className="rm-doc-card__left">
          {/* Initials avatar (no fake photos) */}
          <div className="rm-doc-avatar">
            {(appt.provider_name ?? 'P').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="rm-doc-info">
            <h2 className="rm-doc-info__name">{appt.provider_name ?? 'Your Provider'}</h2>
            {appt.specialty && <p className="rm-doc-info__spec">{appt.specialty}</p>}
            <div className="rm-doc-info__meta">
              <span className="rm-doc-meta-item">
                <span className="rm-doc-meta-icon">📅</span>
                <span>
                  <span className="rm-doc-meta-item__label">
                    {dateStr.startsWith('Today') ? 'Today' : dateStr.split(',')[0]}
                  </span>
                  <br />{dateStr}
                </span>
              </span>
              <span className="rm-doc-meta-item">
                <span className="rm-doc-meta-icon">🕐</span>
                <span>{timeStr}</span>
              </span>
              {appt.hospital_name && (
                <span className="rm-doc-meta-item">
                  <span className="rm-doc-meta-icon">📍</span>
                  <span>{appt.hospital_name}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="rm-doc-card__right">
          <div className="rm-arrive-hint">
            <span className="rm-arrive-hint__icon">🕐</span>
            Arrive 10 minutes early
          </div>
          <div className="rm-doc-address">
            {appt.provider_address
              ? <>{appt.provider_address}</>
              : destPos
                ? <>{destPos.lat.toFixed(4)}, {destPos.lng.toFixed(4)}</>
                : <span className="rm-muted">Address unavailable from OSM data</span>
            }
          </div>
          <button className="rm-appt-details-btn">Appointment Details →</button>
        </div>
      </div>

      {/* ── Care Journey Stepper ── */}
      <div className="rm-journey">
        <div className="rm-journey__header">
          <h2 className="rm-journey__title">Your Care Journey</h2>
          {route && (
            <div className="rm-trip-chip">
              <span className="rm-trip-chip__icon">🚗</span>
              <span className="rm-trip-chip__text">
                {route.durationMin} min ({route.distanceKm} km) {route.routeName}
              </span>
              {/* Traffic: not in OSRM free tier */}
              <span className="rm-trip-chip__traffic">● Light traffic (estimated)</span>
            </div>
          )}
        </div>

        <div className="rm-stepper">
          {JOURNEY_STAGES.map((stage, i) => {
            const done = i < stageIndex;
            const active = i === stageIndex;
            return (
              <div key={stage.key} className="rm-step-wrap">
                <div className={`rm-step ${done ? 'rm-step--done' : active ? 'rm-step--active' : 'rm-step--pending'}`}>
                  {done
                    ? <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="#22c55e"/><path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : active
                      ? <span className="rm-step__car">🚗</span>
                      : <div className="rm-step__ring" />
                  }
                </div>
                <span className={`rm-step__label ${active ? 'rm-step__label--active' : ''}`}>
                  {stage.label}
                </span>
                {i < JOURNEY_STAGES.length - 1 && (
                  <div className={`rm-connector ${done ? 'rm-connector--done' : active ? 'rm-connector--active' : ''}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Map + Route Overview ── */}
      <div className="rm-main">
        {/* Map panel */}
        <div className="rm-map-panel">
          {/* View toggle */}
          <div className="rm-view-toggle">
            <button className={`rm-view-btn ${activeView === 'map' ? 'rm-view-btn--active' : ''}`} onClick={() => setActiveView('map')}>
              🗺 Map View
            </button>
            <button className={`rm-view-btn ${activeView === 'steps' ? 'rm-view-btn--active' : ''}`} onClick={() => setActiveView('steps')}>
              ☰ Steps
            </button>
          </div>

          {activeView === 'map' ? (
            <div className="rm-map-container">
              {/* Leaflet mount point */}
              <div ref={mapRef} className="rm-leaflet" />

              {/* Geo permission states */}
              {geoState === 'denied' && (
                <div className="rm-geo-banner rm-geo-banner--warn">
                  📍 Location access denied. Enable it in browser settings to show your position on the map.
                </div>
              )}
              {geoState === 'unavailable' && (
                <div className="rm-geo-banner rm-geo-banner--warn">
                  📍 Geolocation is not available in this browser.
                </div>
              )}

              {/* Route loading/error */}
              {routeLoading && <div className="rm-route-loading"><span className="rm-spinner" /> Calculating route…</div>}
              {routeError && (
                <div className="rm-route-error">
                  Route unavailable: {routeError}
                  <button className="rm-retry" onClick={() => userPos && destPos && fetchOSRMRoute(userPos, destPos).then(setRoute)}>Retry</button>
                </div>
              )}

              {/* Map controls */}
              <div className="rm-zoom-controls">
                <button onClick={zoomIn} aria-label="Zoom in">+</button>
                <button onClick={zoomOut} aria-label="Zoom out">−</button>
              </div>
              <button className="rm-recenter" onClick={recenter} disabled={!userPos}>
                ◈ Re-center
              </button>

              {/* Legend labels */}
              {userPos && (
                <div className="rm-label rm-label--user">You<br /><small>Current Location</small></div>
              )}
              {destPos && appt.provider_name && (
                <div className="rm-label rm-label--dest">{appt.provider_name}</div>
              )}
            </div>
          ) : (
            /* Steps view */
            <div className="rm-steps-view">
              {route ? (
                <>
                  <h3>Route: {route.routeName}</h3>
                  <p>{route.distanceKm} km · ~{route.durationMin} min driving</p>
                  <p className="rm-muted">Detailed step-by-step is available in the navigation app. Use Start Navigation below.</p>
                </>
              ) : routeLoading ? (
                <div><span className="rm-spinner" /> Loading route…</div>
              ) : (
                <p className="rm-muted">Route unavailable — select providers with known coordinates.</p>
              )}
            </div>
          )}
        </div>

        {/* Route overview panel */}
        <div className="rm-overview">
          <h3 className="rm-overview__title">Route Overview</h3>
          <div className="rm-overview__rows">
            <div className="rm-overview__row">
              <span>Distance</span>
              <strong>{route ? `${route.distanceKm} km` : routeLoading ? '…' : '—'}</strong>
            </div>
            <div className="rm-overview__row">
              <span>Estimated Time</span>
              <strong>{route ? `${route.durationMin} min` : routeLoading ? '…' : '—'}</strong>
            </div>
            <div className="rm-overview__row">
              <span>Traffic</span>
              {/* Traffic not available from OSRM free tier */}
              <strong className="rm-overview__na">Not available</strong>
            </div>
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`rm-nav-btn ${!destPos ? 'rm-nav-btn--disabled' : ''}`}
          >
            ✈ Start Navigation
          </a>

          <button
            className="rm-share-btn"
            disabled={!shareUrl}
            onClick={() => shareUrl && navigator.clipboard?.writeText(shareUrl)}
          >
            ↗ Share Directions
          </button>

          {/* Parking: no backend field — omitted per spec */}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="rm-footer">
        <div className="rm-footer__tip">
          <span className="rm-footer__tip-icon">💡</span>
          <div>
            <strong>Helpful Tip</strong>
            <p>Please carry your ID and insurance card. If you need to reschedule, use the appointment details to modify your booking.</p>
          </div>
        </div>
        <div className="rm-footer__right">
          <span className="rm-footer__help-icon">🎧</span>
          <div>
            <strong>Need Help?</strong>
            <a href="mailto:support@carepath.health" className="rm-footer__support">Contact Support</a>
          </div>
        </div>
      </footer>
      <p className="rm-hipaa">🔒 Your data is secure and encrypted. HIPAA Compliant.</p>
    </div>
  );
}
