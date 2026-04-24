# Prospection Intégrateurs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivoter le pipeline consulting-ops de "consultant pharma/OT" vers "automaticien freelance renfort intégrateurs", avec dual-agent (PrepAgent + ReviewAgent) pour la génération et validation des messages avant envoi.

**Architecture:** Orchestrateur Node.js (`prospect-loop.mjs`) qui enchaîne acquisition leads (LinkedIn + Jobup), enrichissement (Hunter.io + website), génération messages via PrepAgent (`claude -p`), revue qualité via ReviewAgent (`claude -p`), puis envoi SMTP. `relance-scheduler.mjs` gère les relances J+7/J+14 de façon autonome.

**Tech Stack:** Node.js ESM, Playwright (LinkedIn scraping), Hunter.io API, Nodemailer SMTP, yaml, `claude -p` subprocess pour agents IA.

**Spec de référence:** `docs/superpowers/specs/2026-04-24-prospection-integrateurs-design.md`

---

## Fichiers touchés

| Fichier | Action | Raison |
|---|---|---|
| `outreach-dispatch.mjs:210` | Modifier | Supprimer filtre `integrateur` (BLOQUANT) |
| `outreach-dispatch.mjs:loadTable` | Modifier | Parsing header-first au lieu d'index |
| `outreach-dispatch.mjs:saveTable` | Modifier | Sérialisation dynamique des colonnes |
| `outreach-dispatch.mjs:greeting` | Modifier | "Bonjour Monsieur/Madame" (convention CH) |
| `prospection-core.mjs` | Modifier | +`parseTsvRow`, `serializeTsvRow`, 2 nouveaux services intégrateur |
| `config/profile.yml` | Modifier | Pivot positionnement + geo option C |
| `config/lead-sources.yml` | Créer | Sources leads (LinkedIn queries, Jobup) |
| `modes/_profile.md` | Modifier | Archetypes intégrateur/OEM |
| `modes/prospection.md` | Modifier | Templates intégrateur + règles dual-agent |
| `enrich-context.mjs` | Modifier | Flag `--file` pour cibler prospection.tsv |
| `data/prospection.tsv` | Modifier | +2 colonnes : target_type, geo_priority |
| `industrial-prospect-scan.mjs` | Modifier | Écrire nouvelles colonnes + LinkedIn Playwright |
| `prospect-loop.mjs` | Créer | Orchestrateur principal |
| `relance-scheduler.mjs` | Créer | Relances J+7/J+14 |

---

## Task 1 : Fix bloquant -- filtre intégrateur dans outreach-dispatch.mjs

**Files:**
- Modify: `outreach-dispatch.mjs:210`

- [ ] **Step 1 : Lire la ligne concernée**

```bash
grep -n "concurrent\|integrateur\|recruteur" outreach-dispatch.mjs
```
Expected output : ligne ~210 avec `!['concurrent', 'integrateur', 'recruteur']`

- [ ] **Step 2 : Corriger le filtre**

Dans `outreach-dispatch.mjs`, remplacer :
```js
selected = selected.filter((row) => !['concurrent', 'integrateur', 'recruteur'].includes(inferClassification(row, profile)));
```
Par :
```js
selected = selected.filter((row) => !['concurrent', 'recruteur'].includes(inferClassification(row, profile)));
```

- [ ] **Step 3 : Vérifier en dry-run**

```bash
node outreach-dispatch.mjs --dry-run
```
Expected : pas d'erreur, les entreprises classifiées `integrateur` apparaissent maintenant dans la liste.

- [ ] **Step 4 : Commit**

```bash
git add outreach-dispatch.mjs
git commit -m "fix: outreach -- inclure intégrateurs dans les cibles (filtre inversé)"
```

---

## Task 2 : Utilitaires TSV header-first dans prospection-core.mjs

**Files:**
- Modify: `prospection-core.mjs` (fin du fichier)

Raison : tous les scripts parsent prospection.tsv par index fixe. L'ajout de 2 colonnes casserait outreach-dispatch, industrial-prospect-scan, et relance-scheduler. Cette utilitaire résout le problème une fois pour toutes.

- [ ] **Step 1 : Ajouter les exports à prospection-core.mjs**

Ajouter à la fin de `prospection-core.mjs` :
```js
export const PROSPECTION_COLUMNS = [
  'date', 'company', 'contact', 'email', 'linkedin', 'sector',
  'signal', 'score', 'message_sent', 'status', 'notes', 'target_type', 'geo_priority', 'date_envoi',
];

export function parseTsvRow(headerCols, dataLine) {
  const vals = dataLine.split('\t');
  const row = {};
  headerCols.forEach((k, i) => { row[k.trim()] = (vals[i] || '').trim(); });
  return row;
}

export function serializeTsvRow(row) {
  return PROSPECTION_COLUMNS.map((col) => String(row[col] ?? '')).join('\t');
}

export function loadProspectionTsv(filePath) {
  const { readFileSync, existsSync } = await import('fs');
  if (!existsSync(filePath)) return { headerCols: PROSPECTION_COLUMNS, rows: [] };
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter((l) => l.trim());
  const headerLine = lines.find((l) => l.startsWith('date\t'));
  const headerCols = headerLine ? headerLine.split('\t').map((c) => c.trim()) : PROSPECTION_COLUMNS;
  const rows = lines
    .filter((l) => !l.startsWith('date\t') && !l.startsWith('#'))
    .map((l) => {
      const row = parseTsvRow(headerCols, l);
      row.classification = getClassification(row.notes || '');
      return row;
    });
  return { headerCols, rows };
}

export function saveProspectionTsv(filePath, rows) {
  const { writeFileSync } = await import('fs');
  const header = PROSPECTION_COLUMNS.join('\t');
  const body = rows.map(serializeTsvRow).join('\n');
  writeFileSync(filePath, `${header}\n${body}\n`);
}
```

