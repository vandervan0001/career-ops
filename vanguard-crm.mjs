#!/usr/bin/env node
/**
 * vanguard-crm.mjs — Vanguard CRM local server
 *
 * Express server (port 7777) qui sert le dashboard CRM + API REST.
 * Lit les sources de vérité (TSV/MD) et permet l'édition inline.
 *
 * Usage:
 *   node vanguard-crm.mjs              # serve sur port 7777
 *   PORT=8080 node vanguard-crm.mjs    # custom port
 */

import express from 'express';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { openSync } from 'fs';
import { loadProspectionTsv, saveProspectionTsv } from './prospection-tsv.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 7777;
const PROSPECTION_FILE = join(ROOT, 'data', 'prospection.tsv');
const MANDATS_FILE = join(ROOT, 'data', 'mandats.md');
const LINKEDIN_FILE = join(ROOT, 'data', 'linkedin-invitations.tsv');
const SENT_DIR = join(ROOT, 'output', 'prospection', 'sent');
const TRACKING_FILE = join(ROOT, 'data', 'tracking.tsv');
const FRONTEND_DIR = join(ROOT, 'vanguard-crm-frontend');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS pour le Worker Cloudflare (tracking events)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --- Helpers ---

function loadProspects() {
  const { rows } = loadProspectionTsv(PROSPECTION_FILE);
  return rows.map((r, idx) => ({ ...r, id: idx }));
}

function saveProspects(rows) {
  const cleaned = rows.map(({ id, ...rest }) => rest);
  saveProspectionTsv(PROSPECTION_FILE, cleaned);
}

