import { useState, useEffect, useRef, useCallback } from 'react';
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

const STATUS_FILTERS = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'todo', label: 'Todo' },
  { id: 'waiting', label: 'Czekające' },
  { id: 'blocked', label: 'Zablokowane' },
  { id: 'idea', label: 'Pomysły' },
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Najnowsze' },
  { id: 'oldest', label: 'Najstarsze' },
  { id: 'alpha', label: 'A → Z' },
];

export default function BacklogPage() {
  const showToast = useAppStore(s => s.showToast);
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('all');
  const [doneTab, setDoneTab] = useState('active');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const debounceRef = useRef(null);

  const buildParams = useCallback((p = 1) => {
    const params = new URLSearchParams({
      page: p,
      limit: 20,
      sort: sortBy,
      ...(category !== 'all' && { category }),
      ...(doneTab === 'done' && { done: 1 }),
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(searchQuery && { search: searchQuery }),
    });
    return params;
  }, [category, doneTab, statusFilter, sortBy, searchQuery]);

  const fetchBacklog = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    const data = await api.get(`/api/backlog?${buildParams(p)}`);
    if (reset) {
      setItems(data.items);
      setPage(1);
    } else {
      setItems(prev => [...prev, ...data.items]);
    }
    setHasMore(data.hasMore);
    setTotal(data.total);
  }, [buildParams, page]);

  useEffect(() => {
    fetchBacklog(true);
  }, [category, doneTab, statusFilter, sortBy, searchQuery]);

  // Debounced search
  const handleSearchChange = (value) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value), 300);
  };

  const loadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    const data = await api.get(`/api/backlog?${buildParams(nextPage)}`);
    setItems(prev => [...prev, ...data.items]);
    setHasMore(data.hasMore);
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

      {/* Search bar */}
      <div style={{ marginBottom: 12 }}>
        <input
          className="search-input"
          type="text"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Szukaj w backlogu..."
        />
      </div>

      {/* Sort + Done tabs row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="backlog-tabs" style={{ marginBottom: 0 }}>
          <button className={`backlog-tab ${doneTab === 'active' ? 'active' : ''}`} onClick={() => setDoneTab('active')}>Aktywne</button>
          <button className={`backlog-tab ${doneTab === 'done' ? 'active' : ''}`} onClick={() => setDoneTab('done')}>Skończone</button>
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            marginLeft: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-dim)',
            padding: '6px 12px',
            borderRadius: 4,
            fontSize: 11,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Category tabs */}
      <div className="backlog-tabs" style={{ marginBottom: 8 }}>
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

      {/* Status filter */}
      {doneTab === 'active' && (
        <div className="backlog-tabs" style={{ marginBottom: 12 }}>
          {STATUS_FILTERS.map(sf => (
            <button
              key={sf.id}
              className={`backlog-tab ${statusFilter === sf.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(sf.id)}
              style={statusFilter === sf.id ? {} : { borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              {sf.label}
            </button>
          ))}
        </div>
      )}

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
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32, fontSize: 12 }}>
          {searchQuery ? `Brak wyników dla "${searchQuery}"` : 'Brak elementów w backlogu'}
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
