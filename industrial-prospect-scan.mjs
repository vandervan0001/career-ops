#!/usr/bin/env node
/**
 * industrial-prospect-scan.mjs — Find targeted industrial prospects in Romandie
 *
 * Usage:
 *   node industrial-prospect-scan.mjs
 *   node industrial-prospect-scan.mjs --limit 20
 *   node industrial-prospect-scan.mjs --dry-run
 *
 * Strategy:
 *   - Scrape Jobup search result pages for automation/OT/manufacturing signals
 *   - Open each job detail page and parse schema.org JobPosting JSON
 *   - Keep only industrial companies and high-signal roles in target geography
 *   - Append new rows to data/prospection.tsv with status=identifie
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROFILE_FILE = join(ROOT, 'config', 'profile.yml');
const PROSPECTION_FILE = join(ROOT, 'data', 'prospection.tsv');

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
};

const LIMIT = Number(getArg('--limit', '20'));
const DRY_RUN = hasFlag('--dry-run');
const FETCH_TIMEOUT_MS = 12000;
const MAX_DETAIL_PER_SEARCH = 12;

const JOBUP_SEARCHES = [
  { term: 'automation', location: 'neuchâtel' },
  { term: 'automation', location: 'vaud' },
  { term: 'automation', location: 'genève' },
  { term: 'automation', location: 'fribourg' },
  { term: 'automation', location: 'valais' },
  { term: 'OT', location: 'suisse romande' },
  { term: 'manufacturing', location: 'vaud' },
  { term: 'manufacturing', location: 'neuchâtel' },
];

const EXCLUDED_COMPANY_KEYWORDS = [
  'agap2', 'amaris', 'qps', 'michael page', 'hays', 'randstad', 'ok job', 'axepta',
  'approach people', 'experis', 'talentmark', 'recrutis', 'fokus', 'careerplus',
  'proclinical', 'albedis', 'consultants in science', 'hiq consulting', 'gxp consulting',
  'gi group', 'valjob', 'accès personnel', 'acces personnel', 'safeguard', 'myscience',
  'manpower', 'sigma',
  'recruit', 'staffing', 'interim',
];

const HIGH_SIGNAL_TITLE_KEYWORDS = [
  'automation engineer', 'ingénieur en automation', 'responsable automation',
  'ot engineer', 'automation lead', 'chef de projet automation', 'csv',
  'qualification', 'head manufacturing', 'director manufacturing', 'site head',
  'plant manager', 'directeur de production', 'head of engineering',
];

const EXCLUDED_TITLE_KEYWORDS = [
  'apprenti', 'stagiaire', 'intern', 'operator', 'opérateur', 'assembly technician',
  'technologue', 'assistant',
];

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function loadProfile() {
  if (!existsSync(PROFILE_FILE)) return {};
  return yaml.load(readFileSync(PROFILE_FILE, 'utf-8')) || {};
}

function getSourcingConfig(profile) {
  const sourcing = profile.sourcing || {};
  return {
    watchlistCompanies: sourcing.watchlist_companies || [],
    excludedCompanies: (sourcing.excluded_companies || []).map((value) => String(value).toLowerCase()),
    excludedPatterns: (sourcing.excluded_patterns || []).map((value) => String(value).toLowerCase()),
  };
}

function ensureFile() {
  if (!existsSync(PROSPECTION_FILE)) {
    writeFileSync(
      PROSPECTION_FILE,
      'date\tcompany\tcontact\temail\tlinkedin\tsector\tsignal\tscore\tmessage_sent\tstatus\tnotes\n'
    );
  }
}

function loadProspection() {
  ensureFile();
  return readFileSync(PROSPECTION_FILE, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('date\t'))
    .map((line) => {
      const cols = line.split('\t');
      return {
        date: cols[0] || '',
        company: cols[1] || '',
        signal: cols[6] || '',
      };
    });
}

function saveProspection(rows) {
  const header = 'date\tcompany\tcontact\temail\tlinkedin\tsector\tsignal\tscore\tmessage_sent\tstatus\tnotes';
  const body = rows.map((row) =>
    [
      row.date,
      row.company,
      row.contact,
      row.email,
      row.linkedin,
      row.sector,
      row.signal,
      row.score,
      row.channel,
      row.status,
      row.notes || '',
    ].join('\t')
  );
  writeFileSync(PROSPECTION_FILE, `${header}\n${body.join('\n')}\n`);
}

function containsOne(text, needles) {
  const source = String(text || '').toLowerCase();
  return needles.some((needle) => source.includes(needle));
}

function stripTags(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJobPosting(html) {
  const scripts = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1]);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const job = list.find((entry) => entry['@type'] === 'JobPosting');
      if (job) return job;
    } catch {
      // ignore malformed non-JobPosting script
    }
  }
  return null;
}

function detectSector(text) {
  const source = String(text || '').toLowerCase();
  if (containsOne(source, ['pharma', 'biotech', 'gmp', 'life sciences'])) return 'pharma';
  if (containsOne(source, ['medtech', 'medical', 'médical', 'diagnostic', 'implant'])) return 'medtech';
  if (containsOne(source, ['chimie', 'chemical', 'arôme', 'arome'])) return 'chimie';
  if (containsOne(source, ['énergie', 'energie', 'utilities', 'electricite', 'gaz'])) return 'énergie/utilities';
  if (containsOne(source, ['horlogerie', 'watch', 'lvmh', 'manufacture'])) return 'horlogerie/luxe';
  if (containsOne(source, ['food', 'agro', 'fenaco'])) return 'agroalimentaire';
  return 'manufacturing';
}

function geoAllowed(locality, profile) {
  const city = String(locality || '').toLowerCase();
  const accepted = profile.location?.accepted_locations || [];
  const rejected = profile.location?.rejected_locations || [];
  if (rejected.some((value) => city.includes(String(value).toLowerCase()))) return false;
  if (accepted.length === 0) return true;
  return accepted.some((value) => city.includes(String(value).toLowerCase()));
}

function scoreJob(job, locality) {
  const title = String(job.title || '').toLowerCase();
  const description = stripTags(job.description || '').toLowerCase();
  let score = 7;
  if (containsOne(title, ['head manufacturing', 'director manufacturing', 'site head', 'directeur de production'])) score += 1.4;
  if (containsOne(title, ['automation', 'ot', 'responsable automation', 'head of engineering'])) score += 1;
  if (containsOne(description, ['pharma', 'medtech', 'gmp', 'production', 'automation'])) score += 0.6;
  if (containsOne(locality, ['lausanne', 'geneve', 'genève', 'neuchâtel', 'fribourg', 'bulle', 'sion', 'nyon', 'morges', 'yverdon'])) score += 0.4;
  return Math.min(10, Number(score.toFixed(1)));
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VanguardSystems/1.0)' },
  });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

function parseDetailUrls(html) {
  const matches = [...html.matchAll(/href="([^"]*\/emplois\/detail\/[^"]+)"/g)];
  return [...new Set(matches.map((match) => new URL(match[1], 'https://www.jobup.ch').toString()))];
}

async function collectSearchResults(search) {
  const url = `https://www.jobup.ch/fr/emplois/?location=${encodeURIComponent(search.location)}&term=${encodeURIComponent(search.term)}`;
  const html = await fetchHtml(url);
  return parseDetailUrls(html);
}

async function parseJobDetail(url) {
  const html = await fetchHtml(url);
  const job = parseJobPosting(html);
  if (!job) return null;

  const company = job.hiringOrganization?.name || '';
  const domain = job.hiringOrganization?.sameAs || '';
  const locality = job.jobLocation?.address?.addressLocality || '';
  const description = stripTags(job.description || '');
  const sector = detectSector(`${job.title} ${description}`);

  return {
    url,
    company,
    domain,
    locality,
    title: job.title || '',
    description,
    sector,
  };
}

function companyExcluded(company, sourcingConfig) {
  const text = String(company || '').toLowerCase();
  return containsOne(text, EXCLUDED_COMPANY_KEYWORDS) || containsOne(text, sourcingConfig.excludedCompanies);
}

function textExcluded(text, sourcingConfig) {
  return containsOne(String(text || '').toLowerCase(), sourcingConfig.excludedPatterns);
}

function isRelevant(job, profile, sourcingConfig) {
  if (!job?.company) return false;
  if (companyExcluded(job.company, sourcingConfig)) return false;
  if (!geoAllowed(job.locality, profile)) return false;
  if (containsOne(job.title, EXCLUDED_TITLE_KEYWORDS)) return false;
  if (!containsOne(job.title, HIGH_SIGNAL_TITLE_KEYWORDS)) return false;
  if (textExcluded(`${job.title} ${job.description}`, sourcingConfig)) return false;
  return true;
}

function parseGoogleNews(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items.map((match) => {
    const block = match[1];
    const title = stripTags((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const link = stripTags((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
    const description = stripTags((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '');
    const source = stripTags((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '');
    return { title, link, description, source };
  });
}

async function collectExpansionSignals(company) {
  const query = `"${company}" (investissement OR expansion OR manufacturing OR production OR site OR automation OR Neuchâtel OR Vaud OR Genève OR Fribourg OR Valais)`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}`;
  try {
    const xml = await fetchHtml(url);
    return parseGoogleNews(xml);
  } catch {
    return [];
  }
}

function scoreExpansion(item, company) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let score = 7.8;
  if (containsOne(text, ['invest', 'investment', 'expansion', 'facility', 'site'])) score += 0.8;
  if (containsOne(text, ['manufacturing', 'production', 'automation', 'biotechnology'])) score += 0.6;
  if (containsOne(text, ['neuchâtel', 'vaud', 'genève', 'fribourg', 'valais', 'villeret', 'bulle', 'yverdon'])) score += 0.4;
  if (containsOne(company, ['takeda', 'ucb', 'straumann'])) score += 0.2;
  return Math.min(10, Number(score.toFixed(1)));
}

function inferExpansionSector(company, text) {
  return detectSector(`${company} ${text}`);
}

async function main() {
  const profile = loadProfile();
  const sourcingConfig = getSourcingConfig(profile);
  const existing = loadProspection();
  const existingKeys = new Set(existing.map((row) => `${row.company.toLowerCase()}::${row.signal}`));
  const discovered = [];
  const seenUrls = new Set();

  for (const search of JOBUP_SEARCHES) {
    let detailUrls = [];
    try {
      detailUrls = (await collectSearchResults(search)).slice(0, MAX_DETAIL_PER_SEARCH);
    } catch (err) {
      console.error(`Recherche Jobup échouée ${search.term}/${search.location}: ${err.message}`);
      continue;
    }

    for (const url of detailUrls) {
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      let job = null;
      try {
        job = await parseJobDetail(url);
      } catch (err) {
        continue;
      }
      if (!isRelevant(job, profile, sourcingConfig)) continue;

      const signal = `recrutement ${job.title} ${job.locality}`.trim();
      const key = `${job.company.toLowerCase()}::${signal}`;
      if (existingKeys.has(key)) continue;

      existingKeys.add(key);
      discovered.push({
        date: nowDate(),
        company: job.company,
        contact: '',
        email: '',
        linkedin: '',
        sector: job.sector,
        signal,
        score: scoreJob({ title: job.title, description: job.description }, job.locality),
        channel: '',
        status: 'identifie',
        notes: `source:${job.url} | domain:${job.domain} | locality:${job.locality} | signal_type:hiring | role:${job.title}`,
      });

      if (discovered.length >= LIMIT * 2) break;
    }

    if (discovered.length >= LIMIT * 2) break;
  }

  for (const company of sourcingConfig.watchlistCompanies) {
    const items = await collectExpansionSignals(company);
    for (const item of items.slice(0, 4)) {
      const text = `${item.title} ${item.description}`.toLowerCase();
      if (companyExcluded(company, sourcingConfig)) continue;
      if (textExcluded(text, sourcingConfig)) continue;
      if (!containsOne(text, ['invest', 'expansion', 'facility', 'site', 'manufacturing', 'production', 'automation'])) continue;

      const signal = `veille expansion ${company}`.trim();
      const key = `${company.toLowerCase()}::${signal}`;
      if (existingKeys.has(key)) continue;

      existingKeys.add(key);
      discovered.push({
        date: nowDate(),
        company,
        contact: '',
        email: '',
        linkedin: '',
        sector: inferExpansionSector(company, text),
        signal,
        score: scoreExpansion(item, company),
        channel: '',
        status: 'identifie',
        notes: `source:${item.link} | article:${item.title} | publisher:${item.source || 'n/a'} | signal_type:expansion`,
      });
      break;
    }
  }

  const ranked = discovered.sort((a, b) => b.score - a.score).slice(0, LIMIT);
  console.log(`Prospects retenus: ${ranked.length}`);
  ranked.forEach((row) => console.log(`${row.score}/10 ${row.company} — ${row.signal} — ${row.sector}`));

  if (!DRY_RUN && ranked.length > 0) {
    const fullRows = readFileSync(PROSPECTION_FILE, 'utf-8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('date\t'))
      .map((line) => {
        const cols = line.split('\t');
        return {
          date: cols[0] || '',
          company: cols[1] || '',
          contact: cols[2] || '',
          email: cols[3] || '',
          linkedin: cols[4] || '',
          sector: cols[5] || '',
          signal: cols[6] || '',
          score: cols[7] || '',
          channel: cols[8] || '',
          status: cols[9] || '',
          notes: cols[10] || '',
        };
      });
    saveProspection([...fullRows, ...ranked]);
    console.log(`Ajoutés à ${PROSPECTION_FILE}`);
  }
}

await main();
