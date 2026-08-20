import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Mock data — will be replaced with real API calls
const PENDING_APPOINTMENTS = [
  {
    id: '1',
    title: 'Cardiology Follow-Up Visit',
    date: 'Aug 24, 2026, 10:00 AM',
    purpose: 'Post-discharge BP & medication review',
    location: 'Cenior Ave Dosa, Road, Therapy Ra/w, 0 300',
    recommended: true,
  },
];

const CONFIRMED_APPOINTMENTS = [
  { id: '2', title: 'Cardiology Follow-Up Visit', date: 'Aug 24, 2026, 10:00 AM', status: 'confirmed' },
  { id: '3', title: 'Cardiology Follow-Up', date: 'Aug 28, 2026, 2:00 PM', status: 'confirmed' },
];

export default function Appointments() {
  const navigate = useNavigate();
  const [pendingList, setPendingList] = useState(PENDING_APPOINTMENTS);

  const handleAccept = (id: string) => {
    setPendingList(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="apt-page">
      <div className="apt-header">
        <button className="btn-ghost" onClick={() => navigate('/chat')} style={{ marginRight: 8 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 className="apt-title">Appointments</h1>
      </div>

      <div className="apt-content">
        {/* Action Required */}
        {pendingList.length > 0 && (
          <section className="apt-section">
            <div className="apt-section__badge apt-section__badge--warn">
              <span className="apt-badge-dot apt-badge-dot--warn" />
              ACTION REQUIRED: RECOMMENDED BY CARE TEAM
            </div>

            {pendingList.map(apt => (
              <div key={apt.id} className="apt-card apt-card--pending">
                <h3 className="apt-card__title">{apt.title}</h3>
                <p className="apt-card__date">({apt.date})</p>
                <div className="apt-card__detail">
                  <span className="apt-card__label">Purpose:</span> {apt.purpose}
                </div>
                <div className="apt-card__detail">
                  <span className="apt-card__label">Location:</span> {apt.location}
                </div>

                <div className="apt-card__actions">
                  <button className="apt-btn apt-btn--primary" onClick={() => handleAccept(apt.id)}>
                    Accept & Book
                  </button>
                  <button className="apt-btn apt-btn--outline">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    Reschedule
                  </button>
                  <button className="apt-btn apt-btn--ghost">Decline</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Confirmed */}
        <section className="apt-section">
          <div className="apt-section__badge apt-section__badge--success">
            <span className="apt-badge-dot apt-badge-dot--success" />
            CONFIRMED APPOINTMENTS
          </div>

          <div className="apt-list">
            {CONFIRMED_APPOINTMENTS.map(apt => (
              <div key={apt.id} className="apt-confirmed-card">
                <div className="apt-confirmed-card__check">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--cp-coral)" fillOpacity="0.1" stroke="var(--cp-coral)" strokeWidth="1.5"/>
                    <path d="M4.5 8L7 10.5L11.5 5.5" stroke="var(--cp-coral)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="apt-confirmed-card__title">{apt.title}</p>
                  <p className="apt-confirmed-card__date">{apt.date}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
