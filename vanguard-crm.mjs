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
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, openSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { loadProspectionTsv, saveProspectionTsv } from './prospection-tsv.mjs';
import { checkReplies } from './check-replies.mjs';
import { loadRdv, saveRdv, backfillFromReplies, syncFromCalendarJson } from './rdv-detector.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 7777;
const PROSPECTION_FILE = join(ROOT, 'data', 'prospection.tsv');
const MANDATS_FILE = join(ROOT, 'data', 'mandats.md');
const LINKEDIN_FILE = join(ROOT, 'data', 'linkedin-invitations.tsv');
const SENT_DIR = join(ROOT, 'output', 'prospection', 'sent');
const TRACKING_FILE = join(ROOT, 'data', 'tracking.tsv');
const DRAFTS_FILE = join(ROOT, 'data', 'drafts.tsv');
const REPLIES_DIR = join(ROOT, 'data', 'replies');
const FRONTEND_DIR = join(ROOT, 'vanguard-crm-frontend');

const DRAFT_COLUMNS = ['id', 'created_at', 'prospect_id', 'company', 'contact', 'email', 'stage', 'subject', 'body', 'scheduled_at', 'status', 'notes'];

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

// --- Drafts ---

function loadDrafts() {
  if (!existsSync(DRAFTS_FILE)) return [];
  const lines = readFileSync(DRAFTS_FILE, 'utf-8').split('\n').filter(l => l.length);
  if (lines.length < 2) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map(ln => {
    const vals = ln.split('\t');
    const row = {};
    header.forEach((k, i) => row[k] = (vals[i] || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t'));
    return row;
  });
}

function saveDrafts(rows) {
  const header = DRAFT_COLUMNS.join('\t');
  const body = rows.map(r =>
    DRAFT_COLUMNS.map(c => String(r[c] ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t')).join('\t')
  ).join('\n');
  writeFileSync(DRAFTS_FILE, `${header}\n${body}\n`);
}

// Génère une heure "naturelle" pour le scheduling par défaut
// Entre 9h00 et 11h30, minutes non-rondes
function naturalDefaultTime(baseDate = new Date()) {
  const d = new Date(baseDate);
  const minutes = [8, 13, 17, 22, 27, 31, 38, 43, 47, 52, 56];
  const hours = [9, 10, 11];
  d.setHours(hours[Math.floor(Math.random() * hours.length)]);
  d.setMinutes(minutes[Math.floor(Math.random() * minutes.length)]);
  d.setSeconds(Math.floor(Math.random() * 60));
  d.setMilliseconds(0);
  // Si c'est dans le passé (cas de fin de journée), pousse à demain
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d.toISOString();
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

  const relanceDrafts = loadDrafts();
  const pendingReview = relanceDrafts.filter(d => d.status === 'pending_review').length;
  const generating = relanceDrafts.filter(d => d.status === 'generating').length;
  const scheduled = relanceDrafts.filter(d => d.status === 'scheduled').length;

  // RDV à venir (next 30 days, status != done/declined/expired)
  const allRdv = loadRdv();
  const horizon = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  const nowDate = new Date();
  const upcomingRdv = allRdv
    .filter(r => !['done', 'declined', 'expired'].includes(r.status))
    .filter(r => !r.dt_start || (new Date(r.dt_start) >= new Date(nowDate.getTime() - 60 * 60_000) && new Date(r.dt_start) <= horizon))
    .sort((a, b) => (a.dt_start || '').localeCompare(b.dt_start || ''));

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
      pendingReviewDrafts: pendingReview,
      generatingDrafts: generating,
      scheduledDrafts: scheduled,
      upcomingRdv: upcomingRdv.length,
    },
    actions: {
      responded,
      dueFollowups,
      drafts: drafts.slice(0, 30),
      bounces,
      liAccepted,
      upcomingRdv,
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

// --- Drafts API ---

app.get('/api/drafts', (req, res) => {
  res.json(loadDrafts());
});

// Crée des drafts pour un batch de prospects via Claude CLI en background
// Body: { prospectIds: [int, ...] }
app.post('/api/drafts/prepare', (req, res) => {
  const { prospectIds } = req.body;
  if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
    return res.status(400).json({ error: 'prospectIds[] required' });
  }
  const prospects = loadProspects();
  const targets = prospectIds.map(id => prospects[id]).filter(p => p && ['envoye', 'relance_1'].includes(p.status));
  if (targets.length === 0) return res.status(400).json({ error: 'no eligible prospect' });

  const claudeBin = '/Users/tai/.local/bin/claude';
  const drafts = loadDrafts();
  const newDraftIds = [];

  for (const row of targets) {
    const id = drafts.reduce((m, r) => Math.max(m, parseInt(r.id || 0, 10)), 0) + newDraftIds.length + 1;
    newDraftIds.push(id);
    const stage = row.status === 'envoye' ? 'relance_1' : 'relance_2';
    const safeCompany = row.company.replace(/"/g, '\\"');
    const draftBodyFile = `/tmp/draft-${id}-body.txt`;
    const draftSubjectFile = `/tmp/draft-${id}-subject.txt`;
    const logFile = `/tmp/vanguard-draft-${id}.log`;

    const prompt = `Tu rédiges une relance pour Vanguard Systems (Tai Van, automaticien freelance Lausanne) — DRAFT MODE: tu écris dans des fichiers, tu n'envoies rien.

CIBLE: company="${safeCompany}" contact="${row.contact || ''}" email="${row.email}" sector="${row.sector}" status_actuel="${row.status}" date_dernier_envoi="${row.date_envoi || ''}".
SIGNAL initial: ${row.signal || '(aucun)'}.
NOTES tracker: ${(row.notes || '').slice(0, 300)}.

TÂCHE:
1. Lis le mail précédent envoyé à cette boîte dans output/prospection/sent/${row.date_envoi || ''}/ (cherche par slug). Note l'angle.
2. WebSearch brève (2-3 résultats max) actualité récente: recrutement, projet, levée, salon, contrat. Skip si rien.
3. Rédige relance courte (max 100 mots) avec ANGLE NOUVEAU. Si actualité trouvée → s'appuyer dessus. Sinon: 1ère relance "renfort projet immédiat", 2ème "info-only au cas où".
4. Règles strictes Vanguard: vouvoiement, salutation "Bonjour Monsieur/Madame [NOM]" si contact (sinon "Bonjour,"), pas d'em-dashes en corps, français accents, pas de jargon (OEM→constructeurs de machines, FAT/SAT OK, PLC→automate). Ton humain pair-à-pair.
5. Écris UNIQUEMENT 2 fichiers:
   - ${draftSubjectFile} (1 ligne, l'objet du mail, max 60 chars)
   - ${draftBodyFile} (le corps texte, sans signature HTML qui sera ajoutée auto à l'envoi)
6. Ne lance PAS outreach-dispatch.mjs. Le user validera depuis le CRM.

Travaille rapide, pas de question, ne report rien (juste écrire les 2 fichiers).`;

    try {
      const child = spawn(claudeBin, ['-p', prompt, '--dangerously-skip-permissions'], {
        cwd: ROOT, detached: true, stdio: ['ignore', openSync(logFile, 'a'), openSync(logFile, 'a')],
      });
      child.unref();
    } catch (err) {
      console.warn('Failed to spawn claude for draft', id, err.message);
    }

    drafts.push({
      id: String(id),
      created_at: new Date().toISOString(),
      prospect_id: String(row.id),
      company: row.company,
      contact: row.contact || '',
      email: row.email,
      stage,
      subject: '',
      body: '',
      scheduled_at: '',
      status: 'generating',
      notes: `Claude en cours (log: ${logFile}). subject_file=${draftSubjectFile} body_file=${draftBodyFile}`,
    });
  }

  saveDrafts(drafts);
  res.json({ ok: true, draftIds: newDraftIds, message: `${newDraftIds.length} drafts en cours de génération par Claude (1-3 min chacun, refresh dans 2-3 min)` });
});

// Hydrate un draft "generating" si Claude a fini d'écrire les fichiers
function hydrateDraft(d) {
  if (d.status !== 'generating') return d;
  const subjectFile = (d.notes.match(/subject_file=(\S+)/) || [])[1];
  const bodyFile = (d.notes.match(/body_file=(\S+)/) || [])[1];
  if (subjectFile && bodyFile && existsSync(subjectFile) && existsSync(bodyFile)) {
    d.subject = readFileSync(subjectFile, 'utf-8').trim().split('\n')[0];
    d.body = readFileSync(bodyFile, 'utf-8').trim();
    d.status = 'pending_review';
  }
  return d;
}

app.get('/api/drafts/refresh', (req, res) => {
  const drafts = loadDrafts();
  drafts.forEach(hydrateDraft);
  saveDrafts(drafts);
  res.json(drafts);
});

app.patch('/api/drafts/:id', (req, res) => {
  const drafts = loadDrafts();
  const draft = drafts.find(d => d.id === req.params.id);
  if (!draft) return res.status(404).json({ error: 'not found' });
  const allowed = ['subject', 'body', 'scheduled_at', 'status', 'notes'];
  for (const k of allowed) {
    if (k in req.body) draft[k] = String(req.body[k]);
  }
  saveDrafts(drafts);
  res.json(draft);
});

app.delete('/api/drafts/:id', (req, res) => {
  const drafts = loadDrafts().filter(d => d.id !== req.params.id);
  saveDrafts(drafts);
  res.json({ ok: true });
});

// Envoie immédiatement un draft via outreach-dispatch.mjs --body-file
function sendDraft(draft) {
  if (!draft.body) throw new Error('draft body is empty');
  const bodyFile = `/tmp/draft-${draft.id}-final-body.txt`;
  writeFileSync(bodyFile, draft.body);
  const subjectArg = draft.subject ? `--subject "${draft.subject.replace(/"/g, '\\"')}"` : '';
  const cmd = `node ${join(ROOT, 'outreach-dispatch.mjs')} --company "${draft.company.replace(/"/g, '\\"')}" --status ${draft.stage === 'relance_1' ? 'envoye' : 'relance_1'} --body-file ${bodyFile} ${subjectArg} --live --force`;
  const out = execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 60000 }).toString();
  return out;
}

app.post('/api/drafts/:id/send', (req, res) => {
  const drafts = loadDrafts();
  const draft = drafts.find(d => d.id === req.params.id);
  if (!draft) return res.status(404).json({ error: 'not found' });
  if (draft.status === 'sent') return res.status(400).json({ error: 'already sent' });
  try {
    const out = sendDraft(draft);
    draft.status = 'sent';
    draft.notes = (draft.notes || '') + ` | sent ${new Date().toISOString()}`;
    saveDrafts(drafts);
    res.json({ ok: true, output: out });
  } catch (err) {
    res.status(500).json({ error: err.message, output: err.stdout?.toString() || '' });
  }
});

app.get('/api/drafts/default-time', (req, res) => {
  res.json({ scheduled_at: naturalDefaultTime() });
});

// Background scheduler: check drafts scheduled in past, send them
let schedulerRunning = false;
async function schedulerTick() {
  if (schedulerRunning) return;
  schedulerRunning = true;
  try {
    const drafts = loadDrafts();
    const now = new Date();
    let dirty = false;
    for (const d of drafts) {
      if (d.status !== 'pending_review' && d.status !== 'scheduled') continue;
      if (!d.scheduled_at) continue;
      if (d.status === 'pending_review') continue; // pending_review ne s'envoie pas auto
      const sched = new Date(d.scheduled_at);
      if (sched <= now) {
        try {
          sendDraft(d);
          d.status = 'sent';
          d.notes = (d.notes || '') + ` | auto-sent ${now.toISOString()}`;
          dirty = true;
          console.log(`[scheduler] sent draft ${d.id} -> ${d.company}`);
        } catch (err) {
          d.notes = (d.notes || '') + ` | error ${err.message.slice(0, 200)}`;
          d.status = 'error';
          dirty = true;
          console.error(`[scheduler] error sending draft ${d.id}:`, err.message);
        }
      }
    }
    if (dirty) saveDrafts(drafts);
  } finally {
    schedulerRunning = false;
  }
}
setInterval(schedulerTick, 60_000);

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

// --- RDV ---

function googleCalendarLink(rdv) {
  // https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS&details=...&location=...
  const fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  };
  const start = fmt(rdv.dt_start);
  const end = fmt(rdv.dt_end) || (rdv.dt_start ? fmt(new Date(new Date(rdv.dt_start).getTime() + 30 * 60_000).toISOString()) : '');
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', rdv.summary || `RDV ${rdv.company}`);
  if (start && end) params.set('dates', `${start}/${end}`);
  params.set('details', `Contact: ${rdv.contact} (${rdv.email})\nMeeting: ${rdv.meeting_url || rdv.location || ''}\n\nSource: ${rdv.source_reply_file || ''}`);
  if (rdv.meeting_url) params.set('location', rdv.meeting_url);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

app.get('/api/rdv', (req, res) => {
  const rows = loadRdv();
  // Enrichi avec google_cal_link
  res.json(rows.map(r => ({ ...r, google_cal_link: googleCalendarLink(r) })));
});

app.patch('/api/rdv/:id', (req, res) => {
  const rows = loadRdv();
  const rdv = rows.find(r => r.id === req.params.id);
  if (!rdv) return res.status(404).json({ error: 'not found' });
  const allowed = ['status', 'notes', 'dt_start', 'dt_end', 'summary', 'meeting_url'];
  for (const k of allowed) if (k in req.body) rdv[k] = String(req.body[k]);
  saveRdv(rows);
  res.json(rdv);
});

app.delete('/api/rdv/:id', (req, res) => {
  const rows = loadRdv().filter(r => r.id !== req.params.id);
  saveRdv(rows);
  res.json({ ok: true });
});

app.post('/api/rdv/backfill', (req, res) => {
  const { rows: prospects } = loadProspectionTsv(PROSPECTION_FILE);
  const stats = backfillFromReplies(prospects);
  res.json({ ok: true, ...stats });
});

const CALENDAR_JSON = join(ROOT, 'data', 'calendar-events.json');

app.post('/api/calendar/sync', (req, res) => {
  const { rows: prospects } = loadProspectionTsv(PROSPECTION_FILE);
  const stats = syncFromCalendarJson(CALENDAR_JSON, prospects);
  res.json({ ok: !stats.error, ...stats });
});

// Refresh complet: spawn Claude CLI qui pull le calendar via MCP et réécrit data/calendar-events.json
let calendarRefreshRunning = false;
let lastCalendarRefresh = null;
let lastCalendarRefreshOk = null;

function buildCalendarRefreshPrompt() {
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  return `Tu refreshs le snapshot agenda du CRM Vanguard. Pas de réponse texte, juste le boulot.

ÉTAPES:
1. Appelle l'outil mcp__cf900400-41a3-4ed6-b6bb-8155357ab9e3__list_events avec:
   startTime="${now.toISOString()}", endTime="${horizon.toISOString()}", orderBy="startTime", pageSize=100, timeZone="Europe/Zurich"
2. Pour chaque event, extrais le meeting URL depuis conferenceUrl, location, ou description (regex Teams/Meet/Zoom/Calendly/Webex/Whereby).
3. Détecte la plateforme:
   - teams.microsoft.com / teams.live.com → "teams"
   - meet.google.com → "meet"
   - zoom.us → "zoom"
   - calendly.com → "calendly"
   - webex.com → "webex"
   - whereby.com → "whereby"
   - sinon si location physique → "in_person"
   - sinon → "unknown"
4. Écris UNIQUEMENT (avec l'outil Write) le fichier ${CALENDAR_JSON} avec cette structure JSON exacte:

{
  "synced_at": "${now.toISOString()}",
  "source": "google_calendar_mcp",
  "calendar": "tai.van@vanguard-systems.ch",
  "horizon_days": 30,
  "events": [
    {
      "id": "<event.id>",
      "summary": "<event.summary>",
      "start": "<event.start.dateTime ISO complet>",
      "end": "<event.end.dateTime ISO complet>",
      "location": "<event.location ou ''>",
      "meeting_url": "<URL extraite ou ''>",
      "platform": "<teams|meet|zoom|...|unknown>",
      "attendees": ["<email1>", "<email2>"],
      "organizer": "<organizer.email>",
      "html_link": "<event.htmlLink>",
      "description": "<description tronquée à 500 chars>",
      "status": "<event.status>"
    }
  ]
}

5. Skippe les events all-day sans dateTime (juste date), les anniversaires, et les events de type birthday/workingLocation/focusTime.
6. NE LANCE PAS d'autres outils. NE RÉPONDS PAS en texte. Le seul output attendu est le fichier JSON écrit.`;
}

app.post('/api/calendar/refresh', (req, res) => {
  if (calendarRefreshRunning) {
    return res.json({ ok: false, error: 'refresh déjà en cours', startedAt: lastCalendarRefresh });
  }
  calendarRefreshRunning = true;
  lastCalendarRefresh = new Date().toISOString();

  const claudeBin = '/Users/tai/.local/bin/claude';
  const logFile = `/tmp/vanguard-calendar-refresh-${Date.now()}.log`;
  const prevMtime = existsSync(CALENDAR_JSON) ? statSync(CALENDAR_JSON).mtimeMs : 0;

  try {
    const child = spawn(claudeBin, ['-p', buildCalendarRefreshPrompt(), '--dangerously-skip-permissions'], {
      cwd: ROOT, detached: true,
      stdio: ['ignore', openSync(logFile, 'a'), openSync(logFile, 'a')],
    });
    child.unref();

    // Watch le fichier — quand mtime change, on merge automatiquement
    const watcher = setInterval(() => {
      if (!existsSync(CALENDAR_JSON)) return;
      const mt = statSync(CALENDAR_JSON).mtimeMs;
      if (mt > prevMtime) {
        clearInterval(watcher);
        clearTimeout(timeout);
        try {
          const { rows: prospects } = loadProspectionTsv(PROSPECTION_FILE);
          const stats = syncFromCalendarJson(CALENDAR_JSON, prospects);
          lastCalendarRefreshOk = { ts: new Date().toISOString(), ...stats };
          console.log(`[calendar refresh] OK ${stats.created} créés, ${stats.updated} mis à jour`);
        } catch (err) {
          lastCalendarRefreshOk = { ts: new Date().toISOString(), error: err.message };
        }
        calendarRefreshRunning = false;
      }
    }, 3000);
    const timeout = setTimeout(() => {
      clearInterval(watcher);
      calendarRefreshRunning = false;
      lastCalendarRefreshOk = { ts: new Date().toISOString(), error: 'timeout 10 min' };
      console.error('[calendar refresh] timeout 10 min');
    }, 10 * 60_000);

    res.json({
      ok: true,
      message: 'Claude CLI lance le pull agenda en arrière-plan (1-2 min). Le merge se fait automatiquement quand le snapshot est écrit.',
      logFile,
      startedAt: lastCalendarRefresh,
    });
  } catch (err) {
    calendarRefreshRunning = false;
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/calendar/refresh-status', (req, res) => {
  res.json({
    running: calendarRefreshRunning,
    lastStartedAt: lastCalendarRefresh,
    lastResult: lastCalendarRefreshOk,
  });
});

app.get('/api/calendar/snapshot-status', (req, res) => {
  if (!existsSync(CALENDAR_JSON)) return res.json({ exists: false });
  try {
    const snap = JSON.parse(readFileSync(CALENDAR_JSON, 'utf-8'));
    res.json({
      exists: true,
      synced_at: snap.synced_at,
      source: snap.source,
      eventCount: (snap.events || []).length,
      mtime: statSync(CALENDAR_JSON).mtime.toISOString(),
    });
  } catch (err) {
    res.json({ exists: true, error: err.message });
  }
});

// Backfill + sync calendar une fois au démarrage
setTimeout(() => {
  try {
    const { rows: prospects } = loadProspectionTsv(PROSPECTION_FILE);
    const replyStats = backfillFromReplies(prospects);
    if (replyStats.created > 0) console.log(`[rdv backfill] ${replyStats.created} RDV créés depuis ${replyStats.scanned} replies`);
    const calStats = syncFromCalendarJson(CALENDAR_JSON, prospects);
    if (!calStats.error) {
      console.log(`[calendar sync] ${calStats.created} créés, ${calStats.updated} mis à jour (depuis ${calStats.synced_at})`);
    }
  } catch (err) { console.error('[rdv boot sync]', err.message); }
}, 1500);

// --- IMAP replies scraping ---
let lastImapCheck = null;
let imapRunning = false;
let lastImapStats = null;

async function imapTick(days = 1) {
  if (imapRunning) return null;
  imapRunning = true;
  try {
    const stats = await checkReplies({ days, dryRun: false });
    lastImapCheck = new Date().toISOString();
    lastImapStats = stats;
    if (stats.updated > 0) console.log(`[imap] ${stats.updated} prospects mis à jour`);
    return stats;
  } catch (err) {
    console.error('[imap] erreur:', err.message);
    lastImapStats = { error: err.message };
    return null;
  } finally {
    imapRunning = false;
  }
}

// Poll toutes les 5 min
setInterval(() => imapTick(1), 5 * 60_000);
// Premier check au démarrage (3s après le boot pour ne pas bloquer)
setTimeout(() => imapTick(2), 3000);

app.post('/api/check-replies', async (req, res) => {
  const days = parseInt(req.query.days || '2', 10);
  const stats = await imapTick(days);
  res.json({ ok: !!stats, stats, lastImapCheck });
});

app.get('/api/imap-status', (req, res) => {
  res.json({ lastImapCheck, running: imapRunning, lastImapStats });
});

// Lit le texte complet d'une réponse stockée dans data/replies/
app.get('/api/replies/:file', (req, res) => {
  if (!/^[\w.\-]+\.txt$/.test(req.params.file)) return res.status(400).json({ error: 'invalid filename' });
  const path = join(REPLIES_DIR, req.params.file);
  if (!existsSync(path)) return res.status(404).json({ error: 'not found' });
  res.type('text/plain').send(readFileSync(path, 'utf-8'));
});

// --- Static frontend ---
app.use(express.static(FRONTEND_DIR));
app.get('/', (req, res) => res.sendFile(join(FRONTEND_DIR, 'index.html')));

app.listen(PORT, () => {
  console.log(`Vanguard CRM running on http://localhost:${PORT}`);
});
