#!/usr/bin/env node
/**
 * notify-mandats.mjs — Rich email + macOS notifications for consulting-ops
 *
 * Usage:
 *   node notify-mandats.mjs --event "postulation" --client "UCB" --mandat "Automation Lead" --score "4.7/5" --detail "..." --report "reports/026-ucb.md" --email-sent "denis.fabris@ucb.com" --linkedin-sent "linkedin.com/in/denis-fabris"
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createTransport } from 'nodemailer';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANDATS_FILE = join(ROOT, 'data', 'mandats.md');
const PROSP_FILE = join(ROOT, 'data', 'prospection.tsv');
const SMTP_FILE = join(ROOT, 'config', 'smtp.yml');
const DASHBOARD_URL = 'file:///Volumes/Tai_SSD/dev/Projects/Prospection/output/dashboard.html';

function loadSmtp() {
  if (!existsSync(SMTP_FILE)) return null;
  const config = yaml.load(readFileSync(SMTP_FILE, 'utf-8'));
  return config.smtp;
}

function createMailer(smtp) {
  return createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.secure,
    auth: { user: smtp.auth.user, pass: smtp.auth.pass },
  });
}

function loadReport(reportPath) {
  if (!reportPath) return null;
  const fullPath = join(ROOT, reportPath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf-8');
}

function getPipelineStats() {
  if (!existsSync(MANDATS_FILE)) return null;
  const content = readFileSync(MANDATS_FILE, 'utf-8');
  const lines = content.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Client'));
  const total = lines.length;
  let topCount = 0, prestaCount = 0, cdiCount = 0;
  lines.forEach(l => {
    const scoreMatch = l.match(/([\d.]+)\/5/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
    if (score >= 4.0) topCount++;
    if (l.includes('[PRESTA]')) prestaCount++;
    if (l.includes('[CDI]')) cdiCount++;
  });
  let prospCount = 0;
  if (existsSync(PROSP_FILE)) {
    prospCount = readFileSync(PROSP_FILE, 'utf-8').split('\n').filter(l => l.trim() && !l.startsWith('date\t')).length;
  }
  return { total, topCount, prestaCount, cdiCount, prospCount };
}

function htmlHeader() {
  return `
<div style="background:#ffffff;color:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;max-width:640px;margin:0 auto">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb">
    <span style="font-size:18px;font-weight:700;color:#1a1a2e">consulting-ops</span>
    <span style="color:#6b7280;font-size:12px">Vanguard Systems</span>
  </div>`;
}

function htmlFooter(stats) {
  const s = stats || {};
  return `
  <div style="margin-top:20px;padding-top:16px;border-top:2px solid #e5e7eb">
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px"><tr>
      <td style="background:#f3f4f6;padding:8px 12px;border-radius:6px;font-size:13px;text-align:center"><strong style="color:#1a1a2e">${s.total || 0}</strong><br><span style="color:#6b7280;font-size:11px">mandats</span></td>
      <td width="8"></td>
      <td style="background:#f3f4f6;padding:8px 12px;border-radius:6px;font-size:13px;text-align:center"><strong style="color:#16a34a">${s.topCount || 0}</strong><br><span style="color:#6b7280;font-size:11px">top score</span></td>
      <td width="8"></td>
      <td style="background:#f3f4f6;padding:8px 12px;border-radius:6px;font-size:13px;text-align:center"><strong style="color:#0891b2">${s.prestaCount || 0}</strong><br><span style="color:#6b7280;font-size:11px">presta</span></td>
      <td width="8"></td>
      <td style="background:#f3f4f6;padding:8px 12px;border-radius:6px;font-size:13px;text-align:center"><strong style="color:#7c3aed">${s.cdiCount || 0}</strong><br><span style="color:#6b7280;font-size:11px">CDI</span></td>
      <td width="8"></td>
      <td style="background:#f3f4f6;padding:8px 12px;border-radius:6px;font-size:13px;text-align:center"><strong style="color:#d97706">${s.prospCount || 0}</strong><br><span style="color:#6b7280;font-size:11px">leads</span></td>
    </tr></table>
    <a href="${DASHBOARD_URL}" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">Ouvrir le dashboard</a>
  </div>
</div>`;
}

function scoreColor(score) {
  const s = parseFloat(score) || 0;
  if (s >= 4.5) return '#22c55e';
  if (s >= 4.0) return '#16a34a';
  if (s >= 3.5) return '#eab308';
  return '#ef4444';
}

function typeBadge(mandat) {
  if (mandat.includes('[CDI]')) return '<span style="background:#7c3aed;color:white;padding:2px 6px;border-radius:4px;font-size:11px">CDI</span>';
  if (mandat.includes('[PRESTA]')) return '<span style="background:#0891b2;color:white;padding:2px 6px;border-radius:4px;font-size:11px">PRESTA</span>';
  return '';
}

async function sendNotification({ subject, html, smtp }) {
  if (smtp) {
    try {
      const mailer = createMailer(smtp);
      await mailer.sendMail({
        from: `"consulting-ops" <${smtp.from.address}>`,
        to: smtp.auth.user,
        subject: `[consulting-ops] ${subject}`,
        html,
      });
    } catch (e) {
      console.error(`Email failed: ${e.message}`);
    }
  }
  try {
    const short = subject.slice(0, 100);
    execSync(`osascript -e 'display notification "${short.replace(/"/g, '\\"')}" with title "consulting-ops" sound name "Glass"'`, { stdio: 'ignore' });
  } catch (e) {}
}

// --- CLI ---
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
};

const smtp = loadSmtp();
const event = getArg('--event');
const stats = getPipelineStats();

if (event) {
  const client = getArg('--client') || '';
  const mandat = getArg('--mandat') || '';
  const score = getArg('--score') || '';
  const detail = getArg('--detail') || '';
  const reportPath = getArg('--report') || '';
  const emailSent = getArg('--email-sent') || '';
  const linkedinSent = getArg('--linkedin-sent') || '';
  const emailBody = getArg('--email-body') || '';       // Contenu de l'email envoyé
  const linkedinNote = getArg('--linkedin-note') || '';  // Note LinkedIn envoyée
  const emailSubjectSent = getArg('--email-subject') || ''; // Objet de l'email envoyé
  const date = new Date().toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' });

  // Load report content if available
  let reportExcerpt = '';
  const reportContent = loadReport(reportPath);
  if (reportContent) {
    // Extract first ~50 lines (summary)
    reportExcerpt = reportContent.split('\n').slice(0, 60).join('\n')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/## (.+)/g, '<h3 style="color:#3b82f6;margin:12px 0 4px">$1</h3>')
      .replace(/# (.+)/g, '<h2 style="color:#1a1a2e;margin:12px 0 4px">$1</h2>')
      .replace(/\| /g, '| ');
  }

  const subjects = {
    scan_complete: `Scan termine${detail ? ' - ' + detail.substring(0, 60) : ''}`,
    new_mandat: `Nouveau mandat ${score} - ${client} / ${mandat}`,
    postulation: `Postulation envoyee - ${client} / ${mandat}`,
    executive_alert: `EXECUTIVE ${score} - ${client} / ${mandat}`,
    status_change: `Statut mis a jour - ${client} / ${mandat}`,
  };

  let html = htmlHeader();

  if (event === 'postulation') {
    html += `
  <div style="margin-bottom:16px">
    <span style="background:#22c55e;color:white;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600">ENVOYÉ</span>
    ${typeBadge(mandat)}
    ${score ? `<span style="color:${scoreColor(score)};font-weight:700;font-size:16px;margin-left:8px">${score}</span>` : ''}
  </div>
  <h2 style="color:#1a1a2e;margin:0 0 4px;font-size:20px">${client}</h2>
  <p style="color:#4b5563;margin:0 0 16px;font-size:14px">${mandat}</p>
  <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-bottom:16px">
    <h3 style="color:#3b82f6;margin:0 0 8px;font-size:14px">Actions effectuees</h3>
    ${emailSent ? `<p style="margin:4px 0;font-size:13px">📧 Email envoye a <strong>${emailSent}</strong></p>` : ''}
    ${linkedinSent ? `<p style="margin:4px 0;font-size:13px">🔗 LinkedIn connection envoyee : <a href="https://${linkedinSent}" style="color:#3b82f6">${linkedinSent}</a></p>` : ''}
    ${detail ? `<p style="margin:8px 0 0;font-size:13px;color:#4b5563">${detail}</p>` : ''}
  </div>
  ${emailBody ? `
  <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-bottom:16px">
    <h3 style="color:#3b82f6;margin:0 0 8px;font-size:14px">📧 Email envoye</h3>
    ${emailSubjectSent ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280">Objet : <strong style="color:#4b5563">${emailSubjectSent}</strong></p>` : ''}
    <div style="background:#f9fafb;padding:12px;border-radius:6px;border-left:3px solid #2563eb;font-size:13px;line-height:1.6;white-space:pre-line;color:#374151">${emailBody}</div>
  </div>` : ''}
  ${linkedinNote ? `
  <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-bottom:16px">
    <h3 style="color:#0ea5e9;margin:0 0 8px;font-size:14px">🔗 Note LinkedIn</h3>
    <div style="background:#f9fafb;padding:12px;border-radius:6px;border-left:3px solid #0284c7;font-size:13px;line-height:1.6;color:#374151">${linkedinNote}</div>
  </div>` : ''}`;
  } else if (event === 'new_mandat' || event === 'executive_alert') {
    const isExec = event === 'executive_alert';
    html += `
  <div style="margin-bottom:16px">
    <span style="background:${isExec ? '#7c3aed' : '#3b82f6'};color:white;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600">${isExec ? 'EXECUTIVE' : 'NOUVEAU'}</span>
    ${typeBadge(mandat)}
    ${score ? `<span style="color:${scoreColor(score)};font-weight:700;font-size:16px;margin-left:8px">${score}</span>` : ''}
  </div>
  <h2 style="color:#1a1a2e;margin:0 0 4px;font-size:20px">${client}</h2>
  <p style="color:#4b5563;margin:0 0 16px;font-size:14px">${mandat}</p>
  ${detail ? `<div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-bottom:16px"><p style="margin:0;font-size:13px">${detail}</p></div>` : ''}`;
  } else if (event === 'scan_complete') {
    html += `
  <div style="margin-bottom:16px">
    <span style="background:#0ea5e9;color:white;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600">SCAN TERMINÉ</span>
  </div>
  <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-bottom:16px">
    <p style="margin:0;font-size:13px;white-space:pre-line">${detail}</p>
  </div>`;
  } else {
    html += `
  <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:18px">${event} - ${client} / ${mandat}</h2>
  <p style="font-size:13px">${detail}</p>`;
  }

  // Add report excerpt if available
  if (reportExcerpt) {
    html += `
  <details style="margin-bottom:16px">
    <summary style="cursor:pointer;color:#3b82f6;font-size:13px;font-weight:500;margin-bottom:8px">Voir le report complet</summary>
    <div style="background:#f3f4f6;padding:16px;border-radius:8px;font-size:12px;line-height:1.6;max-height:400px;overflow-y:auto">
      ${reportExcerpt}
    </div>
  </details>`;
  }

  html += `
  <p style="color:#9ca3af;font-size:11px;margin-top:12px">${date}</p>`;
  html += htmlFooter(stats);

  const subject = subjects[event] || `${event} - ${client}`;
  await sendNotification({ subject, html, smtp });
  console.log(`Notification envoyee: ${subject}`);

} else {
  // Default: check mandats.md for recent high-score entries
  try {
    const content = readFileSync(MANDATS_FILE, 'utf-8');
    const lines = content.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Client'));
    if (lines.length === 0) process.exit(0);

    const recent = lines.slice(-5);
    const alerts = [];
    for (const line of recent) {
      const parts = line.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length < 9) continue;
      const scoreMatch = parts[4].match(/([\d.]+)/);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
      const isExec = (parts[9] || '').includes('EXECUTIVE');
      if (score >= 4.0 || isExec) {
        alerts.push({ client: parts[2], mandat: parts[3], score: parts[4], notes: parts[9] || '' });
      }
    }

    if (alerts.length > 0) {
      let html = htmlHeader();
      html += `<div style="margin-bottom:16px"><span style="background:#f59e0b;color:white;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600">${alerts.length} ALERTE(S)</span></div>`;
      for (const a of alerts) {
        html += `<div style="background:#f3f4f6;padding:12px;border-radius:6px;margin-bottom:8px">
          <span style="color:${scoreColor(a.score)};font-weight:700">${a.score}</span>
          ${typeBadge(a.mandat)}
          <strong style="color:#1a1a2e;margin-left:8px">${a.client}</strong>
          <span style="color:#4b5563;margin-left:8px">${a.mandat.replace('[CDI] ', '').replace('[PRESTA] ', '')}</span>
          <p style="color:#6b7280;font-size:12px;margin:4px 0 0">${a.notes}</p>
        </div>`;
      }
      html += htmlFooter(stats);
      await sendNotification({ subject: `${alerts.length} mandat(s) prioritaire(s)`, html, smtp });
      console.log(`${alerts.length} notification(s) envoyee(s)`);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}
