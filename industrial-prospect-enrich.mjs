#!/usr/bin/env node
/**
 * industrial-prospect-enrich.mjs — Enrich industrial prospects with domain/contact/email
 *
 * Usage:
 *   node industrial-prospect-enrich.mjs
 *   node industrial-prospect-enrich.mjs --top 10
 *   node industrial-prospect-enrich.mjs --company "Straumann Group"
 *   node industrial-prospect-enrich.mjs --dry-run
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { inferClassification } from './prospection-core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROSPECTION_FILE = join(ROOT, 'data', 'prospection.tsv');
const HUNTER_FILE = join(ROOT, 'config', 'hunter.yml');
const PROFILE_FILE = join(ROOT, 'config', 'profile.yml');

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
};

const TOP = Number(getArg('--top', '12'));
const COMPANY_FILTER = getArg('--company');
const DRY_RUN = hasFlag('--dry-run');

function stripTags(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRss(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items.map((match) => {
    const block = match[1];
    const title = stripTags((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const link = stripTags((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
    const description = stripTags((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '');
    return { title, link, description };
  });
}

async function searchRss(query) {
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VanguardSystems/1.0)' },
  });
  if (!res.ok) throw new Error(`Bing RSS ${res.status}`);
  return parseRss(await res.text());
}

function extractDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (host.includes('bing.com') || host.includes('jobup.ch') || host.includes('indeed.com') || host.includes('linkedin.com')) return '';
    return host;
  } catch {
    return '';
  }
}

function loadHunterKey() {
  if (!existsSync(HUNTER_FILE)) return null;
  const config = yaml.load(readFileSync(HUNTER_FILE, 'utf-8')) || {};
  return config.hunter?.api_key || null;
}

async function hunterEmailFinder(apiKey, domain, firstName, lastName) {
  const params = new URLSearchParams({
    domain,
    first_name: firstName,
    last_name: lastName,
    api_key: apiKey,
  });
  const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);
  const data = await res.json();
  return data.data || null;
}

async function hunterDomainSearch(apiKey, domain) {
  const params = new URLSearchParams({
    domain,
    api_key: apiKey,
    limit: '5',
    department: 'management',
  });
  const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
  const data = await res.json();
  return data.data || null;
}

function loadRows() {
  const raw = readFileSync(PROSPECTION_FILE, 'utf-8');
  const lines = raw.split('\n');
  const header = lines[0];
  const rows = lines
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
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
        score: Number(cols[7] || 0),
        channel: cols[8] || '',
        status: cols[9] || '',
        notes: cols[10] || '',
      };
    });
  return { header, rows };
}

function saveRows(header, rows) {
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

function appendNote(existing, note) {
  if (!existing) return note;
  if (existing.includes(note)) return existing;
  return `${existing} | ${note}`;
}

function loadProfile() {
  if (!existsSync(PROFILE_FILE)) return {};
  return yaml.load(readFileSync(PROFILE_FILE, 'utf-8')) || {};
}

function priority(row) {
  let value = row.score || 0;
  if (!row.contact) value += 0.8;
  if (!row.email) value += 0.8;
  if (row.status === 'identifie') value += 0.5;
  return value;
}

function pickRows(rows) {
  const profile = loadProfile();
  let filtered = rows
    .filter((row) => row.company)
    .filter((row) => !['concurrent', 'recruteur'].includes(inferClassification(row, profile)))
    .filter((row) => !row.contact || !row.email);
  if (COMPANY_FILTER) {
    filtered = filtered.filter((row) => row.company.toLowerCase().includes(COMPANY_FILTER.toLowerCase()));
  }
  return filtered.sort((a, b) => priority(b) - priority(a)).slice(0, TOP);
}

function inferContactName(title) {
  const first = title.split(' - ')[0].trim();
  if (!first || first.split(' ').length < 2) return '';
  return first;
}

async function findOfficialDomain(company) {
  const results = await searchRss(`"${company}" site officiel suisse`);
  for (const result of results) {
    const domain = extractDomain(result.link);
    if (domain) return domain;
  }
  return '';
}

async function findDecisionMaker(company) {
  const query = `site:linkedin.com/in "${company}" ("Head of Manufacturing" OR "Director Manufacturing" OR "Plant Manager" OR "Head of Engineering" OR "Site Head" OR "Directeur de production")`;
  const results = await searchRss(query);
  for (const result of results) {
    if (!result.link.includes('linkedin.com')) continue;
    const name = inferContactName(result.title);
    if (!name) continue;
    return { name, linkedin: result.link, title: result.title };
  }
  return null;
}

async function findEmail(apiKey, domain, contactName) {
  if (!apiKey || !domain) return null;
  if (contactName) {
    const parts = contactName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    const result = await hunterEmailFinder(apiKey, domain, firstName, lastName);
    if (result?.email) return { email: result.email, confidence: result.score || 0 };
  }

  const domainResult = await hunterDomainSearch(apiKey, domain);
  const best = domainResult?.emails?.[0];
  if (best?.value) {
    const name = `${best.first_name || ''} ${best.last_name || ''}`.trim();
    return { email: best.value, contact: name, confidence: best.confidence || 0 };
  }
  return null;
}

async function main() {
  const hunterKey = loadHunterKey();
  const { header, rows } = loadRows();
  const picked = pickRows(rows);

  console.log(`Prospects a enrichir: ${picked.length}`);
  for (const row of picked) {
    console.log(`\n${row.company}`);

    if (!row.notes.includes('domain:')) {
      const domain = await findOfficialDomain(row.company);
      if (domain) {
        row.notes = appendNote(row.notes, `domain:${domain}`);
        console.log(`  domain: ${domain}`);
      }
    }

    if (!row.contact) {
      const decisionMaker = await findDecisionMaker(row.company);
      if (decisionMaker) {
        row.contact = decisionMaker.name;
        row.linkedin = row.linkedin || decisionMaker.linkedin;
        row.notes = appendNote(row.notes, `decision:${decisionMaker.title}`);
        console.log(`  contact: ${row.contact}`);
      }
    }

    const domain = (row.notes.match(/domain:([^\s|]+)/) || [])[1] || '';
    if (!row.email && domain) {
      const emailData = await findEmail(hunterKey, domain, row.contact);
      if (emailData?.email) {
        row.email = emailData.email;
        if (!row.contact && emailData.contact) row.contact = emailData.contact;
        row.notes = appendNote(row.notes, `hunter:${emailData.confidence}`);
        console.log(`  email: ${row.email}`);
      }
    }
  }

  if (!DRY_RUN) {
    saveRows(header, rows);
    console.log(`\nCRM mis a jour: ${PROSPECTION_FILE}`);
  }
}

await main();
