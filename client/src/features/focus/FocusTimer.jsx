import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { format } from 'date-fns';

const PRESETS = [
  { label: '25 min', work: 25, break: 5 },
  { label: '50 min', work: 50, break: 10 },
  { label: '15 min', work: 15, break: 3 },
];

export default function FocusTimer() {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [seconds, setSeconds] = useState(PRESETS[0].work * 60);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('work'); // 'work' | 'break'
  const [sessions, setSessions] = useState([]);
  const intervalRef = useRef(null);

  const fetchSessions = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const data = await api.get(`/api/focus-sessions?date=${today}`);
      setSessions(data);
    } catch {}
  };

  useEffect(() => { fetchSessions(); }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            handlePhaseEnd();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, phase]);

  const handlePhaseEnd = async () => {
    setRunning(false);

    if (phase === 'work') {
      // Save focus session
      await api.post('/api/focus-sessions', {
        date: format(new Date(), 'yyyy-MM-dd'),
        duration_minutes: preset.work,
        type: 'work',
        completed: 1,
      });
      fetchSessions();

      // Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Czas na przerwę!', { body: `${preset.break} minut odpoczynku.` });
      }

      // Switch to break
      setPhase('break');
      setSeconds(preset.break * 60);
    } else {
      // Break ended
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Przerwa skończona!', { body: 'Czas na kolejną sesję fokusa.' });
      }
      setPhase('work');
      setSeconds(preset.work * 60);
    }
  };

  const toggle = () => {
    if (!running && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setRunning(!running);
  };

  const reset = () => {
    setRunning(false);
    clearInterval(intervalRef.current);
    setPhase('work');
    setSeconds(preset.work * 60);
  };

  const selectPreset = (p) => {
    setPreset(p);
    setRunning(false);
    clearInterval(intervalRef.current);
    setPhase('work');
    setSeconds(p.work * 60);
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const totalWorkMinutes = sessions.filter(s => s.type === 'work').reduce((acc, s) => acc + s.duration_minutes, 0);

  return (
    <div>
      <div className="section">
        <div className="section-title">
          <h2>Focus Timer</h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {totalWorkMinutes} min dziś
          </span>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              className={`day-btn ${preset === p ? 'active' : ''}`}
              onClick={() => selectPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Timer display */}
        <div className="timer-display" style={{ color: phase === 'break' ? 'var(--green)' : 'var(--text)' }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>

        <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 12, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase' }}>
          {phase === 'work' ? 'Fokus' : 'Przerwa'}
        </div>

        {/* Controls */}
        <div className="timer-controls">
          <button className={running ? 'btn-danger' : 'btn-primary'} style={{ width: 120 }} onClick={toggle}>
            {running ? 'Pauza' : 'Start'}
          </button>
          <button className="btn-ghost" style={{ width: 120 }} onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      {/* Today's sessions */}
      {sessions.length > 0 && (
        <div className="section" style={{ marginTop: 24 }}>
          <div className="section-title">
            <h2>Dzisiejsze sesje</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sessions.map((s, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 12,
              }}>
                <span style={{ color: s.type === 'work' ? 'var(--blue)' : 'var(--green)', fontWeight: 600 }}>
                  {s.type === 'work' ? '●' : '○'}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>{s.duration_minutes} min</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {s.created_at ? format(new Date(s.created_at), 'HH:mm') : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
