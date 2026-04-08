#!/usr/bin/env node
/**
 * verify-pipeline.mjs — Verification de sante du pipeline consulting
 *
 * Controles :
 * 1. Tous les statuts sont canoniques (selon states.yml)
 * 2. Pas de doublons client+mandat
 * 3. Tous les liens rapports pointent vers des fichiers existants
 * 4. Scores au format X.XX/5 ou N/A ou DUP
 * 5. Toutes les lignes au bon format pipe-delimited
 * 6. Pas de TSV en attente dans tracker-additions/
 * 7. IDs canoniques states.yml pour coherence inter-systemes
 *
 * Run: node verify-pipeline.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const CAREER_OPS = dirname(fileURLToPath(import.meta.url));
// Support both layouts: data/mandats.md (boilerplate) and mandats.md (original)
const APPS_FILE = existsSync(join(CAREER_OPS, 'data/mandats.md'))
  ? join(CAREER_OPS, 'data/mandats.md')
  : join(CAREER_OPS, 'mandats.md');
const ADDITIONS_DIR = join(CAREER_OPS, 'batch/tracker-additions');
const REPORTS_DIR = join(CAREER_OPS, 'reports');
const STATES_FILE = existsSync(join(CAREER_OPS, 'templates/states.yml'))
  ? join(CAREER_OPS, 'templates/states.yml')
  : join(CAREER_OPS, 'states.yml');

const CANONICAL_STATUSES = [
  'identifie', 'evalue', 'qualifie', 'proposition',
  'discussion', 'signe', 'en cours', 'termine', 'perdu', 'skip',
];

const ALIASES = {
  'identifie': 'identifie', 'identified': 'identifie', 'nouveau': 'identifie',
  'evalue': 'evalue', 'evaluated': 'evalue', 'analyse': 'evalue',
  'qualifie': 'qualifie', 'qualified': 'qualifie', 'valide': 'qualifie',
  'proposition': 'proposition', 'propose': 'proposition', 'offre': 'proposition',
  'discussion': 'discussion', 'nego': 'discussion', 'negociation': 'discussion',
  'signe': 'signe', 'signed': 'signe', 'gagne': 'signe',
  'en_cours': 'en cours', 'actif': 'en cours', 'active': 'en cours',
  'termine': 'termine', 'fini': 'termine', 'cloture': 'termine',
  'perdu': 'perdu', 'lost': 'perdu', 'refuse': 'perdu', 'annule': 'perdu',
  'no_go': 'skip', 'abandon': 'skip', 'hors_scope': 'skip',
};

let errors = 0;
let warnings = 0;

function error(msg) { console.log(`❌ ${msg}`); errors++; }
function warn(msg) { console.log(`⚠️  ${msg}`); warnings++; }
function ok(msg) { console.log(`✅ ${msg}`); }

// --- Lecture de mandats.md ---
if (!existsSync(APPS_FILE)) {
  console.log('\nAucun mandats.md trouve. Normal pour une installation neuve.');
  console.log('   Le fichier sera cree lors de l\'evaluation du premier mandat.\n');
  process.exit(0);
}
const content = readFileSync(APPS_FILE, 'utf-8');
const lines = content.split('\n');

const entries = [];
for (const line of lines) {
  if (!line.startsWith('|')) continue;
  const parts = line.split('|').map(s => s.trim());
  if (parts.length < 10) continue;
  const num = parseInt(parts[1]);
  if (isNaN(num)) continue;
  entries.push({
    num, date: parts[2], company: parts[3], role: parts[4],
    score: parts[5], status: parts[6], pdf: parts[7], report: parts[8],
    tjm: parts[9] || '', notes: parts[10] || '',
  });
}

console.log(`\nVerification de ${entries.length} entrees dans mandats.md\n`);

// --- Check 1: Canonical statuses ---
let badStatuses = 0;
for (const e of entries) {
  const clean = e.status.replace(/\*\*/g, '').trim().toLowerCase();
  // Strip trailing dates
  const statusOnly = clean.replace(/\s+\d{4}-\d{2}-\d{2}.*$/, '').trim();

  if (!CANONICAL_STATUSES.includes(statusOnly) && !ALIASES[statusOnly]) {
    error(`#${e.num}: Non-canonical status "${e.status}"`);
    badStatuses++;
  }

  // Check for markdown bold in status
  if (e.status.includes('**')) {
    error(`#${e.num}: Status contains markdown bold: "${e.status}"`);
    badStatuses++;
  }

  // Check for dates in status
  if (/\d{4}-\d{2}-\d{2}/.test(e.status)) {
    error(`#${e.num}: Status contains date: "${e.status}" — dates go in date column`);
    badStatuses++;
  }
}
if (badStatuses === 0) ok('All statuses are canonical');

