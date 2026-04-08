# Consulting-Ops Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform career-ops (job search tool) into consulting-ops (freelance automation consulting pipeline for Vanguard Systems, Swiss pharma market).

**Architecture:** Fork of vandervan0001/career-ops. Replace all job-search terminology, archetypes, and scoring with freelance consulting equivalents. Adapt all 14 modes, templates, scripts, dashboard, and CLAUDE.md. French-first, English when needed.

**Tech Stack:** Node.js (mjs), Go + Bubble Tea (dashboard TUI), Playwright (PDF generation), HTML/CSS (templates), YAML (config), Markdown (data + modes)

**Spec:** `docs/superpowers/specs/2026-04-08-consulting-ops-design.md`

---

## Chunk 1: Foundation — Config, States, Data Structures

### Task 1.1: Rewrite `templates/states.yml`

**Files:**
- Modify: `templates/states.yml`

- [ ] **Step 1: Read the existing states.yml**

Read `templates/states.yml` to understand the format.

- [ ] **Step 2: Replace content with new consulting statuses**

```yaml
# Consulting-Ops — Canonical States
# Source of truth for consulting-ops (writer) and dashboard (reader).
# Both systems MUST use these exact states.
#
# Rule: The status field in mandats.md must contain EXACTLY
# one of these values (case-insensitive). No markdown bold (**),
# no dates, no extra text. Dates go in the date column.

states:
  - id: identifie
    label: "Identifié"
    aliases: [identified, nouveau]
    description: "Opportunité repérée, pas encore analysée"
    dashboard_group: identifie

  - id: evalue
    label: "Évalué"
    aliases: [evaluated, evaluada, evaluée]
    description: "Scoring fait, report généré"
    dashboard_group: evalue

  - id: qualifie
    label: "Qualifié"
    aliases: [qualified, qualifiée]
    description: "Décision de poursuivre, premier contact établi"
    dashboard_group: qualifie

  - id: proposition
    label: "Proposition"
    aliases: [proposed, proposé, offre_envoyée]
    description: "CV adapté et/ou offre commerciale envoyée"
    dashboard_group: proposition

  - id: discussion
    label: "Discussion"
    aliases: [interview, entretien, négociation]
    description: "Échanges en cours, négociation TJM"
    dashboard_group: discussion

  - id: signe
    label: "Signé"
    aliases: [signed, contrat, confirmé]
    description: "Mandat confirmé, PO/contrat reçu"
    dashboard_group: signe

  - id: en_cours
    label: "En cours"
    aliases: [active, en cours, actif]
    description: "Mission active"
    dashboard_group: en_cours

  - id: termine
    label: "Terminé"
    aliases: [completed, terminé, fini, livré]
    description: "Mission livrée"
    dashboard_group: termine

  - id: perdu
    label: "Perdu"
    aliases: [lost, rejected, rechazado, refusé]
    description: "Pas retenu ou abandonné"
    dashboard_group: perdu

  - id: skip
    label: "SKIP"
    aliases: [no_aplicar, skip, passer, pas_intéressant]
    description: "Pas intéressant après évaluation"
    dashboard_group: skip
```

- [ ] **Step 3: Commit**

```bash
git add templates/states.yml
git commit -m "feat: replace job statuses with consulting pipeline statuses"
```

### Task 1.2: Create `config/profile.yml`

**Files:**
- Create: `config/profile.yml`
- Reference: `config/profile.example.yml` (for format)

- [ ] **Step 1: Read the example profile**

Read `config/profile.example.yml` for the existing format.

- [ ] **Step 2: Write the Vanguard Systems profile**

Create `config/profile.yml` with the full consulting profile as defined in the spec Section 1 — consultant info, service_offering, tech_stack, industries, project_types, engagement_models, pricing, location, narrative with proof_points, partner info. Use the YAML structure from the spec's "Profil (config/profile.yml) — rempli" section exactly.

Key fields:
- `consultant` (not `candidate`): full_name "Tai Van", company_name "Vanguard Systems", email "contact@vanguard-systems.ch", phone "+41 79 172 08 08", location "Le Mont-sur-Lausanne, Suisse", linkedin, portfolio_url "https://vanguard-systems.ch"
- `certifications`: PMP, LSSBB, CAS Cybersecurity, CAS AI
- `service_offering.primary_roles`: 5 roles (intégrateur, chef de projet, expert OT, architecte solutions, consultant AI)
- `service_offering.tech_stack`: siemens, rockwell, other_plc, networks_ot, data_ai, standards, mes_scada
- `pricing`: model TJM, currency CHF, range "[à définir]"
- `narrative.proof_points`: Merck, Novartis, Roche, Takeda, Sun Chemicals with exact metrics from vanguard-systems.ch
- `partner`: Eric Rouane

- [ ] **Step 3: Commit**

```bash
git add config/profile.yml
git commit -m "feat: add Vanguard Systems consulting profile"
```

### Task 1.3: Create data files and directories

**Files:**
- Create: `data/mandats.md`
- Create: `data/pipeline.md`
- Create: `output/propositions/.gitkeep`

- [ ] **Step 1: Create mandats.md tracker**

```markdown
# Mandats Tracker

| # | Date | Client | Mandat | Score | Statut | PDF | Report | TJM | Notes |
|---|------|--------|--------|-------|--------|-----|--------|-----|-------|
```

- [ ] **Step 2: Create pipeline.md**

```markdown
# Pipeline

## En attente
<!-- Ajoutez des URLs ou descriptions de mandats ici -->

## Traitées
<!-- Les mandats traités apparaissent ici automatiquement -->
```

- [ ] **Step 3: Create output/propositions directory**

```bash
mkdir -p output/propositions
touch output/propositions/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add data/mandats.md data/pipeline.md output/propositions/.gitkeep
git commit -m "feat: add consulting tracker and pipeline data files"
```

### Task 1.4: Create portals.yml (Swiss automation/pharma)

**Files:**
- Modify: `templates/portals.example.yml` (rewrite)
- Create: `portals.yml` (instance)

- [ ] **Step 1: Rewrite templates/portals.example.yml**

Replace the entire content with Swiss freelance/automation/pharma sources. Include:

**title_filter:**
- positive: automation, automate, automatisation, PLC, SCADA, DCS, OT, "chef de projet", "project manager", commissioning, qualification, pharma, GMP, "ingénieur système", "systems engineer", "control system", MES, "cybersécurité industrielle", "Projektleiter", "Automatisierung", Siemens, Rockwell, WinCC, PCS7, "TIA Portal"
- negative: stage, stagiaire, apprenti, apprentissage, junior, "développeur web", marketing, RH, "ressources humaines", comptable, commercial, vente, Praktikum, Ausbildung
- seniority_boost: senior, lead, principal, expert, architect, manager, Experte

