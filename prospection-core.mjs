#!/usr/bin/env node

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsKeyword(text, keyword) {
  const source = String(text || '').toLowerCase();
  const needle = String(keyword || '').toLowerCase().trim();
  if (!needle) return false;
  if (needle.length <= 3 && /^[a-z0-9]+$/i.test(needle)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, 'i').test(source);
  }
  return source.includes(needle);
}

export function containsOne(text, needles) {
  return needles.some((needle) => containsKeyword(text, needle));
}

export function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getClassification(notes) {
  const match = String(notes || '').match(/(?:^|\|)\s*class:([a-z_]+)/i);
  return match ? match[1].toLowerCase() : '';
}

export function setClassification(notes, klass) {
  const cleaned = String(notes || '')
    .replace(/(?:^|\|)\s*class:[a-z_]+/ig, '')
    .replace(/\s+\|\s+\|/g, ' | ')
    .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
    .trim();
  return cleaned ? `${cleaned} | class:${klass}` : `class:${klass}`;
}

const DEFAULT_SERVICES = [
  {
    id: 'referent_automation',
    label: 'un référent automation externalisé',
    subject: 'automation industrielle',
    pitch: 'reprendre le backlog automation, stabiliser le run et remettre de la continuité',
    trigger_signals: ['maintenance', 'support', 'backlog', 'production', 'site', 'usine', 'manufacturing', 'automation engineer'],
    preferred_sectors: ['manufacturing', 'agroalimentaire', 'horlogerie', 'pharma', 'medtech', 'chimie'],
  },
  {
    id: 'temps_partage_ot',
    label: 'un pilotage OT/automation à temps partagé',
    subject: 'appui OT / automation',
    pitch: 'absorber rapidement la charge pendant que le besoin se structure',
    trigger_signals: ['recrutement', 'hiring', 'head manufacturing', 'director manufacturing', 'site head', 'head of engineering', 'chef de projet automation'],
    preferred_sectors: ['pharma', 'medtech', 'chimie', 'manufacturing', 'agroalimentaire'],
  },
  {
    id: 'cellule_automation_ot',
    label: 'une cellule externe automation & OT',
    subject: 'support automation pour la montée en charge',
    pitch: 'sécuriser la montée en charge sans créer de dette de mise en service',
    trigger_signals: ['expansion', 'investissement', 'scale-up', 'nouvelle ligne', 'nouveau site', 'double surface', 'facility', 'capex'],
    preferred_sectors: ['pharma', 'medtech', 'agroalimentaire', 'chimie', 'manufacturing', 'horlogerie'],
  },
  {
    id: 'audit_ot_cyber',
    label: 'un diagnostic OT/cybersécurité ciblé',
    subject: 'OT / cyber industrielle',
    pitch: 'clarifier les priorités OT/cyber et sortir une feuille de route 62443 pragmatique',
    trigger_signals: ['ot', 'cyber', '62443', 'nis2', 'segmentation', 'hardening', 'incident'],
    preferred_sectors: ['énergie', 'utilities', 'pharma', 'chimie', 'manufacturing'],
  },
  {
    id: 'migration_modernisation',
    label: 'une mission de migration et modernisation PLC/SCADA',
    subject: 'migration automation',
    pitch: 'sortir des versions obsolètes sans casser le run de production',
    trigger_signals: ['migration', 'upgrade', 'modernisation', 'obsolescence', 'pcs7', 'wincc', 'tia', 'scada', 'plc'],
    preferred_sectors: ['pharma', 'chimie', 'agroalimentaire', 'manufacturing', 'énergie'],
  },
  {
    id: 'qualification_csv',
    label: 'un lot qualification / CSV ciblé',
    subject: 'qualification / CSV',
    pitch: 'fiabiliser FAT/SAT/IQ/OQ/CSV sans ralentir les projets industriels',
    trigger_signals: ['csv', 'qualification', 'gmp', 'gxp', '21 cfr', 'iq', 'oq', 'sat', 'fat'],
    preferred_sectors: ['pharma', 'medtech', 'biotech'],
  },
  {
    id: 'digitalisation_ai',
    label: 'un cadrage digitalisation / IA industrielle',
    subject: 'digitalisation industrielle',
    pitch: 'prioriser des cas d’usage data/IA/RPA qui améliorent réellement l’opérationnel',
    trigger_signals: ['digital', 'ia', 'ai', 'industry 4.0', 'reporting', 'power bi', 'rpa', 'mes', 'historian', 'data'],
    preferred_sectors: ['agroalimentaire', 'pharma', 'chimie', 'manufacturing', 'logistique'],
  },
  {
    id: 'renfort_miseenservice',
    label: 'un renfort mise en service',
    subject: 'mise en service / automatisme',
    pitch: 'intervenir rapidement sur chantier pour débloquer une mise en service ou absorber un pic de charge',
    trigger_signals: ['mise en service', 'commissioning', 'chantier', 'démarrage', 'recrutement automaticien', 'automaticien', 'automation engineer'],
    preferred_sectors: ['intégrateur', 'OEM', 'bureau d\'études', 'manufacturing'],
  },
  {
    id: 'renfort_retrofit',
    label: 'un renfort retrofit / migration',
    subject: 'migration / retrofit automation',
    pitch: 'prendre en charge une migration PLC/SCADA ou un retrofit machine sans mobiliser l\'équipe interne',
    trigger_signals: ['retrofit', 'migration', 'upgrade', 'modernisation', 'remplacement', 'obsolescence', 'simatic', 's5', 'pcs7'],
    preferred_sectors: ['intégrateur', 'industriel', 'OEM', 'manufacturing', 'agroalimentaire'],
  },
];

