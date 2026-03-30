import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ title, children, onClose }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
        <button className="modal-close" onClick={onClose} aria-label="Zamknij">&times;</button>
        {title && <div className="modal-title">{title}</div>}
        {children}
      </div>
    </div>,
    document.body
  );
}
