#!/usr/bin/env node
/**
 * enrich-registries.mjs -- Enrich prospects.tsv with missing emails
 *
 * Strategy:
 *   1. For prospects with a domain in notes, fetch the website and scrape emails
 *   2. For admin (communes), try common patterns (info@, greffe@, administration@)
 *   3. Verify guessed emails via Hunter.io email-verifier
 *   4. Update prospects.tsv in-place
 *
 * Usage:
 *   node enrich-registries.mjs                    # Process all missing
 *   node enrich-registries.mjs --limit 100        # Process first 100
 *   node enrich-registries.mjs --segment admin    # Only admin segment
 *   node enrich-registries.mjs --dry-run          # Don't write changes
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROSPECTS_FILE = join(ROOT, 'data', 'prospects.tsv');
const HUNTER_FILE = join(ROOT, 'config', 'hunter.yml');

// --- Config ---
const FETCH_DELAY_MS = 300;
const HUNTER_DELAY_MS = 200;
const SAVE_EVERY = 50;
const FETCH_TIMEOUT_MS = 8000;

// --- CLI args ---
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(name);

const LIMIT = getArg('--limit') ? parseInt(getArg('--limit'), 10) : Infinity;
const SEGMENT_FILTER = getArg('--segment') || null;
const DRY_RUN = hasFlag('--dry-run');
const VERBOSE = hasFlag('--verbose') || hasFlag('-v');

// --- Hunter API ---
function loadApiKey() {
  if (!existsSync(HUNTER_FILE)) {
    console.error('WARN: config/hunter.yml not found, skipping Hunter verification');
    return null;
  }
  const config = yaml.load(readFileSync(HUNTER_FILE, 'utf-8'));
  return config.hunter.api_key;
}

const HUNTER_API_KEY = loadApiKey();
let hunterCalls = 0;

async function hunterVerify(email) {
  if (!HUNTER_API_KEY) return null;
  hunterCalls++;
  const params = new URLSearchParams({ email, api_key: HUNTER_API_KEY });
  try {
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`);
    const data = await res.json();
    if (data.errors) {
      if (VERBOSE) console.log(`  Hunter error: ${JSON.stringify(data.errors)}`);
      return null;
    }
    return data.data;
  } catch (err) {
    if (VERBOSE) console.log(`  Hunter fetch error: ${err.message}`);
    return null;
  }
}

async function hunterDomainSearch(domain) {
  if (!HUNTER_API_KEY) return null;
  hunterCalls++;
  const params = new URLSearchParams({
    domain,
    api_key: HUNTER_API_KEY,
    limit: '5',
  });
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
    const data = await res.json();
    if (data.errors) {
      if (VERBOSE) console.log(`  Hunter domain-search error: ${JSON.stringify(data.errors)}`);
      return null;
    }
    return data.data;
  } catch (err) {
    if (VERBOSE) console.log(`  Hunter domain-search error: ${err.message}`);
    return null;
  }
}

// --- Website scraping ---
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const JUNK_EMAILS = new Set([
  'example@example.com', 'test@test.com', 'email@example.com',
  'noreply@', 'no-reply@', 'mailer-daemon@',
]);

function isJunkEmail(email) {
  const lower = email.toLowerCase();
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.gif') || lower.endsWith('.svg')) return true;
  if (JUNK_EMAILS.has(lower)) return true;
  if (lower.includes('noreply') || lower.includes('no-reply') || lower.includes('mailer-daemon')) return true;
  if (lower.includes('example.com') || lower.includes('test.com') || lower.includes('exemple.fr') || lower.includes('exemple.com')) return true;
  if (lower.includes('sentry.io') || lower.includes('wixpress') || lower.includes('wordpress')) return true;
  if (lower.startsWith('_') || lower.startsWith('-')) return true;
  return false;
}

function extractDomain(notes) {
  if (!notes) return null;
  const match = notes.match(/domain:([^\s|]+)/);
  return match ? match[1].trim() : null;
}

async function fetchPage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('text/plain') && !ct.includes('application/xhtml')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function scrapeEmails(html, domain) {
  if (!html) return [];
  const found = html.match(EMAIL_RE) || [];
  // Prioritize emails matching the domain
  const domainBase = domain.replace(/^www\./, '');
  const onDomain = [];
  const offDomain = [];
  for (const e of found) {
    const lower = e.toLowerCase();
    if (isJunkEmail(lower)) continue;
    if (lower.endsWith(domainBase) || lower.endsWith(domainBase.replace('.ch', '.com'))) {
      onDomain.push(lower);
    } else {
      offDomain.push(lower);
    }
  }
  // Deduplicate
  return [...new Set(onDomain), ...new Set(offDomain)];
}

// --- Strategies ---

// Try fetching the website and scraping emails
async function tryWebsiteScrape(domain) {
  const urls = [
    `https://${domain}`,
    `https://${domain}/contact`,
    `https://${domain}/kontakt`,
    `https://${domain}/impressum`,
    `https://www.${domain}`,
    `https://www.${domain}/contact`,
  ];

  const allEmails = [];
  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) {
      const emails = scrapeEmails(html, domain);
      allEmails.push(...emails);
    }
    await sleep(FETCH_DELAY_MS);
    if (allEmails.length > 0) break; // Found emails, stop early
  }
  return [...new Set(allEmails)];
}

// For admin/communes, try common patterns
function getAdminCandidates(domain) {
  const prefixes = [
    'info', 'greffe', 'administration', 'commune', 'mairie',
    'secretariat', 'contact', 'accueil', 'general',
  ];
  return prefixes.map(p => `${p}@${domain}`);
}

// For fiduciaire, common patterns
function getFiduciaireCandidates(domain) {
  return [
    `info@${domain}`,
    `contact@${domain}`,
    `office@${domain}`,
    `reception@${domain}`,
    `secretariat@${domain}`,
  ];
}

// For general companies
function getGenericCandidates(domain) {
  return [
    `info@${domain}`,
    `contact@${domain}`,
    `office@${domain}`,
  ];
}

// Pick the best email from a list, using Hunter to verify if available
async function pickBestEmail(candidates, segment) {
  if (candidates.length === 0) return null;

  // If no Hunter key, return first candidate from scrape (better than nothing)
  if (!HUNTER_API_KEY) {
    return { email: candidates[0], confidence: 50, source: 'scrape' };
  }

  // Try verifying top candidates (max 3 to save API calls)
  const toVerify = candidates.slice(0, 3);
  for (const email of toVerify) {
    await sleep(HUNTER_DELAY_MS);
    const result = await hunterVerify(email);
    if (result) {
      if (result.result === 'deliverable' || result.status === 'valid') {
        return { email, confidence: result.score || 90, source: 'verified' };
      }
      if (result.result === 'risky' && (result.score || 0) >= 60) {
        return { email, confidence: result.score, source: 'risky-verified' };
      }
    }
  }

  // If Hunter couldn't verify but we found emails on the website, still use them
  // (just with lower confidence)
  if (candidates.length > 0) {
    return { email: candidates[0], confidence: 40, source: 'unverified-scrape' };
  }

  return null;
}

// --- Main ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseTSV(content) {
  const lines = content.split('\n');
  const header = [];
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') {
      header.push(line);
    } else {
      dataLines.push(line);
    }
  }
  return { header, dataLines };
}

async function main() {
  console.log('=== enrich-registries.mjs ===');
  console.log(`Limit: ${LIMIT === Infinity ? 'none' : LIMIT}`);
  console.log(`Segment filter: ${SEGMENT_FILTER || 'all'}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Hunter API: ${HUNTER_API_KEY ? 'available' : 'not configured'}`);
  console.log('');

  const content = readFileSync(PROSPECTS_FILE, 'utf-8');
  const { header, dataLines } = parseTSV(content);

  // Parse prospects
  const prospects = dataLines.map((line, idx) => {
    const cols = line.split('\t');
    return {
      idx,
      raw: line,
      cols,
      id: cols[0],
      date: cols[1],
      entreprise: cols[2],
      contact: cols[3] || '',
      email: cols[4] || '',
      segment: cols[5] || '',
      ville: cols[6] || '',
      pays: cols[7] || '',
      statut: cols[8] || '',
      campagne: cols[9] || '',
      dernier_envoi: cols[10] || '',
      notes: cols[11] || '',
    };
  });

  // Filter: missing email + has domain
  let targets = prospects.filter(p => {
    if (p.email.trim()) return false;
    if (SEGMENT_FILTER && p.segment !== SEGMENT_FILTER) return false;
    const domain = extractDomain(p.notes);
    if (!domain) return false;
    return true;
  });

  if (LIMIT < targets.length) {
    targets = targets.slice(0, LIMIT);
  }

  console.log(`Prospects without email (with domain): ${targets.length}`);
  const bySegment = {};
  for (const t of targets) {
    bySegment[t.segment] = (bySegment[t.segment] || 0) + 1;
  }
  console.log('By segment:', JSON.stringify(bySegment));
  console.log('');

  let found = 0;
  let scraped = 0;
  let hunterFound = 0;
  let failed = 0;
  let processed = 0;

  for (const prospect of targets) {
    processed++;
    const domain = extractDomain(prospect.notes);
    const seg = prospect.segment;

    if (VERBOSE || processed % 10 === 0 || processed <= 5) {
      console.log(`[${processed}/${targets.length}] ${prospect.entreprise} (${seg}) - ${domain}`);
    }

    // Step 1: Try scraping the website
    let candidates = await tryWebsiteScrape(domain);
    const scrapedCount = candidates.length;

    // Step 2: If no emails scraped, try Hunter domain search
    if (candidates.length === 0 && HUNTER_API_KEY) {
      await sleep(HUNTER_DELAY_MS);
      const hunterResult = await hunterDomainSearch(domain);
      if (hunterResult && hunterResult.emails && hunterResult.emails.length > 0) {
        candidates = hunterResult.emails.map(e => e.value);
        if (VERBOSE) console.log(`  Hunter domain-search found: ${candidates.join(', ')}`);
      }
    }

    // Step 3: Add segment-specific guesses
    if (candidates.length === 0) {
      if (seg === 'admin') {
        candidates = getAdminCandidates(domain);
      } else if (seg === 'fiduciaire') {
        candidates = getFiduciaireCandidates(domain);
      } else {
        candidates = getGenericCandidates(domain);
      }
    }

    // Step 4: Pick best email
    const result = await pickBestEmail(candidates, seg);

    if (result) {
      found++;
      if (scrapedCount > 0) scraped++;
      else hunterFound++;

      const conf = result.confidence;
      const src = result.source;

      // Update the prospect's email column
      prospect.cols[4] = result.email;

      // Update notes with confidence
      const existingNotes = prospect.cols[11] || '';
      const confNote = `confidence:${conf}%`;
      if (!existingNotes.includes('confidence:')) {
        prospect.cols[11] = existingNotes ? `${existingNotes.split(' | ctx:')[0]} ${confNote} src:${src} | ctx:${existingNotes.split(' | ctx:')[1] || ''}`.trim() : confNote;
      }

      // Rebuild line
      prospect.raw = prospect.cols.join('\t');
      dataLines[prospect.idx] = prospect.raw;

      if (VERBOSE) console.log(`  -> ${result.email} (${conf}% ${src})`);
    } else {
      failed++;
      if (VERBOSE) console.log(`  -> no email found`);
    }

    // Save periodically
    if (!DRY_RUN && processed % SAVE_EVERY === 0 && found > 0) {
      const output = [...header, ...dataLines].join('\n');
      writeFileSync(PROSPECTS_FILE, output, 'utf-8');
      console.log(`  [saved] ${found} emails found so far (${processed}/${targets.length} processed)`);
    }
  }

  // Final save
  if (!DRY_RUN && found > 0) {
    const output = [...header, ...dataLines].join('\n');
    writeFileSync(PROSPECTS_FILE, output, 'utf-8');
  }

  console.log('');
  console.log('=== Results ===');
  console.log(`Processed: ${processed}`);
  console.log(`Emails found: ${found}`);
  console.log(`  - From website scrape: ${scraped}`);
  console.log(`  - From Hunter/guesses: ${hunterFound}`);
  console.log(`Failed: ${failed}`);
  console.log(`Hunter API calls: ${hunterCalls}`);
  if (DRY_RUN) console.log('(dry run, no changes written)');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