const RECRUITER_KEYWORDS = [
  'michael page',
  'hays',
  'randstad',
  'manpower',
  'experis',
  'gi group',
  'careerplus',
  'axepta',
  'approach people',
  'sigma',
  'albedis',
  'valjob',
  'myscience',
  'interim',
  'staffing',
  'recruitment',
  'recrutement externe',
  'cabinet de recrutement',
];

const INTEGRATOR_KEYWORDS = [
  'integrateur',
  'intégrateur',
  'bureau d\'étude',
  'bureau d’etude',
  'engineering services',
  'fournisseur systemes',
  'system integrator',
];

export function inferClassification(row, profile = {}) {
  const explicit = getClassification(row.notes);
  if (explicit) return explicit;

  const companyText = `${row.company} ${row.notes}`.toLowerCase();
  const fullText = `${row.company} ${row.signal} ${row.notes}`.toLowerCase();
  const excludedCompanies = (profile.sourcing?.excluded_companies || []).map((value) => String(value).toLowerCase());
  const excludedPatterns = (profile.sourcing?.excluded_patterns || []).map((value) => String(value).toLowerCase());

  if (containsOne(companyText, excludedCompanies)) return 'concurrent';
  if (containsOne(companyText, RECRUITER_KEYWORDS)) return 'recruteur';
  if (containsOne(fullText, INTEGRATOR_KEYWORDS)) return 'integrateur';
  if (containsOne(fullText, excludedPatterns)) return 'integrateur';
  return 'client_final';
}

function serviceCatalog(profile = {}) {
  const configured = profile.service_offering?.packaged_services;
  return Array.isArray(configured) && configured.length > 0 ? configured : DEFAULT_SERVICES;
}

function serviceScore(service, row) {
  const text = `${row.company} ${row.sector} ${row.signal} ${row.notes}`.toLowerCase();
  const sector = String(row.sector || '').toLowerCase();
  let score = 1;

  if (containsOne(text, service.trigger_signals || [])) score += 2.4;
  if (containsOne(sector, service.preferred_sectors || [])) score += 1.1;
  if (containsOne(text, ['recrutement', 'hiring']) && service.id === 'temps_partage_ot') score += 1.6;
  if (containsOne(text, ['expansion', 'investissement', 'scale-up', 'nouvelle ligne']) && service.id === 'cellule_automation_ot') score += 1.8;
  if (containsOne(text, ['ot', 'cyber', '62443', 'nis2']) && service.id === 'audit_ot_cyber') score += 1.8;
  if (containsOne(text, ['gmp', 'csv', 'qualification', 'iq', 'oq']) && service.id === 'qualification_csv') score += 1.8;
  if (containsOne(text, ['migration', 'upgrade', 'modernisation', 'pcs7', 'scada', 'plc']) && service.id === 'migration_modernisation') score += 1.8;
  if (containsOne(text, ['ia', 'ai', 'digital', 'rpa', 'data', 'mes', 'historian']) && service.id === 'digitalisation_ai') score += 1.6;
  if (containsOne(text, ['production', 'manufacturing', 'site', 'usine']) && service.id === 'referent_automation') score += 1.1;

  return Number(score.toFixed(2));
}

