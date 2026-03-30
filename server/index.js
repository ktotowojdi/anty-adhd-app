const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

// ---- AUTO-MIGRATION from state.json ----
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

try {
  const backlogCount = db.prepare('SELECT COUNT(*) as c FROM backlog').get().c;
  if (backlogCount === 0) {
    if (fs.existsSync(STATE_FILE)) {
      console.log('[auto-migrate] Empty database detected, state.json found — running migration...');
      const migrateFromJson = require('./migrate-from-json');
      migrateFromJson(db, DATA_DIR);
    } else {
      console.log('[auto-migrate] Empty database, no state.json — seeding defaults...');
      const migrateFromJson = require('./migrate-from-json');
      migrateFromJson(db, DATA_DIR);
    }
  } else {
    console.log(`[auto-migrate] Database already populated (${backlogCount} backlog items), skipping migration`);
  }
} catch (err) {
  console.error('[auto-migrate] Migration error (non-fatal):', err.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '1mb' }));

// Health check (before static!)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Legacy: read old state.json (backward compat)
app.get('/api/state', (req, res) => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      res.json(JSON.parse(raw));
    } else {
      res.json({});
    }
  } catch (err) {
    console.error('[legacy] Error reading state.json:', err.message);
    res.json({});
  }
});

// One-time: import custom backlog from state.json (for items missed in initial migration)
app.post('/api/import-custom-backlog', (req, res) => {
  try {
    if (!fs.existsSync(STATE_FILE)) return res.json({ error: 'No state.json found' });
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const data = state.data || {};

    const customBacklog = data['adhd_custom_backlog'] || [];
    if (!Array.isArray(customBacklog) || customBacklog.length === 0) {
      return res.json({ imported: 0, message: 'No custom backlog in state.json' });
    }

    // Check which titles already exist to avoid duplicates
    const existing = new Set(
      db.prepare('SELECT title FROM backlog').all().map(r => r.title)
    );

    const insertBacklog = db.prepare(
      'INSERT INTO backlog (title, category, status, note, done) VALUES (?, ?, ?, ?, ?)'
    );

    let imported = 0;
    for (const item of customBacklog) {
      if (!item) continue;
      const title = item.title || item.text || '';
      if (!title || existing.has(title)) continue;
      const category = item.category || 'inne';
      const status = item.status || 'todo';
      const note = item.note || item.description || null;
      const done = item.done ? 1 : 0;
      insertBacklog.run(title, category, status, note, done);
      imported++;
    }

    // Also import custom daily tasks
    const insertTask = db.prepare(
      'INSERT INTO tasks (schedule_date, time_start, time_end, text, done, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const existingTasks = new Set(
      db.prepare('SELECT schedule_date || text as k FROM tasks').all().map(r => r.k)
    );

    let importedTasks = 0;
    const datePattern = /^adhd_custom_(\d{4}-\d{2}-\d{2})$/;
    for (const [key, val] of Object.entries(data)) {
      const match = key.match(datePattern);
      if (!match) continue;
      const date = match[1];
      const tasks = Array.isArray(val) ? val : [];
      tasks.forEach((task, i) => {
        if (!task) return;
        const text = task.text || task.title || '';
        if (!text || existingTasks.has(date + text)) return;
        const timeRaw = task.time || '';
        const [timeStart, timeEnd] = timeRaw.includes('-') ? timeRaw.split('-') : [timeRaw || null, null];
        const done = task.done ? 1 : 0;
        insertTask.run(date, timeStart || null, timeEnd || null, text, done, i);
        importedTasks++;
      });
    }

    // Apply done states from adhd_backlog_done
    const backlogDone = data['adhd_backlog_done'] || {};
    const allBacklog = db.prepare('SELECT id, title FROM backlog ORDER BY id ASC').all();
    // Map h_N to default items (first 26), c_N to custom items (27+)
    let doneCount = 0;
    for (const [key, val] of Object.entries(backlogDone)) {
      if (!val) continue;
      const hMatch = key.match(/^h_(\d+)$/);
      const cMatch = key.match(/^c_(\d+)$/);
      let idx;
      if (hMatch) idx = parseInt(hMatch[1]);
      else if (cMatch) idx = 26 + parseInt(cMatch[1]); // custom items start after 26 defaults
      else continue;
      if (idx < allBacklog.length) {
        db.prepare('UPDATE backlog SET done = 1, status = ? WHERE id = ?').run('done', allBacklog[idx].id);
        doneCount++;
      }
    }

    res.json({ imported, importedTasks, doneApplied: doneCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- API ROUTES ----

// === SCHEDULE ===
// IMPORTANT: /range must be BEFORE /:date to avoid being caught by param matcher
app.get('/api/schedule/range', (req, res) => {
  const { from, to } = req.query;
  const schedules = db.prepare('SELECT * FROM daily_schedules WHERE date BETWEEN ? AND ?').all(from, to);
  res.json(schedules);
});

app.get('/api/schedule/:date', (req, res) => {
  const { date } = req.params;
  const schedule = db.prepare('SELECT * FROM daily_schedules WHERE date = ?').get(date);
  const tasks = db.prepare('SELECT * FROM tasks WHERE schedule_date = ? ORDER BY time_start ASC, sort_order ASC').all(date);
  res.json({ schedule: schedule || { date, type: 'work', title: date }, tasks });
});

app.put('/api/schedule/:date', (req, res) => {
  const { date } = req.params;
  const { type, type_label, title } = req.body;
  db.prepare(`INSERT INTO daily_schedules (date, type, type_label, title)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET type=?, type_label=?, title=?`)
    .run(date, type || 'work', type_label || null, title || date, type || 'work', type_label || null, title || date);
  res.json({ ok: true });
});

// === TASKS ===
app.post('/api/tasks', (req, res) => {
  const { schedule_date, time_start, time_end, text, tags, highlight, sort_order } = req.body;
  const result = db.prepare(
    'INSERT INTO tasks (schedule_date, time_start, time_end, text, tags, highlight, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(schedule_date, time_start || null, time_end || null, text, tags || '[]', highlight || 0, sort_order || 0);
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = Object.values(fields);
  db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...vals, id);
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// === BACKLOG ===
app.get('/api/backlog', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const category = req.query.category;
  const done = req.query.done === '1' ? 1 : 0;
  const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';

  let where = 'WHERE done = ?';
  const params = [done];

  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM backlog ${where}`).get(...params).count;
  const items = db.prepare(
    `SELECT * FROM backlog ${where} ORDER BY created_at ${sort} LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  // Fetch subtasks for each item
  const subtaskStmt = db.prepare('SELECT * FROM backlog_subtasks WHERE backlog_id = ? ORDER BY sort_order ASC');
  for (const item of items) {
    item.subtasks = subtaskStmt.all(item.id);
  }

  res.json({ items, total, hasMore: offset + items.length < total, page });
});

app.post('/api/backlog', (req, res) => {
  const { title, description, category, status, note } = req.body;
  const result = db.prepare(
    'INSERT INTO backlog (title, description, category, status, note) VALUES (?, ?, ?, ?, ?)'
  ).run(title, description || null, category || 'inne', status || 'todo', note || null);
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/backlog/:id', (req, res) => {
  const { id } = req.params;
  const fields = { ...req.body };
  if (fields.done === 1) fields.completed_at = new Date().toISOString();
  if (fields.done === 0) fields.completed_at = null;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = Object.values(fields);
  db.prepare(`UPDATE backlog SET ${sets} WHERE id = ?`).run(...vals, id);
  res.json({ ok: true });
});

app.delete('/api/backlog/:id', (req, res) => {
  db.prepare('DELETE FROM backlog WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// === BACKLOG SUBTASKS ===
app.post('/api/backlog/:id/subtasks', (req, res) => {
  const { title, estimated_minutes } = req.body;
  const result = db.prepare(
    'INSERT INTO backlog_subtasks (backlog_id, title, estimated_minutes) VALUES (?, ?, ?)'
  ).run(req.params.id, title, estimated_minutes || 30);
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/backlog-subtasks/:id', (req, res) => {
  const fields = req.body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = Object.values(fields);
  db.prepare(`UPDATE backlog_subtasks SET ${sets} WHERE id = ?`).run(...vals, req.params.id);
  res.json({ ok: true });
});

app.post('/api/backlog-subtasks/:id/move-to-schedule', (req, res) => {
  const subtask = db.prepare('SELECT * FROM backlog_subtasks WHERE id = ?').get(req.params.id);
  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

  const { date, time_start } = req.body;
  const endMinutes = (subtask.estimated_minutes || 30);
  const [h, m] = (time_start || '09:00').split(':').map(Number);
  const endH = Math.floor((h * 60 + m + endMinutes) / 60);
  const endM = (h * 60 + m + endMinutes) % 60;
  const time_end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  // Create task
  const result = db.prepare(
    'INSERT INTO tasks (schedule_date, time_start, time_end, text, tags) VALUES (?, ?, ?, ?, ?)'
  ).run(date, time_start, time_end, subtask.title, '["work"]');

  // Link subtask
  db.prepare('UPDATE backlog_subtasks SET moved_to_task_id = ? WHERE id = ?').run(result.lastInsertRowid, req.params.id);

  res.json({ task_id: result.lastInsertRowid });
});

app.delete('/api/backlog-subtasks/:id', (req, res) => {
  db.prepare('DELETE FROM backlog_subtasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// === AI SUBTASK GENERATION ===
app.post('/api/backlog/:id/generate-subtasks', async (req, res) => {
  const item = db.prepare('SELECT * FROM backlog WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'Jesteś asystentem do zarządzania zadaniami. Rozpisz zadanie na mniejsze sub-taski z estymacją czasu. Odpowiedz TYLKO jako JSON array. Każdy element: {"title": "krótki opis", "estimated_minutes": N}. Estymaty: 15, 30, 60, 90, lub 120 minut. Max 6 sub-tasków. Pisz po polsku, krótko.',
        messages: [{
          role: 'user',
          content: `Rozpisz to zadanie na sub-taski:\n\nTytuł: ${item.title}\n${item.description ? `Opis: ${item.description}` : ''}`,
        }],
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('Anthropic API error:', JSON.stringify(data.error));
      return res.status(500).json({ error: data.error.message || 'API error' });
    }
    const text = data.content?.[0]?.text || '[]';
    console.log('AI response:', text.substring(0, 300));
    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    const subtasks = match ? JSON.parse(match[0]) : [];

    // Insert subtasks into DB
    const stmt = db.prepare('INSERT INTO backlog_subtasks (backlog_id, title, estimated_minutes, sort_order) VALUES (?, ?, ?, ?)');
    const inserted = [];
    subtasks.forEach((st, i) => {
      if (st.title && st.estimated_minutes) {
        const result = stmt.run(req.params.id, st.title, st.estimated_minutes, i);
        inserted.push({ id: result.lastInsertRowid, ...st });
      }
    });

    res.json({ subtasks: inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === RULES ===
app.get('/api/rules', (req, res) => {
  res.json(db.prepare('SELECT * FROM rules WHERE active = 1 ORDER BY sort_order ASC').all());
});

app.post('/api/rules', (req, res) => {
  const { text } = req.body;
  const result = db.prepare('INSERT INTO rules (text) VALUES (?)').run(text);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/rules/:id', (req, res) => {
  db.prepare('UPDATE rules SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// === PRIORITIES ===
app.get('/api/priorities', (req, res) => {
  res.json(db.prepare('SELECT * FROM priorities ORDER BY sort_order ASC').all());
});

app.post('/api/priorities', (req, res) => {
  const { tag, label } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM priorities').get().m || 0;
  const result = db.prepare('INSERT INTO priorities (tag, label, sort_order) VALUES (?, ?, ?)').run(tag, label, maxOrder + 1);
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/priorities/:id', (req, res) => {
  const fields = req.body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = Object.values(fields);
  db.prepare(`UPDATE priorities SET ${sets} WHERE id = ?`).run(...vals, req.params.id);
  res.json({ ok: true });
});

// === WARNINGS ===
app.get('/api/warnings', (req, res) => {
  res.json(db.prepare('SELECT * FROM warnings ORDER BY sort_order ASC').all());
});

app.post('/api/warnings', (req, res) => {
  const result = db.prepare('INSERT INTO warnings (text) VALUES (?)').run(req.body.text);
  res.json({ id: result.lastInsertRowid });
});

// === EXCLUSIONS ===
app.get('/api/exclusions', (req, res) => {
  res.json(db.prepare('SELECT * FROM exclusions').all());
});

app.post('/api/exclusions', (req, res) => {
  const result = db.prepare('INSERT INTO exclusions (text) VALUES (?)').run(req.body.text);
  res.json({ id: result.lastInsertRowid });
});

// === DAILY REVIEWS ===
app.get('/api/reviews/:date', (req, res) => {
  const review = db.prepare('SELECT * FROM daily_reviews WHERE date = ?').get(req.params.date);
  res.json(review || null);
});

app.post('/api/reviews', (req, res) => {
  const { date, went_well, didnt_go_well, energy_level, followed_rules, laptop_closed_on_time, notes } = req.body;
  db.prepare(`INSERT INTO daily_reviews (date, went_well, didnt_go_well, energy_level, followed_rules, laptop_closed_on_time, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET went_well=?, didnt_go_well=?, energy_level=?, followed_rules=?, laptop_closed_on_time=?, notes=?`)
    .run(date, went_well, didnt_go_well, energy_level, followed_rules, laptop_closed_on_time, notes,
         went_well, didnt_go_well, energy_level, followed_rules, laptop_closed_on_time, notes);

  // Auto-save streaks
  if (followed_rules) {
    db.prepare('INSERT OR IGNORE INTO streaks (type, date) VALUES (?, ?)').run('rules_followed', date);
  } else {
    db.prepare('DELETE FROM streaks WHERE type = ? AND date = ?').run('rules_followed', date);
  }
  if (laptop_closed_on_time) {
    db.prepare('INSERT OR IGNORE INTO streaks (type, date) VALUES (?, ?)').run('laptop_close', date);
  } else {
    db.prepare('DELETE FROM streaks WHERE type = ? AND date = ?').run('laptop_close', date);
  }

  res.json({ ok: true });
});

// === STREAKS ===
app.get('/api/streaks', (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  res.json(db.prepare('SELECT * FROM streaks WHERE date >= ? ORDER BY date DESC').all(thirtyDaysAgo));
});

// === FOCUS SESSIONS ===
app.get('/api/focus-sessions', (req, res) => {
  const { date } = req.query;
  if (date) {
    res.json(db.prepare('SELECT * FROM focus_sessions WHERE date = ? ORDER BY created_at DESC').all(date));
  } else {
    res.json(db.prepare('SELECT * FROM focus_sessions ORDER BY created_at DESC LIMIT 50').all());
  }
});

app.post('/api/focus-sessions', (req, res) => {
  const { date, task_id, duration_minutes, type, completed } = req.body;
  const result = db.prepare(
    'INSERT INTO focus_sessions (date, task_id, duration_minutes, type, completed) VALUES (?, ?, ?, ?, ?)'
  ).run(date, task_id || null, duration_minutes, type || 'work', completed ?? 1);
  res.json({ id: result.lastInsertRowid });
});

// === SETTINGS ===
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const row of rows) {
    try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
  }
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const entries = Object.entries(req.body);
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?');
  for (const [key, value] of entries) {
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    stmt.run(key, val, val);
  }
  res.json({ ok: true });
});

// ---- SERVE STATIC (production) ----
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// Legacy: serve old index.html
app.get('/legacy', (req, res) => {
  const legacyFile = path.join(__dirname, '..', 'index.html');
  res.sendFile(legacyFile);
});

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ANTY-ADHD server running on port ${PORT}`);
});
