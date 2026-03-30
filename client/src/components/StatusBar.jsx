import { useState, useEffect } from 'react';

const DAYS_PL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const MONTHS_PL = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

export default function StatusBar() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = now.getHours();
  const isAfterHours = hours >= 18 || hours < 6;
  const isSaturday = now.getDay() === 6;
  const isSunday = now.getDay() === 0;
  const isWeekend = isSaturday || isSunday;

  const timeStr = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = `${DAYS_PL[now.getDay()]}, ${now.getDate()} ${MONTHS_PL[now.getMonth()]}`;

  const getWorkStatus = () => {
    if (isWeekend) return { text: 'Weekend', type: 'ok' };
    if (isAfterHours) return { text: 'Po godzinach', type: 'danger' };
    return { text: 'Czas pracy', type: 'info' };
  };

  const status = getWorkStatus();

  return (
    <div className="clock">
      <div className="time">{timeStr}</div>
      <div className="date">{dateStr}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
        <span className={`status-pill ${status.type}`}>
          <span className="status-dot" />
          {status.text}
        </span>
        {isAfterHours && !isWeekend && (
          <span className="status-pill danger">
            <span className="status-dot" />
            Po 18:00
          </span>
        )}
      </div>
    </div>
  );
}
