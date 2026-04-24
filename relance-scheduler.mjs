#!/usr/bin/env node
/**
 * relance-scheduler.mjs -- Relances automatiques J+7 et J+14
 *
 * Usage:
 *   node relance-scheduler.mjs            # envoie les relances du jour
 *   node relance-scheduler.mjs --dry-run  # affiche sans envoyer
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TODAY = new Date().toISOString().slice(0, 10);

function daysDiff(dateStr) {
  const d = new Date(dateStr);
  const now = new Date(TODAY);
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function buildRelanceMessage(row, relanceNum) {
  const nom = (row.contact || '').split(' ').slice(1).join(' ') || '';
  const salut = nom ? `Bonjour Monsieur/Madame ${nom},` : 'Bonjour,';
  const body = relanceNum === 1
    ? `${salut}\n\nJe me permets de revenir vers vous suite à mon message du ${row.date_envoi || row.date}.\n\nAutomaticien freelance, je reste disponible si un besoin en renfort automatisme / mise en service se présente chez ${row.company}.\n\nBien cordialement,\nTai Van`
    : `${salut}\n\nDernier message de ma part. Je reste joignable si un besoin en automatisme ou mise en service se présente.\n\nBonne continuation.\n\nTai Van`;
  return {
    subject: relanceNum === 1 ? `Suite -- renfort automatisme dispo` : `Dernier message -- automaticien freelance`,
    body,
  };
}

async function main() {
  const { loadProspectionTsv, saveProspectionTsv } = await import('./prospection-tsv.mjs');
  const PROSPECTION_FILE = join(ROOT, 'data', 'prospection.tsv');
  const { rows } = loadProspectionTsv(PROSPECTION_FILE);

  let relanceJ = 7;
  try {
    const yaml = (await import('js-yaml')).default;
    const p = yaml.load(readFileSync(join(ROOT, 'config', 'profile.yml'), 'utf-8'));
    relanceJ = Number(p.outreach?.relance_j || 7);
  } catch {}

  const toRelance = rows.filter((row) => {
    if (!['envoye', 'relance_1'].includes(row.status)) return false;
    const dateRef = row.date_envoi || row.date;
    if (!dateRef) return false;
    const days = daysDiff(dateRef);
    if (row.status === 'envoye') return days >= relanceJ;
    if (row.status === 'relance_1') return days >= relanceJ * 2;
    return false;
  });

  console.log(`[relance-scheduler] ${toRelance.length} prospects à relancer (J+${relanceJ})`);

  for (const row of toRelance) {
    const relanceNum = row.status === 'envoye' ? 1 : 2;
    const { subject, body } = buildRelanceMessage(row, relanceNum);

    console.log(`  ${row.company} <${row.email}> → relance_${relanceNum} | Objet: ${subject}`);

    if (!DRY_RUN && row.email) {
      execFileSync('node', [
        'outreach-dispatch.mjs',
        '--company', row.company,
        '--subject', subject,
        '--body', body,
        '--live',
      ], { stdio: 'inherit', cwd: ROOT });

      row.status = `relance_${relanceNum}`;
      row.notes = `${row.notes || ''} | relance_${relanceNum} ${TODAY}`;
    }
  }

  if (!DRY_RUN && toRelance.length > 0) {
    saveProspectionTsv(PROSPECTION_FILE, rows);
    console.log('[relance-scheduler] CRM mis à jour.');
  }

  if (toRelance.length === 0) {
    console.log("[relance-scheduler] Rien à relancer aujourd'hui.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