**search_queries:** (all with `enabled: true`)
- jobs.ch: "automation pharma Suisse romande", "chef de projet automation Vaud", "ingénieur automation PLC Suisse"
- jobup.ch: "ingénieur automation PLC", "OT cybersecurity Suisse"
- indeed.ch: "automation pharma freelance Suisse", "chef de projet industriel Vaud"
- linkedin.com/jobs: "automation engineer pharma Switzerland contract", "project manager automation pharma Swiss"
- malt.ch: "automation industrielle Suisse"
- freelance.ch: "automation OT pharma"
- hays.ch: "automation contractor pharma"
- michaelpage.ch: "ingénieur automation"
- brunel.net: "automation pharma Switzerland"

**tracked_companies:** (Swiss pharma/engineering intégrateurs)
- Jacobs: careers_url, notes "Engineering pharma, projets CH"
- Exyte: careers_url, notes "Pharma cleanroom engineering"
- NNE: careers_url, notes "Pharma engineering (Novo Nordisk)"
- Boccard: careers_url, notes "Sous-traitance industrielle pharma"
- Yokogawa: careers_url, notes "DCS/SCADA pharma"
- Endress+Hauser: careers_url, notes "Instrumentation, Reinach BL"
- Bürkert: careers_url, notes "Fluid control systems"
- Lonza: careers_url, notes "Pharma CDMO, Visp/Basel"
- Novartis: careers_url, notes "Big pharma, Basel/Stein"
- Roche: careers_url, notes "Big pharma, Basel/Kaiseraugst"
- Merck: careers_url, notes "Pharma, Corsier-sur-Vevey"
- Takeda: careers_url, notes "Pharma, Neuchâtel"
- UCB: careers_url, notes "Biopharma, Bulle"

For each tracked company, look up the actual careers URL using WebSearch and set `scan_method: websearch` with appropriate scan_query.

- [ ] **Step 2: Copy to portals.yml**

```bash
cp templates/portals.example.yml portals.yml
```

- [ ] **Step 3: Commit**

```bash
git add templates/portals.example.yml portals.yml
git commit -m "feat: add Swiss pharma/automation portal scanning config"
```

---

## Chunk 2: Core Modes — _shared.md, _profile, mandat, mandats

### Task 2.1: Rewrite `modes/_shared.md`

**Files:**
- Modify: `modes/_shared.md`

- [ ] **Step 1: Read existing _shared.md**

Read `modes/_shared.md` for the format and structure.

- [ ] **Step 2: Rewrite entirely for Consulting-Ops**

Replace ALL content. Key sections to include:

**Header:** `# System Context -- consulting-ops`

**Sources of Truth:**
| File | Path | When |
| cv.md | project root | ALWAYS |
| profile.yml | config/profile.yml | ALWAYS |
| _profile.md | modes/_profile.md | ALWAYS |

**Scoring System** (10 dimensions, weighted average 1-5):
1. Fit technique (20%) — stack/compétences vs exigences
2. Archetype match (15%) — rôle demandé vs 5 archetypes
3. TJM / Budget (15%) — tarif journalier vs marché
4. Durée & volume (10%) — longueur, récurrence
5. Localisation (10%) — proximité géographique
6. Client / Réputation (10%) — notoriété, historique paiement
7. Potentiel commercial (5%) — porte d'entrée, upsell
8. Conformité réglementaire (5%) — GMP/GxP = forte VA
9. Autonomie & cadre (5%) — contact direct vs sous-traitance
10. Red flags (5%) — scope flou, intermédiaires, paiement 90j

**Score interpretation:**
- 4.5+ → Priorité absolue
- 4.0-4.4 → Très bon, poursuivre
- 3.5-3.9 → Correct si pipeline calme
- <3.5 → Passer sauf raison stratégique

**Relation scoring ↔ report:** (from spec Section 3)

**Archetype Detection** (5 archetypes):
| Archetype | Key signals |
| Intégrateur Automation | PLC, SCADA, migration, programmation, commissioning, FAT/SAT |
| Chef de Projet Automation | Planning, coordination, budget, qualification, GAMP5, stakeholders |
| Expert OT / Infra industrielle | Réseau industriel, cybersec OT, architecture, IEC 62443 |
| Architecte Solutions | Intégration systèmes, MES, data, plateforme, migration globale |
| Consultant Applied AI | IA, ML, agents, RAG, optimisation process, data science |

**Global Rules:**

NEVER:
1. Inventer des compétences ou métriques
2. Modifier cv.md ou portfolio
3. Envoyer des propositions sans validation utilisateur
4. Partager le numéro de téléphone dans les messages générés
5. Recommander un TJM sous le marché
6. Générer un PDF sans lire le cahier des charges
7. Utiliser du corporate-speak
8. Ignorer le tracker (chaque mandat évalué doit être enregistré)

ALWAYS:
1. Lire cv.md, _profile.md, config/profile.yml avant d'évaluer
2. Première évaluation de session: `node cv-sync-check.mjs`
3. Détecter l'archetype et adapter le framing
4. Citer les lignes exactes du CV
5. WebSearch pour TJM et données client
6. Enregistrer dans le tracker après évaluation
7. Générer en français (ou langue du mandat si EN/DE)
8. Être direct et actionnable
9. Tracker additions en TSV — JAMAIS éditer mandats.md directement
10. Inclure `**URL:**` dans chaque header de report

**Tools** table (same as original but replace applications.md → mandats.md)

**Professional Writing rules** (same as original but adapted: French first, pharma/automation vocabulary)

**TSV Format:** 10 columns (num, date, client, mandat, statut, score/5, pdf_emoji, report_link, tjm, notes)

**Pipeline Integrity:** Same rules but mandats.md, new canonical states

**Canonical States:** Reference templates/states.yml with the 10 new statuses

- [ ] **Step 3: Commit**

```bash
git add modes/_shared.md
git commit -m "feat: rewrite _shared.md for consulting-ops scoring and archetypes"
```

### Task 2.2: Rewrite `modes/_profile.template.md` and create `modes/_profile.md`

**Files:**
- Modify: `modes/_profile.template.md`
- Create: `modes/_profile.md`

- [ ] **Step 1: Rewrite the template**

Replace all content with Vanguard Systems framing:

**Your Target Roles:** Table with 5 archetypes (Intégrateur, Chef de Projet, Expert OT, Architecte Solutions, Consultant AI) with thematic axes and "what they buy"

