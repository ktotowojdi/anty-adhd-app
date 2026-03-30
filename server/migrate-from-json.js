/**
 * Migration script: import data from old state.json (v1) into SQLite
 * Can be run standalone: node server/migrate-from-json.js
 * Also called automatically by server/index.js on first boot
 *
 * state.json keys:
 *   adhd_checked_YYYY-MM-DD   -> boolean map of checked tasks
 *   adhd_hidden_YYYY-MM-DD    -> boolean map of hidden tasks
 *   adhd_custom_YYYY-MM-DD    -> JSON array of custom tasks [{text, time?, done?}]
 *   adhd_custom_backlog        -> custom backlog items
 *   adhd_backlog_done          -> done backlog items {key: true}
 *   adhd_backlog_hidden        -> hidden backlog items
 *   adhd_priorities            -> priority states
 *   adhd_checklist             -> checklist states
 */
const fs = require('fs');
const path = require('path');

/**
 * Run migration from state.json into the given db instance.
 * @param {import('better-sqlite3').Database} db
 * @param {string} [dataDir] - override DATA_DIR (for testing)
 * @returns {{ migrated: boolean, stats: object }}
 */
function migrateFromJson(db, dataDir) {
  const DATA_DIR = dataDir || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
  const STATE_FILE = path.join(DATA_DIR, 'state.json');

  // ---- GUARD: skip if DB already has backlog data ----
  const backlogCount = db.prepare('SELECT COUNT(*) as c FROM backlog').get().c;
  if (backlogCount > 0) {
    console.log(`[migrate] Database already has ${backlogCount} backlog items, skipping migration`);
    return { migrated: false, stats: { existing: backlogCount } };
  }

  // ---- LOAD state.json ----
  let state = { data: {} };
  let hasStateFile = false;
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      hasStateFile = true;
      console.log(`[migrate] Loaded state.json (version ${state.version}, updated ${state.updatedAt})`);
    } else {
      console.log('[migrate] No state.json found, seeding with defaults only');
    }
  } catch (err) {
    console.error(`[migrate] Error reading state.json: ${err.message}`);
    console.log('[migrate] Proceeding with defaults only');
  }

  const data = state.data || {};
  const stats = { rules: 0, warnings: 0, priorities: 0, backlog: 0, customTasks: 0, checkedTasks: 0 };

  // Wrap everything in a transaction for atomicity
  const migrate = db.transaction(() => {

    // ---- SEED DEFAULT RULES ----
    const defaultRules = [
      'Laptop zamkniety o 18:00 — wieczory dla Gosi, ksiazek, odpoczynku',
      'Sobota = WOLNE (zero laptopa, zero Claude Code, zero pracy)',
      'Sen do 23:00 (nie wpadaj w pulapke "jeszcze jedno zadanie")',
      'Codzienny ruch: 45 min (spacer/silownia/bieganie)',
      'Nie dodawaj nowych projektow — zapisz pomysl, wroc po urlopie',
    ];
    const insertRule = db.prepare('INSERT OR IGNORE INTO rules (text, sort_order) VALUES (?, ?)');
    defaultRules.forEach((text, i) => { insertRule.run(text, i); stats.rules++; });

    // ---- SEED DEFAULT WARNINGS ----
    const defaultWarnings = [
      'Pulapka "jeszcze jedno zadanie" po 18:00 — to ADHD, nie produktywnosc',
      'Sobotnie rozpraszanie sie Claude Code — zamknij laptopa',
      'Scope creep — nie dodawaj nowych projektow przed wyjazdem',
      'Pamietaj: robisz duzo. Nie musisz robic wiecej.',
      'Rabbit hole alert — zamknij Claude Code, idz na spacer',
    ];
    const insertWarning = db.prepare('INSERT OR IGNORE INTO warnings (text, sort_order) VALUES (?, ?)');
    defaultWarnings.forEach((text, i) => { insertWarning.run(text, i); stats.warnings++; });

    // ---- SEED DEFAULT PRIORITIES ----
    const defaultPriorities = [
      { tag: 'P1', label: 'Sprzedaz — spotkania z klientami + follow-up' },
      { tag: 'P2', label: 'Formularz intake na stronie Auraic' },
      { tag: 'P3', label: 'Aktywny outreach — cold mail + demo' },
      { tag: 'P4', label: 'Rozliczenie rodzicow — deadline koniec miesiaca' },
    ];
    const insertPriority = db.prepare('INSERT OR IGNORE INTO priorities (tag, label, sort_order) VALUES (?, ?, ?)');
    defaultPriorities.forEach((p, i) => { insertPriority.run(p.tag, p.label, i); stats.priorities++; });

    // ---- SEED DEFAULT BACKLOG ----
    const defaultBacklog = [
      { category: 'sprzedaz', title: 'Follow-up VoltForce/KarlLoft', status: 'waiting', note: 'Krzysztof — czekamy na decyzje' },
      { category: 'sprzedaz', title: 'Follow-up Hanna Urbanska', status: 'waiting', note: 'Demo gotowe, czeka na feedback' },
      { category: 'sprzedaz', title: 'Nowi klienci — cold mailing', status: 'todo', note: 'Instantly kampania w przygotowaniu' },
      { category: 'sprzedaz', title: 'Sales funnel — intake form', status: 'todo' },
      { category: 'auraic', title: 'SEO strony Auraic', status: 'todo' },
      { category: 'auraic', title: 'Google Business Profile — weryfikacja', status: 'waiting', note: 'Zgloszenie 25.03, sprawdzic ~01.04' },
      { category: 'auraic', title: 'LinkedIn profil Auraic', status: 'idea' },
      { category: 'marketing', title: 'Instantly cold email campaign', status: 'todo', note: 'Domena + warmup 14 dni' },
      { category: 'marketing', title: 'Instagram DM outreach', status: 'idea' },
      { category: 'marketing', title: 'Reels automation', status: 'idea' },
      { category: 'marketing', title: 'Konkurs IG — 7000 PLN', status: 'todo', note: 'Do 10.04, wyniki do 14.04' },
      { category: 'tech', title: 'n8n workflows setup', status: 'todo' },
      { category: 'tech', title: 'OpenRouter API integration', status: 'idea' },
      { category: 'tech', title: 'Flota-app features', status: 'todo' },
      { category: 'tech', title: 'CRM leads — improvements', status: 'todo' },
      { category: 'tech', title: 'Voice agent Retell AI', status: 'todo' },
      { category: 'inne', title: 'Useme — Szkola muzyczna w Afryce', status: 'waiting', note: 'Klient cieply, 100 kart .doc -> baza' },
      { category: 'inne', title: 'Together App — updates', status: 'idea' },
      { category: 'inne', title: 'Ciociagosia.pl — updates', status: 'idea' },
      { category: 'inne', title: 'SpeakUp — English coach', status: 'idea' },
      { category: 'inne', title: 'Trace Ostrosc — premiera', status: 'done' },
      { category: 'inne', title: 'Rozliczenie rodzicow', status: 'todo', note: 'Deadline koniec miesiaca' },
      { category: 'inne', title: 'Sports Bet AI — maintenance', status: 'todo' },
      { category: 'inne', title: 'Oferta koncertowa Wojdi', status: 'idea' },
      { category: 'inne', title: 'Polymarket Paper Trader', status: 'todo' },
      { category: 'inne', title: 'Otodom MVP (Lokum)', status: 'done' },
    ];

    const insertBacklog = db.prepare(
      'INSERT INTO backlog (title, category, status, note, done) VALUES (?, ?, ?, ?, ?)'
    );

    // Build a map of backlog items by a simple key for marking done/hidden from state.json
    const backlogKeyMap = {};
    for (let i = 0; i < defaultBacklog.length; i++) {
      const item = defaultBacklog[i];
      const done = item.status === 'done' ? 1 : 0;
      insertBacklog.run(item.title, item.category, item.status, item.note || null, done);
      backlogKeyMap[`h_${i}`] = i + 1; // SQLite rowid starts at 1
      stats.backlog++;
    }

    // ---- IMPORT FROM state.json: adhd_backlog_done ----
    const backlogDone = data['adhd_backlog_done'] || {};
    let backlogDoneCount = 0;
    for (const [key, val] of Object.entries(backlogDone)) {
      if (val && backlogKeyMap[key]) {
        db.prepare('UPDATE backlog SET done = 1, status = ? WHERE id = ?').run('done', backlogKeyMap[key]);
        backlogDoneCount++;
      }
    }
    if (backlogDoneCount > 0) {
      console.log(`[migrate] Marked ${backlogDoneCount} backlog items as done from state.json`);
    }

    // ---- IMPORT FROM state.json: adhd_backlog_hidden ----
    const backlogHidden = data['adhd_backlog_hidden'] || {};
    let backlogHiddenCount = 0;
    for (const [key, val] of Object.entries(backlogHidden)) {
      if (val && backlogKeyMap[key]) {
        // Mark hidden items as done (archived)
        db.prepare('UPDATE backlog SET done = 1, status = ? WHERE id = ?').run('hidden', backlogKeyMap[key]);
        backlogHiddenCount++;
      }
    }
    if (backlogHiddenCount > 0) {
      console.log(`[migrate] Marked ${backlogHiddenCount} backlog items as hidden from state.json`);
    }

    // ---- IMPORT FROM state.json: adhd_custom_YYYY-MM-DD -> tasks ----
    const insertTask = db.prepare(
      'INSERT INTO tasks (schedule_date, time_start, time_end, text, done, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const customTaskKeys = Object.keys(data).filter(k => k.startsWith('adhd_custom_'));
    // Exclude non-date keys like adhd_custom_backlog
    const datePattern = /^adhd_custom_(\d{4}-\d{2}-\d{2})$/;

    for (const key of customTaskKeys) {
      const match = key.match(datePattern);
      if (!match) continue;

      const date = match[1];
      let customTasks;
      try {
        customTasks = typeof data[key] === 'string' ? JSON.parse(data[key]) : data[key];
      } catch {
        console.warn(`[migrate] Could not parse ${key}, skipping`);
        continue;
      }

      if (!Array.isArray(customTasks)) continue;

      customTasks.forEach((task, i) => {
        if (!task) return;
        const text = typeof task === 'string' ? task : (task.text || task.title || '');
        if (!text) return;
        const timeStart = task.time || task.time_start || null;
        const timeEnd = task.time_end || null;
        const done = task.done ? 1 : 0;
        insertTask.run(date, timeStart, timeEnd, text, done, i);
        stats.customTasks++;
      });
    }

    // ---- IMPORT FROM state.json: adhd_checked_YYYY-MM-DD -> mark tasks as done ----
    const checkedKeys = Object.keys(data).filter(k => k.startsWith('adhd_checked_'));
    const checkedDatePattern = /^adhd_checked_(\d{4}-\d{2}-\d{2})$/;

    for (const key of checkedKeys) {
      const match = key.match(checkedDatePattern);
      if (!match) continue;

      const date = match[1];
      const checkedMap = data[key];
      if (!checkedMap || typeof checkedMap !== 'object') continue;

      // checkedMap keys are task identifiers — try matching by sort_order or text
      for (const [taskKey, isChecked] of Object.entries(checkedMap)) {
        if (!isChecked) continue;
        // taskKey format varies: could be index-based (e.g. "0", "1") or text-based
        const idx = parseInt(taskKey, 10);
        if (!isNaN(idx)) {
          // Index-based: mark the task at that sort_order for this date
          db.prepare(
            'UPDATE tasks SET done = 1 WHERE schedule_date = ? AND sort_order = ?'
          ).run(date, idx);
        } else {
          // Text-based: try matching by text content
          db.prepare(
            'UPDATE tasks SET done = 1 WHERE schedule_date = ? AND text = ?'
          ).run(date, taskKey);
        }
        stats.checkedTasks++;
      }
    }

    // ---- SEED DEFAULT SETTINGS ----
    const defaultSettings = {
      work_start: '09:00',
      work_end: '18:00',
      free_days: [6, 0],
      pomodoro_work: 25,
      pomodoro_break: 5,
      onboarding_done: false,
    };
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(defaultSettings)) {
      insertSetting.run(key, JSON.stringify(value));
    }

  }); // end transaction

  migrate();

  console.log(`[migrate] === Migration complete ===`);
  console.log(`[migrate] Seeded: ${stats.rules} rules, ${stats.warnings} warnings, ${stats.priorities} priorities`);
  console.log(`[migrate] Seeded: ${stats.backlog} backlog items`);
  console.log(`[migrate] Imported from state.json: ${stats.customTasks} custom tasks, ${stats.checkedTasks} checked states`);
  console.log(`[migrate] Default settings applied`);

  return { migrated: true, stats };
}

// Allow running standalone
if (require.main === module) {
  const db = require('./db');
  const result = migrateFromJson(db);
  if (result.migrated) {
    console.log('\nMigration finished successfully.');
  } else {
    console.log('\nMigration skipped (DB already populated).');
  }
  process.exit(0);
}

module.exports = migrateFromJson;
