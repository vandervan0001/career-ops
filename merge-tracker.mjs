#!/usr/bin/env node
/**
 * merge-tracker.mjs — Fusion des ajouts batch dans mandats.md
 *
 * Gere plusieurs formats TSV :
 * - 10-col: num\tdate\tclient\tmandat\tstatus\tscore\tpdf\treport\ttjm\tnotes
 * - 9-col:  num\tdate\tclient\tmandat\tstatus\tscore\tpdf\treport\ttjm (sans notes)
 * - Pipe-delimited (markdown table row): | col | col | ... |
 *
 * Dedup : client normalise + mandat fuzzy match + numero de rapport
 * Si doublon avec score superieur → mise a jour in-place, maj lien rapport
 * Valide le statut contre states.yml (rejette non-canonique, log warning)
 *
 * Run: node merge-tracker.mjs [--dry-run] [--verify]
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const CAREER_OPS = dirname(fileURLToPath(import.meta.url));
// Support both layouts: data/mandats.md (boilerplate) and mandats.md (original)
const APPS_FILE = existsSync(join(CAREER_OPS, 'data/mandats.md'))
  ? join(CAREER_OPS, 'data/mandats.md')
  : join(CAREER_OPS, 'mandats.md');
const ADDITIONS_DIR = join(CAREER_OPS, 'batch/tracker-additions');
const MERGED_DIR = join(ADDITIONS_DIR, 'merged');
const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');

// Etats canoniques et alias
const CANONICAL_STATES = ['Identifie', 'Evalue', 'Qualifie', 'Proposition', 'Discussion', 'Signe', 'En cours', 'Termine', 'Perdu', 'SKIP'];

function validateStatus(status) {
  const clean = status.replace(/\*\*/g, '').replace(/\s+\d{4}-\d{2}-\d{2}.*$/, '').trim();
  const lower = clean.toLowerCase();

  for (const valid of CANONICAL_STATES) {
    if (valid.toLowerCase() === lower) return valid;
  }

  // Alias
  const aliases = {
    'identifie': 'Identifie', 'identified': 'Identifie', 'nouveau': 'Identifie', 'new': 'Identifie',
    'evalue': 'Evalue', 'evaluated': 'Evalue', 'analyse': 'Evalue', 'a evaluer': 'Evalue',
    'qualifie': 'Qualifie', 'qualified': 'Qualifie', 'valide': 'Qualifie',
    'proposition': 'Proposition', 'propose': 'Proposition', 'offre': 'Proposition', 'soumis': 'Proposition',
    'discussion': 'Discussion', 'nego': 'Discussion', 'negociation': 'Discussion',
    'signe': 'Signe', 'signed': 'Signe', 'gagne': 'Signe', 'won': 'Signe',
    'en cours': 'En cours', 'actif': 'En cours', 'active': 'En cours', 'en_cours': 'En cours',
    'termine': 'Termine', 'fini': 'Termine', 'cloture': 'Termine', 'done': 'Termine',
    'perdu': 'Perdu', 'lost': 'Perdu', 'refuse': 'Perdu', 'annule': 'Perdu', 'rejete': 'Perdu',
    'skip': 'SKIP', 'no_go': 'SKIP', 'abandon': 'SKIP', 'hors_scope': 'SKIP',
  };

  if (aliases[lower]) return aliases[lower];

  // Doublon/Repost → Perdu
  if (/^(doublon|dup|repost)/i.test(lower)) return 'Perdu';

  console.warn(`  Statut non-canonique "${status}" → defaut "Identifie"`);
  return 'Identifie';
}

function normalizeCompany(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function roleFuzzyMatch(a, b) {
  const wordsA = a.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const wordsB = b.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const overlap = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));
  return overlap.length >= 2;
}

function extractReportNum(reportStr) {
  const m = reportStr.match(/\[(\d+)\]/);
  return m ? parseInt(m[1]) : null;
}