**Your Adaptive Framing:** Map Vanguard proof points to each archetype:
- Intégrateur → Merck modernisation (+20% efficacité), Takeda Fill&Finish (zéro déviation)
- Chef de Projet → Novartis plateforme digitale (ROI année 1), Takeda (on-schedule)
- Expert OT → Merck énergie (-30%), cybersec IEC 62443
- Architecte Solutions → Novartis (+50% visibilité), Sun Chemicals (-60% temps)
- Consultant AI → Roche optimisation IA (-15% énergie), chatbot maintenance (90% adoption)

**Your Company Pitch:** "Réseau de consultants seniors. Exécution hands-on dans des environnements critiques et réglementés. Pas de juniors, pas de frameworks génériques."

**Your TJM Strategy:** WebSearch tarifs marché suisse, benchmark par type de mandat, stratégie de pricing

**Your Negotiation Scripts:** Adapted for freelance (TJM, durée, exclusivité, conditions de paiement)

**Your Location Policy:** Suisse romande, arc lémanique, déplacements ponctuels

- [ ] **Step 2: Copy to _profile.md**

```bash
cp modes/_profile.template.md modes/_profile.md
```

- [ ] **Step 3: Commit**

```bash
git add modes/_profile.template.md modes/_profile.md
git commit -m "feat: add Vanguard Systems consulting profile template"
```

### Task 2.3: Create `modes/mandat.md` (evaluation mode)

**Files:**
- Create: `modes/mandat.md`
- Delete: `modes/oferta.md` (after creating replacement)

- [ ] **Step 1: Write modes/mandat.md**

This is the core evaluation mode. Structure based on the spec Section 5 blocs A-F, adapted from `modes/oferta.md` but completely rewritten in French for consulting context:

**Paso 0 → Étape 0 — Détection d'archetype:** Classify into 1-2 of the 5 archetypes. Determines proof points to prioritize.

**Bloc A — Résumé du mandat:** Table with archetype(s), client, secteur, durée estimée, localisation, remote/onsite, taille équipe, TL;DR

**Bloc B — Fit technique:** Read cv.md. Map each requirement to CV lines. Identify gaps with mitigation (adapted per archetype). For each gap: hard blocker or nice-to-have? Adjacent experience? Portfolio project? Mitigation plan.

**Bloc C — Positionnement:** How to sell (intégrateur, PM, double casquette). Framing adapted to archetype. Reference relevant proof points. Positioning statements from _profile.md.

**Bloc D — Marché & TJM:** WebSearch for Swiss market rates for this type of mandate. Benchmark TJM by archetype. Pricing strategy (daily rate, volume estimation).

**Bloc E — Plan de personnalisation:** 5 CV adaptations + personalized approach message for this mandate.

**Bloc F — Préparation client:** Discovery questions, negotiation points (TJM, duration, scope), red flags on client.

**Post-évaluation:**
1. Save report to `reports/{###}-{client-slug}-{YYYY-MM-DD}.md`
2. Register in tracker via TSV in `batch/tracker-additions/`
3. Report format with header: Évaluation: {Client} — {Mandat}, Date, Archetype, Score, PDF, URL

- [ ] **Step 2: Delete modes/oferta.md**

```bash
git rm modes/oferta.md
```

- [ ] **Step 3: Commit**

```bash
git add modes/mandat.md
git commit -m "feat: add mandat evaluation mode (replaces oferta.md)"
```

### Task 2.4: Create `modes/mandats.md` (comparison mode)

**Files:**
- Create: `modes/mandats.md`
- Delete: `modes/ofertas.md`

- [ ] **Step 1: Write modes/mandats.md**

Adapted from ofertas.md. 10-dimension scoring matrix using the consulting scoring dimensions from _shared.md:

| Dimension | Poids | Critères 1-5 |
| Fit technique | 20% | 5=pile dans la stack, 1=hors compétences |
| Archetype match | 15% | 5=archetype primaire exact, 1=rôle flou |
| TJM / Budget | 15% | 5=au-dessus du marché, 1=sous le marché |
| Durée & volume | 10% | 5=3-12 mois récurrence, 1=one-shot <1 sem |
| Localisation | 10% | 5=Suisse romande, 1=international déplacement lourd |
| Client / Réputation | 10% | 5=big pharma référence, 1=inconnu |
| Potentiel commercial | 5% | 5=porte d'entrée grand compte, 1=mission isolée |
| Conformité réglementaire | 5% | 5=GMP/GxP, 1=non réglementé |
| Autonomie & cadre | 5% | 5=contact direct, 1=sous-traitance x3 |
| Red flags | 5% | 5=aucun, 1=scope flou multiples intermédiaires |

Ranking final + recommendation with prioritization.

- [ ] **Step 2: Delete modes/ofertas.md**

```bash
git rm modes/ofertas.md
```

- [ ] **Step 3: Commit**

```bash
git add modes/mandats.md
git commit -m "feat: add mandats comparison mode (replaces ofertas.md)"
```

---

## Chunk 3: Pipeline Modes — auto-pipeline, pipeline, scan, batch

### Task 3.1: Adapt `modes/auto-pipeline.md`

**Files:**
- Modify: `modes/auto-pipeline.md`

- [ ] **Step 1: Read and rewrite**

Translate to French and adapt terminology:
- "oferta" → "mandat"
- "candidato" → "consultant"
- "JD" → "cahier des charges / description de mandat"
- Step 1: Évaluation A-F (reference modes/mandat.md)
- Step 2: Save report
- Step 3: Generate CV PDF (reference modes/cv.md)
- Step 4: Draft approach message (only if score >= 4.5) — NOT form answers, but a personalized email/message
- Step 5: Update tracker (mandats.md via TSV)
- Step 0: JD extraction stays the same (Playwright/WebFetch/WebSearch)

Adapt the "tono" section for consulting:
- Position: "Je choisis mes mandats" — not desperate
- Confident: "J'ai livré [X] chez [client] — votre projet est dans mes cordes"
- Specific: Reference real project/metric from cv.md
- Direct: 2-4 phrases, no fluff

- [ ] **Step 2: Commit**

```bash
git add modes/auto-pipeline.md
git commit -m "feat: adapt auto-pipeline mode for consulting mandates"
```

### Task 3.2: Adapt `modes/pipeline.md`

**Files:**
- Modify: `modes/pipeline.md`

- [ ] **Step 1: Rewrite**