function parseMandatsMd() {
  if (!existsSync(MANDATS_FILE)) return [];
  const lines = readFileSync(MANDATS_FILE, 'utf-8').split('\n');
  const rows = [];
  for (const ln of lines) {
    if (!ln.startsWith('|')) continue;
    if (ln.includes('---')) continue;
    if (ln.match(/^\|\s*#\s*\|/)) continue;
    const cols = ln.split('|').slice(1, -1).map(c => c.trim());
    if (cols.length < 9) continue;
    rows.push({
      num: cols[0],
      date: cols[1],
      client: cols[2],
      mandat: cols[3],
      score: cols[4],
      status: cols[5],
      pdf: cols[6],
      report: cols[7],
      tjm: cols[8] || '',
      notes: cols[9] || '',
    });
  }
  return rows;
}

function loadLinkedinInvites() {
  if (!existsSync(LINKEDIN_FILE)) return [];
  const lines = readFileSync(LINKEDIN_FILE, 'utf-8').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headerCols = lines[0].split('\t').map(c => c.trim());
  return lines.slice(1).map(ln => {
    const vals = ln.split('\t');
    const row = {};
    headerCols.forEach((k, i) => row[k] = (vals[i] || '').trim());
    return row;
  });
}

function loadTrackingEvents() {
  if (!existsSync(TRACKING_FILE)) return [];
  const lines = readFileSync(TRACKING_FILE, 'utf-8').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  return lines.slice(1).map(ln => {
    const [ts, type, msgId, ip, ua, url] = ln.split('\t');
    return { ts, type, msgId, ip, ua, url };
  });
}

function appendTrackingEvent(type, msgId, ip = '', ua = '', url = '') {
  if (!existsSync(TRACKING_FILE)) {
    writeFileSync(TRACKING_FILE, 'ts\ttype\tmsgId\tip\tua\turl\n');
  }
  const line = [new Date().toISOString(), type, msgId, ip, (ua || '').slice(0, 200), url].join('\t') + '\n';
  writeFileSync(TRACKING_FILE, line, { flag: 'a' });
}

function listSentMails() {
  if (!existsSync(SENT_DIR)) return [];
  const dates = readdirSync(SENT_DIR)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort().reverse();
  const mails = [];
  for (const date of dates) {
    const dir = join(SENT_DIR, date);
    const files = readdirSync(dir).filter(f => f.endsWith('.txt') && !f.startsWith('._'));
    for (const file of files) {
      const path = join(dir, file);
      const text = readFileSync(path, 'utf-8');
      const split = text.split('\n--- BODY ---\n');
      const headers = {};
      if (split.length >= 2) {
        for (const line of split[0].split('\n')) {
          const idx = line.indexOf(':');
          if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
      const body = split.length >= 2 ? split[1].replace(/^\n+/, '') : text;
      mails.push({
        date,
        file,
        path: `/api/mails/${date}/${file}`,
        company: headers.Company || file.replace(/\.txt$/, ''),
        contact: ((headers.To || '').match(/^([^<]+)</) || [, headers.To])[1].trim(),
        to: headers.To || '',
        subject: headers.Subject || '',
        messageId: headers['Message-ID'] || '',
        sector: headers.Sector || '',
        signal: headers.Signal || '',
        stage: headers.Stage || 'initial',
        timestamp: headers.Date || statSync(path).mtime.toISOString(),
        body,
      });
    }
  }
  return mails;
}

// --- API endpoints ---

app.get('/api/prospects', (req, res) => {
  res.json(loadProspects());
});

app.patch('/api/prospects/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const updates = req.body;
  const rows = loadProspects();
  if (id < 0 || id >= rows.length) return res.status(404).json({ error: 'not found' });
  const allowed = ['status', 'notes', 'contact', 'email', 'linkedin', 'signal', 'score', 'sector', 'message_sent'];
  for (const key of allowed) {
    if (key in updates) rows[id][key] = String(updates[key]);
  }
  saveProspects(rows);
  res.json(rows[id]);
});

app.get('/api/mandats', (req, res) => {
  res.json(parseMandatsMd());
});

app.get('/api/linkedin', (req, res) => {
  res.json(loadLinkedinInvites());
});

app.get('/api/mails', (req, res) => {
  res.json(listSentMails());
});

app.get('/api/mails/:date/:file', (req, res) => {
  const path = join(SENT_DIR, req.params.date, req.params.file);
  if (!existsSync(path)) return res.status(404).json({ error: 'not found' });
  const text = readFileSync(path, 'utf-8');
  res.type('text/plain').send(text);
});

app.get('/api/today', (req, res) => {
  const prospects = loadProspects();
  const today = new Date().toISOString().slice(0, 10);
  const tracking = loadTrackingEvents();

  const responded = prospects.filter(p =>
    ['reponse', 'rdv', 'repondu_pass_poli'].includes(p.status)
  );

  const now = new Date();
  const dueFollowups = prospects.filter(p => {
    if (!['envoye', 'relance_1'].includes(p.status)) return false;
    if (!p.date_envoi) return false;
    const sentDate = new Date(p.date_envoi);
    const daysDiff = (now - sentDate) / (1000 * 60 * 60 * 24);
    return daysDiff >= 7;
  });

  const drafts = prospects.filter(p => p.status === 'nouveau');

  const bounces = prospects.filter(p =>
    p.notes && /BOUNCE|bounce/.test(p.notes) && !/alt:.*envoy/i.test(p.notes)
  );

  const liInvites = loadLinkedinInvites();
  const liAccepted = liInvites.filter(l => l.status === 'accepted' || l.status === 'accepte');

  const sentToday = prospects.filter(p => p.date_envoi === today).length;
  const sentThisWeek = prospects.filter(p => {
    if (!p.date_envoi) return false;
    const d = new Date(p.date_envoi);
    return (now - d) / (1000 * 60 * 60 * 24) <= 7;
  }).length;
  const totalSent = prospects.filter(p => ['envoye', 'relance_1', 'relance_2'].includes(p.status)).length;
  const responseRate = totalSent > 0 ? (responded.length / totalSent * 100).toFixed(1) : '0.0';

  const opens = tracking.filter(e => e.type === 'open');
  const clicks = tracking.filter(e => e.type === 'click');

  res.json({
    today,
    kpis: {
      sentToday,
      sentThisWeek,
      totalSent,
      totalDrafts: drafts.length,
      totalResponded: responded.length,
      responseRate: `${responseRate}%`,
      totalOpens: opens.length,
      totalClicks: clicks.length,
    },
    actions: {
      responded,
      dueFollowups,
      drafts: drafts.slice(0, 30),
      bounces,
      liAccepted,
    },
  });
});

app.get('/api/stats', (req, res) => {
  const prospects = loadProspects();
  const byDate = {};
  prospects.forEach(p => {
    if (p.date_envoi && /^\d{4}-\d{2}-\d{2}$/.test(p.date_envoi)) {
      byDate[p.date_envoi] = (byDate[p.date_envoi] || 0) + 1;
    }
  });
  const dailySends = Object.entries(byDate).sort().slice(-30).map(([date, count]) => ({ date, count }));

  const byStatus = {};
  prospects.forEach(p => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  });

  const bySector = {};
  prospects.forEach(p => {
    if (p.sector) bySector[p.sector] = (bySector[p.sector] || 0) + 1;
  });

  const byTargetType = {};
  prospects.forEach(p => {
    if (p.target_type) byTargetType[p.target_type] = (byTargetType[p.target_type] || 0) + 1;
  });

  res.json({ dailySends, byStatus, bySector, byTargetType });
});

app.post('/api/relance/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const rows = loadProspects();
  if (id < 0 || id >= rows.length) return res.status(404).json({ error: 'not found' });
  const row = rows[id];
  if (!['envoye', 'relance_1'].includes(row.status)) {
    return res.status(400).json({ error: `Cannot relance row with status=${row.status}` });
  }

  // Lance Claude CLI headless pour rédiger un mail de relance personnalisé
  // (nouveau angle, lecture du mail précédent, recherche actualité boîte)
  // puis envoie via outreach-dispatch.mjs --body-file
  const claudeBin = '/Users/tai/.local/bin/claude';
  const stage = row.status === 'envoye' ? 'relance_1' : 'relance_2';
  const safeCompany = row.company.replace(/"/g, '\\"');

  const prompt = `Tu pilotes une relance email pour Vanguard Systems (Tai Van, automaticien freelance Lausanne).

CIBLE: company="${safeCompany}" contact="${row.contact || ''}" email="${row.email}" sector="${row.sector}" status_actuel="${row.status}" date_dernier_envoi="${row.date_envoi || ''}".

SIGNAL initial: ${row.signal || '(aucun)'}.
NOTES tracker: ${(row.notes || '').slice(0, 300)}.

TÂCHE:
1. Lis le mail précédent envoyé à cette boîte dans output/prospection/sent/${row.date_envoi || ''}/ (cherche le fichier par slug du nom de boîte). Note l'angle utilisé.
2. Cherche brièvement une actualité récente de la boîte via WebSearch (2-3 résultats max, ne perds pas de temps si rien). Recrutement, projet annoncé, levée, salon, contrat...
3. Rédige un mail de relance court (max 100 mots) avec un ANGLE NOUVEAU (pas répétition du précédent). Si actualité trouvée → s'appuyer dessus. Sinon → angle différent (ex. première relance focus "renfort projet immédiat", deuxième relance focus "info-only au cas où").
4. Règles strictes Vanguard: tutoiement non, vouvoiement oui. Salutation "Bonjour Monsieur/Madame [NOM]" si contact. Sinon "Bonjour,". Ton humain pair-à-pair. Pas d'em-dashes en corps (virgules ou parenthèses). Français avec accents. Signature "Bien cordialement, Tai Van" (la signature HTML est ajoutée auto). Pas de jargon ("OEM" → "constructeurs de machines", "FAT/SAT" OK, "PLC/SCADA" → "automate / supervision").
5. Écris le body dans /tmp/relance-${id}-${stage}.txt (texte brut, pas HTML). Pas de subject à l'intérieur, juste le corps.
6. Lance: node outreach-dispatch.mjs --company "${safeCompany}" --status ${row.status} --body-file /tmp/relance-${id}-${stage}.txt --live --force
7. Reporte en 3 lignes: angle choisi, actualité utilisée si oui, message-id retourné.

Travaille rapide, pas de question.`;

  // Lance en background, retourne immédiatement avec un job id
  const logFile = `/tmp/vanguard-relance-${id}-${Date.now()}.log`;
  try {
    const child = spawn(claudeBin, ['-p', prompt, '--dangerously-skip-permissions'], {
      cwd: ROOT, detached: true, stdio: ['ignore', openSync(logFile, 'a'), openSync(logFile, 'a')],
    });
    child.unref();
    res.json({ ok: true, message: `Relance Claude en cours (PID ${child.pid})`, logFile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Tracking endpoints (called by Cloudflare Worker via webhook) ---

app.post('/api/track/open', (req, res) => {
  const { msgId, ip, ua } = req.body;
  if (!msgId) return res.status(400).json({ error: 'missing msgId' });
  appendTrackingEvent('open', msgId, ip || '', ua || '', '');
  res.json({ ok: true });
});

app.post('/api/track/click', (req, res) => {
  const { msgId, url, ip, ua } = req.body;
  if (!msgId || !url) return res.status(400).json({ error: 'missing msgId or url' });
  appendTrackingEvent('click', msgId, ip || '', ua || '', url);
  res.json({ ok: true });
});

// Local fallback pixel/click si pas de Worker Cloudflare
app.get('/t/:msgId.png', (req, res) => {
  appendTrackingEvent('open', req.params.msgId, req.ip, req.headers['user-agent'] || '', '');
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=', 'base64');
  res.type('image/png').send(pixel);
});

app.get('/c/:msgId', (req, res) => {
  const url = req.query.u;
  if (!url) return res.status(400).send('missing u');
  appendTrackingEvent('click', req.params.msgId, req.ip, req.headers['user-agent'] || '', url);
  res.redirect(302, url);
});

app.get('/api/tracking/:msgId', (req, res) => {
  const events = loadTrackingEvents().filter(e => e.msgId === req.params.msgId);
  res.json(events);
});

app.get('/api/tracking', (req, res) => {
  res.json(loadTrackingEvents());
});

// --- Static frontend ---
app.use(express.static(FRONTEND_DIR));
app.get('/', (req, res) => res.sendFile(join(FRONTEND_DIR, 'index.html')));

app.listen(PORT, () => {
  console.log(`Vanguard CRM running on http://localhost:${PORT}`);
});
