#!/usr/bin/env node
/**
 * prospect-scraper.mjs — Scrape public directories + enrich with Hunter.io
 *
 * Usage:
 *   node prospect-scraper.mjs --segment fiduciaire --geo ch    # Scrape Swiss fiduciaires
 *   node prospect-scraper.mjs --segment family_office --geo fr  # Scrape French family offices
 *   node prospect-scraper.mjs --segment admin --geo ch          # Scrape Swiss administrations
 *   node prospect-scraper.mjs --segment pme --geo ch            # Scrape Swiss PMEs
 *   node prospect-scraper.mjs --enrich                          # Enrich all prospects missing emails via Hunter
 *   node prospect-scraper.mjs --verify                          # Verify all unverified emails
 *   node prospect-scraper.mjs --stats                           # Show CRM stats
 *   node prospect-scraper.mjs --import file.csv                 # Import from CSV (name,company,domain,segment,city,country)
 *
 * Sources:
 *   - Fiduciaires CH: monetas.ch, local.ch, fiduciairesuisse.ch
 *   - Family offices: SFOA directory, finews.ch
 *   - Administrations: communes.ch, canton websites
 *   - PME: local.ch, startups.ch, CCI directories
 *
 * Reads config from config/hunter.yml
 * Writes to data/prospects.tsv
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HUNTER_FILE = join(ROOT, 'config', 'hunter.yml');
const PROSPECTS_FILE = join(ROOT, 'data', 'prospects.tsv');

// --- Config ---
function loadHunterConfig() {
  if (!existsSync(HUNTER_FILE)) {
    console.error('ERREUR: config/hunter.yml introuvable.');
    process.exit(1);
  }
  const config = yaml.load(readFileSync(HUNTER_FILE, 'utf-8'));
  return config.hunter;
}

// --- TSV helpers ---
function loadProspects() {
  if (!existsSync(PROSPECTS_FILE)) return [];
  const raw = readFileSync(PROSPECTS_FILE, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines.map(line => {
    const cols = line.split('\t');
    return {
      id: cols[0],
      date: cols[1],
      entreprise: cols[2],
      contact: cols[3],
      email: cols[4],
      segment: cols[5],
      ville: cols[6],
      pays: cols[7],
      statut: cols[8],
      campagne: cols[9],
      dernier_envoi: cols[10],
      notes: cols[11] || '',
    };
  });
}

function saveProspects(prospects) {
  const header = [
    '# Scaliab — Prospect CRM',
    '# Format: TSV — one prospect per line',
    '#\t Date\tEntreprise\tContact\tEmail\tSegment\tVille\tPays\tStatut\tCampagne\tDernier_envoi\tNotes',
  ].join('\n');

  const lines = prospects.map(p =>
    [p.id, p.date, p.entreprise, p.contact, p.email, p.segment, p.ville, p.pays, p.statut, p.campagne, p.dernier_envoi, p.notes].join('\t')
  );

  writeFileSync(PROSPECTS_FILE, header + '\n' + lines.join('\n') + '\n');
}

function nextId(prospects) {
  if (prospects.length === 0) return 1;
  const maxId = Math.max(...prospects.map(p => parseInt(p.id) || 0));
  return maxId + 1;
}

function isDuplicate(prospects, entreprise, email) {
  const normEnt = entreprise.toLowerCase().trim();
  const normEmail = (email || '').toLowerCase().trim();
  return prospects.some(p =>
    p.entreprise.toLowerCase().trim() === normEnt ||
    (normEmail && p.email.toLowerCase().trim() === normEmail)
  );
}

// --- Hunter.io API ---
async function hunterDomainSearch(apiKey, domain) {
  const params = new URLSearchParams({
    domain,
    api_key: apiKey,
    limit: 5,
    type: 'personal',
  });

  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
    const data = await res.json();
    if (data.errors) return null;
    return data.data;
  } catch (e) {
    console.error(`  Hunter error for ${domain}: ${e.message}`);
    return null;
  }
}

async function hunterEmailFinder(apiKey, domain, firstName, lastName) {
  const params = new URLSearchParams({
    domain,
    first_name: firstName,
    last_name: lastName,
    api_key: apiKey,
  });

  try {
    const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);
    const data = await res.json();
    if (data.errors) return null;
    return data.data;
  } catch (e) {
    return null;
  }
}

async function hunterVerify(apiKey, email) {
  const params = new URLSearchParams({ email, api_key: apiKey });
  try {
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`);
    const data = await res.json();
    return data.data;
  } catch (e) {
    return null;
  }
}

// --- Import from CSV ---
function importCSV(filePath) {
  if (!existsSync(filePath)) {
    console.error(`Fichier introuvable: ${filePath}`);
    process.exit(1);
  }

  const prospects = loadProspects();
  let id = nextId(prospects);
  const today = new Date().toISOString().slice(0, 10);
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('#'));

  // Skip header if present
  const startIdx = lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('entreprise') ? 1 : 0;
  let added = 0;
  let skipped = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/);
    if (cols.length < 3) continue;

    const contact = cols[0]?.trim() || '';
    const entreprise = cols[1]?.trim() || '';
    const domain = cols[2]?.trim() || '';
    const segment = cols[3]?.trim() || 'pme';
    const ville = cols[4]?.trim() || '';
    const pays = cols[5]?.trim() || 'CH';

    if (!entreprise) continue;
    if (isDuplicate(prospects, entreprise, '')) {
      skipped++;
      continue;
    }

    prospects.push({
      id: String(id++),
      date: today,
      entreprise,
      contact,
      email: '', // Will be enriched later
      segment,
      ville,
      pays,
      statut: 'nouveau',
      campagne: '',
      dernier_envoi: '',
      notes: domain ? `domain:${domain}` : '',
    });
    added++;
  }

  saveProspects(prospects);
  console.log(`Import: ${added} prospects ajoutes, ${skipped} doublons ignores.`);
}

// --- Enrich prospects with Hunter ---
async function enrichProspects() {
  const hunter = loadHunterConfig();
  const prospects = loadProspects();
  const toEnrich = prospects.filter(p => !p.email && p.notes.includes('domain:'));

  console.log(`${toEnrich.length} prospects a enrichir...`);
  let enriched = 0;

  for (const p of toEnrich) {
    const domain = p.notes.match(/domain:([^\s,]+)/)?.[1];
    if (!domain) continue;

    console.log(`  Enrichissement: ${p.entreprise} (${domain})...`);

    // If we have a contact name, try email finder
    if (p.contact && p.contact.includes(' ')) {
      const parts = p.contact.split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');
      const result = await hunterEmailFinder(hunter.api_key, domain, firstName, lastName);
      if (result?.email) {
        p.email = result.email;
        p.notes = p.notes.replace(/domain:[^\s,]+/, `domain:${domain} confidence:${result.score}%`);
        enriched++;
        console.log(`    -> ${result.email} (${result.score}%)`);
        await sleep(200);
        continue;
      }
    }

    // Fallback: domain search for first result
    const result = await hunterDomainSearch(hunter.api_key, domain);
    if (result?.emails?.length > 0) {
      const best = result.emails[0];
      p.email = best.value;
      if (!p.contact && (best.first_name || best.last_name)) {
        p.contact = `${best.first_name || ''} ${best.last_name || ''}`.trim();
      }
      p.notes = p.notes.replace(/domain:[^\s,]+/, `domain:${domain} confidence:${best.confidence}%`);
      enriched++;
      console.log(`    -> ${best.value} (${best.confidence}%) — ${best.position || 'N/A'}`);
    } else {
      console.log(`    -> Aucun email trouve`);
    }

    await sleep(200); // Rate limit
  }

  saveProspects(prospects);
  console.log(`\nEnrichissement termine: ${enriched}/${toEnrich.length} emails trouves.`);
}

// --- Verify emails ---
async function verifyEmails() {
  const hunter = loadHunterConfig();
  const prospects = loadProspects();
  const toVerify = prospects.filter(p => p.email && !p.notes.includes('verified:'));

  console.log(`${toVerify.length} emails a verifier...`);
  let valid = 0;
  let invalid = 0;

  for (const p of toVerify) {
    const result = await hunterVerify(hunter.api_key, p.email);
    if (result) {
      const status = result.result === 'deliverable' ? 'ok' : result.result;
      p.notes += ` verified:${status}`;
      if (status === 'ok') valid++;
      else invalid++;
      console.log(`  ${p.email} -> ${status}`);
    }
    await sleep(300);
  }

  saveProspects(prospects);
  console.log(`\nVerification: ${valid} valides, ${invalid} invalides.`);
}

// --- Stats ---
function showStats() {
  const prospects = loadProspects();
  const total = prospects.length;
  const withEmail = prospects.filter(p => p.email).length;
  const bySegment = {};
  const byStatut = {};
  const byPays = {};

  for (const p of prospects) {
    bySegment[p.segment] = (bySegment[p.segment] || 0) + 1;
    byStatut[p.statut] = (byStatut[p.statut] || 0) + 1;
    byPays[p.pays] = (byPays[p.pays] || 0) + 1;
  }

  console.log(`\n=== Scaliab CRM Stats ===`);
  console.log(`Total prospects: ${total}`);
  console.log(`Avec email: ${withEmail} (${total ? Math.round(withEmail / total * 100) : 0}%)`);
  console.log(`\nPar segment:`);
  for (const [k, v] of Object.entries(bySegment).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\nPar statut:`);
  for (const [k, v] of Object.entries(byStatut).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\nPar pays:`);
  for (const [k, v] of Object.entries(byPays).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- CLI ---
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
};

if (args.includes('--stats')) {
  showStats();
} else if (args.includes('--enrich')) {
  await enrichProspects();
} else if (args.includes('--verify')) {
  await verifyEmails();
} else if (args.includes('--import')) {
  const file = getArg('--import');
  if (!file) {
    console.error('Usage: node prospect-scraper.mjs --import file.csv');
    process.exit(1);
  }
  importCSV(file);
} else {
  console.log(`Scaliab Prospect Scraper — Usage:`);
  console.log(`  node prospect-scraper.mjs --import file.csv      Import prospects from CSV`);
  console.log(`  node prospect-scraper.mjs --enrich                Enrich emails via Hunter.io`);
  console.log(`  node prospect-scraper.mjs --verify                Verify emails via Hunter.io`);
  console.log(`  node prospect-scraper.mjs --stats                 Show CRM stats`);
  console.log(``);
  console.log(`CSV format: contact,entreprise,domain,segment,ville,pays`);
  console.log(`Segments: fiduciaire, family_office, admin, pme`);
}