**Note :** `loadProspectionTsv` et `saveProspectionTsv` utilisent `await import('fs')` car les fonctions sont exportées depuis un module ESM synchrone. Alternativement, passer les deps en paramètre -- mais pour garder la cohérence avec le reste du fichier (pas d'import `fs` en top-level dans prospection-core.mjs), importer dynamiquement est correct.

Attends -- prospection-core.mjs est un module pur (pas de fs). Pour éviter de le polluer, créer plutôt un helper séparé `prospection-tsv.mjs` :

- [ ] **Step 1 (révisé) : Créer `prospection-tsv.mjs`**

```js
// prospection-tsv.mjs -- Utilitaires de lecture/écriture prospection.tsv
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getClassification } from './prospection-core.mjs';

export const PROSPECTION_COLUMNS = [
  'date', 'company', 'contact', 'email', 'linkedin', 'sector',
  'signal', 'score', 'message_sent', 'status', 'notes', 'target_type', 'geo_priority', 'date_envoi',
];

export function parseTsvRow(headerCols, dataLine) {
  const vals = dataLine.split('\t');
  const row = {};
  headerCols.forEach((k, i) => { row[k.trim()] = (vals[i] || '').trim(); });
  return row;
}

export function serializeTsvRow(row) {
  return PROSPECTION_COLUMNS.map((col) => String(row[col] ?? '')).join('\t');
}

export function loadProspectionTsv(filePath) {
  if (!existsSync(filePath)) return { headerCols: PROSPECTION_COLUMNS, rows: [] };
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter((l) => l.trim());
  const headerLine = lines.find((l) => l.startsWith('date\t'));
  const headerCols = headerLine ? headerLine.split('\t').map((c) => c.trim()) : PROSPECTION_COLUMNS;
  const rows = lines
    .filter((l) => !l.startsWith('date\t') && !l.startsWith('#'))
    .map((l) => {
      const row = parseTsvRow(headerCols, l);
      row.classification = getClassification(row.notes || '');
      return row;
    });
  return { headerCols, rows };
}

export function saveProspectionTsv(filePath, rows) {
  const header = PROSPECTION_COLUMNS.join('\t');
  const body = rows.map(serializeTsvRow).join('\n');
  writeFileSync(filePath, `${header}\n${body}\n`);
}
```

- [ ] **Step 2 : Vérifier le module s'importe sans erreur**

```bash
node --input-type=module <<'EOF'
import { loadProspectionTsv, PROSPECTION_COLUMNS } from './prospection-tsv.mjs';
const { rows } = loadProspectionTsv('./data/prospection.tsv');
console.log(`OK: ${rows.length} lignes, colonnes: ${PROSPECTION_COLUMNS.join(', ')}`);
EOF
```
Expected : `OK: 115 lignes, colonnes: date, company, ...`

- [ ] **Step 3 : Commit**

```bash
git add prospection-tsv.mjs
git commit -m "feat: prospection-tsv -- utilitaire header-first pour prospection.tsv"
```

---

## Task 3 : Migrer outreach-dispatch.mjs vers header-first + fix greeting

**Files:**
- Modify: `outreach-dispatch.mjs`

- [ ] **Step 1 : Remplacer l'import et loadTable/saveTable**

En haut de `outreach-dispatch.mjs`, ajouter l'import :
```js
import { loadProspectionTsv, saveProspectionTsv } from './prospection-tsv.mjs';
```

Remplacer la fonction `loadTable()` entière par :
```js
function loadTable() {
  return loadProspectionTsv(PROSPECTION_FILE);
}
```

Remplacer la fonction `saveTable(header, rows)` entière par :
```js
function saveTable(_header, rows) {
  saveProspectionTsv(PROSPECTION_FILE, rows);
}
```

- [ ] **Step 2 : Corriger la fonction greeting (convention suisse)**

Remplacer :
```js
function greeting(row) {
  const firstName = (row.contact || '').split(' ')[0];
  if (firstName) return `Bonjour ${firstName},`;
  return 'Bonjour,';
}
```
Par :
```js
function greeting(row) {
  const contact = (row.contact || '').trim();
  if (!contact) return 'Bonjour,';
  const parts = contact.split(' ');
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  return `Bonjour Monsieur/Madame ${lastName},`;
}
```

- [ ] **Step 3 : Ajouter l'écriture de date_envoi lors de l'envoi**

Dans `outreach-dispatch.mjs`, dans le bloc `if (live)`, après `row.status = nextStatus(row.status)`, ajouter :
```js
row.date_envoi = nowDate();
```

- [ ] **Step 4 : Vérifier en dry-run**

```bash
node outreach-dispatch.mjs --dry-run --top 3
```
Expected : 3 prospects affichés avec objet, corps du message, salutation "Bonjour Monsieur/Madame ...".

- [ ] **Step 4 : Commit**

```bash
git add outreach-dispatch.mjs
git commit -m "refactor: outreach-dispatch -- header-first TSV + salutation convention CH"
```

---

## Task 4 : Nouveaux services intégrateur dans prospection-core.mjs

**Files:**
- Modify: `prospection-core.mjs` (section `DEFAULT_SERVICES`)

- [ ] **Step 1 : Ajouter les services après les services existants**

Dans `prospection-core.mjs`, localiser `DEFAULT_SERVICES` (array). Ajouter à la fin du tableau :
```js
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
```

- [ ] **Step 2 : Vérifier que recommendServices retourne les nouveaux services**

```bash
node --input-type=module <<'EOF'
import { recommendServices } from './prospection-core.mjs';
const fakeRow = { signal: 'mise en service', sector: 'intégrateur', notes: '' };
const services = recommendServices(fakeRow, {}, 3);
console.log(services.map(s => s.id).join(', '));
EOF
```
Expected : `renfort_miseenservice` apparaît dans la liste.

- [ ] **Step 3 : Commit**

```bash
git add prospection-core.mjs
git commit -m "feat: prospection-core -- services renfort_miseenservice et renfort_retrofit"
```

---

## Task 5 : Pivot config/profile.yml

**Files:**
- Modify: `config/profile.yml`

- [ ] **Step 1 : Mettre à jour le positionnement**

Dans `config/profile.yml`, trouver et remplacer la section `positioning` (ou l'équivalent -- `primary`, `angle`, `tagline`) :
```yaml
positioning:
  primary: "Automaticien freelance -- renfort rapide intégrateurs et industriels"
  tagline: "Dispo rapide. Autonome sur Siemens / TIA / Rockwell. Mise en service, retrofit, renfort projet."
  angle:
    - mise en service
    - renfort projet
    - retrofit
    - dispo rapide
```

- [ ] **Step 2 : Mettre à jour la géographie**

Dans `config/profile.yml`, trouver la section `geo` ou `geography` et remplacer par :
```yaml
geo:
  strict_geo: false
  priority_1:
    - Vaud
    - Genève
    - Fribourg
    - Neuchâtel
    - Valais
    - Jura
  priority_2:
    - Zurich
    - Berne
    - Bâle
  excluded:
    - France
    - Allemagne
    - Italie
```

- [ ] **Step 3 : Mettre à jour les cibles et l'outreach**

Dans `config/profile.yml`, ajouter ou remplacer :
```yaml
targets:
  priority_1:
    - intégrateur automation
    - bureau d'études
    - société d'ingénierie
  priority_2:
    - OEM machine
    - constructeur
  priority_3:
    - industriel
    - maintenance
    - production

outreach:
  daily_email_limit: 20
  daily_linkedin_limit: 15
  relance_j: 7
  relance_max: 2
```

- [ ] **Step 4 : Vérifier le fichier se charge sans erreur**

```bash
node --input-type=module <<'EOF'
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
const p = yaml.load(readFileSync('./config/profile.yml', 'utf-8'));
console.log('positioning:', p.positioning?.primary);
console.log('geo.strict_geo:', p.geo?.strict_geo);
console.log('targets.priority_1:', p.targets?.priority_1);
EOF
```
Expected : les 3 valeurs s'affichent correctement.

- [ ] **Step 5 : Commit**

```bash
git add config/profile.yml
git commit -m "feat: profile -- pivot positionnement intégrateur + geo option C"
```

---

## Task 6 : Créer config/lead-sources.yml

**Files:**
- Create: `config/lead-sources.yml`

- [ ] **Step 1 : Créer le fichier**

```yaml
# config/lead-sources.yml -- Sources de leads prospection intégrateurs

# Phase 1 : LinkedIn (Playwright) + Jobup (existant)
linkedin:
  queries:
    - "automaticien Suisse"
    - "automation engineer Switzerland"
    - "intégrateur Siemens Suisse"
    - "bureau d'études automatisme Suisse"
    - "chef de projet automation Suisse romande"
  filters:
    country: CH
    company_size: "10-500"
  max_per_run: 50
  delay_ms: 3000

jobup:
  searches:
    - { term: "automation", location: "vaud" }
    - { term: "automation", location: "genève" }
    - { term: "automation", location: "fribourg" }
    - { term: "automaticien", location: "suisse romande" }
    - { term: "mise en service", location: "vaud" }
    - { term: "commissioning", location: "suisse romande" }
    - { term: "intégrateur", location: "suisse romande" }
  max_per_run: 30

# Phase 2 (futur -- risque CAPTCHA, non implémenté)
# google_maps: ...
# kompass: ...
```

- [ ] **Step 2 : Vérifier le fichier se charge**

```bash
node --input-type=module <<'EOF'
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
const ls = yaml.load(readFileSync('./config/lead-sources.yml', 'utf-8'));
console.log('linkedin queries:', ls.linkedin.queries.length);
console.log('jobup searches:', ls.jobup.searches.length);
EOF
```
Expected : `linkedin queries: 5`, `jobup searches: 7`

- [ ] **Step 3 : Commit**

```bash
git add config/lead-sources.yml
git commit -m "feat: lead-sources -- config sources leads intégrateurs (phase 1)"
```

---

## Task 7 : Mettre à jour modes/_profile.md (archetypes intégrateur)

**Files:**
- Modify: `modes/_profile.md`

- [ ] **Step 1 : Remplacer les archetypes pharma par des archetypes intégrateur**

Ouvrir `modes/_profile.md`. Trouver la section archetypes. La remplacer entièrement par :

```markdown
## Archetypes

### Archetype 1 : Intégrateur / bureau d'études (PRIORITÉ 1)
**Framing :** Renfort terrain automatisme. Dispo rapide. Autonome sur chantier.
**Phrase d'accroche :** "Automaticien freelance, j'interviens en renfort sur mise en service et automatisme quand vos équipes sont chargées."
**Proof points :** Siemens TIA Portal / WinCC, Rockwell Studio 5000, mise en service multi-sites (Merck, Novartis, Sun Chemicals)
**TJM :** 1100-1500 CHF/jour selon durée et complexité
**Durée typique :** 1 semaine à 6 mois, renouvelable

### Archetype 2 : OEM / constructeur machine (PRIORITÉ 2)
**Framing :** Renfort mise en service et retrofit machines. Expérience manufacturing multi-secteurs.
**Phrase d'accroche :** "Automaticien freelance spécialisé mise en service et retrofit. Siemens / Rockwell. Dispo rapide."
**Proof points :** Retrofit lignes manufacturing, migration S7/S5 → TIA, dépannage chantier
**TJM :** 1000-1400 CHF/jour
**Durée typique :** mission ponctuelle 1-4 semaines

### Archetype 3 : Industriel / production (PRIORITÉ 3)
**Framing :** Renfort backlog automation, support maintenance OT, petits projets.
**Phrase d'accroche :** "Automaticien freelance pour renfort automation, backlog projets ou support OT ponctuel."
**Proof points :** Support production, stabilisation run OT, petits projets Siemens/Rockwell
**TJM :** 1000-1200 CHF/jour
**Durée typique :** mission à la semaine ou temps partagé

## Scripts de négociation

### Si question sur le TJM
"Mon tarif reflète la dispo rapide et l'autonomie sur chantier. Pour une mission > 2 mois, on peut discuter d'un ajustement."

### Si demande d'exclusivité
"Je travaille avec plusieurs clients en parallèle -- c'est ce qui me permet de rester disponible rapidement. Si vous avez besoin d'exclusivité, le TJM est majoré de 20%."

### Si question sur la structure juridique
"J'interviens via Vanguard Systems Sàrl, entreprise suisse, facture CHF avec TVA. Pas de complication administrative."

## Proof points par technologie

- **Siemens TIA Portal / S7 :** mise en service Merck Corsier-sur-Vevey, support Novartis
- **Rockwell Studio 5000 :** projets manufacturing multi-sites
- **WinCC / SCADA :** supervision pharma et manufacturing
- **Retrofit / migration :** remplacement S5/S7 classique → TIA, Sun Chemicals
- **Multi-secteurs :** pharma, horlogerie, agroalimentaire, chimie fine
```

- [ ] **Step 2 : Commit**

```bash
git add modes/_profile.md
git commit -m "feat: _profile -- archetypes pivotés intégrateur/OEM/industriel"
```

---

## Task 8 : Mettre à jour modes/prospection.md (templates + règles dual-agent)

**Files:**
- Modify: `modes/prospection.md`

- [ ] **Step 1 : Mettre à jour les templates email en début de fichier**

Trouver la section templates ou messages. Ajouter/remplacer les 3 templates :

```markdown
## Templates email

### Template A : Signal fort (embauche automaticien détectée)
**Objet :** Renfort automatisme dispo -- [Company]
**Corps :**
Bonjour Monsieur/Madame [NOM],

J'ai vu que [Company] recrute un automaticien en ce moment.

Automaticien freelance basé en Suisse, j'interviens en renfort sur mise en service et automatisme quand les équipes sont en charge ou en recrutement.

Autonome sur Siemens TIA Portal et Rockwell. Références industrielles disponibles.

Disponible rapidement si le besoin est immédiat.

[Prénom]
[Téléphone]

### Template B : Signal moyen (expansion, nouveau projet détecté)
**Objet :** Automaticien freelance -- renfort disponible
**Corps :**
Bonjour Monsieur/Madame [NOM],

J'ai suivi l'actualité de [Company] -- [SIGNAL DÉTECTÉ].

Automaticien freelance, j'interviens en renfort sur ce type de projets : mise en service, automatisme, retrofit. Siemens / Rockwell.

Dispo rapidement si vous anticipez une surcharge.

[Prénom]
[Téléphone]

### Template C : Cold (aucun signal)
**Objet :** Automaticien freelance dispo -- renfort Siemens / Rockwell
**Corps :**
Bonjour Monsieur/Madame [NOM],

Automaticien freelance basé en Suisse romande.

J'interviens en renfort sur :
- mise en service
- automatisme / support OT
- retrofit machines

Autonome sur Siemens TIA Portal et Rockwell Studio 5000. Dispo rapidement si surcharge ou besoin ponctuel.

[Prénom]
[Téléphone]

## Règles de rédaction (STRICTES)

- Vouvoiement obligatoire ("vous", jamais "tu")
- Salutation : "Bonjour Monsieur/Madame [NOM]" -- jamais le prénom seul
- Français avec accents (é, è, ê, à, ù, ç) -- jamais d'anglicismes sans justification
- Aucun tiret long (-- ou —) -- virgules ou parenthèses à la place
- Ton pair-à-pair, jamais commercial ni exclamatif
- Corps : maximum 120 mots
- Objet : maximum 8 mots
- Pas de : "je me permets de", "je serais ravi", "synergie", "innovant", "robuste", "passionné par"

## Score confiance PrepAgent (1-5)

- **5** : signal fort + contact nominatif + proof point exact au secteur
- **4** : signal moyen OU contact générique (pas de nom)
- **3** : cold, message standard mais conforme aux règles
- **< 3** : quarantaine directe sans passage ReviewAgent

## ReviewAgent -- Checklist 9 critères

| # | Critère | Règle |
|---|---|---|
| 1 | Vouvoiement | "vous" partout, jamais "tu" |
| 2 | Salutation | "Bonjour Monsieur/Madame NOM" -- jamais prénom seul |
| 3 | Langue | accents FR corrects, zéro anglicisme non justifié |
| 4 | Em-dash | aucun `--` ou `—` dans le corps (autorisé en objet court) |
| 5 | Ton | peer-to-peer, pas d'exclamation, pas de formules creuses |
| 6 | Signal cohérent | message correspond exactement au signal détecté |
| 7 | Géo | romande = ok, nationwide = mention "missions sur toute la Suisse" explicite |
| 8 | Longueur | max 120 mots corps, objet < 8 mots |
| 9 | Doublons | email absent de prospection.tsv sauf si statut=archive |

Si un critère échoue : réécriture partielle (une tentative). Si toujours KO : quarantaine + rejection_reason.
```

- [ ] **Step 2 : Commit**

```bash
git add modes/prospection.md
git commit -m "feat: modes/prospection -- templates intégrateur + règles dual-agent + checklist 9 critères"
```

---

## Task 9 : Adapter enrich-context.mjs pour prospection.tsv

**Files:**
- Modify: `enrich-context.mjs`

Actuellement le script lit `data/prospects.tsv` (CRM Scaliab) en dur. On ajoute un flag `--file` pour pouvoir cibler `data/prospection.tsv`.

- [ ] **Step 1 : Ajouter le flag --file**

En haut de `enrich-context.mjs`, après les imports existants, ajouter :
```js
const TARGET_FILE = getArg('--file', join(ROOT, 'data', 'prospects.tsv'));
```

(Si `getArg` n'existe pas dans ce fichier, ajouter :)
```js
const args = process.argv.slice(2);
const getArg = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
};
const TARGET_FILE = getArg('--file', join(ROOT, 'data', 'prospects.tsv'));
```

- [ ] **Step 2 : Remplacer PROSPECTS_FILE par TARGET_FILE**

Dans `enrich-context.mjs`, remplacer toutes les occurrences de `PROSPECTS_FILE` par `TARGET_FILE`.

Vérifier avec :
```bash
grep -n "PROSPECTS_FILE\|TARGET_FILE" enrich-context.mjs
```
Expected : uniquement `TARGET_FILE`.

- [ ] **Step 3 : Vérifier que le script accepte le flag**

```bash
node enrich-context.mjs --file data/prospection.tsv --dry-run --limit 1
```
Expected : pas d'erreur, affiche 1 prospect de prospection.tsv.

- [ ] **Step 4 : Commit**

```bash
git add enrich-context.mjs
git commit -m "feat: enrich-context -- flag --file pour cibler prospection.tsv"
```

---

## Task 10 : Migrer prospection.tsv + industrial-prospect-scan.mjs (nouvelles colonnes)

**Files:**
- Modify: `data/prospection.tsv`
- Modify: `industrial-prospect-scan.mjs`

- [ ] **Step 1 : Ajouter les 3 nouvelles colonnes à prospection.tsv**

```bash
# Backup
cp data/prospection.tsv data/prospection.tsv.bak

# Ajouter target_type, geo_priority, date_envoi au header et aux lignes existantes
node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from 'fs';
const raw = readFileSync('./data/prospection.tsv', 'utf-8');
const lines = raw.split('\n');
const updated = lines.map((line) => {
  if (!line.trim()) return line;
  if (line.startsWith('date\t')) return line + '\ttarget_type\tgeo_priority\tdate_envoi';
  if (line.startsWith('#')) return line;
  return line + '\t\t1\t';  // target_type vide, geo_priority=1, date_envoi vide
});
writeFileSync('./data/prospection.tsv', updated.join('\n'));
console.log('Migration OK');
EOF
```

- [ ] **Step 2 : Vérifier le header**

```bash
head -2 data/prospection.tsv
```
Expected : ligne 1 = `date\tcompany\t...notes\ttarget_type\tgeo_priority`, ligne 2 = première entrée avec `\t\t1` en fin.

- [ ] **Step 3 : Vérifier que loadProspectionTsv lit correctement**

```bash
node --input-type=module <<'EOF'
import { loadProspectionTsv } from './prospection-tsv.mjs';
const { rows } = loadProspectionTsv('./data/prospection.tsv');
console.log('Colonnes row[0]:', Object.keys(rows[0]).join(', '));
console.log('geo_priority[0]:', rows[0].geo_priority);
EOF
```
Expected : `geo_priority` présent, valeur `1`.

- [ ] **Step 4 : Mettre à jour industrial-prospect-scan.mjs pour écrire les nouvelles colonnes**

Dans `industrial-prospect-scan.mjs`, trouver la fonction qui append à prospection.tsv. Mettre à jour pour inclure `target_type` et `geo_priority` :

Chercher la ligne qui construit la nouvelle ligne TSV (probablement une template string avec `\t`). La modifier pour ajouter :
```js
// Après la colonne notes :
const targetType = classifyTarget(job.sector);  // voir step 5
const geoPriority = geoAllowed(job.locality, profile) ? '1' : '2';
// ... inclure targetType et geoPriority dans la ligne TSV
```

- [ ] **Step 5 : Ajouter classifyTarget dans industrial-prospect-scan.mjs**

Ajouter la fonction :
```js
function classifyTarget(sector) {
  const s = String(sector || '').toLowerCase();
  if (['intégrateur', 'bureau d\'études', 'ingénierie'].some(k => s.includes(k))) return 'integrateur';
  if (['oem', 'constructeur', 'machine'].some(k => s.includes(k))) return 'OEM';
  return 'industriel';
}
```

- [ ] **Step 6 : Vérifier en dry-run**

```bash
node industrial-prospect-scan.mjs --dry-run --limit 3
```
Expected : pas d'erreur, 3 prospects affichés avec target_type et geo_priority.

- [ ] **Step 7 : Supprimer le backup**

```bash
rm data/prospection.tsv.bak
```

- [ ] **Step 8 : Commit**

```bash
git add data/prospection.tsv industrial-prospect-scan.mjs prospection-tsv.mjs
git commit -m "feat: prospection.tsv -- +target_type +geo_priority, parsing header-first"
```

---

## Task 11 : Étendre industrial-prospect-scan.mjs avec LinkedIn Playwright

**Files:**
- Modify: `industrial-prospect-scan.mjs`
- Modify: `package.json` (si playwright absent)

- [ ] **Step 1 : Vérifier que Playwright est disponible**

```bash
node --input-type=module <<'EOF'
import { chromium } from 'playwright';
console.log('Playwright OK');
EOF
```
Si erreur : `npm install playwright` puis `npx playwright install chromium`.

- [ ] **Step 2 : Ajouter l'import Playwright en haut de industrial-prospect-scan.mjs**

```js
import { chromium } from 'playwright';
```

- [ ] **Step 3 : Ajouter la fonction scrapeLinkedIn**

Ajouter dans `industrial-prospect-scan.mjs` :
```js
async function scrapeLinkedIn(queries, maxPerRun = 50) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const results = [];

  for (const query of queries) {
    if (results.length >= maxPerRun) break;
    const page = await context.newPage();
    try {
      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=Switzerland&f_TPR=r2592000`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      const cards = await page.$$eval(
        '.base-card',
        (els) => els.map((el) => ({
          title: el.querySelector('.base-search-card__title')?.textContent?.trim() || '',
          company: el.querySelector('.base-search-card__subtitle')?.textContent?.trim() || '',
          location: el.querySelector('.job-search-card__location')?.textContent?.trim() || '',
          url: el.querySelector('a.base-card__full-link')?.href || '',
        }))
      );
      results.push(...cards.filter((c) => c.company && c.title));
      await page.waitForTimeout(Number(3000));
    } catch (e) {
      console.warn(`LinkedIn scrape warning (${query}): ${e.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  return results.slice(0, maxPerRun);
}
```

- [ ] **Step 4 : Intégrer scrapeLinkedIn dans le flux principal**

Dans la fonction `main()` de `industrial-prospect-scan.mjs`, après le bloc Jobup existant, ajouter :

```js
// LinkedIn scraping
const leadSources = yaml.load(readFileSync(join(ROOT, 'config', 'lead-sources.yml'), 'utf-8'));
const linkedInResults = await scrapeLinkedIn(
  leadSources.linkedin.queries,
  leadSources.linkedin.max_per_run
);
console.log(`LinkedIn: ${linkedInResults.length} offres trouvées`);

for (const job of linkedInResults) {
  if (!job.company || alreadyInTsv(job.company, existingRows)) continue;
  const locality = extractLocality(job.location);
  if (!geoAccepted(locality, profile)) continue;

  const newRow = {
    date: nowDate(),
    company: job.company,
    contact: '',
    email: '',
    linkedin: job.url,
    sector: detectSector(job.title),
    signal: 'recrutement automaticien',
    score: '6',
    message_sent: '',
    status: 'identifie',
    notes: `LinkedIn: ${job.title}`,
    target_type: classifyTarget(detectSector(job.title)),
    geo_priority: geoIsPriority1(locality, profile) ? '1' : '2',
  };
  newRows.push(newRow);
}
```

(Adapter selon la structure exacte du `main()` existant. Les fonctions `nowDate`, `alreadyInTsv`, `geoAccepted`, `detectSector` doivent déjà exister -- vérifier et ajouter si absentes.)

- [ ] **Step 5 : Ajouter geoIsPriority1 si absente**

```js
function geoIsPriority1(locality, profile) {
  const p1 = (profile.geo?.priority_1 || []).map((r) => r.toLowerCase());
  const loc = String(locality || '').toLowerCase();
  return p1.some((region) => loc.includes(region));
}
```

- [ ] **Step 6 : Vérifier en dry-run (sans Playwright réel pour éviter les bans)**

```bash
node industrial-prospect-scan.mjs --dry-run --limit 5 --skip-linkedin
```

Ajouter le flag `--skip-linkedin` dans le script :
```js
const SKIP_LINKEDIN = hasFlag('--skip-linkedin');
// Dans main(), wrapper le bloc LinkedIn :
if (!SKIP_LINKEDIN) { /* scrapeLinkedIn */ }
```

Expected : dry-run s'exécute sans erreur, affiche Jobup results.

- [ ] **Step 7 : Test LinkedIn réel (1 seule query, 5 max)**

```bash
node industrial-prospect-scan.mjs --dry-run --limit 5
```
Expected : LinkedIn scrape se lance, affiche des entreprises suisses.

- [ ] **Step 8 : Commit**

```bash
git add industrial-prospect-scan.mjs config/lead-sources.yml
git commit -m "feat: industrial-prospect-scan -- LinkedIn Playwright + config lead-sources"
```

---

## Task 12 : Créer prospect-loop.mjs (orchestrateur principal)

**Files:**
- Create: `prospect-loop.mjs`

Cet orchestrateur enchaîne toutes les étapes. Les étapes PrepAgent et ReviewAgent invoquent `claude -p` en subprocess.

- [ ] **Step 1 : Créer prospect-loop.mjs**

```js
#!/usr/bin/env node
/**
 * prospect-loop.mjs -- Orchestrateur pipeline prospection intégrateurs
 *
 * Usage:
 *   node prospect-loop.mjs --mode=full        # pipeline complet
 *   node prospect-loop.mjs --mode=prep-only   # acquisition + enrichissement + queue
 *   node prospect-loop.mjs --mode=relances    # relances J+7/J+14
 *   node prospect-loop.mjs --mode=leads       # acquisition seulement
 *   node prospect-loop.mjs --dry-run          # tout sauf envoi réel
 */
import { execFileSync, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
};

const MODE = (() => {
  const m = args.find((a) => a.startsWith('--mode='));
  return m ? m.replace('--mode=', '') : 'full';
})();
const DRY_RUN = hasFlag('--dry-run');

const QUEUE_DIR = join(ROOT, 'output', 'prospection', 'queue');
const APPROVED_DIR = join(ROOT, 'output', 'prospection', 'approved');
const QUARANTINE_DIR = join(ROOT, 'output', 'prospection', 'quarantine');
const TODAY = new Date().toISOString().slice(0, 10);

function log(msg) { console.log(`[prospect-loop] ${msg}`); }

function run(cmd, args = [], opts = {}) {
  log(`Étape : ${cmd} ${args.join(' ')}`);
  if (DRY_RUN && opts.skipOnDryRun) {
    log(`(dry-run) skipped`);
    return;
  }
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT });
}

function runNode(script, scriptArgs = [], opts = {}) {
  run('node', [script, ...scriptArgs], opts);
}

function buildPrepAgentPrompt(enrichedBatch) {
  const shared = readFileSync(join(ROOT, 'modes', '_shared.md'), 'utf-8');
  const prospection = readFileSync(join(ROOT, 'modes', 'prospection.md'), 'utf-8');
  const profile = readFileSync(join(ROOT, 'modes', '_profile.md'), 'utf-8');
  return [
    shared,
    prospection,
    profile,
    '---',
    '## Ta mission (PrepAgent)',
    'Pour chaque prospect ci-dessous, génère un message email personnalisé.',
    'Respecte les templates et règles de rédaction du mode prospection.',
    'Attribue un score confiance 1-5. Si < 3, marque comme QUARANTINE.',
    'Output : une ligne TSV par prospect avec les colonnes :',
    'company | contact | email | linkedin_url | signal | subject | body | confidence | template_used',
    '---',
    '## Prospects à traiter',
    JSON.stringify(enrichedBatch, null, 2),
  ].join('\n\n');
}

function buildReviewAgentPrompt(queueFile) {
  const queue = readFileSync(queueFile, 'utf-8');
  const prospection = readFileSync(join(ROOT, 'modes', 'prospection.md'), 'utf-8');
  const profile = readFileSync(join(ROOT, 'modes', '_profile.md'), 'utf-8');
  return [
    prospection,
    profile,
    '---',
    '## Ta mission (ReviewAgent)',
    'Vérifie chaque message de la queue ci-dessous contre la checklist 9 critères.',
    'Pour chaque message KO : tente une correction (une seule fois).',
    'Si toujours KO : ajoute rejection_reason et marque QUARANTINE.',
    'Output : deux listes TSV séparées par "=== APPROVED ===" et "=== QUARANTINE ==="',
    'Colonnes : company | contact | email | linkedin_url | signal | subject | body | rejection_reason',
    '---',
    '## Queue à reviewer',
    queue,
  ].join('\n\n');
}

function callClaudeP(prompt, label) {
  log(`Invocation Claude (${label})...`);
  const tmpPrompt = join(ROOT, `output/prospection/.tmp-${label}-${TODAY}.txt`);
  mkdirSync(join(ROOT, 'output/prospection'), { recursive: true });
  writeFileSync(tmpPrompt, prompt);
  const result = execFileSync('claude', ['-p', readFileSync(tmpPrompt, 'utf-8')], {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return result;
}

function splitAgentOutput(output) {
  const approved = [];
  const quarantine = [];
  let section = null;
  for (const line of output.split('\n')) {
    if (line.includes('=== APPROVED ===')) { section = 'approved'; continue; }
    if (line.includes('=== QUARANTINE ===')) { section = 'quarantine'; continue; }
    if (!line.trim()) continue;
    if (section === 'approved') approved.push(line);
    if (section === 'quarantine') quarantine.push(line);
  }
  return { approved, quarantine };
}

async function stepLeads() {
  log('=== ÉTAPE 1 : Acquisition leads ===');
  runNode('industrial-prospect-scan.mjs', ['--limit', '30']);
}

async function stepEnrich() {
  log('=== ÉTAPE 2 : Enrichissement ===');
  // find-email.mjs ne supporte pas --batch : on boucle par entreprise
  const { loadProspectionTsv, saveProspectionTsv } = await import('./prospection-tsv.mjs');
  const PROSPECTION_FILE = join(ROOT, 'data/prospection.tsv');
  const { rows } = loadProspectionTsv(PROSPECTION_FILE);
  const toEnrich = rows.filter((r) => r.status === 'identifie' && !r.email && r.company);

  for (const row of toEnrich.slice(0, 20)) {
    try {
      const domain = row.linkedin
        ? new URL(row.linkedin).hostname.replace('www.', '')
        : `${row.company.toLowerCase().replace(/[^a-z]/g, '')}.com`;
      const result = execFileSync('node', ['find-email.mjs', '--domain', domain, '--json'], {
        cwd: ROOT, encoding: 'utf-8',
      });
      const data = JSON.parse(result.trim());
      if (data?.email) {
        row.email = data.email;
        if (data.first_name && data.last_name) row.contact = `${data.first_name} ${data.last_name}`;
        log(`Email trouvé pour ${row.company} : ${row.email}`);
      }
    } catch { /* quota dépassé ou domaine introuvable, on continue */ }
  }
  if (!DRY_RUN) saveProspectionTsv(PROSPECTION_FILE, rows);
  runNode('enrich-context.mjs', ['--file', 'data/prospection.tsv', '--status', 'identifie', '--limit', '20']);
}

async function stepPrepAgent() {
  log('=== ÉTAPE 3 : PrepAgent ===');
  const { loadProspectionTsv } = await import('./prospection-tsv.mjs');
  const { rows } = loadProspectionTsv(join(ROOT, 'data/prospection.tsv'));
  const batch = rows.filter((r) => r.status === 'identifie' && r.email).slice(0, 20);

  if (batch.length === 0) {
    log('Aucun prospect identifié avec email. Fin PrepAgent.');
    return;
  }

  mkdirSync(QUEUE_DIR, { recursive: true });
  const queueFile = join(QUEUE_DIR, `${TODAY}.tsv`);

  if (DRY_RUN) {
    log(`(dry-run) PrepAgent générerait ${batch.length} messages → ${queueFile}`);
    return;
  }

  const prompt = buildPrepAgentPrompt(batch);
  const output = callClaudeP(prompt, 'prepagent');
  writeFileSync(queueFile, output);
  log(`Queue écrite : ${queueFile} (${output.split('\n').length} lignes)`);
}

async function stepReviewAgent() {
  log('=== ÉTAPE 4 : ReviewAgent ===');
  const queueFile = join(QUEUE_DIR, `${TODAY}.tsv`);
  if (!existsSync(queueFile)) {
    log('Pas de queue PrepAgent pour aujourd\'hui. Skip ReviewAgent.');
    return;
  }

  mkdirSync(APPROVED_DIR, { recursive: true });
  mkdirSync(QUARANTINE_DIR, { recursive: true });

  if (DRY_RUN) {
    log(`(dry-run) ReviewAgent lirait ${queueFile}`);
    return;
  }

  const prompt = buildReviewAgentPrompt(queueFile);
  const output = callClaudeP(prompt, 'reviewagent');
  const { approved, quarantine } = splitAgentOutput(output);

  const approvedFile = join(APPROVED_DIR, `${TODAY}.tsv`);
  const quarantineFile = join(QUARANTINE_DIR, `${TODAY}.tsv`);
  writeFileSync(approvedFile, approved.join('\n'));
  writeFileSync(quarantineFile, quarantine.join('\n'));

  log(`Approuvés : ${approved.length} → ${approvedFile}`);
  log(`Quarantaine : ${quarantine.length} → ${quarantineFile}`);
}

async function stepSend() {
  log('=== ÉTAPE 5 : Envoi ===');
  const approvedFile = join(APPROVED_DIR, `${TODAY}.tsv`);
  if (!existsSync(approvedFile)) {
    log('Aucun message approuvé à envoyer.');
    return;
  }
  const liveFlag = DRY_RUN ? [] : ['--live'];
  runNode('outreach-dispatch.mjs', ['--from-queue', approvedFile, ...liveFlag]);
}

async function main() {
  log(`Mode : ${MODE} | Dry-run : ${DRY_RUN}`);

  if (MODE === 'leads') return stepLeads();
  if (MODE === 'relances') {
    return execFileSync('node', ['relance-scheduler.mjs', ...(DRY_RUN ? ['--dry-run'] : [])], { stdio: 'inherit', cwd: ROOT });
  }

  if (MODE === 'full' || MODE === 'prep-only') {
    await stepLeads();
    await stepEnrich();
    await stepPrepAgent();
    await stepReviewAgent();
    if (MODE === 'full') await stepSend();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2 : Ajouter le flag --from-queue dans outreach-dispatch.mjs**

Dans `outreach-dispatch.mjs`, ajouter la gestion du flag `--from-queue <file>` :
```js
const FROM_QUEUE = getArg('--from-queue', null);
```

Dans `main()`, si `FROM_QUEUE` est défini, lire les prospects depuis ce fichier TSV au lieu de `prospection.tsv`. Mapper les colonnes du queue TSV (company, contact, email, signal, subject, body) vers les champs attendus par `sendMail`.

- [ ] **Step 3 : Tester en dry-run**

```bash
node prospect-loop.mjs --mode=full --dry-run
```
Expected : toutes les étapes s'affichent avec `(dry-run)`, pas d'envoi réel, pas d'erreur.

- [ ] **Step 4 : Tester mode leads seul**

```bash
node prospect-loop.mjs --mode=leads --dry-run
```
Expected : uniquement l'étape acquisition.

- [ ] **Step 5 : Commit**

```bash
git add prospect-loop.mjs outreach-dispatch.mjs
git commit -m "feat: prospect-loop -- orchestrateur principal + from-queue dans outreach-dispatch"
```

---

## Task 13 : Créer relance-scheduler.mjs

**Files:**
- Create: `relance-scheduler.mjs`

- [ ] **Step 1 : Créer relance-scheduler.mjs**

```js
#!/usr/bin/env node
/**
 * relance-scheduler.mjs -- Relances automatiques J+7 et J+14
 *
 * Usage:
 *   node relance-scheduler.mjs            # envoie les relances du jour
 *   node relance-scheduler.mjs --dry-run  # affiche sans envoyer
 */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
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
    ? `${salut}\n\nJe me permets de revenir vers vous suite à mon message du ${row.date_envoi || row.date}.\n\nAutomaticien freelance, je reste disponible si un besoin en renfort automatisme / mise en service se présente chez [Company].\n\n${row.notes?.split('|')[0]?.trim() || ''}\n\n[Prénom]\n[Téléphone]`.replace('[Company]', row.company)
    : `${salut}\n\nDernier message de ma part. Je reste joignable si un besoin en automatisme ou mise en service se présente.\n\nBonne continuation.\n\n[Prénom]\n[Téléphone]`;
  return {
    subject: relanceNum === 1 ? `Suite -- renfort automatisme dispo` : `Dernier message -- automaticien freelance`,
    body,
  };
}

async function main() {
  const { loadProspectionTsv, saveProspectionTsv } = await import('./prospection-tsv.mjs');
  const PROSPECTION_FILE = join(ROOT, 'data', 'prospection.tsv');
  const { rows } = loadProspectionTsv(PROSPECTION_FILE);

  const profile = { outreach: { relance_j: 7, relance_max: 2 } };
  try {
    const yaml = (await import('js-yaml')).default;
    const p = yaml.load(readFileSync(join(ROOT, 'config', 'profile.yml'), 'utf-8'));
    profile.outreach = p.outreach || profile.outreach;
  } catch {}

  const relanceJ = Number(profile.outreach?.relance_j || 7);

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
    console.log(`[relance-scheduler] CRM mis à jour.`);
  }

  if (toRelance.length === 0) {
    console.log('[relance-scheduler] Rien à relancer aujourd\'hui.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2 : Ajouter le flag --subject/--body dans outreach-dispatch.mjs**

Dans `outreach-dispatch.mjs` `main()`, ajouter :
```js
const OVERRIDE_SUBJECT = getArg('--subject', null);
const OVERRIDE_BODY = getArg('--body', null);
```
Si ces flags sont présents, utiliser ces valeurs au lieu des générées par `subjectForRow` et `bodyForStage`.

- [ ] **Step 3 : Tester en dry-run**

```bash
node relance-scheduler.mjs --dry-run
```
Expected : liste des prospects à relancer (statut=envoye depuis >= 7 jours), sans envoi réel.

- [ ] **Step 4 : Vérifier le comportement si rien à relancer**

```bash
# Si tous les prospects sont récents, doit afficher "Rien à relancer"
node relance-scheduler.mjs --dry-run
```

- [ ] **Step 5 : Commit final**

```bash
git add relance-scheduler.mjs outreach-dispatch.mjs
git commit -m "feat: relance-scheduler -- relances J+7/J+14 automatiques"
```

---

## Task 14 : Test d'intégration complet + vérification pipeline

- [ ] **Step 1 : Dry-run pipeline complet**

```bash
node prospect-loop.mjs --mode=full --dry-run
```
Expected : toutes les étapes s'enchaînent sans erreur, output lisible.

- [ ] **Step 2 : Dry-run relances**

```bash
node prospect-loop.mjs --mode=relances --dry-run
```
Expected : liste des relances du jour.

- [ ] **Step 3 : Vérifier les tests existants**

```bash
node test-all.mjs
```
Expected : 63+ checks passent. Si des checks échouent à cause des modifications TSV, corriger les scripts concernés.

- [ ] **Step 4 : Vérifier pipeline consulting-ops**

```bash
node verify-pipeline.mjs
```
Expected : pipeline OK.

- [ ] **Step 5 : Commit de synthèse**

```bash
git add -A
git commit -m "feat: pipeline prospection intégrateurs complet -- dual-agent PrepAgent/ReviewAgent"
```

---

## Résumé des dépendances entre tâches

```
Task 1  (fix filtre)       → indépendant
Task 2  (prospection-tsv)  → indépendant, requis par Tasks 3, 10, 12, 13
Task 3  (outreach-dispatch) → requiert Task 2
Task 4  (nouveaux services) → indépendant
Task 5  (profile.yml)      → indépendant
Task 6  (lead-sources.yml) → indépendant
Task 7  (_profile.md)      → indépendant
Task 8  (prospection.md)   → indépendant
Task 9  (enrich-context)   → indépendant
Task 10 (TSV colonnes)     → requiert Task 2
Task 11 (LinkedIn)         → requiert Tasks 6, 10
Task 12 (prospect-loop)    → requiert Tasks 2, 3, 9, 11
Task 13 (relance-scheduler) → requiert Tasks 2, 3
Task 14 (tests)            → requiert toutes les tasks précédentes
```

**Parallélisable :** Tasks 1, 4, 5, 6, 7, 8, 9 peuvent être faites en parallèle.
**Séquentiel obligatoire :** Task 2 avant Tasks 3/10/12/13, Task 10 avant Task 11, Tasks 11+3 avant Task 12.