- "Pendientes" → "En attente"
- "Procesadas" → "Traitées"
- "applications.md" → "mandats.md"
- "ofertas" → "mandats"
- Score threshold for PDF: >= 3.0 (keep same)
- Reference modes/mandat.md instead of modes/oferta.md
- cv-sync-check.mjs reference stays

- [ ] **Step 2: Commit**

```bash
git add modes/pipeline.md
git commit -m "feat: adapt pipeline mode for consulting"
```

### Task 3.3: Adapt `modes/scan.md`

**Files:**
- Modify: `modes/scan.md`

- [ ] **Step 1: Rewrite**

Translate to French and adapt:
- "ofertas" → "mandats"
- "applications.md" → "mandats.md"
- "pipeline.md" sections: "En attente" / "Traitées"
- Portal strategy remains 3 levels (Playwright, API, WebSearch) — valid for Swiss portals
- Remove Greenhouse API level (not relevant for Swiss portals, mostly WebSearch)
- Title filter references `portals.yml` (now contains Swiss automation keywords)
- Scan history format stays the same
- Summary output in French

- [ ] **Step 2: Commit**

```bash
git add modes/scan.md
git commit -m "feat: adapt scan mode for Swiss freelance portals"
```

### Task 3.4: Adapt `modes/batch.md`

**Files:**
- Modify: `modes/batch.md`

- [ ] **Step 1: Rewrite**

Translate to French and adapt:
- "ofertas" → "mandats"
- "applications.md" → "mandats.md"
- Worker produces: Report .md, PDF, tracker TSV (10 columns including TJM)
- batch-prompt.md reference stays
- Architecture diagram: replace "Oferta" → "Mandat"

- [ ] **Step 2: Commit**

```bash
git add modes/batch.md
git commit -m "feat: adapt batch mode for consulting"
```

---

## Chunk 4: Tool Modes — cv, proposition, contact, client, prepare, veille, projet, tracker

### Task 4.1: Create `modes/cv.md` (replaces pdf.md)

**Files:**
- Create: `modes/cv.md`
- Delete: `modes/pdf.md`

- [ ] **Step 1: Write modes/cv.md**

Based on pdf.md but adapted:
- Title: `# Mode: cv — Génération de CV Technique Personnalisé`
- French throughout
- "candidato" → "consultant"
- Paper format: ALWAYS A4 (Swiss market)
- Language: FR default, EN if mandate is in English
- Sections: Header (Vanguard branding), Profil/résumé, Compétences techniques (grille), Expériences projets clés (max 5-6, reordered by relevance), Certifications, Formation, Langues
- Remove Canva CV section (not needed)
- Template: `templates/cv-template.html`
- Output: `output/cv-vanguard-{client}-{YYYY-MM-DD}.pdf`
- Keyword injection strategy: same ethical approach but with pharma/automation vocabulary
- Remove "exit narrative bridge" — replace with "Vanguard positioning": "Réseau de consultants seniors. [archetype]-specific framing"
- Add competency grid with pharma/automation keywords from the mandate

- [ ] **Step 2: Delete modes/pdf.md**

```bash
git rm modes/pdf.md
```

- [ ] **Step 3: Commit**

```bash
git add modes/cv.md
git commit -m "feat: add cv mode for consulting CV generation (replaces pdf.md)"
```

### Task 4.2: Create `modes/proposition.md` (new mode)

**Files:**
- Create: `modes/proposition.md`
- Delete: `modes/apply.md`

- [ ] **Step 1: Write modes/proposition.md**

New mode as specified in spec Section 5 "Mode proposition":

```markdown
# Mode: proposition — Génération de Proposition Commerciale

## Input
- Report d'évaluation existant (blocs A-F) OU cahier des charges brut
- cv.md (profil consultant)
- config/profile.yml (proof points, pricing)

## Process
1. Lire le report d'évaluation (ou en générer un si absent via mode mandat)
2. Identifier l'archetype primaire et les proof points pertinents
3. Reformuler le besoin client (montrer compréhension)
4. Structurer l'approche technique (phases, méthodologie)
5. Estimer le volume (jours) et le planning
6. Sélectionner 2-3 références projets les plus pertinentes
7. Générer le HTML via templates/proposal-template.html
8. Convertir en PDF via generate-pdf.mjs

## Sections de la proposition
1. Page de garde (logo Vanguard, titre mandat, client, date)
2. Contexte & compréhension du besoin
3. Approche proposée (méthodologie, phases)
4. Livrables & planning indicatif
5. Profil(s) proposé(s) (résumé consultant)
6. Conditions commerciales (TJM si demandé, estimation volume, modalités facturation)
7. Références pertinentes (2-3 proof points sélectionnés)
8. Conditions générales (mention, pas le détail)

## Output
- PDF dans output/propositions/{num}-{client-slug}-proposition.pdf
- NE MET PAS à jour le tracker

## Règles
- JAMAIS inventer de métriques ou références
- TOUJOURS lire cv.md et config/profile.yml
- Langue adaptée au client (FR default, EN si mandat EN)
- TJM NON affiché sauf demande explicite
- Branding Vanguard Systems cohérent
```

- [ ] **Step 2: Delete modes/apply.md**

```bash
git rm modes/apply.md
```

- [ ] **Step 3: Commit**

```bash
git add modes/proposition.md
git commit -m "feat: add proposition mode for commercial proposals (replaces apply.md)"
```

### Task 4.3: Create `modes/contact.md` (replaces contacto.md)

**Files:**
- Create: `modes/contact.md`
- Delete: `modes/contacto.md`

- [ ] **Step 1: Write modes/contact.md**

Based on contacto.md but adapted for consulting:
- Title: `# Mode: contact — Prospection Décideurs`
- Targets: NOT recruiters, but decision-makers (CTO, directeurs de programme, responsables automation, responsables projets, responsables achats)
- Framework 3 phrases adapted:
  - Frase 1 (Hook): Something specific about their plant/project/challenge
  - Frase 2 (Proof): Biggest relevant metric from Vanguard references
  - Frase 3 (Proposal): Quick call, no pressure
- Versions: FR (default), EN, DE (Swiss German market)
- 300 char LinkedIn limit stays
- NO corporate-speak, NO "je suis passionné par..."

- [ ] **Step 2: Delete modes/contacto.md**

```bash
git rm modes/contacto.md
```

- [ ] **Step 3: Commit**

```bash
git add modes/contact.md
git commit -m "feat: add contact mode for client prospecting (replaces contacto.md)"
```

### Task 4.4: Create `modes/client.md` (replaces deep.md)

**Files:**
- Create: `modes/client.md`
- Delete: `modes/deep.md`

