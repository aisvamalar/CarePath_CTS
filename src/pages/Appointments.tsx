/**
 * CarePath — Patient Appointments (sidebar + main layout)
 * Exact replication of reference screenshot 2.
 * Uses the same sidebar as Chat page.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useApp } from '../context/AppContext';
import { careService } from '../services/careService';
import { appointmentStore, type StoredAppointment } from '../services/appointmentStore';

const DOC_PHOTOS = [
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=56&h=56&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=56&h=56&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=56&h=56&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=56&h=56&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1638202993928-7267aad84c31?w=56&h=56&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=56&h=56&fit=crop&crop=face',
];
function docPhoto(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff; return DOC_PHOTOS[h % DOC_PHOTOS.length]; }
function initials(name: string) { return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function fmtAppt(a: StoredAppointment) {
  const d = a.slot?.start_time ? new Date(a.slot.start_time) : a.date ? new Date(a.date) : null;
  if (!d) return { month: 'TBD', day: '—', time: '—', full: '', dateObj: null };
  return { month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), day: String(d.getDate()), time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), full: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), dateObj: d };
}

export default function Appointments() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const patientId = state.patient?.patient_id ?? null;
  const patientName = state.patient?.name ?? state.patient?.username ?? 'Patient';
  const [appts, setAppts] = useState<StoredAppointment[]>([]);
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);

  const refresh = useCallback(async () => {
    const all = appointmentStore.list(patientId ?? undefined);
    setAppts(all);
    await Promise.allSettled(all.filter(a => a.status === 'BOOKED' || a.status === 'RESCHEDULED').map(async a => { try { const s = await careService.getStatus(a.appointment_id, patientId ?? undefined); appointmentStore.updateStatus(a.appointment_id, s.status); } catch {} }));
    setAppts(appointmentStore.list(patientId ?? undefined));
  }, [patientId]);
  useEffect(() => { void refresh(); return appointmentStore.subscribe(() => setAppts(appointmentStore.list(patientId ?? undefined))); }, [refresh, patientId]);

  const upcoming = appts.filter(a => a.status === 'BOOKED' || a.status === 'RESCHEDULED');
  const completed = appts.filter(a => a.status === 'COMPLETED');
  const nextAppt = upcoming[0] ?? null;
  const carePlan = state.conversations.map(c => c.safetyResult?.pathway?.care_plan ?? []).find(p => p.length > 0) ?? [];
  const activity = [
    ...upcoming.map(a => ({ icon: '✅', title: 'Appointment confirmed', sub: `Follow-up Visit with ${a.provider_name ?? 'Provider'}`, date: fmtAppt(a).full, time: fmtAppt(a).time })),
    ...state.conversations.filter(c => c.intakeFeatures?.chief_complaint).slice(0, 2).map(c => ({ icon: '💬', title: 'Chat with CarePath', sub: `Discussed ${c.intakeFeatures!.chief_complaint}`, date: new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), time: new Date(c.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) })),
  ].slice(0, 4);

  // Calendar
  const calY = calMonth.getFullYear(); const calM = calMonth.getMonth();
  const dim = new Date(calY, calM + 1, 0).getDate(); const fdow = new Date(calY, calM, 1).getDay();
  const today = new Date();
  const apptDayStatus: Record<number, string> = {};
  appts.forEach(a => { const d = a.slot?.start_time ? new Date(a.slot.start_time) : a.date ? new Date(a.date) : null; if (d && d.getFullYear() === calY && d.getMonth() === calM) apptDayStatus[d.getDate()] = a.status; });

  const handleNewChat = () => navigate('/chat');

  return (
    <div className="pa-layout">
      {/* Sidebar — same as Chat */}
      <div className={`chat-sidebar-desktop${state.sidebarOpen ? '' : ' chat-sidebar-hidden'}`}>
        <Sidebar onNewChat={handleNewChat} />
      </div>
      {sidebarDrawerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.2)', zIndex: 200 }} onClick={() => setSidebarDrawerOpen(false)}>
          <div style={{ width: 300, maxWidth: '85vw', boxShadow: '4px 0 32px rgba(0,0,0,.12)' }} onClick={e => e.stopPropagation()}>
            <Sidebar onNewChat={() => { handleNewChat(); setSidebarDrawerOpen(false); }} />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="pa-main">
        {/* Header */}
        <div className="pa-hd">
          <button className="pa-hd__menu" onClick={() => { if (window.innerWidth < 768) setSidebarDrawerOpen(v => !v); else dispatch({ type: 'TOGGLE_SIDEBAR' }); }}>☰</button>
          <div className="pa-hd__avatar">{initials(patientName)}</div>
          <div className="pa-hd__text">
            <h1>Hello, {patientName} 👋</h1>
            <p>Here's your health overview and upcoming care.</p>
          </div>
          <button className="pa-hd__chat" onClick={handleNewChat}>● New Chat</button>
        </div>

        {/* KPIs */}
        <div className="pa-kpis">
          <div className="pa-kpi"><span className="pa-kpi__ic pa-kpi__ic--coral">📅</span><div><span className="pa-kpi__label">UPCOMING APPOINTMENTS</span><span className="pa-kpi__val">{upcoming.length}</span><span className="pa-kpi__hint">Next 7 days</span></div></div>
          <div className="pa-kpi"><span className="pa-kpi__ic pa-kpi__ic--green">✅</span><div><span className="pa-kpi__label">COMPLETED</span><span className="pa-kpi__val" style={{color:'#10b981'}}>{completed.length}</span><span className="pa-kpi__hint">This month</span></div></div>
          <div className="pa-kpi"><span className="pa-kpi__ic pa-kpi__ic--amber">📋</span><div><span className="pa-kpi__label">PENDING TASKS</span><span className="pa-kpi__val" style={{color:'#e06a4f'}}>{carePlan.length}</span><span className="pa-kpi__hint">In your care plan</span></div></div>
          <div className="pa-kpi"><span className="pa-kpi__ic pa-kpi__ic--coral">❤️</span><div><span className="pa-kpi__label">HEALTH SCORE</span><span className="pa-kpi__val">78</span><span className="pa-kpi__hint">Good progress</span></div></div>
          <div className="pa-kpi"><span className="pa-kpi__ic pa-kpi__ic--purple">💊</span><div><span className="pa-kpi__label">CARE ADHERENCE</span><span className="pa-kpi__val" style={{color:'#8b5cf6'}}>82%</span><span className="pa-kpi__hint">On track</span></div></div>
        </div>

        {/* Body: appointments + calendar */}
        <div className="pa-body">
          {/* Left: Appointments list */}
          <section className="pa-section">
            <div className="pa-section__hd"><h2>Upcoming Appointments</h2><button className="pa-link">View All</button></div>
            <div className="pa-appts">
              {upcoming.slice(0, 5).map(a => {
                const d = fmtAppt(a);
                return (
                  <div key={a.appointment_id} className="pa-appt">
                    <div className="pa-appt__date"><span>{d.month}</span><b>{d.day}</b><small>{d.time}</small></div>
                    <img src={docPhoto(a.provider_id)} className="pa-appt__photo" alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <div className="pa-appt__info"><strong>{a.provider_name ?? 'Central Texas Family Medicine'}</strong><span>{a.specialty ?? a.care_type ?? 'PCP'}</span>{a.hospital_name && <span className="pa-appt__loc">{a.hospital_name}</span>}</div>
                    <span className="pa-appt__status">{a.status === 'BOOKED' ? 'Confirmed' : 'Pending'}</span>
                    <span className="pa-appt__arrow">›</span>
                  </div>
                );
              })}
              {upcoming.length === 0 && <p className="pa-empty">No upcoming appointments. Complete a chat assessment to book.</p>}
            </div>
            {/* Book CTA */}
            <div className="pa-book">
              <span>📅</span>
              <div><b>Need to reschedule or book a new appointment?</b><br /><span>Find the right time and provider for your care.</span></div>
              <button onClick={handleNewChat}>Book New Appointment</button>
            </div>
          </section>

          {/* Right: Calendar + Next Appointment */}
          <aside className="pa-aside">
            {/* Calendar */}
            <div className="pa-cal">
              <div className="pa-cal__hd">
                <button onClick={() => setCalMonth(new Date(calY, calM - 1, 1))}>‹</button>
                <span>{calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setCalMonth(new Date(calY, calM + 1, 1))}>›</button>
              </div>
              <div className="pa-cal__week">{['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => <span key={d}>{d}</span>)}</div>
              <div className="pa-cal__grid">
                {Array.from({ length: fdow }).map((_, i) => <span key={`e${i}`} />)}
                {Array.from({ length: dim }).map((_, i) => {
                  const day = i + 1;
                  const isToday = today.getFullYear() === calY && today.getMonth() === calM && today.getDate() === day;
                  const st = apptDayStatus[day];
                  return <span key={day} className={['pa-cal__day', isToday ? 'pa-cal__day--today' : '', st ? 'pa-cal__day--dot' : ''].filter(Boolean).join(' ')}>{day}{st && <i />}</span>;
                })}
              </div>
              <div className="pa-cal__legend"><span><i className="pa-dot--green" />Confirmed</span><span><i className="pa-dot--amber" />Pending</span><span><i className="pa-dot--coral" />Completed</span></div>
            </div>

            {/* Next Appointment */}
            {nextAppt && (
              <div className="pa-next">
                <div className="pa-next__hd"><b>Next Appointment</b><span>ID: {nextAppt.appointment_id.slice(0, 12)}</span></div>
                <div className="pa-next__body">
                  <div className="pa-appt__date pa-appt__date--big"><span>{fmtAppt(nextAppt).month}</span><b>{fmtAppt(nextAppt).day}</b></div>
                  <div className="pa-next__info">
                    <strong>Follow-up Visit</strong>
                    <span className="pa-next__confirmed">Confirmed</span>
                    <span>📅 {fmtAppt(nextAppt).full} &nbsp; {fmtAppt(nextAppt).time}</span>
                    <span>👨‍⚕️ {nextAppt.provider_name ?? 'Your Provider'}</span>
                    {nextAppt.hospital_name && <span>🏥 {nextAppt.hospital_name}</span>}
                  </div>
                </div>
                <button className="pa-next__btn">View Details</button>
              </div>
            )}
          </aside>
        </div>

        {/* Bottom: Care Plan + Activity + Quick Actions */}
        <div className="pa-bottom">
          <section className="pa-section pa-section--sm">
            <div className="pa-section__hd"><h2>Your Care Plan</h2><button className="pa-link" onClick={() => navigate('/care-plans')}>View Plan</button></div>
            {(carePlan.length > 0 ? carePlan : [{ title: 'Take blood pressure medication', description: 'Daily · Before breakfast' }, { title: 'Complete physiotherapy exercises', description: '3 sessions this week' }, { title: 'Follow low-sodium diet', description: 'Daily' }]).slice(0, 3).map((t, i) => (
              <div key={i} className="pa-task"><span className="pa-task__icon">{['💊','🏃','🥗'][i]}</span><div><b>{t.title}</b><br /><span>{t.description}</span></div><span className="pa-task__check">{i === 0 ? '✓' : '○'}</span></div>
            ))}
          </section>
          <section className="pa-section pa-section--sm">
            <div className="pa-section__hd"><h2>Recent Activity</h2><button className="pa-link">View All</button></div>
            {activity.map((a, i) => (
              <div key={i} className="pa-act"><span className="pa-act__dot" style={{background: a.icon === '✅' ? '#10b981' : '#e06a4f'}} /><div><b>{a.title}</b><br /><span>{a.sub}</span></div><div className="pa-act__time"><span>{a.date}</span><span>{a.time}</span></div></div>
            ))}
          </section>
          <section className="pa-section pa-section--sm">
            <h2 style={{marginBottom:12}}>Quick Actions</h2>
            <div className="pa-qas">
              <button className="pa-qa" onClick={handleNewChat}><span>🔍</span><b>Find a Doctor</b><small>Search specialists</small></button>
              <button className="pa-qa" onClick={handleNewChat}><span>📅</span><b>Book Appointment</b><small>Schedule a visit</small></button>
              <button className="pa-qa"><span>📤</span><b>Upload Reports</b><small>Share your files</small></button>
              <button className="pa-qa" onClick={() => navigate('/profile')}><span>📋</span><b>Health Records</b><small>View your history</small></button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
