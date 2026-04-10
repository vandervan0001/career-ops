#!/usr/bin/env node
/**
 * enrich-context.mjs,Pre-enrich prospects with personalized context
 *
 * Visits each prospect's website, extracts what they do, and generates
 * a personalized opening line for cold emails using Claude-style rules.
 *
 * Usage:
 *   node enrich-context.mjs --segment fiduciaire [--limit 20]   # Enrich fiduciaires
 *   node enrich-context.mjs --all [--limit 50]                   # Enrich all segments
 *   node enrich-context.mjs --preview 42                         # Preview context for prospect #42
 *   node enrich-context.mjs --stats                               # Show enrichment stats
 *
 * Writing rules (from modes/contact.md + modes/_shared.md):
 *   - Accroche specifique a l'entreprise, PAS generique
 *   - Ton de pair, pas de vendeur
 *   - Pas de "je serais ravi" / "je me permets de"
 *   - Pas de "passionne par" / "synergie" / "robuste" / "innovant"
 *   - Concret : nommer ce que fait l'entreprise
 *   - Vouvoiement par defaut
 *   - Francais, phrases courtes
 *
 * Writes context to the Notes column of data/prospects.tsv
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROSPECTS_FILE = join(ROOT, 'data', 'prospects.tsv');

// --- Prospect loading ---
function loadProspects() {
  if (!existsSync(PROSPECTS_FILE)) return [];
  const raw = readFileSync(PROSPECTS_FILE, 'utf-8');
  return raw.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(line => {
    const cols = line.split('\t');
    return {
      id: cols[0], date: cols[1], entreprise: cols[2], contact: cols[3],
      email: cols[4], segment: cols[5], ville: cols[6], pays: cols[7],
      statut: cols[8], campagne: cols[9], dernier_envoi: cols[10], notes: cols[11] || '',
    };
  });
}

function saveProspects(prospects) {
  const header = [
    '# Scaliab,Prospect CRM',
    '# Format: TSV,one prospect per line',
    '#\tDate\tEntreprise\tContact\tEmail\tSegment\tVille\tPays\tStatut\tCampagne\tDernier_envoi\tNotes',
  ].join('\n');
  const lines = prospects.map(p =>
    [p.id, p.date, p.entreprise, p.contact, p.email, p.segment, p.ville, p.pays, p.statut, p.campagne, p.dernier_envoi, p.notes].join('\t')
  );
  writeFileSync(PROSPECTS_FILE, header + '\n' + lines.join('\n') + '\n');
}

// --- Website fetching ---
async function fetchWebsite(domain) {
  if (!domain) return null;
  const url = domain.startsWith('http') ? domain : `https://${domain}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Scaliab/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    // Strip HTML, keep text, limit to 2000 chars
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);
    return text;
  } catch (e) {
    return null;
  }
}

// --- Context generation ---
// This generates a personalized opening line based on what the company does.
// Rules: specific, concrete, tone of a peer, no cliches, French, vouvoiement.

const SEGMENT_CONTEXT_TEMPLATES = {
  fiduciaire: (entreprise, siteText, ville) => {
    // Try to detect specialties from site text
    const specialties = [];
    if (siteText) {
      if (/revision|audit/i.test(siteText)) specialties.push('revision');
      if (/fiscal|impot|tax/i.test(siteText)) specialties.push('fiscalite');
      if (/comptab|bouclement/i.test(siteText)) specialties.push('comptabilite');
      if (/conseil|gestion|patrimoine/i.test(siteText)) specialties.push('conseil');
      if (/PME|TPE|independant/i.test(siteText)) specialties.push('clientele PME');
      if (/immobili/i.test(siteText)) specialties.push('immobilier');
      if (/succession|heritage/i.test(siteText)) specialties.push('successions');
      if (/international|cross-border/i.test(siteText)) specialties.push('international');
      if (/payroll|salaire/i.test(siteText)) specialties.push('gestion salariale');
      if (/creation|startup/i.test(siteText)) specialties.push('creation d\'entreprise');
    }

    if (specialties.length >= 2) {
      return `En consultant le site de ${entreprise}, j'ai noté que vous intervenez en ${specialties[0]} et ${specialties[1]}. Deux domaines où la rédaction de rapports et l'analyse documentaire prennent un temps considérable.`;
    }
    if (specialties.length === 1) {
      return `${entreprise} intervient notamment en ${specialties[0]}. Un domaine où l'IA peut réduire de moitié le temps passé sur les rapports et la documentation client.`;
    }
    if (ville) {
      return `En tant que fiduciaire basée à ${ville}, vous gérez probablement des dizaines de dossiers en parallèle (déclarations, bouclements, correspondance). C'est exactement le type de charge que l'IA absorbe bien.`;
    }
    return `Les fiduciaires qu'on accompagne nous disent toutes la même chose : trop de temps sur la rédaction, pas assez sur le conseil. C'est là que l'IA change la donne.`;
  },

  family_office: (entreprise, siteText, ville) => {
    const specialties = [];
    if (siteText) {
      if (/wealth|patrimoine|fortune/i.test(siteText)) specialties.push('gestion de patrimoine');
      if (/family|famille/i.test(siteText)) specialties.push('accompagnement familial');
      if (/immobili/i.test(siteText)) specialties.push('investissement immobilier');
      if (/private equity|PE|venture/i.test(siteText)) specialties.push('private equity');
      if (/philanthrop/i.test(siteText)) specialties.push('philanthropie');
      if (/art|collection/i.test(siteText)) specialties.push('gestion de collections');
      if (/succession|generation/i.test(siteText)) specialties.push('transmission intergenerationnelle');
      if (/compliance|conformite|LSFin/i.test(siteText)) specialties.push('conformite reglementaire');
    }

    if (specialties.length >= 2) {
      return `${entreprise} couvre ${specialties[0]} et ${specialties[1]}. Des activités où l'analyse documentaire et le reporting représentent une charge considérable.`;
    }
    if (specialties.length === 1) {
      return `En voyant que ${entreprise} est active en ${specialties[0]}, je me suis dit que la due diligence et le reporting doivent occuper une part significative de votre temps.`;
    }
    return `Dans la gestion de patrimoine, la due diligence et le reporting trimestriel sont chronophages. C'est précisément le type de tâche où l'IA fait gagner des jours entiers.`;
  },

  admin: (entreprise, siteText, ville) => {
    const isCommune = /commune|ville|mairie/i.test(entreprise);
    const isCanton = /canton|etat|republique/i.test(entreprise);
    const isService = /SIG|SIL|TPG|TL|HUG|CHUV|EPFL|universite/i.test(entreprise);

    if (isCommune && ville) {
      return `La commune de ${ville} traite probablement des centaines de demandes citoyens par mois (permis, autorisations, questions administratives). L'IA peut pré-rédiger les réponses aux cas récurrents et libérer du temps pour les dossiers complexes.`;
    }
    if (isCanton) {
      return `Les services cantonaux gèrent un volume important de documents réglementaires et de correspondance. L'IA permet de retrouver l'information pertinente en secondes dans des textes de loi et de générer des projets de réponse.`;
    }
    if (isService) {
      return `${entreprise} gère un volume considérable de documentation et de correspondance. L'IA peut accélérer la recherche d'information et la rédaction, sans compromettre la confidentialité.`;
    }
    if (ville) {
      return `À ${ville}, les équipes administratives jonglent entre traitement de dossiers, séances de conseil et communication aux citoyens. L'IA peut prendre en charge la partie rédactionnelle répétitive.`;
    }
    return `Les collectivités qu'on accompagne gagnent en moyenne 2h par jour sur le traitement des demandes courantes grâce à l'IA. Le reste du temps est libéré pour les dossiers qui demandent du jugement humain.`;
  },

  pme: (entreprise, siteText, ville) => {
    const sectors = [];
    if (siteText) {
      if (/avocat|juridique|droit/i.test(siteText)) sectors.push('juridique');
      if (/immobili|regie/i.test(siteText)) sectors.push('immobilier');
      if (/architect|ingenieur|bureau d/i.test(siteText)) sectors.push('ingenierie');
      if (/communi|market|digital|agence/i.test(siteText)) sectors.push('communication');
      if (/assurance|courtier|prevoyance/i.test(siteText)) sectors.push('assurance');
      if (/conseil|consult/i.test(siteText)) sectors.push('conseil');
      if (/medic|clinique|sante|cabinet/i.test(siteText)) sectors.push('sante');
      if (/forma|ecole|academy/i.test(siteText)) sectors.push('formation');
      if (/recruit|placement|RH|talent/i.test(siteText)) sectors.push('recrutement');
      if (/IT|logiciel|software|dev/i.test(siteText)) sectors.push('IT');
    }

    if (sectors.length > 0) {
      const sector = sectors[0];
      const sectorHooks = {
        'juridique': `Un cabinet comme ${entreprise} passe probablement beaucoup de temps sur la recherche jurisprudentielle et la rédaction d'actes. L'IA accélère les deux sans compromettre la précision.`,
        'immobilier': `Dans l'immobilier, la rédaction de descriptifs, la correspondance locataire et l'analyse de baux représentent un volume considérable. L'IA absorbe cette charge efficacement.`,
        'ingenierie': `Les bureaux d'ingénierie comme ${entreprise} produisent beaucoup de documentation technique et de rapports. L'IA peut en rédiger les premières versions en quelques minutes.`,
        'communication': `${entreprise} produit du contenu en volume (briefs, copy, rapports de campagne). L'IA est un accélérateur rédactionnel qui libère du temps pour la stratégie.`,
        'assurance': `En courtage, l'analyse de polices et la correspondance client sont chronophages. L'IA traite les comparatifs et rédige les courriers standards en quelques secondes.`,
        'conseil': `Un cabinet de conseil comme ${entreprise} rédige des rapports, des analyses et des présentations en continu. L'IA divise le temps de première rédaction par 3 ou 4.`,
        'sante': `Dans le médical, la documentation patient et la correspondance administrative prennent un temps précieux. L'IA aide à pré-rédiger et structurer, en respectant la confidentialité.`,
        'formation': `Les organismes de formation comme ${entreprise} créent du contenu pédagogique en volume (supports, évaluations, programmes). L'IA accélère cette production considérablement.`,
        'recrutement': `En recrutement, le screening de CV, la rédaction d'annonces et la correspondance candidat sont des tâches répétitives. L'IA les traite en quelques secondes.`,
        'IT': `Même les équipes IT comme ${entreprise} perdent du temps sur la documentation, les specs et le support. L'IA est un outil de productivité naturel pour les profils techniques.`,
      };
      return sectorHooks[sector] || `${entreprise} pourrait gagner 5 à 10h par semaine en automatisant les tâches rédactionnelles et administratives avec l'IA.`;
    }

    if (ville) {
      return `En tant que PME basée à ${ville}, vous n'avez probablement pas de département IA, et c'est normal. Notre rôle est justement d'intégrer Claude dans vos outils existants pour que votre équipe gagne du temps dès la première semaine.`;
    }
    return `La plupart des PME testent l'IA 5 minutes puis abandonnent. Pas parce que c'est inutile, mais parce que personne ne l'a configuré pour leur métier. C'est exactement ce qu'on fait.`;
  },
};

// --- Main enrichment ---
async function enrichContext({ segment, limit, all }) {
  const prospects = loadProspects();
  let toEnrich = prospects.filter(p =>
    !p.notes.includes('ctx:') && // Not yet enriched
    p.statut === 'nouveau'
  );

  if (!all && segment) {
    toEnrich = toEnrich.filter(p => p.segment === segment);
  }

  if (limit) toEnrich = toEnrich.slice(0, limit);

  console.log(`\n=== Enrichissement contextuel ===`);
  console.log(`Prospects a enrichir: ${toEnrich.length}`);
  console.log(``);

  let enriched = 0;
  let fetched = 0;

  for (const p of toEnrich) {
    const domain = p.notes.match(/domain:([^\s,]+)/)?.[1];
    let siteText = null;

    if (domain) {
      process.stdout.write(`[${enriched + 1}/${toEnrich.length}] ${p.entreprise} (${domain})...`);
      siteText = await fetchWebsite(domain);
      if (siteText) fetched++;
    } else {
      process.stdout.write(`[${enriched + 1}/${toEnrich.length}] ${p.entreprise} (pas de domain)...`);
    }

    // Generate context
    const generator = SEGMENT_CONTEXT_TEMPLATES[p.segment];
    if (generator) {
      const context = generator(p.entreprise, siteText, p.ville);
      // Store in notes (pipe-delimited to avoid TSV issues)
      p.notes = p.notes ? `${p.notes} | ctx:${context}` : `ctx:${context}`;
      enriched++;
      console.log(` OK`);
    } else {
      console.log(` SKIP (segment inconnu: ${p.segment})`);
    }

    // Small delay to be polite to servers
    if (domain) await sleep(300);
  }

  saveProspects(prospects);
  console.log(`\nTermine: ${enriched} enrichis, ${fetched} sites web lus.`);
}

// --- Preview ---
function previewContext(prospectId) {
  const prospects = loadProspects();
  const p = prospects.find(pr => pr.id === prospectId);
  if (!p) {
    console.error(`Prospect #${prospectId} introuvable.`);
    process.exit(1);
  }

  const ctxMatch = p.notes.match(/ctx:(.+?)(?:\||$)/);
  if (ctxMatch) {
    console.log(`\n=== Prospect #${p.id}: ${p.entreprise} ===`);
    console.log(`Segment: ${p.segment} | Ville: ${p.ville} | Pays: ${p.pays}`);
    console.log(`Email: ${p.email || '(aucun)'}`);
    console.log(`\nContexte personnalise:`);
    console.log(`"${ctxMatch[1].trim()}"`);
  } else {
    console.log(`Prospect #${p.id} (${p.entreprise}) n'a pas encore de contexte.`);
    console.log(`Lancez: node enrich-context.mjs --segment ${p.segment}`);
  }
}

// --- Stats ---
function showStats() {
  const prospects = loadProspects();
  const total = prospects.length;
  const withCtx = prospects.filter(p => p.notes.includes('ctx:')).length;
  const bySegment = {};

  for (const p of prospects) {
    if (!bySegment[p.segment]) bySegment[p.segment] = { total: 0, enriched: 0 };
    bySegment[p.segment].total++;
    if (p.notes.includes('ctx:')) bySegment[p.segment].enriched++;
  }

  console.log(`\n=== Enrichissement contextuel,Stats ===`);
  console.log(`Total: ${withCtx}/${total} enrichis (${total ? Math.round(withCtx / total * 100) : 0}%)\n`);

  for (const [seg, s] of Object.entries(bySegment).sort((a, b) => b[1].total - a[1].total)) {
    const pct = s.total ? Math.round(s.enriched / s.total * 100) : 0;
    console.log(`  ${seg}: ${s.enriched}/${s.total} (${pct}%)`);
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
} else if (args.includes('--preview')) {
  const id = getArg('--preview');
  if (!id) { console.error('Usage: node enrich-context.mjs --preview 42'); process.exit(1); }
  previewContext(id);
} else {
  const segment = getArg('--segment');
  const limit = getArg('--limit') ? parseInt(getArg('--limit')) : null;
  const all = args.includes('--all');

  if (!segment && !all) {
    console.log('Scaliab Context Enricher,Usage:');
    console.log('  node enrich-context.mjs --segment fiduciaire [--limit 20]');
    console.log('  node enrich-context.mjs --all [--limit 50]');
    console.log('  node enrich-context.mjs --preview 42');
    console.log('  node enrich-context.mjs --stats');
    console.log('');
    console.log('Visite le site web de chaque prospect et genere une accroche');
    console.log('personnalisee pour le cold email (stockee dans la colonne Notes).');
    process.exit(0);
  }

  await enrichContext({ segment, limit, all });
}