- [ ] **Step 1: Write modes/client.md**

Title: `# Mode: client — Recherche Client Approfondie`

6 axes adapted for consulting:
1. **Installé base & automation** — Quel DCS/PLC/SCADA utilisent-ils? Siemens, Rockwell, autre? MES? Historian?
2. **Projets récents (6 derniers mois)** — Extensions? Nouvelles lignes? Migrations? Investissements capex?
3. **Organisation & maturité** — Taille équipe automation? Interne vs sous-traitance? Maturité digitale?
4. **Contraintes réglementaires** — GMP? GxP? FDA? Swissmedic? Niveau de qualification requis?
5. **Douleurs probables** — Vieillissement systèmes? Turnover? Compliance gaps? Performance?
6. **Angle Vanguard** — Quelle valeur unique apporte-t-on? Quels proof points sont les plus pertinents?

Use WebSearch for: company news, LinkedIn posts, job openings (signal of internal gaps), annual reports, Swissmedic inspections.

- [ ] **Step 2: Delete modes/deep.md**

```bash
git rm modes/deep.md
```

- [ ] **Step 3: Commit**

```bash
git add modes/client.md
git commit -m "feat: add client research mode (replaces deep.md)"
```

### Task 4.5: Create `modes/prepare.md` (new mode)

**Files:**
- Create: `modes/prepare.md`

- [ ] **Step 1: Write modes/prepare.md**

New mode as specified in spec Section 5:

```markdown
# Mode: prepare — Préparation Entretien Client

## Input
- Report d'évaluation du mandat (obligatoire)
- Dossier client (mode client, si disponible)
- config/profile.yml

## Process
1. Lire le report d'évaluation et le dossier client
2. Générer un framework de discussion structuré

## Sections du framework

### Ouverture (2-3 phrases)
Cadrer la conversation, montrer qu'on a compris le besoin.

### Questions discovery (8-10)
Organisées par thème:
- **Scope technique:** Quel système? Quelle version? Quel périmètre?
- **Organisation:** Équipe interne? Sous-traitants existants? Décisionnaire?
- **Planning:** Deadline? Contraintes d'arrêt? Phases?
- **Budget:** Budget alloué? TJM habituel? Processus achat?
- **Décision:** Timeline de décision? Autres consultants en lice?

### Points de valeur (3-5)
Arguments clés liés aux proof points Vanguard. Inclure chiffres concrets.

### Objections anticipées (3-4)
- "TJM trop élevé" → [réponse préparée avec justification]
- "Pas de référence dans notre secteur" → [réponse]
- "On préfère un intégrateur plus gros" → [réponse]
- "Disponibilité?" → [réponse]

### Négociation
- Fourchette TJM cible
- Conditions à négocier (durée, remote, exclusivité)
- BATNA (meilleure alternative)

### Red flags à surveiller
- Signaux d'alerte pendant l'entretien
- Scope creep, décision floue, intermédiaires multiples

### Next steps
- Actions à proposer en fin d'entretien

## Output
- Report markdown dans reports/{num}-{client-slug}-prepare.md
- Pas de PDF, document de travail interne

## Règles
- TOUJOURS baser sur des proof points réels
- Adapter le ton à l'interlocuteur (ingénieur vs manager vs achat)
- Inclure des chiffres concrets
```

- [ ] **Step 2: Commit**

```bash
git add modes/prepare.md
git commit -m "feat: add prepare mode for client meeting preparation"
```

### Task 4.6: Create `modes/veille.md` (replaces training.md)

**Files:**
- Create: `modes/veille.md`
- Delete: `modes/training.md`

- [ ] **Step 1: Write modes/veille.md**

Title: `# Mode: veille — Veille Marché & Technologique`

Evaluate market trends and technologies relevant to Vanguard:

| Dimension | What it evaluates |
| Pertinence business | Impact sur l'offre de services Vanguard |
| Signal marché suisse | Tendances spécifiques au marché suisse automation/pharma |
| Compétitivité | Comment ça nous différencie de la concurrence |
| Investissement | Temps/coût d'apprentissage vs retour |
| Risques | Techno immature? Standard instable? |
| Opportunité commerciale | Ouvre-t-il de nouveaux mandats? |

Topics prioritaires:
1. Migrations PCS7 → TIA Portal (marché énorme)
2. Cybersécurité OT / IEC 62443 (réglementation croissante)
3. IA appliquée en production pharma
4. Digitalisation pharma 4.0
5. Nouvelles réglementations GMP (Annexe 11, Data Integrity)

- [ ] **Step 2: Delete modes/training.md**

```bash
git rm modes/training.md
```

- [ ] **Step 3: Commit**

```bash
git add modes/veille.md
git commit -m "feat: add veille mode for market intelligence (replaces training.md)"
```

### Task 4.7: Create `modes/projet.md` (replaces project.md)

**Files:**
- Create: `modes/projet.md`
- Delete: `modes/project.md`

- [ ] **Step 1: Write modes/projet.md**

Title: `# Mode: projet — Évaluation d'Idée de Projet`

Adapted from project.md but for consulting side projects / portfolio:

6 dimensions (1-5):
| Dimension | Poids |
| Signal pour mandats cibles | 25% — Démontre directement une compétence recherchée |
| Unicité | 20% — Personne d'autre ne l'a fait |
| Démonstrabilité | 20% — Montrable en 2 min |
| Potentiel métriques | 15% — Résultats quantifiables |
| Temps au MVP | 10% — 1 semaine idéal |
| Potentiel commercial | 10% — Peut devenir une offre de service? |

Verdicts: CONSTRUIRE / PASSER / PIVOTER

- [ ] **Step 2: Delete modes/project.md**

```bash
git rm modes/project.md
```

- [ ] **Step 3: Commit**

```bash
git add modes/projet.md
git commit -m "feat: add projet mode for portfolio evaluation (replaces project.md)"
```

### Task 4.8: Adapt `modes/tracker.md`

**Files:**
- Modify: `modes/tracker.md`

- [ ] **Step 1: Rewrite**

- Title: `# Mode: tracker — Suivi des Mandats`
- Read `data/mandats.md` instead of `data/applications.md`
- Format: `| # | Date | Client | Mandat | Score | Statut | PDF | Report | TJM | Notes |`
- Statuts: identifie, evalue, qualifie, proposition, discussion, signe, en_cours, termine, perdu, skip
- Stats: Total mandats, par statut, score moyen, % avec PDF, % avec report, TJM moyen des mandats signés

- [ ] **Step 2: Commit**

