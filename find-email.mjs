#!/usr/bin/env node
/**
 * find-email.mjs — Find professional emails via Hunter.io API
 *
 * Usage:
 *   node find-email.mjs --domain firmenich.com                     # List all emails for domain
 *   node find-email.mjs --domain firmenich.com --name "Jean Dupont" # Find specific person
 *   node find-email.mjs --domain firmenich.com --role "engineering"  # Filter by department
 *
 * Reads API key from config/hunter.yml
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HUNTER_FILE = join(ROOT, 'config', 'hunter.yml');

function loadApiKey() {
  if (!existsSync(HUNTER_FILE)) {
    console.error('ERREUR: config/hunter.yml introuvable.');
    console.error('1. Creez un compte sur https://hunter.io/users/sign_up');
    console.error('2. Copiez votre cle API depuis https://hunter.io/api-keys');
    console.error('3. cp config/hunter.example.yml config/hunter.yml');
    console.error('4. Collez votre cle dans config/hunter.yml');
    process.exit(1);
  }
  const config = yaml.load(readFileSync(HUNTER_FILE, 'utf-8'));
  return config.hunter.api_key;
}

async function domainSearch(apiKey, domain, options = {}) {
  const params = new URLSearchParams({
    domain,
    api_key: apiKey,
    limit: options.limit || 10,
  });
  if (options.department) params.set('department', options.department);
  if (options.type) params.set('type', options.type);

  const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
  const data = await res.json();

  if (data.errors) {
    console.error(`Hunter API error: ${JSON.stringify(data.errors)}`);
    return null;
  }
  return data.data;
}

async function emailFinder(apiKey, domain, firstName, lastName) {
  const params = new URLSearchParams({
    domain,
    first_name: firstName,
    last_name: lastName,
    api_key: apiKey,
  });

  const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);
  const data = await res.json();

  if (data.errors) {
    console.error(`Hunter API error: ${JSON.stringify(data.errors)}`);
    return null;
  }
  return data.data;
}

async function emailVerifier(apiKey, email) {
  const params = new URLSearchParams({
    email,
    api_key: apiKey,
  });

  const res = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`);
  const data = await res.json();
  return data.data;
}

// --- CLI ---
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
};

const apiKey = loadApiKey();
const domain = getArg('--domain');
const name = getArg('--name');
const role = getArg('--role');
const verify = getArg('--verify');

if (verify) {
  // Verify a specific email
  const result = await emailVerifier(apiKey, verify);
  if (result) {
    console.log(`Email: ${result.email}`);
    console.log(`Status: ${result.status}`);
    console.log(`Score: ${result.score}`);
    console.log(`Deliverable: ${result.result === 'deliverable' ? 'OUI' : 'NON'}`);
  }
} else if (domain && name) {
  // Find specific person's email
  const parts = name.split(' ');
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');

  console.log(`Recherche email: ${firstName} ${lastName} @ ${domain}...`);
  const result = await emailFinder(apiKey, domain, firstName, lastName);

  if (result && result.email) {
    console.log(`\nTrouve:`);
    console.log(`  Email: ${result.email}`);
    console.log(`  Confidence: ${result.score}%`);
    console.log(`  Position: ${result.position || 'N/A'}`);
    console.log(`  LinkedIn: ${result.linkedin || 'N/A'}`);
  } else {
    console.log(`Aucun email trouve pour ${firstName} ${lastName} @ ${domain}`);
  }
} else if (domain) {
  // Domain search
  console.log(`Recherche emails pour ${domain}...`);
  const options = {};
  if (role) {
    // Map common roles to Hunter departments
    const deptMap = {
      'engineering': 'engineering',
      'management': 'management',
      'executive': 'executive',
      'it': 'it',
      'operations': 'operations',
      'production': 'management',
    };
    options.department = deptMap[role.toLowerCase()] || role;
  }

  const result = await domainSearch(apiKey, domain, options);

  if (result) {
    console.log(`\nDomaine: ${domain}`);
    console.log(`Organisation: ${result.organization || 'N/A'}`);
    console.log(`Emails trouves: ${result.emails?.length || 0}`);
    console.log(`Pattern: ${result.pattern || 'N/A'}`);
    console.log('');

    if (result.emails && result.emails.length > 0) {
      for (const e of result.emails) {
        const dept = e.department || '';
        const pos = e.position || '';
        const conf = e.confidence || 0;
        console.log(`  ${e.value} (${conf}%) — ${pos} [${dept}]`);
        if (e.linkedin) console.log(`    LinkedIn: ${e.linkedin}`);
      }
    }

    // Output as JSON for piping
    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    }
  }
} else {
  console.log('Usage:');
  console.log('  node find-email.mjs --domain company.com                  # Tous les emails du domaine');
  console.log('  node find-email.mjs --domain company.com --name "Jean Dupont"  # Email specifique');
  console.log('  node find-email.mjs --domain company.com --role engineering    # Filtrer par departement');
  console.log('  node find-email.mjs --verify jean@company.com                  # Verifier un email');
}
