import { useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import Modal from '../../components/Modal';

export default function BacklogCard({ item, onToggleDone, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const [subtaskMinutes, setSubtaskMinutes] = useState(30);
  const [showMoveModal, setShowMoveModal] = useState(null);
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [editSubtaskText, setEditSubtaskText] = useState('');
  const [editSubtaskMinutes, setEditSubtaskMinutes] = useState(30);
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split('T')[0]);
  const [moveTime, setMoveTime] = useState('09:00');
  const [editingItem, setEditingItem] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDesc, setEditDesc] = useState(item.description || '');
  const [editCategory, setEditCategory] = useState(item.category);
  const [editStatus, setEditStatus] = useState(item.status);

  const [generating, setGenerating] = useState(false);

  const subtasks = item.subtasks || [];

  const generateSubtasks = async () => {
    setGenerating(true);
    try {
      await api.post(`/api/backlog/${item.id}/generate-subtasks`);
      onUpdate();
    } catch (err) {
      console.error('AI generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const saveItemEdit = async () => {
    await api.patch(`/api/backlog/${item.id}`, {
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      category: editCategory,
      status: editStatus,
    });
    setEditingItem(false);
    onUpdate();
  };

  const addSubtask = async () => {
    if (!subtaskText.trim()) return;
    await api.post(`/api/backlog/${item.id}/subtasks`, {
      title: subtaskText.trim(),
      estimated_minutes: subtaskMinutes,
    });
    setSubtaskText('');
    setShowSubtaskForm(false);
    onUpdate();
  };

  const deleteSubtask = async (subtaskId) => {
    await api.delete(`/api/backlog-subtasks/${subtaskId}`);
    onUpdate();
  };

  const startEditSubtask = (st) => {
    setEditingSubtask(st.id);
    setEditSubtaskText(st.title);
    setEditSubtaskMinutes(st.estimated_minutes || 30);
  };

  const saveEditSubtask = async () => {
    if (!editSubtaskText.trim()) return;
    await api.patch(`/api/backlog-subtasks/${editingSubtask}`, {
      title: editSubtaskText.trim(),
      estimated_minutes: editSubtaskMinutes,
    });
    setEditingSubtask(null);
    onUpdate();
  };

  const toggleSubtask = async (subtaskId, done) => {
    await api.patch(`/api/backlog-subtasks/${subtaskId}`, { done: done ? 0 : 1 });
    onUpdate();
  };

  const moveSubtaskToSchedule = async (subtaskId) => {
    await api.post(`/api/backlog-subtasks/${subtaskId}/move-to-schedule`, {
      date: moveDate,
      time_start: moveTime,
    });
    setShowMoveModal(null);
    onUpdate();
  };

  const doneSubtasks = subtasks.filter(s => s.done).length;
  const totalMinutes = subtasks.reduce((acc, s) => acc + (s.estimated_minutes || 0), 0);

  return (
    <div className={`backlog-card cat-${item.category} ${item.done ? 'backlog-done' : ''}`}>
      <div className="backlog-actions">
        <button className="btn-icon" style={{ color: 'var(--text-dim)' }} onClick={() => setEditingItem(true)} title="Edytuj">&#9998;</button>
        <button className="done-btn" onClick={onToggleDone} title={item.done ? 'Przywróć' : 'Gotowe'}>
          {item.done ? '↩' : '✓'}
        </button>
        <button className="del-btn" onClick={onDelete} title="Usuń">&times;</button>
      </div>

      <div className="backlog-title" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        {item.title}
      </div>

      {item.description && <div className="backlog-desc">{item.description}</div>}

      <div className="backlog-meta">
        <span className={`backlog-badge status-${item.status}`}>{item.status}</span>
        {subtasks.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {doneSubtasks}/{subtasks.length} sub-tasków · {totalMinutes} min
          </span>
        )}
      </div>

      {item.note && <div className="backlog-note">{item.note}</div>}

      {/* Sub-tasks — always visible when not done */}
      {!item.done && (
        <div className="subtask-list">
          {subtasks.map(st => (
            editingSubtask === st.id ? (
              <div key={st.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' }}
                  value={editSubtaskText}
                  onChange={e => setEditSubtaskText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEditSubtask()}
                  autoFocus
                />
                <select
                  value={editSubtaskMinutes}
                  onChange={e => setEditSubtaskMinutes(Number(e.target.value))}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' }}
                >
                  <option value={15}>15m</option>
                  <option value={30}>30m</option>
                  <option value={60}>1h</option>
                  <option value={90}>1.5h</option>
                  <option value={120}>2h</option>
                </select>
                <button className="btn-green btn-sm" onClick={saveEditSubtask}>✓</button>
                <button className="btn-ghost btn-sm" onClick={() => setEditingSubtask(null)}>&times;</button>
              </div>
            ) : (
              <div key={st.id} className={`subtask-item ${st.done ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!st.done}
                  onChange={() => toggleSubtask(st.id, st.done)}
                  style={{ accentColor: 'var(--green)', cursor: 'pointer' }}
                />
                <span className="subtask-time">{st.estimated_minutes}m</span>
                <span className="subtask-text">{st.title}</span>
                {!st.done && !st.moved_to_task_id && (
                  <button className="move-to-schedule-btn" onClick={() => setShowMoveModal(st.id)}>→ Plan</button>
                )}
                {st.moved_to_task_id && (
                  <span style={{ fontSize: 10, color: 'var(--green)' }}>✓ w planie</span>
                )}
                <button className="btn-icon" style={{ color: 'var(--text-dim)', fontSize: 12 }} onClick={() => startEditSubtask(st)} title="Edytuj">&#9998;</button>
                <button className="btn-icon" style={{ color: 'var(--red)', fontSize: 12 }} onClick={() => deleteSubtask(st.id)} title="Usuń">&times;</button>
              </div>
            )
          ))}

          {!item.done && (
            showSubtaskForm ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' }}
                  placeholder="Nazwa sub-taska"
                  value={subtaskText}
                  onChange={e => setSubtaskText(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && addSubtask()}
                />
                <select
                  value={subtaskMinutes}
                  onChange={e => setSubtaskMinutes(Number(e.target.value))}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' }}
                >
                  <option value={15}>15m</option>
                  <option value={30}>30m</option>
                  <option value={60}>1h</option>
                  <option value={90}>1.5h</option>
                  <option value={120}>2h</option>
                </select>
                <button className="btn-green btn-sm" onClick={addSubtask}>+</button>
                <button className="btn-ghost btn-sm" onClick={() => setShowSubtaskForm(false)}>&times;</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button className="btn-link" onClick={() => setShowSubtaskForm(true)}>
                  + Dodaj sub-task
                </button>
                <button
                  className="btn-link"
                  style={{ color: 'var(--accent)' }}
                  onClick={generateSubtasks}
                  disabled={generating}
                >
                  {generating ? 'Generuję...' : '◎ AI rozpisz'}
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Move to schedule modal */}
      {showMoveModal && (
        <Modal title="Przenieś na plan dnia" onClose={() => setShowMoveModal(null)}>
          <div className="form-field">
            <label>Dzień</label>
            <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Godzina rozpoczęcia</label>
            <input type="time" value={moveTime} onChange={e => setMoveTime(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => moveSubtaskToSchedule(showMoveModal)}>
            Przenieś na plan
          </button>
        </Modal>
      )}

      {/* Edit backlog item modal */}
      {editingItem && (
        <Modal title="Edytuj zadanie" onClose={() => setEditingItem(false)}>
          <div className="form-field">
            <label>Tytuł</label>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Opis</label>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Kategoria</label>
            <select value={editCategory} onChange={e => setEditCategory(e.target.value)}>
              {['sprzedaz', 'auraic', 'marketing', 'tech', 'klienci', 'muzyka', 'finanse', 'zdrowie', 'inne'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Status</label>
            <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
              {['todo', 'waiting', 'blocked', 'idea'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={saveItemEdit}>Zapisz</button>
        </Modal>
      )}
    </div>
  );
}