```bash
git add modes/tracker.md
git commit -m "feat: adapt tracker mode for consulting mandates"
```

---

## Chunk 5: Templates — CV and Proposal

### Task 5.1: Adapt `templates/cv-template.html`

**Files:**
- Modify: `templates/cv-template.html`

- [ ] **Step 1: Read existing template**

Read `templates/cv-template.html` fully.

- [ ] **Step 2: Adapt for Vanguard Systems**

Key changes:
- Replace gradient colors: keep the professional design but use Vanguard brand colors. Use a dark blue/teal gradient instead of cyan-purple: `linear-gradient(to right, #1a365d, #2d6a8a)`
- Add `{{COMPANY_NAME}}` placeholder under the name (renders "Vanguard Systems" in smaller text)
- Add `{{PHONE}}` to contact row
- Section headers: adapt placeholders for consulting CV structure:
  - `{{SECTION_SUMMARY}}` → "Profil" / "Profile"
  - `{{SECTION_COMPETENCIES}}` → "Compétences Techniques" / "Technical Competencies"
  - `{{SECTION_EXPERIENCE}}` → "Projets Clés" / "Key Projects" (not "Work Experience")
  - `{{SECTION_CERTIFICATIONS}}` → "Certifications"
  - `{{SECTION_SKILLS}}` → "Standards & Normes" / "Standards"
  - `{{SECTION_EDUCATION}}` → "Formation" / "Education"
  - `{{SECTION_LANGUAGES}}` → "Langues" / "Languages" (new section)
- Page width: always A4 (`210mm`)
- Keep fonts (Space Grotesk + DM Sans)
- Keep ATS-optimized single-column layout

- [ ] **Step 3: Commit**

```bash
git add templates/cv-template.html
git commit -m "feat: adapt CV template for Vanguard Systems branding"
```

### Task 5.2: Create `templates/proposal-template.html`

**Files:**
- Create: `templates/proposal-template.html`

- [ ] **Step 1: Write proposal template**

Professional HTML template for commercial proposals. Same fonts and general design language as CV template but different structure:

Placeholders:
- `{{LANG}}`, `{{DATE}}`, `{{CLIENT_NAME}}`, `{{MANDAT_TITLE}}`
- `{{COMPANY_NAME}}`, `{{COMPANY_PHONE}}`, `{{COMPANY_EMAIL}}`, `{{COMPANY_URL}}`
- `{{CONTEXT}}` — reformulation of client need
- `{{APPROACH}}` — methodology and phases
- `{{DELIVERABLES}}` — deliverables and timeline
- `{{PROFILES}}` — consultant profiles
- `{{COMMERCIAL}}` — commercial conditions
- `{{REFERENCES}}` — relevant proof points
- `{{CONDITIONS}}` — general conditions mention

Design:
- A4 format, professional layout
- Vanguard Systems header with logo placeholder and contact
- Page de garde: clean title page
- Section dividers with blue accents
- Table styling for deliverables/timeline
- Footer with page numbers
- Same fonts as CV (Space Grotesk + DM Sans)

- [ ] **Step 2: Commit**

```bash
git add templates/proposal-template.html
git commit -m "feat: add proposal template for commercial proposals"
```

---

## Chunk 6: Scripts — Node.js adaptations

### Task 6.1: Adapt `merge-tracker.mjs`

**Files:**
- Modify: `merge-tracker.mjs`

- [ ] **Step 1: Read and adapt**

Key changes:
- `APPS_FILE`: look for `data/mandats.md` instead of `data/applications.md`
- `CANONICAL_STATES`: replace with `['Identifié', 'Évalué', 'Qualifié', 'Proposition', 'Discussion', 'Signé', 'En cours', 'Terminé', 'Perdu', 'SKIP']`
- `validateStatus()`: update aliases map for French statuses
- `parseAppLine()`: handle 10 columns (add TJM at index 8, Notes at index 9). Current format expects: `| # | Date | Company | Role | Score | Status | PDF | Report | Notes |` → new: `| # | Date | Client | Mandat | Score | Statut | PDF | Report | TJM | Notes |`
- `parseTsvContent()`: handle 10 columns (num, date, client, mandat, statut, score/5, pdf_emoji, report_link, tjm, notes)
- Column swap detection: adapt for new column order
- Header detection: `| #` and `Empresa` → `Client`
- Console output messages: translate to French

- [ ] **Step 2: Test with dry-run**

```bash
node merge-tracker.mjs --dry-run
```

Expected: "No pending additions to merge" (clean state)

- [ ] **Step 3: Commit**

```bash
git add merge-tracker.mjs
git commit -m "feat: adapt merge-tracker for mandats.md with TJM column"
```

### Task 6.2: Adapt `normalize-statuses.mjs`

**Files:**
- Modify: `normalize-statuses.mjs`

- [ ] **Step 1: Rewrite status mapping**

- `APPS_FILE`: `data/mandats.md`
- `CANONICAL_STATES`: French consulting statuses
- `normalizeStatus()`: new mapping with French aliases
- Column index for status: field[6] stays (same position)
- Handle new 10-column format

- [ ] **Step 2: Test with dry-run**

```bash
node normalize-statuses.mjs --dry-run
```

- [ ] **Step 3: Commit**

```bash
git add normalize-statuses.mjs
git commit -m "feat: adapt normalize-statuses for consulting pipeline statuses"
```

### Task 6.3: Adapt `dedup-tracker.mjs`

**Files:**
- Modify: `dedup-tracker.mjs`

- [ ] **Step 1: Read and adapt**

Read the file. Change:
- File reference: `data/mandats.md`
- Column names in output messages
- Any hardcoded references to `applications.md`

- [ ] **Step 2: Commit**

```bash
git add dedup-tracker.mjs
git commit -m "feat: adapt dedup-tracker for mandats.md"
```

### Task 6.4: Adapt `verify-pipeline.mjs`

**Files:**
- Modify: `verify-pipeline.mjs`

- [ ] **Step 1: Read and adapt**

- File references: `data/mandats.md`, pipeline.md sections "En attente"/"Traitées"
- Status validation against new canonical states
- Column count validation: 10 columns

- [ ] **Step 2: Commit**

```bash
git add verify-pipeline.mjs
git commit -m "feat: adapt verify-pipeline for consulting data format"
```

### Task 6.5: Adapt `generate-pdf.mjs`

**Files:**
- Modify: `generate-pdf.mjs`

- [ ] **Step 1: Read and adapt**

- Default format: `a4` (not `letter`)
- Any hardcoded references to the old template structure

- [ ] **Step 2: Commit**

