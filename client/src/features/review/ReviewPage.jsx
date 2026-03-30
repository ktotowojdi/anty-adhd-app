import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { format, subDays, parseISO } from 'date-fns';

export default function ReviewPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [wentWell, setWentWell] = useState('');
  const [didntGoWell, setDidntGoWell] = useState('');
  const [energyLevel, setEnergyLevel] = useState(3);
  const [followedRules, setFollowedRules] = useState(true);
  const [laptopClosed, setLaptopClosed] = useState(true);
  const [notes, setNotes] = useState('');
  const [streaks, setStreaks] = useState([]);
  const [saved, setSaved] = useState(false); // true = review exists in DB, show read mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchReview = async () => {
    try {
      const data = await api.get(`/api/reviews/${selectedDate}`);
      if (data) {
        setWentWell(data.went_well || '');
        setDidntGoWell(data.didnt_go_well || '');
        setEnergyLevel(data.energy_level || 3);
        setFollowedRules(!!data.followed_rules);
        setLaptopClosed(!!data.laptop_closed_on_time);
        setNotes(data.notes || '');
        setSaved(true);
        setEditing(false);
      } else {
        resetForm();
      }
    } catch {
      resetForm();
    }
  };

  const fetchStreaks = async () => {
    try { setStreaks(await api.get('/api/streaks')); } catch {}
  };

  const resetForm = () => {
    setWentWell('');
    setDidntGoWell('');
    setEnergyLevel(3);
    setFollowedRules(true);
    setLaptopClosed(true);
    setNotes('');
    setSaved(false);
    setEditing(false);
  };

  useEffect(() => { fetchReview(); fetchStreaks(); }, [selectedDate]);

  const saveReview = async () => {
    setSaving(true);
    await api.post('/api/reviews', {
      date: selectedDate,
      went_well: wentWell,
      didnt_go_well: didntGoWell,
      energy_level: energyLevel,
      followed_rules: followedRules ? 1 : 0,
      laptop_closed_on_time: laptopClosed ? 1 : 0,
      notes,
    });
    setSaving(false);
    setSaved(true);
    setEditing(false);
    fetchStreaks();
  };

  const recentDays = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));

  const streaksByType = {};
  streaks.forEach(s => {
    if (!streaksByType[s.type]) streaksByType[s.type] = 0;
    streaksByType[s.type]++;
  });

  const showForm = !saved || editing;

  return (
    <div>
      {/* Streak summary */}
      <div className="section">
        <div className="section-title">
          <h2>Streaki</h2>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { type: 'laptop_close', label: 'Laptop o czasie', icon: '◻' },
            { type: 'rules_followed', label: 'Zasady', icon: '◈' },
            { type: 'exercise', label: 'Ruch', icon: '▲' },
          ].map(({ type, label, icon }) => (
            <div key={type} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '12px 16px',
              flex: 1,
              minWidth: 120,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 20 }}>{icon}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: streaksByType[type] ? 'var(--green)' : 'var(--text-muted)' }}>
                {streaksByType[type] || 0}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>

        <div className="streak-grid" style={{ maxWidth: 200, marginBottom: 20 }}>
          {Array.from({ length: 28 }, (_, i) => {
            const date = format(subDays(new Date(), 27 - i), 'yyyy-MM-dd');
            const dayStreaks = streaks.filter(s => s.date === date);
            const level = Math.min(dayStreaks.length, 4);
            return (
              <div
                key={date}
                className={`streak-cell ${level ? `level-${level}` : ''}`}
                title={`${date}: ${level} aktywności`}
              />
            );
          })}
        </div>
      </div>

      {/* Day selector */}
      <div className="section">
        <div className="section-title">
          <h2>Daily Review</h2>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
          {recentDays.map(d => (
            <button
              key={d}
              className={`day-btn ${d === selectedDate ? 'active' : ''} ${d === today ? 'today' : ''}`}
              onClick={() => setSelectedDate(d)}
            >
              {format(parseISO(d), 'dd.MM')}
            </button>
          ))}
        </div>

        {/* Saved review — read mode */}
        {saved && !editing && (
          <div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 16, marginBottom: 12 }}>
              {wentWell && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--green)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Co poszło dobrze</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{wentWell}</div>
                </div>
              )}
              {didntGoWell && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--red)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Co mogło pójść lepiej</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{didntGoWell}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: notes ? 12 : 0 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Energia: <strong style={{ color: 'var(--text)' }}>{energyLevel}/5</strong></span>
                <span style={{ fontSize: 11, color: followedRules ? 'var(--green)' : 'var(--red)' }}>
                  {followedRules ? '✓ Zasady OK' : '✕ Zasady złamane'}
                </span>
                <span style={{ fontSize: 11, color: laptopClosed ? 'var(--green)' : 'var(--red)' }}>
                  {laptopClosed ? '✓ Laptop OK' : '✕ Laptop po czasie'}
                </span>
              </div>
              {notes && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Notatki</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{notes}</div>
                </div>
              )}
            </div>
            <button className="btn-ghost" style={{ width: '100%' }} onClick={() => setEditing(true)}>Edytuj review</button>
          </div>
        )}

        {/* Form — new or editing */}
        {showForm && (
          <div>
            <div className="form-field">
              <label>Co poszło dobrze?</label>
              <textarea value={wentWell} onChange={e => setWentWell(e.target.value)} placeholder="Zrobiłem X, udało mi się Y..." />
            </div>

            <div className="form-field">
              <label>Co mogło pójść lepiej?</label>
              <textarea value={didntGoWell} onChange={e => setDidntGoWell(e.target.value)} placeholder="Nie zamknąłem laptopa na czas, rozproszył mnie X..." />
            </div>

            <div className="form-field">
              <label>Poziom energii (1-5)</label>
              <div className="energy-selector">
                {[1, 2, 3, 4, 5].map(level => (
                  <button
                    key={level}
                    className={`energy-btn ${energyLevel === level ? 'active' : ''}`}
                    onClick={() => setEnergyLevel(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)' }}>
                <input type="checkbox" checked={followedRules} onChange={e => setFollowedRules(e.target.checked)} />
                Przestrzegałem zasad
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)' }}>
                <input type="checkbox" checked={laptopClosed} onChange={e => setLaptopClosed(e.target.checked)} />
                Laptop zamknięty na czas
              </label>
            </div>

            <div className="form-field">
              <label>Notatki</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Dodatkowe myśli..." />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={saveReview} disabled={saving}>
                {saving ? 'Zapisuję...' : 'Zapisz review'}
              </button>
              {editing && (
                <button className="btn-ghost" onClick={() => { setEditing(false); fetchReview(); }}>Anuluj</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