function serviceWhy(service, row) {
  const text = `${row.sector} ${row.signal} ${row.notes}`.toLowerCase();
  if (containsOne(text, ['recrutement', 'hiring']) && service.id === 'temps_partage_ot') {
    return 'le signal de recrutement montre un besoin déjà ouvert et rapidement mobilisable';
  }
  if (containsOne(text, ['expansion', 'investissement', 'scale-up']) && service.id === 'cellule_automation_ot') {
    return 'le compte est en montée de charge et a besoin de support structuré, pas seulement de jours isolés';
  }
  if (containsOne(text, ['ot', 'cyber', '62443', 'nis2']) && service.id === 'audit_ot_cyber') {
    return 'les signaux OT/cyber permettent une entrée packagée à forte valeur';
  }
  if (containsOne(text, ['csv', 'qualification', 'gmp']) && service.id === 'qualification_csv') {
    return 'l’environnement régulé rend le lot qualification/CSV très concret à vendre';
  }
  if (containsOne(text, ['migration', 'upgrade', 'modernisation']) && service.id === 'migration_modernisation') {
    return 'la modernisation technique donne un angle projet clair et urgent';
  }
  return service.pitch || 'le besoin semble délégable et suffisamment structuré pour une offre Vanguard';
}

export function recommendServices(row, profile = {}, limit = 3) {
  return serviceCatalog(profile)
    .map((service) => ({
      id: service.id,
      label: service.label,
      subject: service.subject,
      pitch: service.pitch,
      score: serviceScore(service, row),
      why: serviceWhy(service, row),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function primaryService(row, profile = {}) {
  return recommendServices(row, profile, 1)[0] || {
    id: 'referent_automation',
    label: 'un référent automation externalisé',
    subject: 'automation industrielle',
    pitch: 'reprendre le backlog automation de façon structurée',
    score: 1,
    why: 'offre de départ la plus simple pour ouvrir le compte proprement',
  };
}

// Élision "que" devant voyelle ou h muet : "qu'Actemium", "qu'AISA", "que Prodima".
function que(text) {
  if (!text) return 'que ';
  return /^[aeiouhéèêàâAEIOUHÉÈÊÀÂ]/.test(String(text).trim()) ? `qu'${text}` : `que ${text}`;
}

// Détecte si un libellé de poste correspond à un rôle senior / management.
// Le pitch "renfort le temps du recrutement" n'a aucun sens pour ces postes
// (un directeur ne se remplace pas par un freelance).
function isSeniorRole(label) {
  if (!label) return false;
  return /\b(head|director|directeur|directrice|vp|vice[- ]president|chief|c[- ]?level|cto|coo|ceo|cio|cmo|cfo|managing|partner|founder|fondateur|chef de d[ée]partement|responsable de d[ée]partement|responsable d[’']automation|manager industriel|leader|expert principal|principal engineer|architect)\b/i.test(label);
}

// Génère une phrase d'ouverture contextuelle naturelle, ou retourne null si pas de contexte exploitable.
// Convention: si `row.signal` commence par une minuscule et un verbe ("vous recrutez", "votre fusion"),
// on utilise tel quel. Sinon on tente de reformuler depuis les mots-clés.
export function contextLine(row) {
  const sig = String(row.signal || '').trim();
  if (!sig) return null;
  const lower = sig.toLowerCase();

  // Si le signal est déjà une phrase humaine ("vous recrutez...", "votre projet...")
  if (/^(vous|votre|vos)\s/i.test(sig)) {
    return `J'ai vu ${que(sig)}.`;
  }

  // Détection de motifs courants pour reformulation
  const recruitMatch = sig.match(/recrutement\s+([^,(|]+?)(?:\s+(?:LinkedIn|jobup|via|sur|sources?)\b|$)/i);
  const recruitedTitle = recruitMatch ? recruitMatch[1].trim().replace(/^un[e]?\s+/i, '') : null;
  const isSeniorRecruit = recruitedTitle && isSeniorRole(recruitedTitle);

  // Recrutement IC (automaticien, ingénieur) : on peut se positionner en renfort cohérent.
  if (recruitedTitle && !isSeniorRecruit) {
    return `J'ai vu que vous recrutez actuellement un ${recruitedTitle} chez ${row.company}.`;
  }
  // Recrutement vague non-senior
  if (!isSeniorRecruit && containsOne(lower, ['recrutement', 'hiring'])) {
    return `J'ai vu ${que(row.company)} recrute actuellement sur des sujets d'automation.`;
  }
  // Recrutement senior : on saute l'angle "renfort recrutement" et on bascule sur fallback ci-dessous.
  if (containsOne(lower, ['expansion', 'nouvelle ligne', 'nouveau site', 'investissement', 'scale-up'])) {
    return `J'ai vu ${que(row.company)} est en phase d'expansion.`;
  }
  if (containsOne(lower, ['fusion', 'acquisition', 'rapprochement'])) {
    return `J'ai suivi le rapprochement récent autour de ${row.company}.`;
  }
  if (containsOne(lower, ['migration', 'upgrade', 'modernisation', 'obsolescence'])) {
    return `J'ai vu ${que(row.company)} est probablement confronté à des sujets de migration ou de modernisation.`;
  }
  if (containsOne(lower, ['nouveau projet', 'contrat', 'projet remporté', 'gagne', 'remporte'])) {
    return `J'ai vu ${que(row.company)} remporte régulièrement des projets industriels en Suisse romande.`;
  }
  if (containsOne(lower, ['oem', 'machine spéciale', 'machines spéciales', 'constructeur'])) {
    return `J'ai vu ${que(row.company)} conçoit et fabrique des machines spéciales pour ses clients.`;
  }
  if (containsOne(lower, ['intégrateur', 'integrateur', 'epcm'])) {
    return `J'ai vu ${que(row.company)} est un intégrateur actif sur des projets industriels en Suisse romande.`;
  }

  // Fallback générique selon le type de cible (OEM / intégrateur / site industriel)
  const targetText = `${row.target_type || ''} ${row.sector || ''}`.toLowerCase();
  if (containsOne(targetText, ['oem', 'machine spéciale', 'machines spéciales', 'constructeur'])) {
    return `J'ai vu ${que(row.company)} conçoit et fabrique des machines pour ses clients industriels.`;
  }
  if (containsOne(targetText, ['intégrateur', 'integrateur', 'epcm'])) {
    return `J'ai vu ${que(row.company)} opère en Suisse romande comme intégrateur sur des projets industriels.`;
  }
  // Pas de catégorie claire : phrase neutre régionale.
  return `J'ai vu ${que(row.company)} opère en Suisse romande sur des sujets industriels.`;
}

// Présentation Vanguard adaptée au type de cible (OEM / intégrateur / industriel).
export function presentationLine(row) {
  const text = `${row.target_type || ''} ${row.sector || ''} ${row.signal || ''} ${row.notes || ''}`.toLowerCase();
  if (containsOne(text, ['oem', 'machine spéciale', 'machines spéciales', 'constructeur', 'équipementier'])) {
    return "Je dirige Vanguard Systems, basée en Suisse romande. J'accompagne les fabricants de machines sur la programmation des automates, la mise en service en atelier (FAT) puis sur site client (SAT).";
  }
  if (containsOne(text, ['intégrateur', 'integrateur', 'epcm', 'engineering services', 'bureau d\'études', 'partenaire'])) {
    return "Je dirige Vanguard Systems, basée en Suisse romande. J'accompagne les intégrateurs sur leurs phases de mise en service, FAT et SAT chez leurs clients finaux, en renfort ou en sous-traitance.";
  }
  if (containsOne(text, ['pharma', 'biotech', 'medtech'])) {
    return "Je dirige Vanguard Systems, basée en Suisse romande. J'accompagne des sites pharmaceutiques sur leurs sujets d'automation, qualification et migration des installations.";
  }
  if (containsOne(text, ['énergie', 'energie', 'utilities'])) {
    return "Je dirige Vanguard Systems, basée en Suisse romande. J'accompagne des sites industriels et utilities sur leurs sujets d'automation, supervision et migration des installations.";
  }
  return "Je dirige Vanguard Systems, basée en Suisse romande. J'accompagne des sites industriels sur leurs sujets d'automation, migration et support des installations.";
}

// Phrase de proposition concrète, adaptée au signal.
export function propositionLine(row) {
  const text = `${row.signal || ''} ${row.notes || ''}`.toLowerCase();
  // Recrutement IC (automaticien, ingénieur, technicien) → on est cohérent comme renfort
  // Recrutement senior (directeur, head, VP) → on ne se positionne pas en remplaçant
  const isRecruit = containsOne(text, ['recrutement', 'hiring']);
  const recruitedSenior = isRecruit && isSeniorRole(row.signal || '');
  if (isRecruit && !recruitedSenior) {
    return "Je suis disponible en renfort, le temps que votre recrutement aboutisse, ou ponctuellement sur projet.";
  }
  if (containsOne(text, ['expansion', 'nouvelle ligne', 'nouveau site', 'investissement', 'scale-up'])) {
    return "Je suis disponible pour vous appuyer sur la montée en charge, en programmation des automates ou en mise en service.";
  }
  if (containsOne(text, ['migration', 'upgrade', 'modernisation', 'obsolescence', 'pcs7', 'wincc', 's5'])) {
    return "Je suis disponible pour prendre en charge une phase de migration ou de modernisation des automates et de la supervision, sans mobiliser votre équipe interne.";
  }
  if (containsOne(text, ['fat', 'sat', 'mise en service', 'commissioning', 'démarrage'])) {
    return "Je suis disponible pour vous renforcer sur les phases de FAT en atelier et SAT chez le client final.";
  }
  if (containsOne(text, ['gmp', 'csv', 'qualification', 'iq', 'oq'])) {
    return "Je suis disponible pour intervenir sur la qualification, le CSV ou les phases FAT et SAT en environnement régulé.";
  }
  return "Je suis disponible en renfort ponctuel ou sur projet : programmation automate, supervision, mise en service, FAT et SAT.";
}

// CTA fixe, ton humain et ouvert.
export function ctaLine() {
  return "Je suis volontiers disponible pour un échange si vous y voyez un intérêt aujourd'hui ou dans le futur.";
}

// --- Conserve l'ancien API pour compat (relance_1, relance_2) ---
export function painPoint(row) {
  const text = `${row.signal} ${row.notes} ${row.sector}`.toLowerCase();
  if (containsOne(text, ['recrutement', 'hiring'])) return 'avancer le temps que votre recrutement aboutisse';
  if (containsOne(text, ['expansion', 'investissement', 'scale-up'])) return 'sécuriser la montée en charge';
  if (containsOne(text, ['nis2', '62443', 'cyber'])) return 'avancer sur les sujets de cybersécurité industrielle';
  if (containsOne(text, ['qualification', 'csv', 'gmp'])) return 'sécuriser la qualification sans ralentir vos projets';
  if (containsOne(text, ['migration', 'upgrade', 'modernisation'])) return 'avancer sur la migration ou la modernisation des installations';
  if (containsOne(text, ['fat', 'sat', 'mise en service'])) return 'avancer sur les phases de FAT et SAT';
  if (containsOne(text, ['manufacturing', 'production', 'site'])) return 'reprendre proprement le backlog automation';
  return 'avancer sur vos sujets d\'automation';
}

export function proofPoint(row) {
  return presentationLine(row);
}

export function signalLine(row) {
  const ctx = contextLine(row);
  if (ctx) return ctx;
  return `Je vous contacte au sujet de ${row.company} et de ses sujets d'automation industrielle.`;
}

export function subjectForRow(row, profile = {}) {
  const service = primaryService(row, profile);
  return `${row.company} — ${service.subject || 'automation industrielle'}`;
}
