import { useState } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';

const CATEGORIES = ['sprzedaz', 'auraic', 'marketing', 'tech', 'klienci', 'muzyka', 'finanse', 'zdrowie', 'inne'];
const STATUSES = ['todo', 'waiting', 'blocked', 'idea'];

export default function AddBacklogModal({ onClose, onAdded }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('inne');
  const [status, setStatus] = useState('todo');

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await api.post('/api/backlog', {
      title: title.trim(),
      description: description.trim() || null,
      category,
      status,
    });
    onAdded();
    onClose();
  };

  return (
    <Modal title="Dodaj do backlogu" onClose={onClose}>
      <div className="form-field">
        <label>Tytuł</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Co trzeba zrobić?" autoFocus />
      </div>
      <div className="form-field">
        <label>Opis (opcjonalnie)</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Szczegóły..." />
      </div>
      <div className="form-field">
        <label>Kategoria</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`add-tag-btn ${category === cat ? 'selected' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div className="form-field">
        <label>Status</label>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <button className="btn-primary" onClick={handleSubmit}>Dodaj</button>
    </Modal>
  );
}
