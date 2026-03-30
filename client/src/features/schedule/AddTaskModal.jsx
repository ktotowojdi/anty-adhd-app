import { useState } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';

const TAG_OPTIONS = ['sales', 'work', 'personal', 'stop'];

export default function AddTaskModal({ date, onClose, onAdded }) {
  const [text, setText] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [highlight, setHighlight] = useState(false);

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    await api.post('/api/tasks', {
      schedule_date: date,
      text: text.trim(),
      time_start: allDay ? null : timeStart || null,
      time_end: allDay ? null : timeEnd || null,
      tags: JSON.stringify(selectedTags),
      highlight: highlight ? 1 : 0,
    });
    onAdded();
    onClose();
  };

  return (
    <Modal title="Dodaj zadanie" onClose={onClose}>
      <div className="form-field">
        <label>Treść zadania</label>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Co chcesz zrobić?"
          autoFocus
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)' }}>
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
          Cały dzień
        </label>
      </div>

      {!allDay && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Od</label>
            <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Do</label>
            <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} />
          </div>
        </div>
      )}

      <div className="form-field">
        <label>Tagi</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TAG_OPTIONS.map(tag => (
            <button
              key={tag}
              type="button"
              className={`add-tag-btn ${selectedTags.includes(tag) ? 'selected' : ''}`}
              onClick={() => toggleTag(tag)}
              style={selectedTags.includes(tag) ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-dim)' } : {}}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)' }}>
          <input type="checkbox" checked={highlight} onChange={e => setHighlight(e.target.checked)} />
          Priorytetowe (podświetlone)
        </label>
      </div>

      <button className="btn-primary" onClick={handleSubmit}>Dodaj zadanie</button>
    </Modal>
  );
}
