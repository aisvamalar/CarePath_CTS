import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Mock data
const ACTIVE_PLAN = {
  name: 'Intensive Post-Discharge Recovery',
  day: 3,
  totalDays: 14,
  progress: 50,
};

const TODAYS_TASKS = [
  { id: '1', text: 'Evening Walk — 15 minutes light activity', done: true },
  { id: '2', text: 'Afternoon Check-in — Complete 2-minute status response in chat', done: true },
  { id: '3', text: 'Afternoon Check-in — Complete 2-minute status response in chat', done: false },
  { id: '4', text: 'Afternoon Check-in — Complete 2-minute status response in chat', done: false },
];

export default function CarePlans() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(TODAYS_TASKS);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const completedCount = tasks.filter(t => t.done).length;

  return (
    <div className="cp-plans-page">
      <div className="cp-plans-header">
        <button className="btn-ghost" onClick={() => navigate('/chat')} style={{ marginRight: 8 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 className="cp-plans-title">Care Plans</h1>
      </div>

      <div className="cp-plans-content">
        {/* Active Plan */}
        <section className="cp-plan-section">
          <div className="cp-plan-badge">
            <span className="apt-badge-dot apt-badge-dot--success" />
            ACTIVE PLAN:
          </div>

          <div className="cp-plan-card">
            <h2 className="cp-plan-card__name">{ACTIVE_PLAN.name}</h2>
            <p className="cp-plan-card__day">(Day {ACTIVE_PLAN.day} of {ACTIVE_PLAN.totalDays})</p>

            {/* Progress bar */}
            <div className="cp-plan-progress">
              <span className="cp-plan-progress__label">Progress:</span>
              <div className="cp-plan-progress__bar">
                <div className="cp-plan-progress__fill" style={{ width: `${ACTIVE_PLAN.progress}%` }} />
              </div>
              <span className="cp-plan-progress__pct">{ACTIVE_PLAN.progress}% Complete</span>
            </div>
          </div>
        </section>

        {/* Today's Tasks */}
        <section className="cp-plan-section">
          <h3 className="cp-plan-section__title">TODAY'S TASKS</h3>

          <div className="cp-tasks">
            {tasks.map(task => (
              <button
                key={task.id}
                className={`cp-task${task.done ? ' cp-task--done' : ''}`}
                onClick={() => toggleTask(task.id)}
                aria-pressed={task.done}
              >
                <div className={`cp-task__check${task.done ? ' cp-task__check--done' : ''}`}>
                  {task.done && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className={`cp-task__text${task.done ? ' cp-task__text--done' : ''}`}>
                  {task.text}
                </span>
              </button>
            ))}
          </div>

          <p className="cp-tasks__count">{completedCount} of {tasks.length} tasks completed today</p>
        </section>

        {/* Help section */}
        <section className="cp-plan-section">
          <h3 className="cp-plan-section__title">NEED HELP WITH THIS PLAN?</h3>

          <div className="cp-plan-help">
            <button className="cp-help-btn" onClick={() => navigate('/chat')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H9l-3 2.5V12H2a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
              Discuss Plan in Chat
            </button>
            <button className="cp-help-btn cp-help-btn--warn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L1 14h14L8 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M8 6v4M8 12h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Request Care Manager Call
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
