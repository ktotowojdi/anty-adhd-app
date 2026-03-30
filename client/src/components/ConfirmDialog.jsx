import Modal from './Modal';

export default function ConfirmDialog({ icon, title, description, onConfirm, onCancel, confirmText = 'Usuń', danger = true }) {
  return (
    <Modal onClose={onCancel}>
      <div style={{ textAlign: 'center' }}>
        {icon && <div className="confirm-icon">{icon}</div>}
        <div className="confirm-title">{title}</div>
        <div className="confirm-desc">{description}</div>
        <div className="confirm-btns">
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Anuluj</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} style={{ flex: 1 }} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
