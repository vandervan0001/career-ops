# System Context -- consulting-ops

<!-- ============================================================
     THIS FILE IS AUTO-UPDATABLE. Don't put personal data here.
     
     Your customizations go in modes/_profile.md (never auto-updated).
     This file contains system rules, scoring logic, and tool config
     that improve with each consulting-ops release.
     ============================================================ -->

## Sources of Truth

| File | Path | When |
|------|------|------|
| cv.md | `cv.md` (project root) | ALWAYS |
| profile.yml | `config/profile.yml` | ALWAYS (consultant identity and targets) |
| _profile.md | `modes/_profile.md` | ALWAYS (archetypes, narrative, negotiation) |

**RULE: NEVER hardcode metrics from proof points.** Read them from cv.md at evaluation time.
**RULE: Read _profile.md AFTER this file. User customizations in _profile.md override defaults here.**

---

## Scoring System

10 dimensions, weighted average 1-5:

| # | Dimension | Poids | Criteres 1-5 |
|---|-----------|-------|---------------|
| 1 | Fit technique | 20% | 5 = 90%+ match competences, 1 = <40% |
| 2 | Archetype match | 15% | 5 = archetype cible exact, 1 = hors perimetre |
| 3 | TJM / Budget | 15% | 5 = top quartile marche suisse, 1 = nettement sous marche |
| 4 | Duree & volume | 10% | 5 = 6+ mois, temps plein, 1 = <1 mois ou flou |
| 5 | Localisation | 10% | 5 = Suisse romande / remote, 1 = relocation exigee hors perimetre |
| 6 | Client / Reputation | 10% | 5 = grand pharma / reference secteur, 1 = red flags |
| 7 | Potentiel commercial | 5% | 5 = upsell/extension probable, 1 = one-shot sans suite |
| 8 | Conformite reglementaire | 5% | 5 = GAMP5/FDA/GxP explicite = terrain connu, 1 = domaine non maitrise |
| 9 | Autonomie & cadre | 5% | 5 = autonomie totale, scope clair, 1 = micromanagement / scope flou |
| 10 | Red flags | 5% | 5 = aucun, 1 = blockers multiples |

**Score interpretation:**
- 4.5+ = Prioritaire, postuler / repondre immediatement
- 4.0-4.4 = Bon match, poursuivre
- 3.5-3.9 = Acceptable si pipeline calme
- <3.5 = Passer, sauf raison strategique specifique

## Scoring <-> Report Relation

| Bloc rapport | Dimensions alimentees |
|--------------|-----------------------|
| A: Resume mandat | dims 4 (duree), 5 (localisation), 8 (conformite) |
| B: Fit technique | dims 1 (fit technique), 2 (archetype match) |
| C: Positionnement | dims 2 (archetype match), 9 (autonomie & cadre) |
| D: Marche & TJM | dims 3 (TJM/budget), 7 (potentiel commercial) |
| E: Plan personnalisation | pas de score direct |
| F: Preparation client | dims 6 (client/reputation), 10 (red flags) |

---

## Archetype Detection

Classifier chaque mandat dans l'un des 5 archetypes (ou hybride de 2):

| Archetype | Signaux cles dans le mandat |
|-----------|----------------------------|
| **Integrateur Automation** | PLC, SCADA, DCS, migration, commissioning, FAT/SAT, mise en service |
| **Chef de Projet Automation** | Planning, coordination, GAMP5, stakeholders, validation, budget |
| **Expert OT / Infra industrielle** | Reseau OT, cybersecurite industrielle, IEC 62443, segmentation |
| **Architecte Solutions** | MES, data historian, plateforme, migration globale, integration SI |
| **Consultant Applied AI** | IA, ML, RAG, optimisation process, predictive maintenance, NLP |

Apres detection de l'archetype, lire `modes/_profile.md` pour le cadrage et les proof points specifiques.

---

## Global Rules

### NEVER

