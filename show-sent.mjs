#!/usr/bin/env node
/**
 * show-sent.mjs — Génère un dashboard HTML statique des cold mails envoyés.
 *
 * Lit output/prospection/sent/{YYYY-MM-DD}/*.txt (chacun avec headers + body)
 * et produit output/prospection/sent/index.html consultable au navigateur.
 *
 * Usage:
 *   node show-sent.mjs            # génère puis affiche le path
 *   node show-sent.mjs --open     # ouvre dans le navigateur après génération
 */

import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SENT_DIR = join(ROOT, 'output', 'prospection', 'sent');
const INDEX_PATH = join(SENT_DIR, 'index.html');

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function parseMail(path) {
  const text = readFileSync(path, 'utf-8');
  const split = text.split('\n--- BODY ---\n');
  if (split.length < 2) {
    return { headers: {}, body: text, raw: text };
  }
  const headersRaw = split[0];
  const body = split.slice(1).join('\n--- BODY ---\n').replace(/^\n+/, '');
  const headers = {};
  for (const line of headersRaw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) headers[key] = value;
    }
  }
  return { headers, body, raw: text };
}

function listMails() {
  if (!existsSync(SENT_DIR)) return [];
  const dates = readdirSync(SENT_DIR)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry))
    .sort()
    .reverse();
  const rows = [];
  for (const date of dates) {
    const dir = join(SENT_DIR, date);
    const files = readdirSync(dir).filter((f) => f.endsWith('.txt') && !f.startsWith('._')).sort().reverse();
    for (const file of files) {
      const path = join(dir, file);
      const stat = statSync(path);
      const { headers, body } = parseMail(path);
      rows.push({
        date,
        file,
        path,
        mtime: stat.mtime,
        company: headers.Company || file,
        to: headers.To || '',
        from: headers.From || '',
        subject: headers.Subject || '',
        messageId: headers['Message-ID'] || '',
        sector: headers.Sector || '',
        signal: headers.Signal || '',
        stage: headers.Stage || '',
        timestamp: headers.Date || stat.mtime.toISOString(),
        body,
      });
    }
  }
  return rows;
}

