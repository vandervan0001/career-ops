# Consulting-Ops : Adaptation de Career-Ops pour le freelance automation/pharma

**Date** : 2026-04-08
**Auteur** : Tai Van / Claude
**Statut** : Draft
**Base** : fork de vandervan0001/career-ops

---

## 1. Contexte & objectif

Career-Ops est un outil CLI propulsé par Claude Code qui automatise la recherche d'emploi (évaluation d'offres, génération de CVs, scanning de portails, tracking). L'objectif est de l'adapter intégralement pour **Vanguard Systems**, société de consulting senior en automation industrielle basée en Suisse romande.

### Profil consultant

- **Nom** : Tai Van
- **Société** : Vanguard Systems (Le Mont-sur-Lausanne)
- **Métier** : Ingénieur automation, chef de projet, expert OT
- **Industrie primaire** : Pharma / Life Sciences
- **Marché** : Suisse romande, TJM en CHF
- **Partenaire** : Eric Rouane (Senior Automation & Industrial IT, 20+ ans)
- **Certifications** : PMP, Lean Six Sigma Black Belt, CAS Cybersecurity, CAS AI
- **Stack** : Siemens (PCS7, WinCC, TIA Portal), Rockwell (ControlLogix, FactoryTalk, PlantPAx), Beckhoff, Emerson, OPC UA, Profinet, Ethernet/IP
- **Standards** : GAMP5, GxP, ISA-88, ISA-95, IEC 62443, 21 CFR Part 11
- **Références** : Merck, Novartis, Roche, Takeda, Sun Chemicals

### Modèle d'acquisition

- Réseau & bouche-à-oreille (principal)
- Intégrateurs & sociétés de services qui sous-traitent
- Scanning automatisé de portails (nouveau, à développer)

### Pain point

L'ensemble du processus de réponse à une opportunité prend trop de temps : évaluation du fit, adaptation du CV, rédaction de proposition, recherche client.

---

## 2. Archetypes

5 archetypes remplacent les 6 archetypes AI du repo original :

| # | Archetype | Signaux dans le mandat | Positionnement |
|---|-----------|----------------------|----------------|
| 1 | **Intégrateur Automation** | PLC, SCADA, migration, programmation, commissioning, FAT/SAT | Technique pur, multi-vendor Siemens/Rockwell |
| 2 | **Chef de Projet Automation** | Planning, coordination, budget, qualification, GAMP5, stakeholders | Pilotage, livrables, conformité réglementaire |
| 3 | **Expert OT / Infra industrielle** | Réseau industriel, cybersec OT, architecture, IEC 62443, segmentation | Conseil, audit, architecture réseau |
| 4 | **Architecte Solutions** | Intégration systèmes, MES, data, plateforme, migration globale | Vision transverse, design technique |
| 5 | **Consultant Applied AI** | IA, machine learning, agents, RAG, optimisation process, data science | IA appliquée en contexte industriel |

Un mandat peut correspondre à plusieurs archetypes. L'archetype primaire détermine le framing du CV et de la proposition.

---

## 3. Scoring des mandats

10 dimensions, chacune notée 1-5, moyenne pondérée :

| # | Dimension | Description | Poids |
|---|-----------|-------------|-------|
| 1 | **Fit technique** | Adéquation stack/compétences avec les exigences du mandat | 20% |
| 2 | **Archetype match** | Le rôle demandé correspond à un des 5 archetypes | 15% |
| 3 | **TJM / Budget** | Tarif journalier vs marché, budget confirmé ou non | 15% |
| 4 | **Durée & volume** | Longueur du mandat, potentiel de récurrence | 10% |
| 5 | **Localisation** | Proximité géographique, contraintes de déplacement | 10% |
| 6 | **Client / Réputation** | Notoriété du client, historique de paiement, référence portfolio | 10% |
| 7 | **Potentiel commercial** | Porte d'entrée chez un grand compte, upsell possible | 5% |
| 8 | **Conformité réglementaire** | Environnement GMP/GxP = forte valeur ajoutée de Vanguard | 5% |
| 9 | **Autonomie & cadre** | Contact direct client vs chaîne de sous-traitance | 5% |
| 10 | **Red flags** | Scope flou, intermédiaires multiples, paiement à 90j, etc. | 5% |

### Seuils de décision

