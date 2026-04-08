#!/usr/bin/env node
/**
 * notify-mandats.mjs — Email + macOS notifications for consulting-ops events
 *
 * Usage:
 *   node notify-mandats.mjs                          # Check mandats.md for new high-score entries
 *   node notify-mandats.mjs --event "postulation"    # Notify a specific event
 *     --client "Novartis"
 *     --mandat "Automation Engineer"
 *     --score "4.3/5"
 *     --detail "CV envoyé + connection LinkedIn"
 *
 * Events:
 *   scan_complete    — Scan terminé, résumé des résultats
 *   new_mandat       — Nouveau mandat trouvé avec bon score
 *   postulation      — Candidature/message envoyé
 *   executive_alert  — Poste CDI executive détecté
 *   status_change    — Changement de statut dans le pipeline
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createTransport } from 'nodemailer';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANDATS = join(ROOT, 'data', 'mandats.md');
const SMTP_FILE = join(ROOT, 'config', 'smtp.yml');

// --- SMTP setup ---
function loadSmtp() {
  if (!existsSync(SMTP_FILE)) return null;
  const config = yaml.load(readFileSync(SMTP_FILE, 'utf-8'));
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

async function sendNotification({ subject, body, smtp }) {
  // Email
  if (smtp) {
    try {
      const mailer = createMailer(smtp);
      await mailer.sendMail({
        from: `"consulting-ops" <${smtp.from.address}>`,
        to: smtp.auth.user, // Self-send
        subject: `[consulting-ops] ${subject}`,
        text: body,
        html: body.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
      });
    } catch (e) {
      console.error(`Email notification failed: ${e.message}`);
    }
  }

  // macOS notification (always attempt)
  try {
    const short = subject.slice(0, 100);
    const script = `display notification "${short.replace(/"/g, '\\"')}" with title "consulting-ops" sound name "Glass"`;
    execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
  } catch (e) {
    // Silent — macOS notifications are nice-to-have
  }
}

// --- CLI ---
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
};

const smtp = loadSmtp();
const event = getArg('--event');

if (event) {
  // Direct event notification
  const client = getArg('--client') || '';
  const mandat = getArg('--mandat') || '';
  const score = getArg('--score') || '';
  const detail = getArg('--detail') || '';
  const date = new Date().toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' });

  const subjects = {
    scan_complete: `Scan termine — ${detail || 'voir resume'}`,
    new_mandat: `Nouveau mandat ${score} — ${client} / ${mandat}`,
    postulation: `Postulation envoyee — ${client} / ${mandat}`,
    executive_alert: `EXECUTIVE — ${client} / ${mandat} (${score})`,
    status_change: `Statut mis a jour — ${client} / ${mandat}`,
  };

  const bodies = {
    scan_complete: `**Scan automatique termine** (${date})\n\n${detail}\n\nVoir data/pipeline.md et data/mandats.md pour les details.`,
    new_mandat: `**Nouveau mandat detecte** (${date})\n\n**Client:** ${client}\n**Mandat:** ${mandat}\n**Score:** ${score}\n\n${detail}\n\nReport disponible dans reports/.`,
    postulation: `**Postulation envoyee** (${date})\n\n**Client:** ${client}\n**Mandat:** ${mandat}\n**Score:** ${score}\n\n**Actions effectuees:**\n${detail}\n\nVoir le report complet dans reports/.`,
    executive_alert: `**Poste executive detecte** (${date})\n\n**Client:** ${client}\n**Mandat:** ${mandat}\n**Score:** ${score}\n\n${detail}\n\nCe poste necessite une action manuelle. Review le report dans reports/.`,
    status_change: `**Changement de statut** (${date})\n\n**Client:** ${client}\n**Mandat:** ${mandat}\n\n${detail}`,
  };

  const subject = subjects[event] || `${event} — ${client} / ${mandat}`;
  const body = bodies[event] || `Event: ${event}\nClient: ${client}\nMandat: ${mandat}\nScore: ${score}\n\n${detail}`;

  await sendNotification({ subject, body, smtp });
  console.log(`Notification envoyee: ${subject}`);

} else {
  // Default: check mandats.md for recent high-score entries
  try {
    const content = readFileSync(MANDATS, 'utf-8');
    const lines = content.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Client'));

    if (lines.length === 0) process.exit(0);

    const recent = lines.slice(-5);
    const alerts = [];

    for (const line of recent) {
      const parts = line.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length < 9) continue;

      const client = parts[2];
      const mandat = parts[3];
      const scoreRaw = parts[4];
      const notes = parts[9] || '';

      const scoreMatch = scoreRaw.match(/([\d.]+)/);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

      const isExecutive = notes.includes('EXECUTIVE') || mandat.includes('[EXECUTIVE]');
      const isHighScore = score >= 4.0;

      if (isHighScore || isExecutive) {
        const type = isExecutive ? 'EXECUTIVE' : 'HIGH SCORE';
        alerts.push(`${type}: ${client} — ${mandat} (${scoreRaw})`);
      }
    }

    if (alerts.length > 0) {
      const subject = `${alerts.length} mandat(s) prioritaire(s) detecte(s)`;
      const body = `**consulting-ops — Alertes pipeline**\n\n${alerts.join('\n')}\n\nVoir data/mandats.md et reports/ pour les details.`;
      await sendNotification({ subject, body, smtp });
      console.log(`${alerts.length} notification(s) envoyee(s)`);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}
