/**
 * rdv-detector.mjs — Détecte les invitations de RDV dans les mails reçus
 *
 * Analyse:
 *   1. Pièce jointe iCalendar (text/calendar) si présente → DTSTART/SUMMARY/LOCATION/URL
 *   2. Sinon, regex sur le body pour URL Teams / Google Meet / Zoom / Calendly
 *
 * Écrit dans data/rdv.tsv. Idempotent via une clé unique (prospect_idx + dt_start + meeting_url).
 *
 * Schema rdv.tsv:
 *   id, detected_at, prospect_idx, company, contact, email,
 *   dt_start, dt_end, summary, location, meeting_url, platform,
 *   source_reply_file, status, notes
 *
 * Status: pending (par défaut) | confirmed | done | declined | expired
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RDV_FILE = join(ROOT, 'data', 'rdv.tsv');
const REPLIES_DIR = join(ROOT, 'data', 'replies');

export const RDV_COLUMNS = [
  'id', 'detected_at', 'prospect_idx', 'company', 'contact', 'email',
  'dt_start', 'dt_end', 'summary', 'location', 'meeting_url', 'platform',
  'source_reply_file', 'status', 'notes',
];

const PLATFORM_PATTERNS = [
  { name: 'teams', re: /https:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\/l\/meetup-join\/[^\s"<>]+/i },
  { name: 'meet', re: /https:\/\/meet\.google\.com\/[a-z0-9\-]+(?:\?[^\s"<>]*)?/i },
  { name: 'zoom', re: /https:\/\/[a-z0-9.\-]*zoom\.us\/(?:j|my|s)\/[^\s"<>]+/i },
  { name: 'calendly', re: /https:\/\/calendly\.com\/[^\s"<>]+/i },
  { name: 'webex', re: /https:\/\/[a-z0-9\-]+\.webex\.com\/(?:meet|join)\/[^\s"<>]+/i },
  { name: 'whereby', re: /https:\/\/whereby\.com\/[^\s"<>]+/i },
];

function detectPlatform(text = '') {
  for (const p of PLATFORM_PATTERNS) {
    const m = text.match(p.re);
    if (m) return { platform: p.name, url: m[0].replace(/[\.,;]+$/, '') };
  }
  return null;
}

// Parse une ligne ICS dépliée (ex: "DTSTART;TZID=Europe/Paris:20260513T140000")
function parseIcsLine(line) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1).trim();
  const parts = left.split(';');
  const key = parts[0];
  const params = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq > 0) params[parts[i].slice(0, eq)] = parts[i].slice(eq + 1);
  }
  return { key, value, params };
}

function unfoldIcs(raw) {
  // RFC 5545: lignes pliées avec espace ou tab en début
  return raw.replace(/\r/g, '').replace(/\n[ \t]/g, '');
}

function icsValueToIso(value) {
  // 20260513T140000Z (UTC) ou 20260513T140000 (local) ou 20260513 (date only)
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    return new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}:${value.slice(13,15)}Z`).toISOString();
  }
  if (/^\d{8}T\d{6}$/.test(value)) {
    // Floating local time. Si TZID=Europe/Paris ou similar, on assume +02:00 en été (approx)
    // Pour ne pas se planter, on le traite comme local sans TZ et on laisse le brut pour affichage
    const d = new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}:${value.slice(13,15)}`);
    return d.toISOString();
  }
  if (/^\d{8}$/.test(value)) {
    return new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T00:00:00Z`).toISOString();
  }
  return null;
}

export function parseIcs(raw) {
  if (!raw) return null;
  const unfolded = unfoldIcs(raw);
  const lines = unfolded.split('\n');
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') { if (current) events.push(current); current = null; }
    else if (current) {
      const parsed = parseIcsLine(line);
      if (!parsed) continue;
      switch (parsed.key) {
        case 'DTSTART': current.dt_start = icsValueToIso(parsed.value) || parsed.value; break;
        case 'DTEND': current.dt_end = icsValueToIso(parsed.value) || parsed.value; break;
        case 'SUMMARY': current.summary = parsed.value.replace(/\\n/g, ' ').replace(/\\,/g, ',').slice(0, 200); break;
        case 'LOCATION': current.location = parsed.value.replace(/\\n/g, ' ').replace(/\\,/g, ',').slice(0, 500); break;
        case 'URL': current.url = parsed.value; break;
        case 'DESCRIPTION': current.description = parsed.value.replace(/\\n/g, ' ').replace(/\\,/g, ',').slice(0, 2000); break;
        case 'ORGANIZER': current.organizer = parsed.value; break;
      }
    }
  }
  return events.length > 0 ? events[0] : null;
}

function loadRdv() {
  if (!existsSync(RDV_FILE)) return [];
  const lines = readFileSync(RDV_FILE, 'utf-8').split('\n').filter(l => l.length);
  if (lines.length < 2) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map(ln => {
    const vals = ln.split('\t');
    const row = {};
    header.forEach((k, i) => { row[k] = (vals[i] || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t'); });
    return row;
  });
}

function saveRdv(rows) {
  const header = RDV_COLUMNS.join('\t');
  const body = rows.map(r =>
    RDV_COLUMNS.map(c => String(r[c] ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t')).join('\t')
  ).join('\n');
  writeFileSync(RDV_FILE, `${header}\n${body}\n`);
}

function nextRdvId(rows) {
  return rows.reduce((m, r) => Math.max(m, parseInt(r.id || 0, 10)), 0) + 1;
}

// Crée un RDV à partir d'un mail capté (idempotent sur prospect_idx+dt_start+url)
export function recordRdv({ prospect, prospectIdx, replyFile, body, ics, fallbackSubject }) {
  const event = ics ? parseIcs(ics) : null;
  const detection = detectPlatform(body) || (event?.location ? detectPlatform(event.location) : null) || (event?.description ? detectPlatform(event.description) : null);
  if (!event && !detection) return null; // ni ICS ni URL → pas de RDV

  const meeting_url = detection?.url || (event?.url || '');
  const platform = detection?.platform || (meeting_url.includes('teams') ? 'teams' : meeting_url.includes('meet.google') ? 'meet' : meeting_url.includes('zoom') ? 'zoom' : 'unknown');

  const rows = loadRdv();
  const dt_start = event?.dt_start || '';
  // dédup: même prospect + (même dt_start OU même URL)
  const dup = rows.find(r => {
    if (String(r.prospect_idx) !== String(prospectIdx)) return false;
    if (dt_start && r.dt_start === dt_start) return true;
    if (meeting_url && r.meeting_url === meeting_url) return true;
    return false;
  });
  if (dup) {
    // Si on a maintenant des champs manquants → on met à jour
    let updated = false;
    if (!dup.dt_start && dt_start) { dup.dt_start = dt_start; updated = true; }
    if (!dup.dt_end && event?.dt_end) { dup.dt_end = event.dt_end; updated = true; }
    if (!dup.location && event?.location) { dup.location = event.location; updated = true; }
    if ((!dup.summary || dup.summary.startsWith('RDV ')) && event?.summary) { dup.summary = event.summary; updated = true; }
    if (updated) saveRdv(rows);
    return { ...dup, _duplicate: !updated };
  }

  const newRow = {
    id: String(nextRdvId(rows)),
    detected_at: new Date().toISOString(),
    prospect_idx: String(prospectIdx),
    company: prospect.company || '',
    contact: prospect.contact || '',
    email: prospect.email || '',
    dt_start,
    dt_end: event?.dt_end || '',
    summary: event?.summary || fallbackSubject || `RDV ${prospect.company}`,
    location: event?.location || '',
    meeting_url,
    platform,
    source_reply_file: replyFile || '',
    status: 'pending',
    notes: '',
  };
  rows.push(newRow);
  saveRdv(rows);
  return newRow;
}

// Sync depuis un snapshot Google Calendar JSON (data/calendar-events.json)
// Le snapshot est mis à jour soit par Claude CLI soit par moi (calendar MCP).
// Idempotent: dédup sur calendar_event_id + meeting_url.
export function syncFromCalendarJson(jsonPath, prospects) {
  if (!existsSync(jsonPath)) return { error: 'snapshot absent', synced_at: null, created: 0, updated: 0 };
  const snapshot = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const events = snapshot.events || [];
  const rows = loadRdv();
  const byEmail = new Map();
  prospects.forEach((p, idx) => { if (p.email) byEmail.set(p.email.toLowerCase().trim(), { p, idx }); });

  let created = 0, updated = 0, untracked = 0;
  for (const ev of events) {
    // Match ANY attendee against the prospect base
    const allAddrs = [ev.organizer, ...(ev.attendees || [])].filter(Boolean).map(a => a.toLowerCase());
    let match = null;
    for (const addr of allAddrs) {
      const m = byEmail.get(addr);
      if (m) { match = m; break; }
    }

    const startIso = new Date(ev.start).toISOString();
    const endIso = new Date(ev.end).toISOString();

    // Dédup multi-niveau:
    //  1. calendar_id déjà présent (re-sync)
    //  2. même meeting_url exact
    //  3. même prospect + heure de début proche (±60min)
    //  4. même prospect + RDV provenant d'un email reply sans dt_start (calendar enrichit)
    const existing = rows.find(r => {
      if (r.notes?.includes(`calendar_id:${ev.id}`)) return true;
      if (ev.meeting_url && r.meeting_url === ev.meeting_url) return true;
      if (match && r.prospect_idx === String(match.idx)) {
        if (r.dt_start) {
          const diff = Math.abs(new Date(r.dt_start).getTime() - new Date(startIso).getTime());
          if (diff < 60 * 60_000) return true;
        } else if (r.source_reply_file) {
          // RDV créé depuis email reply sans date — le calendar fournit les détails
          return true;
        }
      }
      return false;
    });

    if (existing) {
      // Update champs depuis le calendrier (source of truth pour les RDV confirmés)
      let dirty = false;
      if (existing.dt_start !== startIso) { existing.dt_start = startIso; dirty = true; }
      if (existing.dt_end !== endIso) { existing.dt_end = endIso; dirty = true; }
      if (ev.summary && existing.summary !== ev.summary) { existing.summary = ev.summary; dirty = true; }
      if (ev.location && existing.location !== ev.location) { existing.location = ev.location; dirty = true; }
      if (ev.meeting_url && !existing.meeting_url) { existing.meeting_url = ev.meeting_url; dirty = true; }
      if (existing.platform === 'unknown' && ev.platform) { existing.platform = ev.platform; dirty = true; }
      if (!existing.notes?.includes(`calendar_id:${ev.id}`)) {
        existing.notes = (existing.notes ? existing.notes + ' | ' : '') + `calendar_id:${ev.id}`;
        dirty = true;
      }
      // RDV calendar = automatiquement passé à confirmed (le user a accepté)
      if (existing.status === 'pending') { existing.status = 'confirmed'; dirty = true; }
      if (dirty) updated++;
    } else {
      // Si pas de match prospect: extraire la boîte depuis le domaine de l'organizer
      const organizerEmail = ev.organizer || (ev.attendees || [])[0] || '';
      const organizerDomain = organizerEmail.split('@')[1] || '';
      const fallbackCompany = match?.p.company
        || (organizerDomain && !organizerDomain.includes('vanguard-systems')
            ? organizerDomain.replace(/\.(com|ch|fr|io|net|org|eu)$/i, '').replace(/[\.\-]/g, ' ')
            : null)
        || ev.summary || '(sans nom)';

      const newRow = {
        id: String(nextRdvId(rows)),
        detected_at: new Date().toISOString(),
        prospect_idx: match ? String(match.idx) : '',
        company: fallbackCompany,
        contact: match?.p.contact || (organizerEmail ? organizerEmail.split('@')[0].replace(/\./g, ' ') : ''),
        email: match?.p.email || organizerEmail || '',
        dt_start: startIso,
        dt_end: endIso,
        summary: ev.summary || `RDV ${fallbackCompany}`,
        location: ev.location || '',
        meeting_url: ev.meeting_url || '',
        platform: ev.platform || 'unknown',
        source_reply_file: '',
        status: 'confirmed',
        notes: `calendar_id:${ev.id}${match ? '' : ' [non-matched]'}`,
      };
      rows.push(newRow);
      created++;
      if (!match) untracked++;
    }
  }
  saveRdv(rows);
  return { synced_at: snapshot.synced_at, created, updated, untracked, total_events: events.length };
}

// Backfill: rescanne data/replies/*.txt et tente d'extraire des RDV pour les mails déjà ingérés
export function backfillFromReplies(prospects) {
  if (!existsSync(REPLIES_DIR)) return { scanned: 0, created: 0 };
  const files = readdirSync(REPLIES_DIR).filter(f => f.endsWith('.txt') && !f.startsWith('._'));
  let scanned = 0, created = 0;
  for (const file of files) {
    scanned++;
    const text = readFileSync(join(REPLIES_DIR, file), 'utf-8');
    const split = text.split('\n--- BODY ---\n');
    if (split.length < 2) continue;
    const headers = {};
    for (const line of split[0].split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    const body = split[1];
    const fromMatch = (headers.From || '').match(/<([^>]+)>/) || [, headers.From];
    const fromAddr = (fromMatch[1] || '').toLowerCase().trim();
    const prospectEntry = prospects.findIndex(p => (p.email || '').toLowerCase().trim() === fromAddr);
    if (prospectEntry < 0) continue;
    const prospect = prospects[prospectEntry];
    const result = recordRdv({
      prospect,
      prospectIdx: prospectEntry,
      replyFile: file,
      body,
      ics: null, // on n'a pas l'ICS ici (pas sauvegardé pour les replies déjà capturés)
      fallbackSubject: headers.Subject,
    });
    if (result && !result._duplicate) created++;
  }
  return { scanned, created };
}

export { loadRdv, saveRdv };
