#!/usr/bin/env node
/**
 * prospect-loop.mjs -- Orchestrateur pipeline prospection intégrateurs
 *
 * Usage:
 *   node prospect-loop.mjs --mode=full        # pipeline complet
 *   node prospect-loop.mjs --mode=prep-only   # acquisition + enrichissement + queue
 *   node prospect-loop.mjs --mode=relances    # relances J+7/J+14
 *   node prospect-loop.mjs --mode=leads       # acquisition seulement
 *   node prospect-loop.mjs --dry-run          # tout sauf envoi réel
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);

const MODE = (() => {
  const m = args.find((a) => a.startsWith('--mode='));
  return m ? m.replace('--mode=', '') : 'full';
})();
const DRY_RUN = hasFlag('--dry-run');

const QUEUE_DIR = join(ROOT, 'output', 'prospection', 'queue');
const APPROVED_DIR = join(ROOT, 'output', 'prospection', 'approved');
const QUARANTINE_DIR = join(ROOT, 'output', 'prospection', 'quarantine');
const TODAY = new Date().toISOString().slice(0, 10);

function log(msg) { console.log(`[prospect-loop] ${msg}`); }

function runNode(script, scriptArgs = [], opts = {}) {
  log(`Étape : node ${script} ${scriptArgs.join(' ')}`);
  if (DRY_RUN && opts.skipOnDryRun) {
    log(`(dry-run) skipped`);
    return;
  }
  execFileSync('node', [script, ...scriptArgs], { stdio: 'inherit', cwd: ROOT });
}

function buildPrepAgentPrompt(enrichedBatch) {
  const shared = readFileSync(join(ROOT, 'modes', '_shared.md'), 'utf-8');
  const prospection = readFileSync(join(ROOT, 'modes', 'prospection.md'), 'utf-8');
  const profile = readFileSync(join(ROOT, 'modes', '_profile.md'), 'utf-8');
  return [
    shared,
    prospection,
    profile,
    '---',
    '## Ta mission (PrepAgent)',
    'Pour chaque prospect ci-dessous, génère un message email personnalisé.',
    'Respecte les templates et règles de rédaction du mode prospection.',
    'Attribue un score confiance 1-5. Si < 3, marque comme QUARANTINE.',
    'Output : une ligne TSV par prospect avec les colonnes :',
    'company | contact | email | linkedin_url | signal | subject | body | confidence | template_used',
    '---',
    '## Prospects à traiter',
    JSON.stringify(enrichedBatch, null, 2),
  ].join('\n\n');
}

function buildReviewAgentPrompt(queueFile) {
  const queue = readFileSync(queueFile, 'utf-8');
  const prospection = readFileSync(join(ROOT, 'modes', 'prospection.md'), 'utf-8');
  const profile = readFileSync(join(ROOT, 'modes', '_profile.md'), 'utf-8');
  return [
    prospection,
    profile,
    '---',
    '## Ta mission (ReviewAgent)',
    'Vérifie chaque message de la queue ci-dessous contre la checklist 9 critères.',
    'Pour chaque message KO : tente une correction (une seule fois).',
    'Si toujours KO : ajoute rejection_reason et marque QUARANTINE.',
    'Output : deux listes TSV séparées par "=== APPROVED ===" et "=== QUARANTINE ==="',
    'Colonnes : company | contact | email | linkedin_url | signal | subject | body | rejection_reason',
    '---',
    '## Queue à reviewer',
    queue,
  ].join('\n\n');
}

function callClaudeP(prompt, label) {
  log(`Invocation Claude (${label})...`);
  mkdirSync(join(ROOT, 'output/prospection'), { recursive: true });
  const tmpPrompt = join(ROOT, `output/prospection/.tmp-${label}-${TODAY}.txt`);
  writeFileSync(tmpPrompt, prompt);
  const result = execFileSync('claude', ['-p', readFileSync(tmpPrompt, 'utf-8')], {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return result;
}

function splitAgentOutput(output) {
  const approved = [];
  const quarantine = [];
  let section = null;
  for (const line of output.split('\n')) {
    if (line.includes('=== APPROVED ===')) { section = 'approved'; continue; }
    if (line.includes('=== QUARANTINE ===')) { section = 'quarantine'; continue; }
    if (!line.trim()) continue;
    if (section === 'approved') approved.push(line);
    if (section === 'quarantine') quarantine.push(line);
  }
  return { approved, quarantine };
}

async function stepLeads() {
  log('=== ÉTAPE 1 : Acquisition leads ===');
  runNode('industrial-prospect-scan.mjs', ['--limit', '30', '--skip-linkedin']);
}

async function stepEnrich() {
  log('=== ÉTAPE 2 : Enrichissement ===');
  const { loadProspectionTsv, saveProspectionTsv } = await import('./prospection-tsv.mjs');
  const PROSPECTION_FILE = join(ROOT, 'data/prospection.tsv');
  const { rows } = loadProspectionTsv(PROSPECTION_FILE);
  const toEnrich = rows.filter((r) => r.status === 'identifie' && !r.email && r.company);

  for (const row of toEnrich.slice(0, 20)) {
    try {
      const domain = row.linkedin
        ? new URL(row.linkedin).hostname.replace('www.', '')
        : `${row.company.toLowerCase().replace(/[^a-z]/g, '')}.com`;
      const raw = execFileSync('node', ['find-email.mjs', '--domain', domain, '--json'], {
        cwd: ROOT, encoding: 'utf-8',
      });
      const jsonStart = raw.indexOf('{');
      const data = jsonStart >= 0 ? JSON.parse(raw.slice(jsonStart)) : null;
      const first = data?.emails?.[0];
      if (first?.value) {
        row.email = first.value;
        if (first.first_name && first.last_name) row.contact = `${first.first_name} ${first.last_name}`;
        log(`Email trouvé pour ${row.company} : ${row.email} (${first.confidence}%)`);
      }
    } catch { /* quota dépassé ou domaine introuvable */ }
  }
  if (!DRY_RUN) saveProspectionTsv(PROSPECTION_FILE, rows);
}

