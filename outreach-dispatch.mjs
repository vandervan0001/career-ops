#!/usr/bin/env node
/**
 * outreach-dispatch.mjs — Send outbound emails and update prospection CRM
 *
 * Usage:
 *   node outreach-dispatch.mjs --status nouveau --top 5
 *   node outreach-dispatch.mjs --status envoye --top 5 --live
 *   node outreach-dispatch.mjs --company "Straumann Group" --live
 *
 * Default mode is preview only. Use --live to actually send and update CRM.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createTransport } from 'nodemailer';
import yaml from 'js-yaml';
import { contextLine, ctaLine, inferClassification, painPoint, presentationLine, primaryService, propositionLine, slugify, subjectForRow } from './prospection-core.mjs';
import { loadProspectionTsv, saveProspectionTsv } from './prospection-tsv.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROSPECTION_FILE = join(ROOT, 'data', 'prospection.tsv');
const PROFILE_FILE = join(ROOT, 'config', 'profile.yml');
const SMTP_FILE = join(ROOT, 'config', 'smtp.yml');
const QUEUE_DIR = join(ROOT, 'output', 'prospection', 'queue');
const SENT_DIR = join(ROOT, 'output', 'prospection', 'sent');

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
};

const FROM_QUEUE = getArg('--from-queue', null);
const OVERRIDE_SUBJECT = getArg('--subject', null);
const OVERRIDE_BODY = getArg('--body', null);

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function loadProfile() {
  if (!existsSync(PROFILE_FILE)) return {};
  return yaml.load(readFileSync(PROFILE_FILE, 'utf-8')) || {};
}

function loadSmtp() {
  if (!existsSync(SMTP_FILE)) {
    throw new Error('config/smtp.yml introuvable');
  }
  const config = yaml.load(readFileSync(SMTP_FILE, 'utf-8')) || {};
  return config.smtp;
}

function createMailer(smtp) {
  return createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.auth.user, pass: smtp.auth.pass },
  });
}

function loadSignatureHtml() {
  const path = join(ROOT, 'config', 'signature.html');
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

function buildHtmlEmail(text) {
  // Sépare le corps principal de la signature texte (avant "Bien cordialement,")
  const sigIdx = String(text).indexOf('Bien cordialement,');
  const mainRaw = sigIdx > -1 ? String(text).slice(0, sigIdx).trimEnd() : String(text);
  const closure = 'Bien cordialement,';

  const escape = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const paragraphs = escape(mainRaw)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 22px;font-family:Tahoma,Arial,sans-serif;font-size:14.5px;line-height:1.75;color:#1a1a2e;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');

  const signatureHtml = loadSignatureHtml();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Vanguard Systems</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Tahoma,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background-color:#ffffff;border:1px solid #e2e4e8;border-radius:8px;border-top:4px solid rgb(0,21,163);box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <tr><td style="padding:36px 40px 8px;">
          ${paragraphs}
          <p style="margin:32px 0 0;font-family:Tahoma,Arial,sans-serif;font-size:14.5px;line-height:1.75;color:#1a1a2e;">${closure}</p>
        </td></tr>
        <tr><td style="padding:24px 40px 36px;">
          ${signatureHtml}
        </td></tr>
      </table>
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;margin-top:16px;">
        <tr><td align="center" style="font-family:Tahoma,Arial,sans-serif;font-size:11px;line-height:1.5;color:#9ca0a8;padding:8px;">
          Vanguard Systems Sàrl &middot; Chemin du Grand-Pré 4, 1052 Le Mont-sur-Lausanne &middot; Suisse
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function loadTable() {
  return loadProspectionTsv(PROSPECTION_FILE);
}

function saveTable(_header, rows) {
  saveProspectionTsv(PROSPECTION_FILE, rows);
}

function greeting(row) {
  const contact = (row.contact || '').trim();
  if (!contact) return 'Bonjour,';
  const parts = contact.split(' ');
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  return `Bonjour Monsieur/Madame ${lastName},`;
}

function initialEmail(row, profile) {
  const ctx = contextLine(row);
  const blocks = [greeting(row)];
  if (ctx) blocks.push(ctx);
  blocks.push(presentationLine(row));
  blocks.push(propositionLine(row));
  blocks.push(ctaLine());
  blocks.push('Bien cordialement,');
  blocks.push(profile.consultant?.full_name || 'Tai Van');
  return blocks.filter(Boolean).join('\n\n');
}

function followup1(row) {
  const service = primaryService(row, loadProfile());
  return [
    greeting(row),
    '',
    `Je reviens vers vous une seule fois concernant ${service.label}.`,
    '',
    `L'idée n'est pas de lancer un gros chantier, mais de voir si cela peut aider ${row.company} à ${painPoint(row)} avec un cadre simple et rapidement mobilisable.`,
    '',
    "Si le sujet est encore ouvert, un court échange suffit pour valider s'il y a un angle utile.",
    '',
    'Bien cordialement,',
    'Tai Van',
  ].join('\n');
}

function followup2(row) {
  return [
    greeting(row),
    '',
    'Dernier message de ma part sur ce sujet.',
    '',
    `Si ${row.company} a un besoin en automation, OT ou support d'installations critiques dans les prochains mois, je peux reprendre la discussion au bon moment.`,
    '',
    'Bien cordialement,',
    'Tai Van',
  ].join('\n');
}

function stageForStatus(status) {
  if (status === 'nouveau') return 'initial';
  if (status === 'envoye') return 'relance_1';
  if (status === 'relance_1') return 'relance_2';
  return null;
}

function nextStatus(status) {
  if (status === 'nouveau') return 'envoye';
  if (status === 'envoye') return 'relance_1';
  if (status === 'relance_1') return 'relance_2';
  return status;
}

function bodyForStage(stage, row, profile) {
  if (stage === 'initial') return initialEmail(row, profile);
  if (stage === 'relance_1') return followup1(row);
  if (stage === 'relance_2') return followup2(row);
  return '';
}

function rank(row) {
  let score = row.score || 0;
  if (row.status === 'nouveau') score += 0.3;
  if (row.status === 'envoye') score += 0.5;
  if (row.status === 'relance_1') score += 0.7;
  if (!row.email) score -= 5;
  return score;
}

function selectRows(rows, profile) {
  const company = getArg('--company');
  const status = getArg('--status');
  const top = Number(getArg('--top', '0'));

  let selected = rows.filter((row) => row.email).filter((row) => stageForStatus(row.status));
  selected = selected.filter((row) => !['concurrent', 'recruteur'].includes(inferClassification(row, profile)));
  if (company) {
    selected = selected.filter((row) => row.company.toLowerCase().includes(company.toLowerCase()));
  }
  if (status) {
    selected = selected.filter((row) => row.status === status);
  }
  selected = selected.sort((a, b) => rank(b) - rank(a));
  if (top > 0) selected = selected.slice(0, top);
  return selected;
}

function appendNote(existing, note) {
  if (!existing) return note;
  return `${existing}. ${note}`;
}

async function sendMail(mailer, smtp, row, subjectLine, body) {
  return mailer.sendMail({
    from: `"${smtp.from.name}" <${smtp.from.address}>`,
    to: row.email,
    subject: subjectLine,
    text: body,
    html: buildHtmlEmail(body),
  });
}

async function main() {
  // --from-queue: read approved messages from PrepAgent/ReviewAgent queue file
  if (FROM_QUEUE) {
    if (!existsSync(FROM_QUEUE)) {
      console.log(`Queue file not found: ${FROM_QUEUE}`);
      return;
    }
    const live = hasFlag('--live');
    let smtp = null;
    let mailer = null;
    if (live) {
      smtp = loadSmtp();
      mailer = createMailer(smtp);
    }
    const lines = readFileSync(FROM_QUEUE, 'utf-8').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    for (const line of lines) {
      const [company, contact, email, , , subject, body] = line.split('\t');
      if (!email || !subject || email === 'email') continue;
      const bodyDecoded = (body || '').replace(/\\n/g, '\n');
      const row = { company: company || '', contact: contact || '', email };
      console.log(`${live ? 'ENVOI' : 'PREVIEW'} ${company} <${email}>`);
      console.log(`Objet: ${subject}`);
      if (live) {
        const info = await sendMail(mailer, smtp, row, subject, bodyDecoded);
        console.log(`OK ${info.messageId}`);
      }
    }
    return;
  }

  // Normal flow (existing code below)
  const { rows } = loadTable();
  const profile = loadProfile();
  const selected = selectRows(rows, profile);
  const live = hasFlag('--live');

  if (selected.length === 0) {
    console.log('Aucun compte eligible pour dispatch.');
    return;
  }

  mkdirSync(QUEUE_DIR, { recursive: true });

  let smtp = null;
  let mailer = null;
  if (live) {
    smtp = loadSmtp();
    mailer = createMailer(smtp);
  }

  for (const row of selected) {
    const stage = stageForStatus(row.status);
    const subjectLine = OVERRIDE_SUBJECT || subjectForRow(row, profile);
    const body = OVERRIDE_BODY || bodyForStage(stage, row, profile);
    const filePath = join(QUEUE_DIR, `${slugify(row.company)}-${stage}.txt`);
    writeFileSync(filePath, `${body}\n`);

    console.log(`${live ? 'ENVOI' : 'PREVIEW'} ${row.company} -> ${stage} <${row.email}>`);
    console.log(`Objet: ${subjectLine}`);

    if (live) {
      const info = await sendMail(mailer, smtp, row, subjectLine, body);
      row.status = nextStatus(row.status);
      row.date_envoi = nowDate();
      row.message_sent = row.message_sent || 'email';
      row.notes = appendNote(
        row.notes,
        `${stage} envoye ${nowDate()} — objet ${subjectLine} — ${info.messageId}`
      );
      console.log(`OK ${info.messageId}`);

      // Archive permanent et horodate du mail envoyé pour consultation
      const now = new Date();
      const dateDir = join(SENT_DIR, now.toISOString().slice(0, 10));
      mkdirSync(dateDir, { recursive: true });
      const stamp = now.toISOString().replace(/[:.]/g, '-');
      const archivePath = join(dateDir, `${stamp}-${slugify(row.company)}-${stage}.txt`);
      const fromAddr = smtp?.from?.address || smtp?.auth?.user || '';
      const fromName = smtp?.from?.name || '';
      const header = [
        `Date: ${now.toISOString()}`,
        `From: ${fromName ? `${fromName} <${fromAddr}>` : fromAddr}`,
        `To: ${row.contact ? `${row.contact} <${row.email}>` : row.email}`,
        `Subject: ${subjectLine}`,
        `Message-ID: ${info.messageId}`,
        `Company: ${row.company}`,
        `Sector: ${row.sector}`,
        `Signal: ${row.signal}`,
        `Stage: ${stage}`,
        '',
        '--- BODY ---',
        '',
      ].join('\n');
      writeFileSync(archivePath, `${header}${body}\n`);
    } else {
      console.log(filePath);
    }
  }

  if (live) {
    saveTable(null, rows);
    console.log(`CRM mis a jour: ${PROSPECTION_FILE}`);
    // Régénère le dashboard sent/index.html après chaque envoi.
    try {
      execSync(`node ${join(ROOT, 'show-sent.mjs')}`, { stdio: 'inherit' });
    } catch (err) {
      console.warn('Dashboard refresh failed:', err.message);
    }
  } else {
    console.log('Mode preview uniquement. Utiliser --live pour envoyer et mettre a jour le CRM.');
  }
}

await main();