```bash
git add generate-pdf.mjs
git commit -m "feat: default to A4 format for Swiss market"
```

### Task 6.6: Adapt remaining scripts

**Files:**
- Modify: `cv-sync-check.mjs`
- Modify: `doctor.mjs`
- Modify: `test-all.mjs`
- Modify: `check-liveness.mjs`
- Modify: `update-system.mjs`

- [ ] **Step 1: Read each script and adapt**

For each: replace references to `applications.md` → `mandats.md`, old archetypes → new archetypes, old statuses → new statuses.

- [ ] **Step 2: Test**

```bash
node doctor.mjs
node test-all.mjs
```

- [ ] **Step 3: Commit**

```bash
git add cv-sync-check.mjs doctor.mjs test-all.mjs check-liveness.mjs update-system.mjs
git commit -m "feat: adapt utility scripts for consulting-ops"
```

---

## Chunk 7: Dashboard Go

### Task 7.1: Adapt Go model

**Files:**
- Modify: `dashboard/internal/model/career.go`

- [ ] **Step 1: Add TJM field and rename struct**

```go
package model

// Mandat represents a single consulting mandate from the tracker.
type Mandat struct {
	Number       int
	Date         string
	Client       string    // was Company
	Title        string    // was Role — the mandate title
	Status       string
	Score        float64
	ScoreRaw     string
	HasPDF       bool
	ReportPath   string
	ReportNumber string
	TJM          int       // Daily rate in CHF, 0 = unknown
	Notes        string
	JobURL       string
	// Enrichment (lazy loaded from report)
	Archetype    string
	TlDr         string
	Remote       string
	CompEstimate string
}

// PipelineMetrics holds aggregate stats for the pipeline dashboard.
type PipelineMetrics struct {
	Total      int
	ByStatus   map[string]int
	AvgScore   float64
	TopScore   float64
	WithPDF    int
	AvgTJM     float64
	Actionable int
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/internal/model/career.go
git commit -m "feat: add TJM field to dashboard model, rename to Mandat"
```

### Task 7.2: Adapt Go data parser

**Files:**
- Modify: `dashboard/internal/data/career.go`

- [ ] **Step 1: Adapt ParseApplications → ParseMandats**

Key changes:
- Function name: `ParseMandats`
- File path: look for `mandats.md` and `data/mandats.md`
- Parse 10 columns: add TJM parsing (field index 8, parseInt)
- Return `[]model.Mandat` instead of `[]model.CareerApplication`
- `NormalizeStatus()`: replace all status mappings with French consulting statuses:
  - identifie, evalue, qualifie, proposition, discussion, signe, en_cours, termine, perdu, skip
  - Map aliases: "évalué" → "evalue", "qualifié" → "qualifie", etc.
- `StatusPriority()`: new order: signe(0), en_cours(1), discussion(2), proposition(3), qualifie(4), evalue(5), identifie(6), termine(7), perdu(8), skip(9)
- `statusLabel()`: French labels: "Signé", "En cours", "Discussion", etc.
- `UpdateApplicationStatus` → `UpdateMandatStatus`: reference mandats.md
- `LoadReportSummary()`: update regex for French report headers: `**Archetype:**` or `**Archetype**`, `**TL;DR:**`, etc.
- `ComputeMetrics()`: add AvgTJM calculation, adapt status filtering for new canonical statuses

- [ ] **Step 2: Commit**

```bash
git add dashboard/internal/data/career.go
git commit -m "feat: adapt data parser for mandats.md with TJM and French statuses"
```

### Task 7.3: Adapt Go pipeline screen

**Files:**
- Modify: `dashboard/internal/ui/screens/pipeline.go`

- [ ] **Step 1: Adapt filters, tabs, status options**

Key changes:
- `pipelineTabs`: replace with consulting tabs:
  ```go
  var pipelineTabs = []pipelineTab{
      {filterAll, "TOUS"},
      {"evalue", "ÉVALUÉS"},
      {"qualifie", "QUALIFIÉS"},
      {"discussion", "DISCUSSION"},
      {"signe", "SIGNÉS"},
      {filterTop, "TOP ≥4"},
      {filterSkip, "SKIP"},
  }
  ```
- `statusOptions`: replace with French consulting statuses
- `statusGroupOrder`: new order matching StatusPriority
- `renderHeader()`: "CAREER PIPELINE" → "CONSULTING PIPELINE", "offers" → "mandats"
- `renderAppLine()`: add TJM column display (`"1200"` if >0, `"-"` if 0)
- `renderPreview()`: "Arquetipo" → "Archetype", "Comp" → "TJM"
- `renderHelp()`: "career-ops by santifer.io" → "consulting-ops by vanguard-systems.ch"
- All `model.CareerApplication` → `model.Mandat`
- All `app.Company` → `app.Client`, `app.Role` → `app.Title`
- `statusLabel()` function: return French labels
- `statusColorMap()`: map new statuses to colors (signe=Green, en_cours=Green, discussion=Sky, proposition=Blue, qualifie=Text, evalue=Text, identifie=Subtext, termine=Subtext, perdu=Red, skip=Red)

- [ ] **Step 2: Commit**

```bash
git add dashboard/internal/ui/screens/pipeline.go
git commit -m "feat: adapt dashboard UI for consulting pipeline with French labels"
```

### Task 7.4: Adapt Go main.go and viewer

**Files:**
- Modify: `dashboard/main.go`
- Modify: `dashboard/internal/ui/screens/viewer.go`

- [ ] **Step 1: Update main.go**

- Change all `CareerApplication` → `Mandat`
- Change `ParseApplications` → `ParseMandats`
- Update any string references

- [ ] **Step 2: Update viewer.go**

- Change `CareerApplication` → `Mandat`
- Any display text adaptations

- [ ] **Step 3: Update go.mod module path if needed**

Check if module path `github.com/santifer/career-ops/dashboard` needs updating. If not used externally, leave as-is (internal imports will still work).

- [ ] **Step 4: Build and test**

```bash
cd dashboard && go build -o consulting-dashboard . && cd ..
```

