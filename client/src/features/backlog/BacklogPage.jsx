import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import BacklogCard from './BacklogCard';
import AddBacklogModal from './AddBacklogModal';

const CATEGORIES = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'sprzedaz', label: 'Sprzedaż' },
  { id: 'auraic', label: 'Auraic' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'tech', label: 'Tech' },
  { id: 'klienci', label: 'Klienci' },
  { id: 'muzyka', label: 'Muzyka' },
  { id: 'finanse', label: 'Finanse' },
  { id: 'zdrowie', label: 'Zdrowie' },
  { id: 'inne', label: 'Inne' },
];

const STATUS_TABS = [
  { id: 'active', label: 'Aktywne' },
  { id: 'done', label: 'Skończone' },
];

export default function BacklogPage() {
  const showToast = useAppStore(s => s.showToast);
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('all');
  const [statusTab, setStatusTab] = useState('active');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);

  const fetchBacklog = async (reset = false) => {
    const p = reset ? 1 : page;
    const params = new URLSearchParams({
      page: p,
      limit: 20,
      sort: 'newest',
      ...(category !== 'all' && { category }),
      ...(statusTab === 'done' && { done: 1 }),
    });
    const data = await api.get(`/api/backlog?${params}`);
    if (reset) {
      setItems(data.items);
      setPage(1);
    } else if (p === 1) {
      setItems(data.items);
    } else {
      setItems(prev => [...prev, ...data.items]);
    }
    setHasMore(data.hasMore);
    setTotal(data.total);
  };

  useEffect(() => {
    fetchBacklog(true);
  }, [category, statusTab]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    const params = new URLSearchParams({
      page: nextPage,
      limit: 20,
      sort: 'newest',
      ...(category !== 'all' && { category }),
      ...(statusTab === 'done' && { done: 1 }),
    });
    api.get(`/api/backlog?${params}`).then(data => {
      setItems(prev => [...prev, ...data.items]);
      setHasMore(data.hasMore);
    });
  };

  const toggleDone = async (id, currentDone) => {
    await api.patch(`/api/backlog/${id}`, { done: currentDone ? 0 : 1 });
    fetchBacklog(true);
  };

  const deleteItem = async (id) => {
    const item = items.find(i => i.id === id);
    await api.delete(`/api/backlog/${id}`);
    fetchBacklog(true);
    showToast('Element usunięty', async () => {
      await api.post('/api/backlog', item);
      fetchBacklog(true);
    });
  };

  return (
    <div>
      <div className="section-title">
        <h2>Backlog <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{total}</span></h2>
        <button className="btn-green btn-sm" onClick={() => setShowAdd(true)}>+ Dodaj</button>
      </div>

      {/* Status tabs */}
      <div className="backlog-tabs" style={{ marginBottom: 8 }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            className={`backlog-tab ${statusTab === tab.id ? 'active' : ''}`}
            onClick={() => setStatusTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="backlog-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`backlog-tab ${category === cat.id ? 'active' : ''}`}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="backlog-list">
        {items.map(item => (
          <BacklogCard
            key={item.id}
            item={item}
            onToggleDone={() => toggleDone(item.id, item.done)}
            onDelete={() => deleteItem(item.id)}
            onUpdate={() => fetchBacklog(true)}
          />
        ))}
      </div>

      {hasMore && (
        <button className="load-more-btn" onClick={loadMore}>
          Załaduj więcej...
        </button>
      )}

      {items.length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
          Brak elementów w backlogu.
        </div>
      )}

      {showAdd && (
        <AddBacklogModal
          onClose={() => setShowAdd(false)}
          onAdded={() => fetchBacklog(true)}
        />
      )}
    </div>
  );
}
