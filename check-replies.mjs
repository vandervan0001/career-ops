#!/usr/bin/env node
/**
 * check-replies.mjs — Check inbox for unsubscribes, bounces, and replies
 *
 * Connects to info@scaliab.io via IMAP, scans recent emails, and updates
 * prospect statuses in data/prospects.tsv automatically.
 *
 * Usage:
 *   node check-replies.mjs              # Check last 24h
 *   node check-replies.mjs --days 3     # Check last 3 days
 *   node check-replies.mjs --dry-run    # Preview without updating
 *
 * Detects:
 *   - Unsubscribes: "stop", "désabonnement", "unsubscribe", "ne plus recevoir"
 *   - Bounces: "undeliverable", "delivery failed", "mailbox not found"
 *   - Positive replies: "intéressé", "rdv", "diagnostic", "calendrier"
 *   - General replies: anything from a known prospect email
 *
 * Updates data/prospects.tsv accordingly.
 * Reads IMAP config from config/smtp.yml (scaliab.imap section)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SMTP_FILE = join(ROOT, 'config', 'smtp.yml');
const PROSPECTS_FILE = join(ROOT, 'data', 'prospects.tsv');

// --- Detection patterns ---
const UNSUB_PATTERNS = [
  /\bstop\b/i,
  /d[ée]sabonne/i,
  /unsubscribe/i,
  /ne plus recevoir/i,
  /retir[eé].*liste/i,
  /plus de message/i,
  /arr[eê]te/i,
];

const BOUNCE_PATTERNS = [
  /undeliverable/i,
  /delivery.*(failed|failure|status)/i,
  /mailbox.*(not found|unavailable|full)/i,
  /user.*(unknown|not found)/i,
  /message.*not delivered/i,
  /permanent.*failure/i,
  /mailer.daemon/i,
];

const POSITIVE_PATTERNS = [
  /int[ée]ress[ée]/i,
  /rdv|rendez.vous/i,
  /diagnostic/i,
  /r[ée]serv/i,
  /calendrier|cr[ée]neau/i,
  /appel|appelez/i,
  /volontiers|avec plaisir/i,
  /d'accord/i,
  /quand.*disponible/i,
];

// --- Config ---
function loadConfig() {
  if (!existsSync(SMTP_FILE)) {
    console.error('ERREUR: config/smtp.yml introuvable.');
    process.exit(1);
  }
  const config = yaml.load(readFileSync(SMTP_FILE, 'utf-8'));
  return config.scaliab;
}

// --- Prospects ---
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

// --- Email classification ---
function classifyEmail(subject, body) {
  const text = (subject + ' ' + body).toLowerCase();

  for (const pat of BOUNCE_PATTERNS) {
    if (pat.test(text)) return 'bounce';
  }
  for (const pat of UNSUB_PATTERNS) {
    if (pat.test(text)) return 'desabonne';
  }
  for (const pat of POSITIVE_PATTERNS) {
    if (pat.test(text)) return 'rdv_potentiel';
  }
  return 'repondu';
}

// --- Main ---
async function checkReplies({ days, dryRun }) {
  const config = loadConfig();
  const { header, prospects } = loadProspects();
  const prospectEmails = new Map();
  for (const p of prospects) {
    if (p.email) prospectEmails.set(p.email.toLowerCase(), p);
  }

  console.log(`\n=== Check Replies ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'MISE À JOUR'}`);
  console.log(`Période: ${days} derniers jours`);
  console.log(`Prospects avec email: ${prospectEmails.size}`);
  console.log('');

  // Connect IMAP
  const imap = new ImapFlow({
    host: config.imap?.host || config.host,
    port: config.imap?.port || 993,
    secure: config.imap?.secure !== false,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
    logger: false,
  });

  try {
    await imap.connect();
    console.log('Connecté à la boîte mail.');

    const lock = await imap.getMailboxLock('INBOX');
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const messages = imap.fetch(
        { since },
        { source: true, envelope: true }
      );

      let processed = 0;
      let updates = { desabonne: 0, bounce: 0, repondu: 0, rdv_potentiel: 0 };

      for await (const msg of messages) {
        const parsed = await simpleParser(msg.source);
        const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
        const subject = parsed.subject || '';
        const body = parsed.text || '';

        // Check if sender is a known prospect
        const prospect = prospectEmails.get(fromAddr);
        if (!prospect) continue;

        // Skip already processed
        if (['desabonne', 'bounce', 'rdv_pris', 'converti', 'pas_interesse'].includes(prospect.statut)) continue;

        const classification = classifyEmail(subject, body);
        const today = new Date().toISOString().slice(0, 10);

        console.log(`[${fromAddr}] ${prospect.entreprise}`);
        console.log(`  Sujet: ${subject.slice(0, 80)}`);
        console.log(`  Classification: ${classification}`);

        if (!dryRun) {
          if (classification === 'desabonne') {
            prospect.statut = 'desabonne';
            prospect.notes += ` | unsub:${today}`;
          } else if (classification === 'bounce') {
            prospect.statut = 'bounce';
            prospect.notes += ` | bounce:${today}`;
          } else if (classification === 'rdv_potentiel') {
            prospect.statut = 'repondu';
            prospect.notes += ` | réponse positive:${today} VÉRIFIER`;
          } else {
            prospect.statut = 'repondu';
            prospect.notes += ` | réponse:${today}`;
          }
        }

        updates[classification]++;
        processed++;
      }

      if (!dryRun && processed > 0) {
        saveProspects(header, prospects);
      }

      console.log(`\n=== Résultat ===`);
      console.log(`Emails analysés depuis ${since.toISOString().slice(0, 10)}`);
      console.log(`Réponses de prospects: ${processed}`);
      console.log(`  Désabonnements: ${updates.desabonne}`);
      console.log(`  Bounces: ${updates.bounce}`);
      console.log(`  Réponses positives: ${updates.rdv_potentiel} (à vérifier)`);
      console.log(`  Réponses neutres: ${updates.repondu}`);

    } finally {
      lock.release();
    }

    await imap.logout();
  } catch (err) {
    console.error(`Erreur IMAP: ${err.message}`);
    if (err.code === 'EAUTH' || err.authenticationFailed) {
      console.error('-> Vérifiez les identifiants IMAP dans config/smtp.yml (section scaliab.imap)');
    }
    process.exit(1);
  }
}

// --- CLI ---
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
};

const days = parseInt(getArg('--days') || '1');
const dryRun = args.includes('--dry-run');

await checkReplies({ days, dryRun });
