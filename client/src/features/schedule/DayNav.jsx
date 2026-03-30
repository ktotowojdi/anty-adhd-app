import { useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { format, startOfWeek, addDays, isSameDay, isBefore, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function DayNav() {
  const selectedDate = useAppStore(s => s.selectedDate);
  const setSelectedDate = useAppStore(s => s.setSelectedDate);

  const today = new Date();
  const selected = parseISO(selectedDate);

  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart.toISOString()]
  );

  const goWeek = (delta) => {
    const newDate = addDays(selected, delta * 7);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button className="day-btn" onClick={() => goWeek(-1)}>&larr;</button>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, flex: 1, textAlign: 'center' }}>
          {format(weekStart, 'd MMM', { locale: pl })} — {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: pl })}
        </span>
        <button className="day-btn" onClick={() => goWeek(1)}>&rarr;</button>
        <button
          className="day-btn"
          style={{ fontSize: 10, padding: '4px 8px' }}
          onClick={() => setSelectedDate(format(today, 'yyyy-MM-dd'))}
        >
          Dziś
        </button>
      </div>
      <div className="day-nav" style={{ display: 'flex', width: '100%' }}>
        {weekDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isToday = isSameDay(day, today);
          const isPast = isBefore(day, today) && !isToday;
          const isActive = dateStr === selectedDate;
          const dayOfWeek = day.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          return (
            <button
              key={dateStr}
              className={[
                'day-btn',
                isActive && 'active',
                isToday && 'today',
                isPast && 'past',
                isWeekend && 'free',
              ].filter(Boolean).join(' ')}
              style={{ flex: 1, textAlign: 'center' }}
              onClick={() => setSelectedDate(dateStr)}
            >
              {format(day, 'EEE d', { locale: pl })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
