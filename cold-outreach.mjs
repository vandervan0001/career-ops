#!/usr/bin/env node
/**
 * cold-outreach.mjs :Send personalized cold emails with rate limiting
 *
 * Usage:
 *   node cold-outreach.mjs --campaign fidu-ch-01 --segment fiduciaire --limit 20 --dry-run
 *   node cold-outreach.mjs --campaign fidu-ch-01 --segment fiduciaire --limit 20
 *   node cold-outreach.mjs --campaign fidu-ch-01 --relance 1              # Send follow-up #1
 *   node cold-outreach.mjs --preview --segment fiduciaire                 # Preview template
 *   node cold-outreach.mjs --stats                                         # Campaign stats
 *
 * Features:
 *   - Rate limiting (configurable delay between sends)
 *   - Auto-skip bounces and unsubscribes
 *   - Template personalization ({{PRENOM}}, {{ENTREPRISE}}, etc.)
 *   - Dry-run mode to preview without sending
 *   - Campaign tracking in data/prospects.tsv
 *
 * Reads config from config/smtp.yml
 * Reads/writes data/prospects.tsv
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createTransport } from 'nodemailer';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SMTP_FILE = join(ROOT, 'config', 'smtp.yml');
const PROSPECTS_FILE = join(ROOT, 'data', 'prospects.tsv');
const TEMPLATES_DIR = join(ROOT, 'templates', 'cold-emails');

// --- Rate limiting config ---
const DELAY_BETWEEN_EMAILS_MS = 180_000; // 3 minutes between emails
const MAX_PER_HOUR = 20;
const MAX_PER_DAY = 50; // Start conservative, increase after warmup

// --- Subject lines per segment ---
const SUBJECTS = {
  fiduciaire: {
    initial: 'Claude IA pour les fiduciaires (diagnostic gratuit)',
    relance1: 'Suite à mon email, 20 min pour évaluer le potentiel IA chez {{ENTREPRISE}}',
    relance2: 'Dernier message. L\'IA dans les fiduciaires en 2026',
  },
  family_office: {
    initial: 'IA et gestion de patrimoine, diagnostic gratuit pour {{ENTREPRISE}}',
    relance1: 'Suite à mon email, due diligence et reporting assistés par IA',
    relance2: 'Dernier message. Claude pour les family offices',
  },
  admin: {
    initial: 'L\'IA au service des collectivités (diagnostic gratuit)',
    relance1: 'Suite à mon email, simplifier le traitement des demandes citoyens',
    relance2: 'Dernier message. IA pour les administrations publiques',
  },
  pme: {
    initial: 'Votre équipe pourrait gagner 10h/semaine (diagnostic IA gratuit)',
    relance1: 'Suite à mon email, 20 minutes pour évaluer le potentiel IA de {{ENTREPRISE}}',
    relance2: 'Dernier message. L\'IA en PME, concrètement',
  },
};

// --- SMTP ---
function loadSmtpConfig() {
  if (!existsSync(SMTP_FILE)) {
    console.error('ERREUR: config/smtp.yml introuvable.');
    process.exit(1);
  }
  const config = yaml.load(readFileSync(SMTP_FILE, 'utf-8'));
  // Cold outreach uses Scaliab SMTP, fallback to default
  const smtp = config.scaliab || config.smtp;
  if (smtp.auth.pass === 'REMPLIR_ICI') {
    console.error('ERREUR: Mot de passe Scaliab non configure dans config/smtp.yml');
    console.error('Editez la section "scaliab:" et remplacez REMPLIR_ICI par votre mot de passe LWS.');
    process.exit(1);
  }
  return smtp;
}

function createMailTransport(smtp) {
  return createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.auth.user, pass: smtp.auth.pass },
  });
}

// --- Prospects TSV ---
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
    '# Scaliab :Prospect CRM',
    '# Format: TSV :one prospect per line',
    '#\tDate\tEntreprise\tContact\tEmail\tSegment\tVille\tPays\tStatut\tCampagne\tDernier_envoi\tNotes',
  ].join('\n');
  const lines = prospects.map(p =>
    [p.id, p.date, p.entreprise, p.contact, p.email, p.segment, p.ville, p.pays, p.statut, p.campagne, p.dernier_envoi, p.notes].join('\t')
  );
  writeFileSync(PROSPECTS_FILE, header + '\n' + lines.join('\n') + '\n');
}

// --- Template rendering ---
function loadTemplate(segment) {
  const templateMap = {
    fiduciaire: 'fiduciaire.html',
    family_office: 'family-office.html',
    admin: 'administration.html',
    pme: 'pme.html',
  };
  const file = join(TEMPLATES_DIR, templateMap[segment]);
  if (!existsSync(file)) {
    console.error(`Template introuvable: ${file}`);
    process.exit(1);
  }
  return readFileSync(file, 'utf-8');
}

function renderTemplate(template, prospect) {
  const prenom = prospect.contact?.split(' ')[0] || 'Madame, Monsieur';
  // Extract personalized context from notes (set by enrich-context.mjs)
  const ctxMatch = prospect.notes?.match(/ctx:(.+?)(?:\||$)/);
  const context = ctxMatch ? ctxMatch[1].trim() : getFallbackContext(prospect);
  return template
    .replace(/\{\{PRENOM\}\}/g, prenom)
    .replace(/\{\{ENTREPRISE\}\}/g, prospect.entreprise || '')
    .replace(/\{\{VILLE\}\}/g, prospect.ville || '')
    .replace(/\{\{SEGMENT\}\}/g, prospect.segment || '')
    .replace(/\{\{CONTEXT\}\}/g, context);
}

function getFallbackContext(prospect) {
  const fallbacks = {
    fiduciaire: `Les fiduciaires qu'on accompagne nous disent toutes la même chose : trop de temps sur la rédaction, pas assez sur le conseil. C'est là que l'IA change la donne.`,
    family_office: `Dans la gestion de patrimoine, la due diligence et le reporting trimestriel sont chronophages. C'est précisément le type de tâche où l'IA fait gagner des jours entiers.`,
    admin: `Les collectivités qu'on accompagne gagnent en moyenne 2h par jour sur le traitement des demandes courantes grâce à l'IA.`,
    pme: `La plupart des PME testent l'IA 5 minutes puis abandonnent. Pas parce que c'est inutile, mais parce que personne ne l'a configuré pour leur métier. C'est exactement ce qu'on fait.`,
  };
  return fallbacks[prospect.segment] || fallbacks.pme;
}

function renderSubject(subjectTemplate, prospect) {
  return subjectTemplate
    .replace(/\{\{ENTREPRISE\}\}/g, prospect.entreprise || '')
    .replace(/\{\{PRENOM\}\}/g, prospect.contact?.split(' ')[0] || '');
}

// --- Follow-up templates ---
function getRelanceTemplate(_segment, relanceNum) {
  if (relanceNum === 1) {
    return `<p>Bonjour {{PRENOM}},</p>
<p>Je reviens vers vous suite à mon précédent message concernant l'intégration de l'IA chez {{ENTREPRISE}}.</p>
<p>Beaucoup de dirigeants me disent qu'ils n'ont tout simplement pas le temps d'explorer le sujet. C'est justement pour ça que le diagnostic est gratuit et ne prend que 20 minutes : on vous dit concrètement ce que l'IA peut (ou ne peut pas) faire pour vous.</p>
<p><a href="https://www.cal.eu/scaliab/diagnostic-claude?overlayCalendar=true" style="color: #fff; background: linear-gradient(135deg, #1a1a2e, #2d4a7a); padding: 12px 28px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600;">Réserver mon créneau &rarr;</a></p>
<p>Bonne journée,<br><strong>Tai Van</strong>, Scaliab</p>
<hr style="border:none;border-top:1px solid #eee;margin-top:30px">
<p style="font-size:11px;color:#999;">Si vous ne souhaitez plus recevoir de messages, <a href="mailto:info@scaliab.io?subject=Desabonnement" style="color:#999;">répondez "stop"</a>.</p>`;
  }
  if (relanceNum === 2) {
    return `<p>Bonjour {{PRENOM}},</p>
<p>Dernier message de ma part, je ne veux pas être insistant.</p>
<p>Si l'IA n'est pas une priorité pour {{ENTREPRISE}} en ce moment, c'est tout à fait normal. Mais si le sujet revient dans 3 ou 6 mois, on sera là.</p>
<p>En attendant, n'hésitez pas à consulter nos résultats concrets : <a href="https://www.scaliab.io" style="color: #3a5ba0;">scaliab.io</a></p>
<p>Bonne continuation,<br><strong>Tai Van</strong>, Scaliab</p>
<hr style="border:none;border-top:1px solid #eee;margin-top:30px">
<p style="font-size:11px;color:#999;">Dernier message, vous ne recevrez plus d'emails de notre part.</p>`;
  }
  return null;
}

// --- Core send logic ---
async function sendCampaign({ campaignId, segment, limit, dryRun, relance }) {
  const smtp = loadSmtpConfig();
  const prospects = loadProspects();
  const today = new Date().toISOString().slice(0, 10);

  // Filter eligible prospects
  const skipStatuses = ['desabonne', 'bounce', 'invalide', 'converti', 'rdv_pris', 'pas_interesse'];
  let eligible;

  if (relance === 1) {
    // Relance 1: contacted 3+ days ago, not yet followed up
    eligible = prospects.filter(p =>
      p.segment === segment &&
      p.statut === 'contacte' &&
      p.email &&
      !skipStatuses.includes(p.statut) &&
      daysSince(p.dernier_envoi) >= 3
    );
  } else if (relance === 2) {
    eligible = prospects.filter(p =>
      p.segment === segment &&
      p.statut === 'relance1' &&
      p.email &&
      !skipStatuses.includes(p.statut) &&
      daysSince(p.dernier_envoi) >= 4
    );
  } else {
    // Initial send: nouveau prospects with email
    eligible = prospects.filter(p =>
      p.segment === segment &&
      p.statut === 'nouveau' &&
      p.email &&
      !skipStatuses.includes(p.statut)
    );
  }

  const batch = eligible.slice(0, limit || MAX_PER_DAY);

  console.log(`\n=== Campagne: ${campaignId} ===`);
  console.log(`Segment: ${segment}`);
  console.log(`Type: ${relance ? `relance ${relance}` : 'initial'}`);
  console.log(`Eligibles: ${eligible.length}`);
  console.log(`Batch: ${batch.length} (limit: ${limit || MAX_PER_DAY})`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'ENVOI REEL'}`);
  console.log('');

  if (batch.length === 0) {
    console.log('Aucun prospect eligible. Verifiez le segment et les statuts.');
    return;
  }

  // Load template
  let template;
  let subjectKey;
  if (relance) {
    template = getRelanceTemplate(segment, relance);
    subjectKey = `relance${relance}`;
  } else {
    template = loadTemplate(segment);
    subjectKey = 'initial';
  }

  const subjectTemplate = SUBJECTS[segment]?.[subjectKey] || `Scaliab :Diagnostic IA gratuit pour {{ENTREPRISE}}`;

  let transporter;
  if (!dryRun) {
    transporter = createMailTransport(smtp);
  }

  let sent = 0;
  let errors = 0;

  for (const prospect of batch) {
    const html = renderTemplate(template, prospect);
    const subject = renderSubject(subjectTemplate, prospect);

    console.log(`[${sent + 1}/${batch.length}] ${prospect.email} :${prospect.entreprise}`);
    console.log(`  Sujet: ${subject}`);

    if (dryRun) {
      console.log(`  -> DRY RUN (pas d'envoi)`);
    } else {
      try {
        const info = await transporter.sendMail({
          from: `"Tai Van :Scaliab" <${smtp.from.address}>`,
          to: prospect.email,
          subject,
          html,
          text: html.replace(/<[^>]+>/g, ''), // Plaintext fallback
        });

        console.log(`  -> Envoye (${info.messageId})`);

        // Update prospect
        prospect.campagne = campaignId;
        prospect.dernier_envoi = today;
        if (relance === 1) prospect.statut = 'relance1';
        else if (relance === 2) prospect.statut = 'relance2';
        else prospect.statut = 'contacte';

        sent++;
      } catch (err) {
        console.error(`  -> ERREUR: ${err.message}`);
        if (err.responseCode >= 500) {
          prospect.statut = 'bounce';
          prospect.notes += ` bounce:${today}`;
        }
        errors++;
      }

      // Save after each send (crash-safe)
      saveProspects(prospects);

      // Rate limiting
      if (sent < batch.length) {
        const delayMin = DELAY_BETWEEN_EMAILS_MS / 60000;
        console.log(`  Attente ${delayMin} min avant prochain envoi...`);
        await sleep(DELAY_BETWEEN_EMAILS_MS);
      }
    }
  }

  if (!dryRun) {
    saveProspects(prospects);
  }

  console.log(`\n=== Resultat ===`);
  console.log(`Envoyes: ${sent}`);
  console.log(`Erreurs: ${errors}`);
  console.log(`Restants: ${eligible.length - batch.length}`);
}

// --- Preview ---
function previewTemplate(segment) {
  const template = loadTemplate(segment);
  const mockProspect = {
    contact: 'Marie Dupont',
    entreprise: 'Fiduciaire Exemple SA',
    ville: 'Lausanne',
    segment,
  };
  const html = renderTemplate(template, mockProspect);
  const subject = renderSubject(
    SUBJECTS[segment]?.initial || 'Diagnostic IA gratuit',
    mockProspect
  );

  console.log(`\n=== Preview: ${segment} ===`);
  console.log(`Sujet: ${subject}\n`);
  console.log(html.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n'));
}

// --- Stats ---
function showStats() {
  const prospects = loadProspects();
  const campaigns = {};

  for (const p of prospects) {
    if (!p.campagne) continue;
    if (!campaigns[p.campagne]) {
      campaigns[p.campagne] = { total: 0, contacte: 0, relance1: 0, relance2: 0, repondu: 0, rdv: 0, bounce: 0, desabo: 0 };
    }
    campaigns[p.campagne].total++;
    if (['contacte', 'relance1', 'relance2'].includes(p.statut)) campaigns[p.campagne][p.statut]++;
    if (p.statut === 'repondu') campaigns[p.campagne].repondu++;
    if (p.statut === 'rdv_pris') campaigns[p.campagne].rdv++;
    if (p.statut === 'bounce') campaigns[p.campagne].bounce++;
    if (p.statut === 'desabonne') campaigns[p.campagne].desabo++;
  }

  console.log(`\n=== Stats Campagnes ===`);
  for (const [id, stats] of Object.entries(campaigns)) {
    console.log(`\n${id}:`);
    console.log(`  Envoyes: ${stats.total}`);
    console.log(`  Contactes: ${stats.contacte} | Relance1: ${stats.relance1} | Relance2: ${stats.relance2}`);
    console.log(`  Repondu: ${stats.repondu} | RDV pris: ${stats.rdv}`);
    console.log(`  Bounces: ${stats.bounce} | Desabo: ${stats.desabo}`);
    const replyRate = stats.total > 0 ? ((stats.repondu + stats.rdv) / stats.total * 100).toFixed(1) : 0;
    console.log(`  Taux reponse: ${replyRate}%`);
  }
}

// --- Helpers ---
function daysSince(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / 86400000);
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
  const segment = getArg('--segment') || getArg('--preview');
  if (!segment || !SUBJECTS[segment]) {
    console.error('Segments valides: fiduciaire, family_office, admin, pme');
    process.exit(1);
  }
  previewTemplate(segment);
} else {
  const campaignId = getArg('--campaign');
  const segment = getArg('--segment');
  const limit = parseInt(getArg('--limit') || MAX_PER_DAY);
  const dryRun = args.includes('--dry-run');
  const relance = getArg('--relance') ? parseInt(getArg('--relance')) : 0;

  if (!campaignId || !segment) {
    console.log('Scaliab Cold Outreach :Usage:');
    console.log('  node cold-outreach.mjs --campaign ID --segment SEG [--limit N] [--dry-run]');
    console.log('  node cold-outreach.mjs --campaign ID --segment SEG --relance 1');
    console.log('  node cold-outreach.mjs --preview --segment SEG');
    console.log('  node cold-outreach.mjs --stats');
    console.log('');
    console.log('Segments: fiduciaire, family_office, admin, pme');
    console.log('');
    console.log(`Rate limits: ${MAX_PER_DAY}/jour, ${MAX_PER_HOUR}/heure, ${DELAY_BETWEEN_EMAILS_MS / 1000}s entre chaque`);
    process.exit(0);
  }

  if (!SUBJECTS[segment]) {
    console.error(`Segment inconnu: ${segment}. Valides: fiduciaire, family_office, admin, pme`);
    process.exit(1);
  }

  await sendCampaign({ campaignId, segment, limit, dryRun, relance });
}
