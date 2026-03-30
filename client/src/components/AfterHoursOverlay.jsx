import { useState, useEffect } from 'react';

export default function AfterHoursOverlay() {
  const [now, setNow] = useState(new Date());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const hours = now.getHours();
  const isAfterHours = hours >= 18 || hours < 6;
  const isSaturday = now.getDay() === 6;
  const isSunday = now.getDay() === 0;

  // After-hours banner
  const showBanner = isAfterHours && !isSaturday && !isSunday;

  // Saturday/Sunday overlay
  const showWeekendOverlay = (isSaturday || isSunday) && !dismissed;

  return (
    <>
      {showBanner && (
        <div className="after-hours-banner visible">
          Zamknij laptopa. Jest po 18:00.
        </div>
      )}
      {showWeekendOverlay && (
        <div className="saturday-overlay visible">
          <h2>{isSaturday ? 'Sobota' : 'Niedziela'}</h2>
          <p>
            Dzisiaj nie pracujesz. Zero laptopa, zero Claude Code, zero "jeszcze tylko jedno zadanie".
            Idź na spacer, poczytaj książkę, spędź czas z bliskimi.
          </p>
          <button className="dismiss-btn" onClick={() => setDismissed(true)}>
            Rozumiem, zamykam
          </button>
        </div>
      )}
    </>
  );
}