function parseScore(s) {
  const m = s.replace(/\*\*/g, '').match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

function parseAppLine(line) {
  const parts = line.split('|').map(s => s.trim());
  if (parts.length < 10) return null;
  const num = parseInt(parts[1]);
  if (isNaN(num) || num === 0) return null;
  return {
    num, date: parts[2], company: parts[3], role: parts[4],
    score: parts[5], status: parts[6], pdf: parts[7], report: parts[8],
    tjm: parts[9] || '', notes: parts[10] || '', raw: line,
  };
}

/**
 * Parse a TSV file content into a structured addition object.
 * Handles: 9-col TSV, 8-col TSV, pipe-delimited markdown.
 */
function parseTsvContent(content, filename) {
  content = content.trim();
  if (!content) return null;

  let parts;
  let addition;

  // Detect pipe-delimited (markdown table row)
  if (content.startsWith('|')) {
    parts = content.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 9) {
      console.warn(`  Format pipe invalide ${filename}: ${parts.length} champs`);
      return null;
    }
    // Format: num | date | client | mandat | score | status | pdf | report | tjm | notes
    addition = {
      num: parseInt(parts[0]),
      date: parts[1],
      company: parts[2],
      role: parts[3],
      score: parts[4],
      status: validateStatus(parts[5]),
      pdf: parts[6],
      report: parts[7],
      tjm: parts[8] || '',
      notes: parts[9] || '',
    };
  } else {
    // Tab-separated
    parts = content.split('\t');
    if (parts.length < 9) {
      console.warn(`  TSV malforme ${filename}: ${parts.length} champs`);
      return null;
    }

    // Detection d'ordre des colonnes : certains TSV ont (status, score), d'autres (score, status)
    // Heuristique : si col4 ressemble a un score et col5 a un statut, ils sont inverses
    const col4 = parts[4].trim();
    const col5 = parts[5].trim();
    const col4LooksLikeScore = /^\d+\.?\d*\/5$/.test(col4) || col4 === 'N/A' || col4 === 'DUP';
    const col5LooksLikeScore = /^\d+\.?\d*\/5$/.test(col5) || col5 === 'N/A' || col5 === 'DUP';
    const col4LooksLikeStatus = /^(identifie|evalue|qualifie|proposition|discussion|signe|en.cours|termine|perdu|skip|doublon|repost|nouveau|analyse)/i.test(col4);
    const col5LooksLikeStatus = /^(identifie|evalue|qualifie|proposition|discussion|signe|en.cours|termine|perdu|skip|doublon|repost|nouveau|analyse)/i.test(col5);

    let statusCol, scoreCol;
    if (col4LooksLikeStatus && !col4LooksLikeScore) {
      // Format standard : col4=status, col5=score
      statusCol = col4; scoreCol = col5;
    } else if (col4LooksLikeScore && col5LooksLikeStatus) {
      // Format inverse : col4=score, col5=status
      statusCol = col5; scoreCol = col4;
    } else if (col5LooksLikeScore && !col4LooksLikeScore) {
      // col5 est clairement un score → col4 est le statut
      statusCol = col4; scoreCol = col5;
    } else {
      // Defaut : format standard (statut avant score)
      statusCol = col4; scoreCol = col5;
    }

    addition = {
      num: parseInt(parts[0]),
      date: parts[1],
      company: parts[2],
      role: parts[3],
      status: validateStatus(statusCol),
      score: scoreCol,
      pdf: parts[6],
      report: parts[7],
      tjm: parts[8] || '',
      notes: parts[9] || '',
    };
  }

  if (isNaN(addition.num) || addition.num === 0) {
    console.warn(`  ${filename} ignore : numero d'entree invalide`);
    return null;
  }

  return addition;
}

// ---- Main ----

// Lecture de mandats.md
if (!existsSync(APPS_FILE)) {
  console.log('Aucun mandats.md trouve. Rien a fusionner.');
  process.exit(0);
}
const appContent = readFileSync(APPS_FILE, 'utf-8');
const appLines = appContent.split('\n');
const existingApps = [];
let maxNum = 0;

for (const line of appLines) {
  if (line.startsWith('|') && !line.includes('---') && !line.includes('Client')) {
    const app = parseAppLine(line);
    if (app) {
      existingApps.push(app);
      if (app.num > maxNum) maxNum = app.num;
    }
  }
}

console.log(`Existants : ${existingApps.length} entrees, max #${maxNum}`);

// Read tracker additions
if (!existsSync(ADDITIONS_DIR)) {
  console.log('Aucun repertoire tracker-additions trouve.');
  process.exit(0);
}

const tsvFiles = readdirSync(ADDITIONS_DIR).filter(f => f.endsWith('.tsv'));
if (tsvFiles.length === 0) {
  console.log('Aucun ajout en attente a fusionner.');
  process.exit(0);
}