| Score | Action |
|-------|--------|
| **4.5+** | Priorité absolue, répondre immédiatement |
| **4.0-4.4** | Très bon, à poursuivre activement |
| **3.5-3.9** | Correct, seulement si le pipeline est calme |
| **< 3.5** | Passer, sauf raison stratégique explicite |

---

## 4. Pipeline & Statuts

### Cycle de vie d'une opportunité

```
Identifié → Évalué → Qualifié → Proposition → Discussion → Signé → En cours → Terminé
                                                              ↘ Perdu
                 ↘ SKIP
```

### Statuts canoniques

| Statut | Description | Ancien équivalent |
|--------|-------------|-------------------|
| `identifie` | Opportunité repérée, pas encore analysée | — |
| `evalue` | Scoring fait, report généré | Evaluated |
| `qualifie` | Décision de poursuivre, premier contact établi | Applied |
| `proposition` | CV adapté et/ou offre envoyée | — |
| `discussion` | Échanges en cours, négociation TJM | Interview |
| `signe` | Mandat confirmé, PO/contrat reçu | Offer |
| `en_cours` | Mission active | — |
| `termine` | Mission livrée | — |
| `perdu` | Pas retenu ou abandonné | Rejected |
| `skip` | Pas intéressant après évaluation | Discarded |

### Fichier tracker : `data/mandats.md`

```markdown
| # | Date | Client | Mandat | Score | Statut | PDF | Report | TJM | Notes |
|---|------|--------|--------|-------|--------|-----|--------|-----|-------|
| 001 | 2026-04-08 | Novartis | Migration PCS7 Bâle | 4.2/5 | qualifie | [PDF](output/...) | [001](reports/...) | 1200 | Via Brunel |
```

### Pipeline inbox : `data/pipeline.md`

Même format que l'original :

```markdown
## Pendientes
- [ ] <url_ou_description> [| Client | Mandat]

## Procesadas
- [x] #NNN | URL | Client | Mandat | Score/5 | PDF
```

---

## 5. Modes / Skills

### 14 modes adaptés

| Mode | Fichier | Trigger | Input | Output |
|------|---------|---------|-------|--------|
| **auto-pipeline** | `modes/auto-pipeline.md` | User forwarde un mandat | URL/texte du mandat | Report + CV adapté + ligne tracker |
| **mandat** | `modes/mandat.md` | "Évalue ce mandat" | Cahier des charges / JD | Report 6 blocs (A-F) + score 1-5 |
| **mandats** | `modes/mandats.md` | "Compare ces mandats" | N mandats | Classement comparatif pondéré |
| **cv** | `modes/cv.md` | "Adapte mon CV" | Mandat + cv.md | CV technique PDF personnalisé |
| **proposition** | `modes/proposition.md` | "Prépare une proposition" | Mandat + profil | Offre technique + commerciale PDF |
| **scan** | `modes/scan.md` | "Cherche des mandats" | portals.yml | Nouvelles opportunités → pipeline.md |
| **batch** | `modes/batch.md` | "Traite le pipeline" | N URLs/descriptions | N reports + CVs en parallèle |
| **pipeline** | `modes/pipeline.md` | "Montre le pipeline" | pipeline.md | Traitement des entrées pendantes |
| **client** | `modes/client.md` | "Recherche ce client" | Nom entreprise | Dossier client (installé base, projets, contacts) |
| **contact** | `modes/contact.md` | "Trouve le décideur" | Entreprise | LinkedIn prospecting + message d'approche |
| **tracker** | `modes/tracker.md` | "État des mandats" | mandats.md | Tableau formaté + statistiques |
| **prepare** | `modes/prepare.md` | "Prépare l'entretien" | Mandat + client | Framework discussion, pricing, questions discovery |
| **veille** | `modes/veille.md` | "Veille techno/marché" | Sujet | Synthèse marché suisse automation/pharma |
| **projet** | `modes/projet.md` | "Évalue cette idée" | Idée side project | Fit portfolio + faisabilité |

### Blocs d'évaluation (A-F)

Chaque évaluation de mandat produit un report structuré en 6 blocs :

