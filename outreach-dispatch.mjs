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
import { createTransport } from 'nodemailer';
import yaml from 'js-yaml';
import { inferClassification, painPoint, primaryService, proofPoint, signalLine, slugify, subjectForRow } from './prospection-core.mjs';
import { loadProspectionTsv, saveProspectionTsv } from './prospection-tsv.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROSPECTION_FILE = join(ROOT, 'data', 'prospection.tsv');
const PROFILE_FILE = join(ROOT, 'config', 'profile.yml');
const SMTP_FILE = join(ROOT, 'config', 'smtp.yml');
const QUEUE_DIR = join(ROOT, 'output', 'prospection', 'queue');

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
};

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

function buildHtmlEmail(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<div style="font-family: Tahoma; font-size: 14px; color: #000;">${escaped}</div>`;
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
  const service = primaryService(row, profile);
  const companyName = profile.consultant?.company_name || 'Vanguard Systems';
  return [
    greeting(row),
    '',
    signalLine(row),
    '',
    `Dans ce type de situation, le plus utile est souvent de mettre en place ${service.label} pour ${painPoint(row)}.`,
    '',
    proofPoint(row),
    '',
    `Si le sujet est d'actualite chez ${row.company}, je peux vous proposer un echange de 20 minutes pour voir s'il y a un angle utile et concret.`,
    '',
    'Bien cordialement,',
    profile.consultant?.full_name || 'Tai Van',
    companyName,
    profile.consultant?.phone || '',
    profile.consultant?.portfolio_url || '',
  ].filter(Boolean).join('\n');
}

function followup1(row) {
  const service = primaryService(row, loadProfile());
  return [
    greeting(row),
    '',
    `Je reviens vers vous une seule fois concernant ${service.label}.`,
    '',
    `L'idee n'est pas de lancer un gros chantier, mais de voir si cela peut aider ${row.company} a ${painPoint(row)} avec un cadre simple et rapidement mobilisable.`,
    '',
    "Si le sujet est encore ouvert, un court echange suffit pour valider s'il y a un angle utile.",
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
    const subjectLine = subjectForRow(row, profile);
    const body = bodyForStage(stage, row, profile);
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
    } else {
      console.log(filePath);
    }
  }

  if (live) {
    saveTable(null, rows);
    console.log(`CRM mis a jour: ${PROSPECTION_FILE}`);
  } else {
    console.log('Mode preview uniquement. Utiliser --live pour envoyer et mettre a jour le CRM.');
  }
}

await main();
