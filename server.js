const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway volume or local fallback
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json({ limit: '1mb' }));

// CORS for local dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health check (before static!)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { version: 0, data: {} };
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8');
}

// GET state
app.get('/api/state', (req, res) => {
  res.json(readState());
});

// PUT state — merge incoming keys, bump version
app.put('/api/state', (req, res) => {
  const current = readState();
  const incoming = req.body;

  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Invalid body' });
  }

  // Merge: incoming keys overwrite current
  Object.assign(current.data, incoming);
  current.version = (current.version || 0) + 1;
  current.updatedAt = new Date().toISOString();

  writeState(current);
  res.json({ version: current.version });
});

// Serve static files
app.use(express.static(__dirname, { index: 'index.html' }));

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ADHD sync server on port ${PORT}`);
});