| Bloc | Contenu |
|------|---------|
| **A) Résumé mandat** | Tableau : archetype(s), client, secteur, durée estimée, localisation, remote, taille équipe, TL;DR |
| **B) Fit technique** | Mapping exigences du mandat ↔ compétences Vanguard, identification des gaps, plan de mitigation |
| **C) Positionnement** | Comment se vendre : intégrateur, PM, ou double casquette. Framing adapté à l'archetype. Référence aux proof points pertinents |
| **D) Marché & TJM** | WebSearch tarifs marché suisse pour le type de mandat, benchmark TJM, stratégie de pricing |
| **E) Plan de personnalisation** | 5 adaptations CV + message d'approche personnalisé pour ce mandat |
| **F) Préparation client** | Questions discovery à poser, points de négociation (TJM, durée, périmètre), red flags identifiés sur le client |

---

## 6. Portal Scanning

### Sources configurées dans `portals.yml`

**Portails généralistes suisses :**

| Source | Méthode | Requêtes type |
|--------|---------|---------------|
| jobs.ch | WebSearch `site:jobs.ch` | "automation pharma Suisse romande", "chef de projet automation Vaud" |
| jobup.ch | WebSearch `site:jobup.ch` | "ingénieur automation PLC", "OT cybersecurity" |
| Indeed CH | WebSearch `site:indeed.ch` | "automation pharma freelance", "chef de projet industriel" |
| LinkedIn Jobs | WebSearch `site:linkedin.com/jobs` | "automation engineer pharma Switzerland contract" |

**Plateformes freelance :**

| Source | Méthode | Requêtes type |
|--------|---------|---------------|
| Malt | WebSearch `site:malt.ch` | "automation industrielle Suisse" |
| Freelance.ch | WebSearch `site:freelance.ch` | "automation OT pharma" |

**Cabinets de recrutement / intégrateurs :**

| Source | Méthode | Requêtes type |
|--------|---------|---------------|
| Hays CH | WebSearch `site:hays.ch` | "automation contractor pharma" |
| Michael Page CH | WebSearch `site:michaelpage.ch` | "ingénieur automation" |
| Brunel | WebSearch `site:brunel.net` | "automation pharma Switzerland" |

**Intégrateurs pharma (careers pages directes) :**

| Source | URL type |
|--------|----------|
| Jacobs / Worley | careers page |
| Exyte | careers page |
| NNE | careers page |
| Boccard | careers page |
| Chrono.ch | careers page |

### Filtrage des titres

```yaml
title_filter:
  positive:
    - automation
    - automate
    - automatisation
    - PLC
    - SCADA
    - DCS
    - OT
    - "chef de projet"
    - "project manager"
    - commissioning
    - qualification
    - pharma
    - GMP
    - "ingénieur système"
    - "systems engineer"
    - "control system"
    - MES
    - cybersécurité industrielle
  negative:
    - stage
    - stagiaire
    - apprenti
    - apprentissage
    - junior
    - "développeur web"
    - marketing
    - RH
    - "ressources humaines"
    - comptable
    - commercial
    - vente
  seniority_boost:
    - senior
    - lead
    - principal
    - expert
    - architect
    - manager
```

---

## 7. Génération de documents

### 7.1 CV Technique (adapté par mandat)

Réutilise le pipeline existant : extraction keywords JD → personnalisation → template HTML → Playwright → PDF.

**Sections du CV :**
1. En-tête avec branding Vanguard Systems (logo, coordonnées)
2. Profil / résumé (réécrit avec les keywords du mandat)
3. Compétences techniques (grille : PLC, SCADA, réseaux, standards, outils)
4. Expériences projets clés (réordonnées par pertinence au mandat, max 5-6)
5. Certifications (PMP, LSSBB, CAS Cyber, CAS AI)
6. Formation
7. Langues

**Règles :**
- Détection langue FR/EN/DE selon le mandat
- Format A4 (marché suisse)
- ATS-optimisé (pas de colonnes multiples, texte sélectionnable)
- Ne jamais inventer de compétences ou de métriques

### 7.2 Proposition commerciale (nouveau mode)

Template HTML dédié, généré via Playwright → PDF.

**Sections :**
1. Page de garde (logo Vanguard, titre du mandat, client, date)
2. Contexte & compréhension du besoin (reformulation du cahier des charges)
3. Approche proposée (méthodologie, phases)
4. Livrables & planning indicatif
5. Profil(s) proposé(s) (résumé du/des consultants)
6. Conditions commerciales (TJM, estimation volume, modalités de facturation)
7. Références pertinentes (2-3 proof points sélectionnés)
8. Conditions générales (mention, pas le détail complet)

