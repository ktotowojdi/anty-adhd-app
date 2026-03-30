import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');

  const fetchAll = async () => {
    const [r, w, e] = await Promise.all([
      api.get('/api/rules'),
      api.get('/api/warnings'),
      api.get('/api/exclusions'),
    ]);
    setRules(r);
    setWarnings(w);
    setExclusions(e);
  };

  useEffect(() => { fetchAll(); }, []);

  const addRule = async () => {
    if (!newRuleText.trim()) return;
    await api.post('/api/rules', { text: newRuleText.trim() });
    setNewRuleText('');
    setShowAddRule(false);
    fetchAll();
  };

  const deleteRule = async (id) => {
    await api.delete(`/api/rules/${id}`);
    fetchAll();
  };

  return (
    <div>
      {/* Rules */}
      <div className="section">
        <div className="section-title">
          <h2>Zasady</h2>
          <button className="btn-green btn-sm" onClick={() => setShowAddRule(true)}>+ Dodaj</button>
        </div>
        {rules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#128736;</div>
            Brak zasad
            <div className="empty-text">Dodaj pierwsza zasade, ktora pomoze Ci utrzymac fokus.</div>
          </div>
        ) : (
          <div className="rules-grid">
            {rules.map((rule, i) => (
              <div key={rule.id} className="rule-card">
                <div className="rule-num">Zasada {i + 1}</div>
                <div className="rule-text">{rule.text}</div>
                <button
                  className="btn-icon"
                  style={{ position: 'absolute', top: 8, right: 8, color: 'var(--red)', fontSize: 12 }}
                  onClick={() => deleteRule(rule.id)}
                >&times;</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>Sygnały ostrzegawcze</h2>
          </div>
          <div className="warnings-list">
            {warnings.map((w, i) => (
              <div key={w.id} className="warning-card">
                <span className="warn-num">{i + 1}</span>
                {w.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exclusions */}
      {exclusions.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>Co NIE jest w planie</h2>
          </div>
          <div className="not-in-plan">
            {exclusions.map(e => (
              <div key={e.id} className="not-item">
                <span className="x-mark">&times;</span>
                {e.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Rule Modal */}
      {showAddRule && (
        <Modal title="Dodaj zasadę" onClose={() => setShowAddRule(false)}>
          <div className="form-field">
            <label>Treść zasady</label>
            <textarea value={newRuleText} onChange={e => setNewRuleText(e.target.value)} placeholder="Np. Laptopa zamykam o 18:00" autoFocus />
          </div>
          <button className="btn-primary" onClick={addRule}>Dodaj zasadę</button>
        </Modal>
      )}
    </div>
  );
}
