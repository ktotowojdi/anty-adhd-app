import { useState } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';

export default function TaskRow({ task, isToday, onToggle, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editTime, setEditTime] = useState(task.time_start || '');
  const [editTimeEnd, setEditTimeEnd] = useState(task.time_end || '');

  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const isCurrentSlot = isToday && task.time_start && (() => {
    const [h, m] = task.time_start.split(':').map(Number);
    const endParts = task.time_end ? task.time_end.split(':').map(Number) : [h + 1, m];
    const startMin = h * 60 + m;
    const endMin = endParts[0] * 60 + endParts[1];
    const nowMin = currentHour * 60 + currentMin;
    return nowMin >= startMin && nowMin < endMin;
  })();

  const tags = (() => {
    try { return JSON.parse(task.tags || '[]'); } catch { return []; }
  })();

  const timeStr = task.time_start
    ? `${task.time_start}${task.time_end ? ' – ' + task.time_end : ''}`
    : 'Cały dzień';

  const handleSave = async () => {
    await api.patch(`/api/tasks/${task.id}`, {
      text: editText,
      time_start: editTime || null,
      time_end: editTimeEnd || null,
    });
    setEditing(false);
    onEdit();
  };

  return (
    <>
      <tr className={[
        task.done && 'done-row',
        isCurrentSlot && 'current-slot',
      ].filter(Boolean).join(' ')}>
        <td className="task-check">
          <input type="checkbox" checked={!!task.done} onChange={onToggle} />
        </td>
        <td className="time-col">{timeStr}</td>
        <td className="task-col">
          <span className={task.highlight ? 'highlight' : ''}>{task.text}</span>
          {tags.map(tag => (
            <span key={tag} className={`tag-badge ${tag}`}>{tag}</span>
          ))}
        </td>
        <td className="task-actions">
          <button className="btn-icon" style={{ color: 'var(--text-dim)' }} onClick={() => setEditing(true)} title="Edytuj">&#9998;</button>
          <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={onDelete} title="Usuń">&times;</button>
        </td>
      </tr>

      {editing && (
        <Modal title="Edytuj zadanie" onClose={() => setEditing(false)}>
          <div className="form-field">
            <label>Treść</label>
            <input value={editText} onChange={e => setEditText(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label>Od</label>
              <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label>Do</label>
              <input type="time" value={editTimeEnd} onChange={e => setEditTimeEnd(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary" onClick={handleSave}>Zapisz</button>
        </Modal>
      )}
    </>
  );
}