async function stepPrepAgent() {
  log('=== ÉTAPE 3 : PrepAgent ===');
  const { loadProspectionTsv } = await import('./prospection-tsv.mjs');
  const { rows } = loadProspectionTsv(join(ROOT, 'data/prospection.tsv'));
  const batch = rows.filter((r) => r.status === 'identifie' && r.email).slice(0, 20);

  if (batch.length === 0) {
    log('Aucun prospect identifié avec email. Fin PrepAgent.');
    return;
  }

  mkdirSync(QUEUE_DIR, { recursive: true });
  const queueFile = join(QUEUE_DIR, `${TODAY}.tsv`);

  if (DRY_RUN) {
    log(`(dry-run) PrepAgent générerait ${batch.length} messages → ${queueFile}`);
    return;
  }

  const prompt = buildPrepAgentPrompt(batch);
  const output = callClaudeP(prompt, 'prepagent');
  writeFileSync(queueFile, output);
  log(`Queue écrite : ${queueFile} (${output.split('\n').length} lignes)`);
}

async function stepReviewAgent() {
  log('=== ÉTAPE 4 : ReviewAgent ===');
  const queueFile = join(QUEUE_DIR, `${TODAY}.tsv`);
  if (!existsSync(queueFile)) {
    log("Pas de queue PrepAgent pour aujourd'hui. Skip ReviewAgent.");
    return;
  }

  mkdirSync(APPROVED_DIR, { recursive: true });
  mkdirSync(QUARANTINE_DIR, { recursive: true });

  if (DRY_RUN) {
    log(`(dry-run) ReviewAgent lirait ${queueFile}`);
    return;
  }

  const prompt = buildReviewAgentPrompt(queueFile);
  const output = callClaudeP(prompt, 'reviewagent');
  const { approved, quarantine } = splitAgentOutput(output);

  const approvedFile = join(APPROVED_DIR, `${TODAY}.tsv`);
  const quarantineFile = join(QUARANTINE_DIR, `${TODAY}.tsv`);
  writeFileSync(approvedFile, approved.join('\n'));
  writeFileSync(quarantineFile, quarantine.join('\n'));

  log(`Approuvés : ${approved.length} → ${approvedFile}`);
  log(`Quarantaine : ${quarantine.length} → ${quarantineFile}`);
}

async function stepSend() {
  log('=== ÉTAPE 5 : Envoi ===');
  const approvedFile = join(APPROVED_DIR, `${TODAY}.tsv`);
  if (!existsSync(approvedFile)) {
    log('Aucun message approuvé à envoyer.');
    return;
  }
  const liveFlag = DRY_RUN ? [] : ['--live'];
  runNode('outreach-dispatch.mjs', ['--from-queue', approvedFile, ...liveFlag]);
}

async function main() {
  log(`Mode : ${MODE} | Dry-run : ${DRY_RUN}`);

  if (MODE === 'leads') return stepLeads();
  if (MODE === 'relances') {
    return execFileSync('node', ['relance-scheduler.mjs', ...(DRY_RUN ? ['--dry-run'] : [])], { stdio: 'inherit', cwd: ROOT });
  }

  if (MODE === 'full' || MODE === 'prep-only') {
    await stepLeads();
    await stepEnrich();
    await stepPrepAgent();
    await stepReviewAgent();
    if (MODE === 'full') await stepSend();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