**Règles :**
- Généré uniquement via le mode `proposition`
- Branding Vanguard Systems cohérent avec le CV
- Langue adaptée au client

---

## 8. Dashboard Go

Adaptations minimales du dashboard TUI existant :

### Changements

| Élément | Avant | Après |
|---------|-------|-------|
| Fichier source | `data/applications.md` | `data/mandats.md` |
| Tabs de filtre | All, Evaluated, Applied, Interview, Top≥4, No Aplicar | **Tous, Évalués, Qualifiés, Discussion, Signés, Top≥4, SKIP** |
| Colonnes | #, Date, Empresa, Rol, Score, Estado, PDF, Report, Notes | **#, Date, Client, Mandat, Score, Statut, PDF, Report, TJM, Notes** |
| Statuts picker | Evaluated, Applied, Responded, Interview, Offer, Rejected, Discarded, SKIP | Les 10 statuts canoniques de la section 4 |
| Thème | Catppuccin Mocha (inchangé) | Idem |

### Ce qui ne change pas
- Architecture Go + Bubble Tea + Lipgloss
- Report viewer markdown
- Tri par score/date/client/statut
- Vue groupée/plate
- Ouverture URL dans le navigateur
- Resize fenêtre

---

## 9. Fichiers à modifier

### Fichiers de configuration (User Layer)
- `config/profile.yml` — réécrire entièrement (profil Vanguard)
- `cv.md` — réécrire (CV canonique Tai Van)
- `portals.yml` — réécrire (sources suisses)
- `modes/_profile.md` — réécrire (archetypes ↔ proof points Vanguard)

### Modes (System Layer)
- `modes/_shared.md` — réécrire (scoring, archetypes, règles globales)
- `modes/auto-pipeline.md` → adapter (offre → mandat)
- `modes/oferta.md` → renommer `modes/mandat.md` + réécrire blocs A-F
- `modes/ofertas.md` → renommer `modes/mandats.md` + adapter
- `modes/pdf.md` → renommer `modes/cv.md` + adapter
- `modes/scan.md` → adapter (portails suisses)
- `modes/batch.md` → adapter (terminologie)
- `modes/pipeline.md` → adapter (statuts)
- `modes/contacto.md` → renommer `modes/contact.md` + adapter (décideurs vs recruteurs)
- `modes/deep.md` → renommer `modes/client.md` + adapter (recherche client)
- `modes/tracker.md` → adapter (mandats.md, colonnes)
- `modes/training.md` → renommer `modes/veille.md` + réécrire
- `modes/project.md` → renommer `modes/projet.md` + adapter
- `modes/apply.md` → renommer `modes/proposition.md` + réécrire (nouveau)
- `modes/prepare.md` — nouveau mode (préparation entretien client)
- Supprimer variantes `modes/de/` et `modes/fr/` (on travaille en FR par défaut, EN si nécessaire)

### Templates
- `templates/cv-template.html` → adapter (branding Vanguard, sections consulting)
- `templates/proposal-template.html` — nouveau (proposition commerciale)
- `templates/states.yml` → réécrire (10 statuts canoniques)

### Scripts Node.js
- `merge-tracker.mjs` → adapter (mandats.md au lieu de applications.md)
- `verify-pipeline.mjs` → adapter
- `normalize-statuses.mjs` → adapter (nouveaux statuts)
- `dedup-tracker.mjs` → adapter
- `generate-pdf.mjs` → adapter (A4 par défaut)

### Dashboard Go
- `dashboard/internal/data/career.go` → adapter parsing mandats.md
- `dashboard/internal/model/career.go` → adapter structures (TJM, nouveaux statuts)
- `dashboard/internal/ui/screens/pipeline.go` → adapter tabs, colonnes
- Autres fichiers dashboard : changements cosmétiques

### CLAUDE.md
- Réécrire entièrement pour refléter le contexte Consulting-Ops

### Batch
- `batch/batch-prompt.md` → adapter (terminologie, scoring, archetypes)

---

## 10. Ce qui est hors scope (v1)

- Intégration CRM (HubSpot, Pipedrive, etc.)
- Facturation / suivi financier
- Intégration calendrier
- Multi-consultant (Eric Rouane a son propre profil — v2)
- Application mobile
- Internationalisation au-delà de FR/EN