// Sort files numerically for deterministic processing
tsvFiles.sort((a, b) => {
  const numA = parseInt(a.replace(/\D/g, '')) || 0;
  const numB = parseInt(b.replace(/\D/g, '')) || 0;
  return numA - numB;
});

console.log(`${tsvFiles.length} ajouts en attente`);

let added = 0;
let updated = 0;
let skipped = 0;
const newLines = [];

for (const file of tsvFiles) {
  const content = readFileSync(join(ADDITIONS_DIR, file), 'utf-8').trim();
  const addition = parseTsvContent(content, file);
  if (!addition) { skipped++; continue; }

  // Check for duplicate by:
  // 1. Exact report number match
  // 2. Company + role fuzzy match
  const reportNum = extractReportNum(addition.report);
  let duplicate = null;

  if (reportNum) {
    // Check if this report number already exists
    duplicate = existingApps.find(app => {
      const existingReportNum = extractReportNum(app.report);
      return existingReportNum === reportNum;
    });
  }

  if (!duplicate) {
    // Exact entry number match
    duplicate = existingApps.find(app => app.num === addition.num);
  }

  if (!duplicate) {
    // Company + role fuzzy match
    const normCompany = normalizeCompany(addition.company);
    duplicate = existingApps.find(app => {
      if (normalizeCompany(app.company) !== normCompany) return false;
      return roleFuzzyMatch(addition.role, app.role);
    });
  }

  if (duplicate) {
    const newScore = parseScore(addition.score);
    const oldScore = parseScore(duplicate.score);

    if (newScore > oldScore) {
      console.log(`Maj : #${duplicate.num} ${addition.company} - ${addition.role} (${oldScore}->${newScore})`);
      const lineIdx = appLines.indexOf(duplicate.raw);
      if (lineIdx >= 0) {
        const updatedLine = `| ${duplicate.num} | ${addition.date} | ${addition.company} | ${addition.role} | ${addition.score} | ${duplicate.status} | ${duplicate.pdf} | ${addition.report} | ${duplicate.tjm || addition.tjm || ''} | Re-eval ${addition.date} (${oldScore}->${newScore}). ${addition.notes} |`;
        appLines[lineIdx] = updatedLine;
        updated++;
      }
    } else {
      console.log(`Ignore : ${addition.company} - ${addition.role} (existant #${duplicate.num} ${oldScore} >= nouveau ${newScore})`);
      skipped++;
    }
  } else {
    // New entry — use the number from the TSV
    const entryNum = addition.num > maxNum ? addition.num : ++maxNum;
    if (addition.num > maxNum) maxNum = addition.num;

    const newLine = `| ${entryNum} | ${addition.date} | ${addition.company} | ${addition.role} | ${addition.score} | ${addition.status} | ${addition.pdf} | ${addition.report} | ${addition.tjm} | ${addition.notes} |`;
    newLines.push(newLine);
    added++;
    console.log(`Ajout #${entryNum}: ${addition.company} - ${addition.role} (${addition.score})`);
  }
}

// Insert new lines after the header (line index of first data row)
if (newLines.length > 0) {
  // Find header separator (|---|...) and insert after it
  let insertIdx = -1;
  for (let i = 0; i < appLines.length; i++) {
    if (appLines[i].includes('---') && appLines[i].startsWith('|')) {
      insertIdx = i + 1;
      break;
    }
  }
  if (insertIdx >= 0) {
    appLines.splice(insertIdx, 0, ...newLines);
  }
}

// Write back
if (!DRY_RUN) {
  writeFileSync(APPS_FILE, appLines.join('\n'));

  // Move processed files to merged/
  if (!existsSync(MERGED_DIR)) mkdirSync(MERGED_DIR, { recursive: true });
  for (const file of tsvFiles) {
    renameSync(join(ADDITIONS_DIR, file), join(MERGED_DIR, file));
  }
  console.log(`\n${tsvFiles.length} TSV deplaces vers merged/`);
}

console.log(`\nResume : +${added} ajoutes, ${updated} mis a jour, ${skipped} ignores`);
if (DRY_RUN) console.log('(dry-run - aucune modification ecrite)');

// Optional verify
if (VERIFY && !DRY_RUN) {
  console.log('\n--- Verification en cours ---');
  const { execSync } = await import('child_process');
  try {
    execSync(`node ${join(CAREER_OPS, 'verify-pipeline.mjs')}`, { stdio: 'inherit' });
  } catch (e) {
    process.exit(1);
  }
}