function render(rows) {
  const byDate = new Map();
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  }

  const totalCount = rows.length;
  const dateBlocks = [...byDate.entries()].map(([date, items]) => {
    const cards = items.map((row, idx) => `
      <details class="mail-card" id="mail-${date}-${idx}">
        <summary>
          <div class="card-meta">
            <span class="time">${escapeHtml(new Date(row.timestamp).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }))}</span>
            <span class="company">${escapeHtml(row.company)}</span>
            <span class="stage stage-${escapeHtml(row.stage)}">${escapeHtml(row.stage)}</span>
            <span class="to">${escapeHtml(row.to)}</span>
          </div>
          <div class="card-subject">${escapeHtml(row.subject)}</div>
        </summary>
        <div class="card-body">
          <div class="card-headers">
            <div><strong>De</strong>: ${escapeHtml(row.from)}</div>
            <div><strong>À</strong>: ${escapeHtml(row.to)}</div>
            <div><strong>Objet</strong>: ${escapeHtml(row.subject)}</div>
            <div><strong>Message-ID</strong>: <code>${escapeHtml(row.messageId)}</code></div>
            <div><strong>Secteur</strong>: ${escapeHtml(row.sector)} — <strong>Signal</strong>: ${escapeHtml(row.signal)}</div>
          </div>
          <pre class="card-mail">${escapeHtml(row.body)}</pre>
        </div>
      </details>
    `).join('');
    return `
      <section class="day">
        <h2>${escapeHtml(date)} <span class="count">(${items.length})</span></h2>
        ${cards}
      </section>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Vanguard Outreach — Mails envoyés</title>
<style>
  :root {
    --bg: #f6f7f9; --fg: #1a1a2e; --muted: #6c7280;
    --card: #fff; --border: #e2e4e8; --accent: #3a5ba0;
    --stage-initial: #3a5ba0; --stage-relance_1: #ea580c; --stage-relance_2: #ef4444;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg); color: var(--fg); line-height: 1.5; }
  header { background: var(--fg); color: #fff; padding: 1.2rem 2rem; }
  header h1 { margin: 0; font-size: 1.4rem; font-weight: 600; }
  header .stats { font-size: 0.85rem; color: #c8cbd0; margin-top: 0.3rem; }
  main { max-width: 980px; margin: 0 auto; padding: 1.5rem; }
  .filter-bar { background: var(--card); padding: 0.8rem 1rem; border: 1px solid var(--border);
    border-radius: 8px; margin-bottom: 1.5rem; }
  .filter-bar input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border);
    border-radius: 6px; font-size: 0.95rem; }
  .day h2 { font-size: 1rem; font-weight: 600; margin: 1.5rem 0 0.7rem; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.05em; }
  .day h2 .count { color: var(--accent); font-weight: 500; }
  .mail-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px;
    margin-bottom: 0.5rem; overflow: hidden; transition: box-shadow 0.15s; }
  .mail-card[open] { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .mail-card summary { cursor: pointer; padding: 0.7rem 1rem; list-style: none;
    display: flex; flex-direction: column; gap: 0.3rem; user-select: none; }
  .mail-card summary::-webkit-details-marker { display: none; }
  .card-meta { display: flex; gap: 0.7rem; align-items: center; font-size: 0.8rem; color: var(--muted); }
  .card-meta .time { font-variant-numeric: tabular-nums; min-width: 3rem; }
  .card-meta .company { font-weight: 600; color: var(--fg); }
  .card-meta .stage { padding: 0.1rem 0.5rem; border-radius: 3px; font-size: 0.7rem;
    text-transform: uppercase; color: #fff; background: var(--accent); }
  .card-meta .stage-relance_1 { background: var(--stage-relance_1); }
  .card-meta .stage-relance_2 { background: var(--stage-relance_2); }
  .card-meta .to { margin-left: auto; font-family: ui-monospace, monospace; font-size: 0.75rem; }
  .card-subject { font-weight: 500; color: var(--fg); }
  .card-body { padding: 0 1rem 1rem; border-top: 1px solid var(--border); }
  .card-headers { font-size: 0.85rem; color: var(--muted); padding: 0.7rem 0;
    border-bottom: 1px dashed var(--border); margin-bottom: 0.7rem; }
  .card-headers div { margin-bottom: 0.2rem; }
  .card-headers code { font-size: 0.75rem; }
  .card-mail { background: #fafbfc; border: 1px solid var(--border); border-radius: 6px;
    padding: 1rem; font-family: ui-monospace, 'SF Mono', monospace; font-size: 0.85rem;
    white-space: pre-wrap; word-wrap: break-word; margin: 0; }
  .empty { text-align: center; padding: 3rem; color: var(--muted); }
</style>
</head>
<body>
<header>
  <h1>Vanguard Outreach — Mails envoyés</h1>
  <div class="stats">${totalCount} mails archivés • Généré le ${new Date().toLocaleString('fr-CH')}</div>
</header>
<main>
  <div class="filter-bar">
    <input type="search" id="filter" placeholder="Filtrer (entreprise, objet, contact, secteur)…">
  </div>
  ${dateBlocks || '<p class="empty">Aucun mail archivé. Lancez node outreach-dispatch.mjs --status nouveau --top N --live pour en générer.</p>'}
</main>
<script>
  const input = document.getElementById('filter');
  if (input) input.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.mail-card').forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.style.display = !q || text.includes(q) ? '' : 'none';
    });
  });
</script>
</body>
</html>
`;
}

function main() {
  const rows = listMails();
  const html = render(rows);
  writeFileSync(INDEX_PATH, html);
  console.log(`Dashboard généré: ${INDEX_PATH}`);
  console.log(`${rows.length} mails listés.`);
  if (process.argv.includes('--open')) {
    try { execSync(`open "${INDEX_PATH}"`); } catch {}
  }
}

main();
