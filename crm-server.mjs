#!/usr/bin/env node
/**
 * crm-server.mjs — Local server for the outreach CRM dashboard
 *
 * Serves static files + API endpoints to update prospects.tsv
 *
 * Usage:
 *   node crm-server.mjs          # Start on port 8788
 *   node crm-server.mjs --port 9000
 *
 * API:
 *   GET  /data/prospects.tsv      — Read prospects
 *   POST /api/move                — Move prospect: { id, status }
 *   POST /api/bulk-move           — Bulk move: { ids: [...], status }
 *   GET  /api/stats               — CRM stats JSON
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROSPECTS_FILE = join(ROOT, 'data', 'prospects.tsv');
const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') || '8788');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// --- Prospects helpers ---
function loadProspects() {
  if (!existsSync(PROSPECTS_FILE)) return { header: '', prospects: [] };
  const raw = readFileSync(PROSPECTS_FILE, 'utf-8');
  const lines = raw.split('\n');
  const headerLines = lines.filter(l => l.startsWith('#'));
  const dataLines = lines.filter(l => l.trim() && !l.startsWith('#'));
  const prospects = dataLines.map(line => {
    const cols = line.split('\t');
    return {
      id: cols[0], date: cols[1], entreprise: cols[2], contact: cols[3],
      email: cols[4], segment: cols[5], ville: cols[6], pays: cols[7],
      statut: cols[8], campagne: cols[9], dernier_envoi: cols[10], notes: cols[11] || '',
    };
  });
  return { header: headerLines.join('\n'), prospects };
}

function saveProspects(header, prospects) {
  const lines = prospects.map(p =>
    [p.id, p.date, p.entreprise, p.contact, p.email, p.segment, p.ville, p.pays, p.statut, p.campagne, p.dernier_envoi, p.notes].join('\t')
  );
  writeFileSync(PROSPECTS_FILE, header + '\n' + lines.join('\n') + '\n');
}

// --- API handlers ---
function handleMove(body) {
  const { id, status } = body;
  if (!id || !status) return { error: 'id et status requis' };

  const { header, prospects } = loadProspects();
  const prospect = prospects.find(p => p.id === String(id));
  if (!prospect) return { error: `Prospect #${id} introuvable` };

  const oldStatus = prospect.statut;
  prospect.statut = status;
  saveProspects(header, prospects);

  return { ok: true, id, from: oldStatus, to: status, entreprise: prospect.entreprise };
}

function handleBulkMove(body) {
  const { ids, status } = body;
  if (!ids?.length || !status) return { error: 'ids[] et status requis' };

  const { header, prospects } = loadProspects();
  let moved = 0;
  for (const id of ids) {
    const prospect = prospects.find(p => p.id === String(id));
    if (prospect) {
      prospect.statut = status;
      moved++;
    }
  }
  saveProspects(header, prospects);
  return { ok: true, moved, status };
}

function handleStats() {
  const { prospects } = loadProspects();
  const total = prospects.length;
  const withEmail = prospects.filter(p => p.email).length;
  const contacted = prospects.filter(p => ['contacte', 'relance1', 'relance2'].includes(p.statut)).length;
  const responded = prospects.filter(p => p.statut === 'repondu').length;
  const rdv = prospects.filter(p => p.statut === 'rdv_pris').length;
  const converted = prospects.filter(p => p.statut === 'converti').length;
  const totalOutreach = contacted + responded + rdv + converted;
  const responseRate = totalOutreach > 0 ? ((responded + rdv + converted) / totalOutreach * 100).toFixed(1) : '0';

  return { total, withEmail, contacted, responded, rdv, converted, responseRate };
}

// --- Server ---
const server = createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API routes
  if (req.method === 'POST' && req.url === '/api/move') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const result = handleMove(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/bulk-move') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const result = handleBulkMove(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(handleStats()));
    return;
  }

  // Static files
  let filePath = join(ROOT, req.url === '/' ? '/dashboard/outreach.html' : req.url);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`Outreach CRM server: http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard/outreach.html`);
  console.log(`API: POST /api/move { id, status }, GET /api/stats`);
});