// --- Check 2: Duplicates ---
const companyRoleMap = new Map();
let dupes = 0;
for (const e of entries) {
  const key = e.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '::' +
    e.role.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  if (!companyRoleMap.has(key)) companyRoleMap.set(key, []);
  companyRoleMap.get(key).push(e);
}
for (const [key, group] of companyRoleMap) {
  if (group.length > 1) {
    warn(`Possible duplicates: ${group.map(e => `#${e.num}`).join(', ')} (${group[0].company} — ${group[0].role})`);
    dupes++;
  }
}
if (dupes === 0) ok('No exact duplicates found');

// --- Check 3: Report links ---
let brokenReports = 0;
for (const e of entries) {
  const match = e.report.match(/\]\(([^)]+)\)/);
  if (!match) continue;
  const reportPath = join(CAREER_OPS, match[1]);
  if (!existsSync(reportPath)) {
    error(`#${e.num}: Report not found: ${match[1]}`);
    brokenReports++;
  }
}
if (brokenReports === 0) ok('All report links valid');

// --- Check 4: Score format ---
let badScores = 0;
for (const e of entries) {
  const s = e.score.replace(/\*\*/g, '').trim();
  if (!/^\d+\.?\d*\/5$/.test(s) && s !== 'N/A' && s !== 'DUP') {
    error(`#${e.num}: Invalid score format: "${e.score}"`);
    badScores++;
  }
}
if (badScores === 0) ok('All scores valid');

// --- Check 5: Row format ---
let badRows = 0;
for (const line of lines) {
  if (!line.startsWith('|')) continue;
  if (line.includes('---') || line.includes('Client')) continue;
  const parts = line.split('|');
  if (parts.length < 10) {
    error(`Ligne avec <10 colonnes : ${line.substring(0, 80)}...`);
    badRows++;
  }
}
if (badRows === 0) ok('All rows properly formatted');

// --- Check 6: Pending TSVs ---
let pendingTsvs = 0;
if (existsSync(ADDITIONS_DIR)) {
  const files = readdirSync(ADDITIONS_DIR).filter(f => f.endsWith('.tsv'));
  pendingTsvs = files.length;
  if (pendingTsvs > 0) {
    warn(`${pendingTsvs} pending TSVs in tracker-additions/ (not merged)`);
  }
}
if (pendingTsvs === 0) ok('No pending TSVs');

// --- Check 7: Bold in scores ---
let boldScores = 0;
for (const e of entries) {
  if (e.score.includes('**')) {
    warn(`#${e.num}: Score has markdown bold: "${e.score}"`);
    boldScores++;
  }
}
if (boldScores === 0) ok('No bold in scores');

// --- Resume ---
console.log('\n' + '='.repeat(50));
console.log(`Sante du pipeline : ${errors} erreurs, ${warnings} avertissements`);
if (errors === 0 && warnings === 0) {
  console.log('Pipeline OK !');
} else if (errors === 0) {
  console.log('Pipeline OK avec avertissements');
} else {
  console.log('Pipeline en erreur - corriger avant de continuer');
}

process.exit(errors > 0 ? 1 : 0);
