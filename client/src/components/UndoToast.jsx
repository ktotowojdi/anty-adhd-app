import { useAppStore } from '../stores/appStore';

export default function UndoToast() {
  const toast = useAppStore(s => s.toast);
  const hideToast = useAppStore(s => s.hideToast);

  if (!toast) return null;

  const handleUndo = () => {
    if (toast.onUndo) toast.onUndo();
    hideToast();
  };

  return (
    <div className="undo-toast">
      <span>{toast.message}</span>
      {toast.onUndo && (
        <button className="btn-green" onClick={handleUndo}>Cofnij</button>
      )}
    </div>
  );
}
