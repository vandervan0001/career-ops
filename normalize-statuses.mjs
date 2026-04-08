#!/usr/bin/env node
/**
 * normalize-statuses.mjs — Normalisation des statuts dans mandats.md
 *
 * Mappe tous les statuts non-canoniques vers les canoniques selon states.yml :
 *   Identifie, Evalue, Qualifie, Proposition, Discussion, Signe, En cours, Termine, Perdu, SKIP
 *
 * Supprime aussi le gras markdown (**) et les dates du champ statut,
 * deplace les infos DOUBLON vers la colonne notes.
 *
 * Run: node normalize-statuses.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const CAREER_OPS = dirname(fileURLToPath(import.meta.url));
// Support both layouts: data/mandats.md (boilerplate) and mandats.md (original)
const APPS_FILE = existsSync(join(CAREER_OPS, 'data/mandats.md'))
  ? join(CAREER_OPS, 'data/mandats.md')
  : join(CAREER_OPS, 'mandats.md');
const DRY_RUN = process.argv.includes('--dry-run');

// Mapping des statuts canoniques
function normalizeStatus(raw) {
  // Suppression du gras markdown
  let s = raw.replace(/\*\*/g, '').trim();
  const lower = s.toLowerCase();

  // Variantes DOUBLON → Perdu
  if (/^doublon/i.test(s) || /^dup\b/i.test(s)) {
    return { status: 'Perdu', moveToNotes: raw.trim() };
  }

  // Annule/Refuse → Perdu
  if (/^annule/i.test(s)) return { status: 'Perdu' };
  if (/^refuse/i.test(s)) return { status: 'Perdu' };
  if (/^rejete/i.test(s)) return { status: 'Perdu' };

  // Statut avec date → nettoyer la date
  if (/^perdu\s+\d{4}/i.test(s)) return { status: 'Perdu' };
  if (/^signe\s+\d{4}/i.test(s)) return { status: 'Signe' };
  if (/^termine\s+\d{4}/i.test(s)) return { status: 'Termine' };

  // Repost → Perdu
  if (/^repost/i.test(s)) return { status: 'Perdu', moveToNotes: raw.trim() };

  // Em dash, tiret, vide → Perdu
  if (s === '\u2014' || s === '-' || s === '') return { status: 'Perdu' };

  // Deja canonique — corriger la casse/le gras
  const canonical = [
    'Identifie', 'Evalue', 'Qualifie', 'Proposition',
    'Discussion', 'Signe', 'En cours', 'Termine', 'Perdu', 'SKIP',
  ];
  for (const c of canonical) {
    if (lower === c.toLowerCase()) return { status: c };
  }

  // Alias selon states.yml
  const aliases = {
    'identifie': 'Identifie', 'identified': 'Identifie', 'nouveau': 'Identifie', 'new': 'Identifie',
    'evalue': 'Evalue', 'evaluated': 'Evalue', 'analyse': 'Evalue', 'a evaluer': 'Evalue',
    'qualifie': 'Qualifie', 'qualified': 'Qualifie', 'valide': 'Qualifie',
    'proposition': 'Proposition', 'propose': 'Proposition', 'offre': 'Proposition', 'soumis': 'Proposition',
    'discussion': 'Discussion', 'nego': 'Discussion', 'negociation': 'Discussion',
    'signe': 'Signe', 'signed': 'Signe', 'gagne': 'Signe', 'won': 'Signe',
    'en cours': 'En cours', 'actif': 'En cours', 'active': 'En cours', 'en_cours': 'En cours',
    'termine': 'Termine', 'fini': 'Termine', 'cloture': 'Termine', 'done': 'Termine',
    'perdu': 'Perdu', 'lost': 'Perdu',
    'skip': 'SKIP', 'no_go': 'SKIP', 'abandon': 'SKIP', 'hors_scope': 'SKIP',
  };

  if (aliases[lower]) return { status: aliases[lower] };

  // Inconnu — signaler
  return { status: null, unknown: true };
}

// Lecture de mandats.md
if (!existsSync(APPS_FILE)) {
  console.log('Aucun mandats.md trouve. Rien a normaliser.');
  process.exit(0);
}
const content = readFileSync(APPS_FILE, 'utf-8');
const lines = content.split('\n');

let changes = 0;
let unknowns = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.startsWith('|')) continue;

  const parts = line.split('|').map(s => s.trim());
  // Format: ['', '#', 'date', 'client', 'mandat', 'score', 'STATUS', 'pdf', 'report', 'tjm', 'notes', '']
  if (parts.length < 10) continue;
  if (parts[1] === '#' || parts[1] === '---' || parts[1] === '') continue;

  const num = parseInt(parts[1]);
  if (isNaN(num)) continue;

  const rawStatus = parts[6];
  const result = normalizeStatus(rawStatus);

  if (result.unknown) {
    unknowns.push({ num, rawStatus, line: i + 1 });
    continue;
  }

  if (result.status === rawStatus) continue; // Already canonical

  // Apply change
  const oldStatus = rawStatus;
  parts[6] = result.status;

  // Deplacer info DOUBLON vers notes si necessaire
  if (result.moveToNotes && parts[10]) {
    const existing = parts[10] || '';
    if (!existing.includes(result.moveToNotes)) {
      parts[10] = result.moveToNotes + (existing ? '. ' + existing : '');
    }
  } else if (result.moveToNotes && !parts[10]) {
    parts[10] = result.moveToNotes;
  }

  // Also strip bold from score field
  if (parts[5]) {
    parts[5] = parts[5].replace(/\*\*/g, '');
  }

  // Reconstruct line
  const newLine = '| ' + parts.slice(1, -1).join(' | ') + ' |';
  lines[i] = newLine;
  changes++;

  console.log(`#${num}: "${oldStatus}" → "${result.status}"`);
}

if (unknowns.length > 0) {
  console.log(`\n${unknowns.length} statuts inconnus :`);
  for (const u of unknowns) {
    console.log(`  #${u.num} (ligne ${u.line}): "${u.rawStatus}"`);
  }
}

console.log(`\n${changes} statuts normalises`);

if (!DRY_RUN && changes > 0) {
  // Sauvegarde d'abord
  copyFileSync(APPS_FILE, APPS_FILE + '.bak');
  writeFileSync(APPS_FILE, lines.join('\n'));
  console.log('Ecrit dans mandats.md (sauvegarde : mandats.md.bak)');
} else if (DRY_RUN) {
  console.log('(dry-run - aucune modification ecrite)');
} else {
  console.log('Aucune modification necessaire');
}
