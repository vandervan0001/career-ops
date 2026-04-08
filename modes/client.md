# Mode : client -- Recherche approfondie client

Genere une analyse structuree d'un client potentiel selon 6 axes, orientee prise de decision commerciale pour Vanguard Systems.

## Declenchement

Quand le consultant demande une recherche sur un client (entreprise), generer un rapport couvrant les 6 axes ci-dessous. Utiliser WebSearch, LinkedIn, offres d'emploi actuelles et toute source publique pertinente.

## Les 6 axes de recherche

### 1. Base installee et automatisation

- Quel est le parc d'automatisation du client ? (Siemens, Rockwell, ABB, Honeywell, Emerson, Yokogawa)
- Quels systemes SCADA/DCS sont en place ? (WinCC, PCS7, TIA Portal, DeltaV, PlantPAx)
- Quels MES/ERP ? (Werum PAS-X, SAP, Opcenter, AVEVA)
- Niveaux ISA-95 couverts (0-4) ?
- Quel niveau d'integration OT/IT ?
- Sites de production en Suisse (et ailleurs) ?

**Sources :** WebSearch (`"{entreprise}" automation OR SCADA OR DCS OR PCS7 OR TIA Portal`), offres d'emploi mentionnant des technologies specifiques, rapports annuels, communiques de presse.

### 2. Projets recents (6-12 derniers mois)

- Investissements annonces (CAPEX, nouvelles lignes, extensions)
- Migrations de systemes (PCS7 -> TIA Portal, DeltaV upgrades, etc.)
- Projets de digitalisation (IoT, Industry 4.0, digital twin)
- Projets cybersecurite OT (IEC 62443, NIS2)
- Acquisitions, fusions, partenariats technologiques
- Nouvelles usines ou sites en construction

**Sources :** WebSearch actualites recentes, communiques de presse, LinkedIn company posts, rapports annuels.

### 3. Maturite organisationnelle

- Taille de l'equipe automatisation/OT (estimer depuis LinkedIn)
- Ratio interne vs externe (combien de consultants ?)
- Turnover recent (departs, recrutements massifs)
- Presence d'un departement OT Security dedie ?
- Culture : waterfall vs agile ? Centralisee vs site-autonome ?
- Budget IT/OT (estimer si possible)

**Sources :** LinkedIn (`"{entreprise}" automation engineer OR OT manager`), offres d'emploi actuelles, Glassdoor/Kununu pour la culture.

### 4. Contraintes reglementaires

- GMP / GDP applicable ? (pharma, medtech, biotech)
- FDA, Swissmedic, EMA : quelles autorites ?
- Annexe 11, 21 CFR Part 11 : exigences data integrity ?
- GAMP5 : approche de validation ?
- IEC 62443 / NIS2 : exigences cybersecurite ?
- ISO 27001, ISO 22000, FSSC : autres normes pertinentes ?
- Inspections recentes (warning letters, observations FDA) ?

**Sources :** WebSearch (`"{entreprise}" FDA warning letter OR inspection`), bases de donnees FDA/EMA publiques, rapports de qualite.

### 5. Pain points probables

Deduire des axes 1-4 les problemes probables :
- Systemes en fin de vie (PCS7 V7, WinCC V6, etc.)
- Dette technique OT (spaghetti code, documentation manquante)
- Pression reglementaire (nouvelles exigences, inspections a venir)
- Manque de ressources internes (offres d'emploi ouvertes non pourvues)
- Projets en retard ou bloques (indices dans les offres d'emploi "urgent")
- Risques cybersecurite (systemes non patches, acces distants non securises)

### 6. Angle Vanguard

Synthese operationnelle :
- **Ou Vanguard apporte le plus de valeur** (gap entre besoins et capacites internes)
- **Quel type de mandat proposer** (migration, audit, integration, formation, support)
- **Quel TJM viser** (en fonction de la complexite et du budget estime)
- **Qui contacter** (decideurs identifies pendant la recherche)
- **Quel angle d'approche** (pain point le plus urgent, projet le plus visible)
- **Risques a anticiper** (concurrence installee, politique interne, gel de budget)

## Format de sortie

```markdown
# Recherche client : {Entreprise}

**Date :** {YYYY-MM-DD}
**Secteur :** {Pharma / Biotech / Chimie / Agroalimentaire / ...}
**Sites Suisse :** {liste des sites}
**Effectif estime :** {N employes}

---

## 1. Base installee et automatisation
(contenu)

## 2. Projets recents
(contenu)

## 3. Maturite organisationnelle
(contenu)

## 4. Contraintes reglementaires
(contenu)

## 5. Pain points probables
(contenu)

## 6. Angle Vanguard
(contenu)

---

## Actions recommandees
1. [Action concrete avec cible et calendrier]
2. [...]
3. [...]
```

## Sauvegarde

Sauvegarder le rapport dans `reports/client-{entreprise-slug}-{YYYY-MM-DD}.md`.