Expected: compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/
git commit -m "feat: adapt dashboard for consulting-ops (mandats, TJM, French UI)"
```

---

## Chunk 8: CLAUDE.md, Batch Prompt, Cleanup

### Task 8.1: Rewrite CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite entirely**

Replace all content following the structure of the original but adapted:

- Title: `# Consulting-Ops — Pipeline de Mandats Freelance`
- Origin: Adapted from career-ops for Vanguard Systems
- Data Contract: Same structure, files renamed (mandats.md, etc.)
- Update Check: Same mechanism
- What is consulting-ops: AI-powered consulting pipeline
- Main Files table: updated paths
- Onboarding: adapted for consulting (check cv.md, profile.yml, _profile.md, portals.yml, mandats.md)
- Skill Modes table: 14 new modes with French triggers
- Ethical Use: adapted (quality over quantity, never send proposals without review)
- Stack and Conventions: same but mandats.md, new TSV format (10 cols), new canonical states

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: rewrite CLAUDE.md for consulting-ops"
```

### Task 8.2: Adapt `batch/batch-prompt.md`

**Files:**
- Modify: `batch/batch-prompt.md`

- [ ] **Step 1: Read and adapt**

Read `batch/batch-prompt.md`. Replace:
- All archetype references (6 AI → 5 consulting)
- Scoring dimensions (old 5 → new 10)
- Terminology (oferta→mandat, candidato→consultant, empresa→client, etc.)
- TSV format: 10 columns with TJM
- Statuses: new canonical French statuses
- applications.md → mandats.md

- [ ] **Step 2: Commit**

```bash
git add batch/batch-prompt.md
git commit -m "feat: adapt batch worker prompt for consulting-ops"
```

### Task 8.3: Create cv.md

**Files:**
- Create: `cv.md`

- [ ] **Step 1: Write canonical CV**

Write Tai Van's canonical CV in markdown based on information gathered from LinkedIn and vanguard-systems.ch:

```markdown
# Tai Van
## Solution Architect & Automation Engineer

**Vanguard Systems** | Le Mont-sur-Lausanne, Suisse
contact@vanguard-systems.ch | +41 79 172 08 08
linkedin.com/in/tai-van | vanguard-systems.ch

---

## Profil

Ingénieur automation senior et architecte solutions avec une expertise approfondie en environnements pharmaceutiques réglementés. Double compétence intégrateur technique (Siemens, Rockwell) et chef de projet (PMP). Fondateur de Vanguard Systems, réseau de consultants seniors spécialisé dans l'exécution hands-on pour des environnements critiques.

## Compétences Techniques

### PLC / DCS / SCADA
- Siemens: PCS7, WinCC, TIA Portal, S7, Simatic Batch
- Rockwell: ControlLogix, FactoryTalk, PlantPAx
- Beckhoff, Emerson

### Réseaux & Communications OT
- Profinet, Ethernet/IP, OPC UA
- Cybersécurité OT, IEC 62443, segmentation réseau

### Data & IA
- Python, TensorFlow, Azure ML
- Power BI, Power Automate, RPA
- RAG, agents autonomes

### Standards & Normes
- GAMP5, GxP, ISA-88, ISA-95
- IEC 62443, 21 CFR Part 11
- FAT/SAT, IQ/OQ/PQ

## Projets Clés

### Merck — Modernisation Automation (2020-2023)
Corsier-sur-Vevey, Vaud
- Stabilisation et refonte des processus automatisés
- +20% efficacité équipe, -35% temps de résolution incidents, 90% adoption outils

### Novartis — Plateforme Production Digitale (2021-2023)
Basel
- Plateforme intégrée (production, qualité, maintenance, supply chain)
- +50% visibilité opérationnelle, -40% temps de décision, ROI positif année 1

### Roche — Optimisation Process IA (2023-2024)
Basel
- Intégration Python, TensorFlow, Azure ML
- -15% consommation énergie, +8% disponibilité, -20% variance qualité

### Takeda — Commissioning Fill & Finish (2022-2024)
- Qualification complète FAT/SAT avec validation GMP
- Déploiement on-schedule, zéro déviation GMP majeure

### Sun Chemicals — Automatisation Flux Matières (2023-2024)
- Power BI, RPA, Power Automate
- -60% temps introduction matières, élimination erreurs, ROI 6 mois

### Chatbot Maintenance Intelligent (2023-2024)
Major Pharma
- Déploiement RAG on-premise
- -40% temps résolution incidents, 90% adoption techniciens, 4.5/5 satisfaction

### Merck — Optimisation Énergie Systèmes Air (2023-2024)
Corsier-sur-Vevey
- -30%+ consommation énergie, 100% conformité GMP maintenue

## Certifications
- PMP® — Project Management Professional (PMI, 2026-2029)
- Lean Six Sigma Black Belt (CSSSC, 2025)
- CAS Cybersecurity Foundations (EITCA, 2025)
- CAS Artificial Intelligence (EITCA, 2024)

## Formation
- The Open University (2025-2029, en cours)

## Langues
- Français (natif)
- English (professionnel)
```

- [ ] **Step 2: Commit**

```bash
git add cv.md
git commit -m "feat: add Tai Van canonical CV"
```

### Task 8.4: Cleanup — delete old files and directories

**Files:**
- Delete: `modes/de/` (entire directory)
- Delete: `modes/fr/` (entire directory)
- Delete: `modes/pt/` (entire directory)
- Delete: `interview-prep/` (entire directory)
- Delete: `.opencode/commands/` (entire directory)

- [ ] **Step 1: Remove old language variants and unused directories**

```bash
git rm -r modes/de/ modes/fr/ modes/pt/ interview-prep/
git rm -r .opencode/commands/
```

- [ ] **Step 2: Adapt .claude/skills/career-ops/SKILL.md**

Read `.claude/skills/career-ops/SKILL.md`. Rename directory to `consulting-ops` and adapt content:
- Rename all command references
- Update mode names
- French descriptions

```bash
mkdir -p .claude/skills/consulting-ops
# Copy and adapt SKILL.md content
git rm -r .claude/skills/career-ops
```

- [ ] **Step 3: Update .gitignore**

Add to .gitignore if not already present:
```
output/propositions/
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "cleanup: remove old language variants, interview-prep, opencode commands

Replaced by consulting-ops skill and French-first modes."
```

### Task 8.5: Final verification

- [ ] **Step 1: Run doctor.mjs**

```bash
node doctor.mjs
```

Fix any issues reported.

- [ ] **Step 2: Run verify-pipeline.mjs**

```bash
node verify-pipeline.mjs
```

- [ ] **Step 3: Build dashboard**

```bash
cd dashboard && go build -o consulting-dashboard . && cd ..
```

- [ ] **Step 4: Verify all mode files exist**

```bash
ls modes/*.md
```

Expected: _shared.md, _profile.template.md, _profile.md, auto-pipeline.md, mandat.md, mandats.md, cv.md, proposition.md, scan.md, batch.md, pipeline.md, contact.md, client.md, tracker.md, prepare.md, veille.md, projet.md

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues from final verification"
```
