/**
 * carnet.mjs — Module pour le carnet d'adresses (contacts qualifiés)
 *
 * Distinct du cold outreach (data/prospection.tsv) et des clients actifs
 * (data/clients.tsv). Le carnet contient des relations qualifiées qu'on
 * entretient avec une cadence (par défaut 60 jours).
 *
 * Architecture:
 *   - data/carnet.tsv  : index pour query/sort rapide
 *   - carnet/{slug}.md : fiche markdown riche par contact (journal,
 *                        idées projets, contexte, liens cliquables)
 *
 * Quand l'index est modifié → la fiche est synchronisée (header).
 * Quand on "touche" un contact → entry au journal + last_touch=today.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CARNET_FILE = join(ROOT, 'data', 'carnet.tsv');
const CARNET_DIR = join(ROOT, 'carnet');

export const CARNET_COLUMNS = [
  'id', 'full_name', 'company', 'role', 'site', 'email', 'phone', 'linkedin',
  'last_touch', 'next_touch_due', 'cadence_days', 'status',
  'linked_mandats', 'notes',
];

const VALID_STATUSES = ['active', 'dormant', 'muted', 'converted', 'lost'];
const DEFAULT_CADENCE_DAYS = 60;

export function loadCarnet() {
  if (!existsSync(CARNET_FILE)) return [];
  const lines = readFileSync(CARNET_FILE, 'utf-8').split('\n').filter(l => l.length);
  if (lines.length < 2) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map(ln => {
    const vals = ln.split('\t');
    const row = {};
    header.forEach((k, i) => { row[k] = (vals[i] || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t'); });
    return row;
  });
}

export function saveCarnet(rows) {
  if (!existsSync(dirname(CARNET_FILE))) mkdirSync(dirname(CARNET_FILE), { recursive: true });
  const header = CARNET_COLUMNS.join('\t');
  const body = rows.map(r =>
    CARNET_COLUMNS.map(c => String(r[c] ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t')).join('\t')
  ).join('\n');
  writeFileSync(CARNET_FILE, `${header}\n${body}\n`);
}

export function nextCarnetId() {
  const rows = loadCarnet();
  return rows.reduce((m, r) => Math.max(m, parseInt(r.id || 0, 10)), 0) + 1;
}

export function slugifyName(name) {
  return (name || 'unknown')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function ficheSlug(row) {
  // Format: prenom-nom-boite (idempotent)
  const namePart = slugifyName(row.full_name);
  const companyPart = slugifyName(row.company).slice(0, 20);
  return `${namePart}--${companyPart}`;
}

export function fichePath(row) {
  return join(CARNET_DIR, `${ficheSlug(row)}.md`);
}

export function computeNextTouchDue(lastTouch, cadenceDays) {
  if (!lastTouch) return '';
  const last = new Date(lastTouch);
  if (isNaN(last.getTime())) return '';
  const cad = parseInt(cadenceDays, 10) || DEFAULT_CADENCE_DAYS;
  return new Date(last.getTime() + cad * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Génère le header markdown pour une fiche (les sections Coordonnées, Status, Liens)
function buildFicheHeader(row) {
  const lines = [];
  lines.push(`# ${row.full_name || '(sans nom)'}`);
  lines.push('');
  const sub = [];
  if (row.role) sub.push(row.role);
  if (row.company) sub.push(row.company);
  if (row.site) sub.push(row.site);
  if (sub.length) { lines.push(`> ${sub.join(' • ')}`); lines.push(''); }

  lines.push('## Coordonnées');
  lines.push('');
  if (row.email) lines.push(`- 📧 ${row.email}`);
  if (row.phone) lines.push(`- 📱 ${row.phone}`);
  if (row.linkedin) {
    const url = row.linkedin.startsWith('http') ? row.linkedin : `https://${row.linkedin}`;
    lines.push(`- 🔗 [LinkedIn](${url})`);
  }
  lines.push('');

  lines.push('## Status & cadence');
  lines.push('');
  lines.push(`- **Status:** ${row.status || 'active'}`);
  lines.push(`- **Dernier contact:** ${row.last_touch || '—'}`);
  lines.push(`- **Prochain rappel:** ${row.next_touch_due || '—'} (cadence ${row.cadence_days || DEFAULT_CADENCE_DAYS}j)`);
  lines.push('');

  if (row.linked_mandats) {
    lines.push('## Mandats liés');
    lines.push('');
    for (const m of row.linked_mandats.split(',').map(s => s.trim()).filter(Boolean)) {
      lines.push(`- [Mandat #${m}](../data/mandats.md)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Section after the header (free-form, contains intro/potentiel/journal)
const FICHE_SECTION_MARKER = '<!-- FICHE_DETAILS_BELOW -->';

// Compose une fiche complète depuis le row TSV + le contenu libre
export function composeFiche(row, freeContent = '') {
  const header = buildFicheHeader(row);
  const free = freeContent.trim();
  return `${header}\n${FICHE_SECTION_MARKER}\n\n${free || '## Comment je l\'ai connu\n\n_(à compléter)_\n\n## Potentiel / Mandats possibles\n\n_(à compléter)_\n\n## Journal\n'}\n`;
}

// Lit le contenu libre de la fiche (tout après le marker)
export function readFreeContent(slug) {
  const path = join(CARNET_DIR, `${slug}.md`);
  if (!existsSync(path)) return '';
  const text = readFileSync(path, 'utf-8');
  const idx = text.indexOf(FICHE_SECTION_MARKER);
  if (idx < 0) return text; // fichier sans marker = tout est libre
  return text.slice(idx + FICHE_SECTION_MARKER.length).trim();
}

// Sauvegarde la fiche (header dérivé du row + contenu libre fourni)
export function syncFiche(row, freeContent = null) {
  if (!existsSync(CARNET_DIR)) mkdirSync(CARNET_DIR, { recursive: true });
  const slug = ficheSlug(row);
  const path = join(CARNET_DIR, `${slug}.md`);
  // Si pas de freeContent fourni, conserver l'existant
  const free = freeContent !== null ? freeContent : readFreeContent(slug);
  const content = composeFiche(row, free);
  writeFileSync(path, content);
  return path;
}

export function readFiche(row) {
  const path = fichePath(row);
  if (!existsSync(path)) return composeFiche(row, '');
  return readFileSync(path, 'utf-8');
}

export function writeFicheRaw(row, content) {
  if (!existsSync(CARNET_DIR)) mkdirSync(CARNET_DIR, { recursive: true });
  writeFileSync(fichePath(row), content);
}

// Append une entry au journal (auto: ajoute "## Journal" si absent)
export function appendJournal(row, entry) {
  const free = readFreeContent(ficheSlug(row));
  const date = entry.date || new Date().toISOString().slice(0, 10);
  const subject = entry.subject || 'Touched';
  const body = (entry.body || '').trim();
  const journalEntry = `\n### ${date} — ${subject}\n${body ? body + '\n' : ''}`;

  let newFree = free;
  if (free.includes('## Journal')) {
    // Insère après "## Journal"
    const idx = free.indexOf('## Journal');
    const before = free.slice(0, idx + '## Journal'.length);
    const after = free.slice(idx + '## Journal'.length);
    newFree = `${before}\n${journalEntry}${after}`;
  } else {
    // Ajoute la section Journal à la fin
    newFree = `${free}\n\n## Journal\n${journalEntry}`;
  }

  syncFiche(row, newFree);
  return journalEntry;
}

// Marque un "touch" : update last_touch=today + next_touch_due, ajoute journal entry
export function recordTouch(row, opts = {}) {
  const today = new Date().toISOString().slice(0, 10);
  row.last_touch = today;
  row.next_touch_due = computeNextTouchDue(today, row.cadence_days);
  appendJournal(row, {
    date: today,
    subject: opts.subject || 'Contact',
    body: opts.body || '',
  });
  return row;
}

// Convert an existing prospect row (from prospection.tsv) into a carnet entry
export function buildFromProspect(prospect, prospectIdx, defaults = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const row = {
    id: String(nextCarnetId()),
    full_name: prospect.contact || prospect.company,
    company: prospect.company || '',
    role: defaults.role || '',
    site: defaults.site || '',
    email: (prospect.email || '').replace(/\s*\(à confirmer\)/, '').trim(),
    phone: defaults.phone || '',
    linkedin: prospect.linkedin || '',
    last_touch: defaults.last_touch || today,
    next_touch_due: '',
    cadence_days: String(defaults.cadence_days || DEFAULT_CADENCE_DAYS),
    status: defaults.status || 'active',
    linked_mandats: defaults.linked_mandats || '',
    notes: `Migré depuis prospection.tsv (idx ${prospectIdx}). ${prospect.notes || ''}`.slice(0, 1000),
  };
  row.next_touch_due = computeNextTouchDue(row.last_touch, row.cadence_days);
  return row;
}

// Liste tous les fichiers fiches existants (pour audit / nettoyage)
export function listFiches() {
  if (!existsSync(CARNET_DIR)) return [];
  return readdirSync(CARNET_DIR).filter(f => f.endsWith('.md') && !f.startsWith('._'));
}

export { VALID_STATUSES, DEFAULT_CADENCE_DAYS, CARNET_DIR, CARNET_FILE };
