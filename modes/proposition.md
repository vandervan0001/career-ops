# Mode : proposition -- Generation de proposition commerciale

Genere une proposition commerciale PDF structuree pour repondre a un appel d'offres ou une demande de mandat.

## Inputs

- Report d'evaluation du mandat (depuis `reports/`)
- CV genere (`modes/cv.md`)
- Profil consultant (`config/profile.yml`)
- Cahier des charges du client (texte ou URL)

## Workflow

1. **Charger le contexte** : lire le report d'evaluation, `cv.md`, `config/profile.yml`
2. **Extraire les exigences** du cahier des charges : perimetre, contraintes, delais, budget si mentionne
3. **Generer chaque section** de la proposition (voir ci-dessous)
4. **Assembler le HTML** depuis le template
5. **Generer le PDF** : `node generate-pdf.mjs /tmp/proposition-{num}-{client}.html output/propositions/{num}-{client-slug}-proposition.pdf --format=a4`
6. **Reporter** : chemin du PDF, nombre de pages

## Sections de la proposition

### 1. Page de garde

- Logo Vanguard Systems (si disponible dans `assets/`)
- Titre : "Proposition technique et commerciale"
- Sous-titre : "{Objet du mandat}"
- Client : "{Nom du client}"
- Reference : "{num}-{client-slug}"
- Date : "{YYYY-MM-DD}"
- Mention "Confidentiel"

### 2. Contexte et comprehension du besoin

- Reformulation du besoin du client en 3-5 paragraphes
- Demontrer la comprehension des enjeux specifiques
- Identifier les contraintes techniques et reglementaires (GMP, FDA, Swissmedic, etc.)
- Mentionner le contexte du marche si pertinent

### 3. Approche methodologique

- Description de la demarche proposee (phases, jalons, livrables intermediaires)
- Methodologie adaptee au contexte (V-model pour la validation, Agile pour le developpement, GAMP5 pour la pharma)
- Planning macro avec jalons cles
- Gestion des risques identifies

### 4. Livrables

- Liste exhaustive des livrables avec description
- Criteres d'acceptation pour chaque livrable
- Format de livraison (documents, code, formations, etc.)

### 5. Profils proposes

- CV condense du/des consultant(s) (issu de `cv.md`)
- Mise en avant des experiences pertinentes pour CE mandat
- Certifications et qualifications relevantes
- Disponibilite

### 6. Conditions commerciales

- Estimation de charge en jours/homme par phase
- **TJM : NE PAS afficher sauf si le client le demande explicitement**
- Montant total de la prestation (fourchette si necessaire)
- Conditions de facturation (mensuelle, par jalon, etc.)
- Frais de deplacement si applicable
- Validite de l'offre (generalement 30 jours)

**REGLE CRITIQUE : Le TJM (Taux Journalier Moyen) ne doit JAMAIS apparaitre dans la proposition sauf demande explicite du consultant. Afficher uniquement le montant global par phase ou le forfait total. Le TJM est une information de negociation interne.**

### 7. References

- 3-5 projets similaires realises (issus de `cv.md` et `article-digest.md`)
- Pour chaque reference : client (anonymise si necessaire), perimetre, resultats mesurables
- Domaines d'intervention pertinents

### 8. Conditions generales

- Propriete intellectuelle (code, documents)
- Confidentialite (NDA)
- Assurances (RC Pro)
- Conditions de resiliation
- Droit applicable (droit suisse par defaut)
- For juridique

## Fichier de sortie

```
output/propositions/{num}-{client-slug}-proposition.pdf
```

Exemples :
- `output/propositions/001-roche-migration-pcs7-proposition.pdf`
- `output/propositions/002-novartis-scada-upgrade-proposition.pdf`

## Regles de ton

- **Professionnel et factuel** : pas de superlatifs, pas de promesses vagues
- **Centre sur la valeur client** : chaque phrase doit repondre a "en quoi ca aide le client ?"
- **Specifique** : chiffres, delais, livrables concrets
- **Confiant sans arrogance** : laisser les references parler
- **Francais technique naturel** : termes techniques en anglais quand c'est l'usage (SCADA, DCS, PLC, HMI, OPC UA)

## Design du PDF

- **Format** : A4
- **Style** : sobre et professionnel, coherent avec le CV
- **En-tete** : logo Vanguard + reference du document
- **Pied de page** : "Vanguard Systems -- Confidentiel" + numero de page
- **Table des matieres** si > 5 pages
- **Fonts** : coherentes avec le CV (Space Grotesk + DM Sans)

## Post-generation

1. Sauvegarder le chemin de la proposition dans le report du mandat
2. Mettre a jour le tracker (`data/mandats.md`) si le mandat est enregistre
