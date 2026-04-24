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

export function painPoint(row) {
  const text = `${row.signal} ${row.notes} ${row.sector}`.toLowerCase();
  if (containsOne(text, ['recrutement', 'hiring'])) return 'absorber rapidement la charge pendant que le besoin se structure';
  if (containsOne(text, ['expansion', 'investissement', 'scale-up'])) return 'sécuriser la montée en charge sans créer de dette de mise en service';
  if (containsOne(text, ['nis2', '62443', 'cyber'])) return 'clarifier les priorités OT/cyber sans lancer un chantier disproportionné';
  if (containsOne(text, ['qualification', 'csv', 'gmp'])) return 'sécuriser qualification et conformité sans freiner l’exécution';
  if (containsOne(text, ['migration', 'upgrade', 'modernisation'])) return 'sortir d’une dette technique qui finit toujours par devenir un risque opérationnel';
  if (containsOne(text, ['manufacturing', 'production', 'site'])) return 'reprendre les irritants automation avant qu’ils ne deviennent du run subi';
  return 'reprendre le backlog automation de façon structurée';
}

export function proofPoint(row) {
  const text = `${row.sector} ${row.signal}`.toLowerCase();
  if (containsOne(text, ['pharma', 'biotech', 'medtech'])) {
    return "J'interviens sur ce type d'environnement en Suisse romande, avec des contextes régulés où la continuité d'exploitation compte autant que le projet.";
  }
  if (containsOne(text, ['horlogerie', 'luxe', 'manufacturing', 'agroalimentaire'])) {
    return "Le sujet revient souvent dans les sites de production où la qualité, la cadence et la traçabilité se jouent aussi dans l'automation.";
  }
  if (containsOne(text, ['énergie', 'energie', 'utilities'])) {
    return "Sur les environnements critiques, l'enjeu est souvent de reprendre l'existant proprement avant d'empiler de nouvelles couches.";
  }
  if (containsOne(text, ['chimie', 'chemical'])) {
    return "Dans les procédés continus ou semi-continus, l'enjeu est souvent de remettre de la robustesse et de la visibilité sans perturber la production.";
  }
  return "Je travaille sur des sujets similaires en Suisse romande, avec une logique très terrain: reprendre, fiabiliser, puis faire tourner proprement.";
}

export function signalLine(row) {
  if (!row.signal) return `Je vous contacte car ${row.company} évolue dans un contexte où l'automation et la fiabilité des systèmes ont un impact direct sur l'opérationnel.`;
  return `J'ai vu le signal suivant chez ${row.company}: ${row.signal}.`;
}

export function subjectForRow(row, profile = {}) {
  const service = primaryService(row, profile);
  return `${row.company} — ${service.subject || 'automation industrielle'}`;
}