1. Inventer des competences ou des metriques
2. Modifier cv.md ou les fichiers portfolio
3. Envoyer une proposition sans validation utilisateur
4. Recommander un TJM en dessous du marche
5. Generer un PDF sans avoir lu le cahier des charges / JD
6. Utiliser du jargon corporate creux
7. Ignorer le tracker (chaque mandat evalue est enregistre)

### ALWAYS

1. Lire cv.md, _profile.md, et profile.yml avant d'evaluer
2. Detecter l'archetype du mandat et adapter le cadrage selon _profile.md
3. Citer des lignes exactes du CV lors du matching
4. Utiliser WebSearch pour TJM et donnees marche suisse
5. Enregistrer dans le tracker apres evaluation
6. Generer le contenu en francais (langue par defaut)
7. Etre direct et actionnable -- pas de fluff
8. Vocabulaire pharma/industrie precis (voir section ecriture professionnelle)
9. **Tracker additions en TSV** -- JAMAIS editer applications.md directement. Ecrire le TSV dans `batch/tracker-additions/`.
10. **Inclure `**URL:**` dans chaque en-tete de rapport.**

### Tools

| Tool | Utilisation |
|------|-------------|
| WebSearch | TJM suisse, tendances marche, reputation client, contacts LinkedIn |
| WebFetch | Extraire des JD depuis des pages statiques (fallback) |
| Read | cv.md, _profile.md, profile.yml |
| Write | HTML temporaire pour PDF, applications.md, rapports .md |
| Edit | Mettre a jour le tracker |
| Bash | `node generate-pdf.mjs` |

---

## Professional Writing -- French / Pharma / Industry

Ces regles s'appliquent a TOUT texte genere pour le client ou pour des candidatures : CV adapte, message d'approche, reponses formulaires, profil LinkedIn. Elles ne s'appliquent PAS aux rapports d'evaluation internes.

### Vocabulaire pharma a privilegier
- "Qualification / validation" (pas "testing")
- "Mise en service" (pas "commissioning" sauf contexte anglophone)
- "Cahier des charges" (pas "requirements doc")
- "Recette usine / recette site" (pour FAT/SAT)
- "Automate programmable" (pour PLC en contexte francophone)
- "Systeme de conduite" (pour DCS/SCADA en contexte francophone)

### Eviter les cliches
- "passionne par" / "fort de X annees d'experience"
- "synergie" / "robuste" / "seamless" / "cutting-edge" / "innovant"
- "dans un monde en constante evolution"
- "capacite demontree a" / "bonnes pratiques" (nommer la pratique)

### Privilegier le concret
- "Migration 120 boucles DeltaV vers PlantPAx en 8 mois" > "migration reussie"
- "Coordination 4 lots CVC/HVAC/process/utilities sur site Novartis Stein" > "gestion multi-lots"
- Nommer les outils, projets, clients quand autorise

### Varier la structure
- Ne pas commencer chaque puce par le meme verbe
- Alterner phrases courtes et longues
- Alterner entre 2, 3 et 4 elements dans les listes

---

## TSV Format -- Tracker

10 colonnes, separateur tabulation:

```
num	date	client	mandat	statut	score/5	pdf_emoji	report_link	tjm	notes
```

| Colonne | Description |
|---------|-------------|
| num | Numero sequentiel (3 digits, zero-padded) |
| date | YYYY-MM-DD |
| client | Nom du client ou intermediaire |
| mandat | Titre du mandat |
| statut | Etat canonique (voir states.yml) |
| score/5 | Score moyen pondere |
| pdf_emoji | ✅ ou ❌ |
| report_link | Lien relatif au rapport .md |
| tjm | TJM negocie ou estime (CHF) |
| notes | Notes libres |

---

## Pipeline Integrity

- Chaque mandat evalue DOIT etre enregistre dans le tracker
- Les etats doivent correspondre exactement aux valeurs de `templates/states.yml`
- Un mandat ne peut pas reculer d'etat sauf si marque explicitement comme "Discarded"
- Les rapports sont immutables apres generation (creer un addendum si mise a jour necessaire)

## Canonical States

Referencer `templates/states.yml` pour la liste exacte des etats et leurs alias.
