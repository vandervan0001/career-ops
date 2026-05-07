#!/usr/bin/env node
/**
 * check-replies.mjs — Scrape la boîte tai.van@vanguard-systems.ch via IMAP
 *
 * Connecte à imap.gmail.com avec App Password Workspace, scanne INBOX, matche
 * les expéditeurs contre data/prospection.tsv, et met à jour le statut +
 * stocke le texte complet de la réponse dans data/replies/{date}-{slug}.txt
 *
 * Usage:
 *   node check-replies.mjs              # check last 24h
 *   node check-replies.mjs --days 3
 *   node check-replies.mjs --dry-run    # preview only
 *
 * Détecte:
 *   - rdv_potentiel: "intéressé", "rdv", "calendrier", "appel"…
 *   - pass_poli: "pas de besoin", "merci mais", "pas pour l'instant"…
 *   - bounce: "undeliverable", "delivery failed", "mailer-daemon"
 *   - desabonne: "stop", "unsubscribe", "ne plus recevoir"
 *   - reponse: tout autre mail d'un prospect connu
 *
 * Logique conservatrice:
 *   - Update uniquement si status courant ∈ {envoye, relance_1, relance_2}
 *   - Ne re-traite pas un message déjà ingéré (data/replies-seen.tsv)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import yaml from 'js-yaml';
import { loadProspectionTsv, saveProspectionTsv } from './prospection-tsv.mjs';
import { recordRdv } from './rdv-detector.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SMTP_FILE = join(ROOT, 'config', 'smtp.yml');
const PROSPECTION_FILE = join(ROOT, 'data', 'prospection.tsv');
const REPLIES_DIR = join(ROOT, 'data', 'replies');
const SEEN_FILE = join(ROOT, 'data', 'replies-seen.tsv');

const UNSUB = [
  /\bstop\b/i, /d[ée]sabonne/i, /unsubscribe/i, /ne plus recevoir/i,
  /retir[eé].*liste/i, /plus de message/i,
];
const BOUNCE = [
  /undeliverable/i, /delivery.*(failed|failure|status)/i,
  /mailbox.*(not found|unavailable|full)/i,
  /user.*(unknown|not found)/i, /message.*not delivered/i,
  /permanent.*failure/i, /mailer.daemon/i, /address rejected/i,
];
const PASS_POLI = [
  /pas de besoin/i, /pas (pour l'instant|d'urgence)/i,
  /merci.*mais/i, /pas int[ée]ress[ée]/i,
  /(no|pas).*(merci|need)/i, /(garde|gardons).*contact/i,
  /pas de projet/i, /not.*relevant/i, /not.*interested/i,
];
const POSITIVE = [
  /int[ée]ress[ée]/i, /rdv|rendez.vous/i, /\bappel\b/i, /\bcall\b/i,
  /calendrier|cr[ée]neau/i, /volontiers|avec plaisir/i, /^d'accord/i,
  /quand.*disponible/i, /discutons/i, /\bdemo\b/i,
  /happy to/i, /let.s talk/i, /interesting/i,
];

function loadConfig() {
  if (!existsSync(SMTP_FILE)) {
    throw new Error('config/smtp.yml introuvable');
  }
  const cfg = yaml.load(readFileSync(SMTP_FILE, 'utf-8'));
  if (!cfg.smtp?.imap) {
    throw new Error('config/smtp.yml: bloc smtp.imap absent. Voir documentation.');
  }
  return cfg.smtp.imap;
}

function classify(subject, body) {
  const text = `${subject || ''} ${body || ''}`.toLowerCase();
  for (const re of BOUNCE) if (re.test(text)) return 'bounce';
  for (const re of UNSUB) if (re.test(text)) return 'desabonne';
  for (const re of PASS_POLI) if (re.test(text)) return 'pass_poli';
  for (const re of POSITIVE) if (re.test(text)) return 'rdv_potentiel';
  return 'reponse';
}

function loadSeen() {
  if (!existsSync(SEEN_FILE)) return new Set();
  return new Set(
    readFileSync(SEEN_FILE, 'utf-8')
      .split('\n').filter(Boolean)
      .map(l => l.split('\t')[0])
  );
}

function markSeen(messageId, fromAddr, prospectIdx, classification) {
  if (!existsSync(SEEN_FILE)) {
    writeFileSync(SEEN_FILE, 'message_id\tfrom\tprospect_idx\tclassification\tts\n');
  }
  appendFileSync(SEEN_FILE, [messageId, fromAddr, prospectIdx, classification, new Date().toISOString()].join('\t') + '\n');
}

function slugify(s) {
  return (s || 'unknown').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

function saveReplyBody(prospect, parsed, classification) {
  if (!existsSync(REPLIES_DIR)) mkdirSync(REPLIES_DIR, { recursive: true });
  const ts = (parsed.date || new Date()).toISOString().slice(0, 10);
  const slug = slugify(prospect.company);
  const fname = `${ts}-${slug}.txt`;
  const path = join(REPLIES_DIR, fname);
  const body = parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '';
  const headers = [
    `From: ${parsed.from?.text || ''}`,
    `To: ${parsed.to?.text || ''}`,
    `Date: ${(parsed.date || new Date()).toISOString()}`,
    `Subject: ${parsed.subject || ''}`,
    `Message-ID: ${parsed.messageId || ''}`,
    `Classification: ${classification}`,
    `Prospect: ${prospect.company} (${prospect.contact || prospect.email})`,
  ].join('\n');
  writeFileSync(path, `${headers}\n--- BODY ---\n${body}\n`);

  // Sauvegarde l'ICS attaché (text/calendar) si présent → utilisé par rdv-detector
  let icsContent = null;
  for (const att of (parsed.attachments || [])) {
    if (/text\/calendar/i.test(att.contentType || '')) {
      const icsPath = join(REPLIES_DIR, `${ts}-${slug}.ics`);
      const buf = att.content || Buffer.from('');
      writeFileSync(icsPath, buf);
      icsContent = buf.toString('utf-8');
      break;
    }
  }
  return { fname, body, icsContent };
}

const STATUS_FROM_CLASS = {
  rdv_potentiel: 'reponse',
  reponse: 'reponse',
  pass_poli: 'repondu_pass_poli',
  desabonne: 'Discarded',
  bounce: 'envoye', // garde envoyé, mais marque BOUNCE en notes
};

async function checkReplies({ days, dryRun }) {
  const config = loadConfig();
  const { rows } = loadProspectionTsv(PROSPECTION_FILE);
  const byEmail = new Map();
  rows.forEach((r, idx) => {
    if (r.email) byEmail.set(r.email.toLowerCase().trim(), { row: r, idx });
  });
  const seen = loadSeen();

  console.log(`\n=== Check Replies (Workspace IMAP) ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Période: ${days} dernier(s) jour(s)`);
  console.log(`Prospects indexés: ${byEmail.size}`);
  console.log(`Déjà vus: ${seen.size}`);

  const imap = new ImapFlow({
    host: config.host,
    port: config.port || 993,
    secure: config.secure !== false,
    auth: { user: config.auth.user, pass: config.auth.pass },
    logger: false,
  });

  let stats = { scanned: 0, matched: 0, skipped: 0, updated: 0, byClass: {} };

  try {
    await imap.connect();
    const lock = await imap.getMailboxLock('INBOX');
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const messages = imap.fetch({ since }, { source: true, envelope: true, uid: true });

      for await (const msg of messages) {
        stats.scanned++;
        const parsed = await simpleParser(msg.source);
        const fromAddr = (parsed.from?.value?.[0]?.address || '').toLowerCase().trim();
        if (!fromAddr) continue;
        const messageId = parsed.messageId || `uid-${msg.uid}`;
        if (seen.has(messageId)) { stats.skipped++; continue; }

        const match = byEmail.get(fromAddr);
        if (!match) continue;
        stats.matched++;

        const { row: prospect, idx } = match;
        const isActive = ['envoye', 'relance_1', 'relance_2', 'nouveau'].includes(prospect.status);
        const classification = classify(parsed.subject || '', parsed.text || '');
        stats.byClass[classification] = (stats.byClass[classification] || 0) + 1;

        const today = new Date().toISOString().slice(0, 10);
        const subject = (parsed.subject || '(sans sujet)').slice(0, 80);
        console.log(`\n[${classification.toUpperCase()}] ${prospect.company} (${fromAddr})${isActive ? '' : ' [already-handled]'}`);
        console.log(`  Sujet: ${subject}`);

        if (dryRun) continue;

        // Toujours sauvegarder le reply (pour RDV detection même si déjà classé)
        const { fname: replyFile, body: replyBody, icsContent } = saveReplyBody(prospect, parsed, classification);

        // Update prospect status uniquement si en outreach actif
        if (isActive) {
          const newStatus = classification === 'bounce' ? prospect.status : STATUS_FROM_CLASS[classification];
          prospect.status = newStatus;
          const noteTag = classification === 'bounce'
            ? `BOUNCE ${today}: ${subject}`
            : `Réponse ${today} (${classification}): ${subject} [reply:${replyFile}]`;
          prospect.notes = prospect.notes ? `${prospect.notes} | ${noteTag}` : noteTag;
          stats.updated++;
        } else {
          stats.skipped++;
        }
        markSeen(messageId, fromAddr, idx, isActive ? classification : 'already-handled');

        // Détection RDV — toujours tentée, indépendante du status
        try {
          const rdv = recordRdv({
            prospect, prospectIdx: idx, replyFile,
            body: replyBody, ics: icsContent,
            fallbackSubject: parsed.subject,
          });
          if (rdv && !rdv._duplicate) {
            stats.rdvDetected = (stats.rdvDetected || 0) + 1;
            console.log(`  -> RDV détecté: ${rdv.platform} ${rdv.dt_start || '(date à confirmer)'}`);
          }
        } catch (err) {
          console.warn(`  -> Erreur détection RDV: ${err.message}`);
        }
      }

      if (!dryRun && stats.updated > 0) {
        saveProspectionTsv(PROSPECTION_FILE, rows);
      }

      console.log(`\n=== Résultat ===`);
      console.log(`Scanned: ${stats.scanned} | Matched: ${stats.matched} | Skipped: ${stats.skipped} | Updated: ${stats.updated}`);
      Object.entries(stats.byClass).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
    } finally {
      lock.release();
    }
    await imap.logout();
  } catch (err) {
    console.error(`Erreur IMAP: ${err.message}`);
    if (err.authenticationFailed) {
      console.error('-> Vérifiez le bloc smtp.imap dans config/smtp.yml et que IMAP est activé sur Gmail.');
    }
    throw err;
  }

  return stats;
}

// CLI uniquement si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };
  const days = parseInt(getArg('--days') || '1', 10);
  const dryRun = args.includes('--dry-run');
  await checkReplies({ days, dryRun });
}

export { checkReplies };
