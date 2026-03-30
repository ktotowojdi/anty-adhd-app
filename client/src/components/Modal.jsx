import { createPortal } from 'react-dom';

export default function Modal({ title, children, onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>&times;</button>
        {title && <div className="modal-title">{title}</div>}
        {children}
      </div>
    </div>,
    document.body
  );
}
