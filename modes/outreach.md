# Mode: Outreach — Campagnes Cold Email Scaliab

## Quand utiliser ce mode

L'utilisateur veut :
- Sourcer des prospects pour Scaliab
- Lancer une campagne cold email
- Relancer des prospects
- Voir les stats d'une campagne
- Importer une liste de prospects

## Architecture

### CRM
- **`data/prospects.tsv`** — Base de prospects (12 colonnes TSV)
- **`data/campaigns.md`** — Suivi des campagnes
- **`templates/outreach-states.yml`** — Statuts canoniques

### Scripts
- **`prospect-scraper.mjs`** — Import CSV + enrichissement Hunter.io + verification emails
- **`cold-outreach.mjs`** — Envoi cold email avec rate limiting + relances

### Templates
- **`templates/cold-emails/fiduciaire.html`** — Fiduciaires & cabinets comptables
- **`templates/cold-emails/family-office.html`** — Family offices & gestion de patrimoine
- **`templates/cold-emails/administration.html`** — Administrations & collectivites publiques
- **`templates/cold-emails/pme.html`** — PME generales

## Workflow standard

### 1. Sourcer des prospects

Le consultant fournit une liste CSV ou demande de chercher dans un segment :

```
# Import CSV (format: contact,entreprise,domain,segment,ville,pays)
node prospect-scraper.mjs --import prospects-fidu.csv

# Enrichir les emails manquants via Hunter.io
node prospect-scraper.mjs --enrich

# Verifier les emails
node prospect-scraper.mjs --verify

# Stats
node prospect-scraper.mjs --stats
```

**Sources de scraping par segment :**

| Segment | Sources CH | Sources FR |
|---------|-----------|-----------|
| Fiduciaire | monetas.ch, local.ch, fiduciairesuisse.ch, zefix.ch | societe.com, annuaire.com |
| Family office | SFOA, finews.ch, swissbanking.ch | AFFO, agefi.fr |
| Admin | communes.ch, vd.ch, ge.ch, ne.ch | annuaire-mairie.fr |
| PME | local.ch, startups.ch, bilan.ch | societe.com, pappers.fr |

### 2. Preparer la campagne

```bash
# Preview du template
node cold-outreach.mjs --preview --segment fiduciaire

# Dry run (pas d'envoi reel)
node cold-outreach.mjs --campaign fidu-ch-01 --segment fiduciaire --limit 5 --dry-run
```

### 3. Lancer l'envoi

```bash
# Envoi initial (max 20-50/jour au debut)
node cold-outreach.mjs --campaign fidu-ch-01 --segment fiduciaire --limit 20

# Relance 1 (J+3 apres premier contact)
node cold-outreach.mjs --campaign fidu-ch-01 --segment fiduciaire --relance 1

# Relance 2 (J+7 — dernier message)
node cold-outreach.mjs --campaign fidu-ch-01 --segment fiduciaire --relance 2
```

### 4. Suivi

```bash
# Stats campagne
node cold-outreach.mjs --stats
```

## Regles SMTP & Deliverabilite

1. **Warmup progressif** : 10/jour semaine 1, 20/jour semaine 2, 50/jour semaine 3+
2. **Delai entre emails** : 3 minutes minimum (configure dans cold-outreach.mjs)
3. **Max/jour** : 50 (configurable)
4. **Desabonnement** : Lien obligatoire dans chaque email, honorer immediatement
5. **Bounces** : Auto-marques, jamais renvoyes
6. **SMTP** : Configurer `config/smtp.yml` avec l'adresse Scaliab (info@scaliab.io)

## Convention de nommage des campagnes

Format : `{segment_court}-{pays}-{numero}`

Exemples :
- `fidu-ch-01` — Premiere campagne fiduciaires Suisse
- `fo-fr-01` — Premiere campagne family offices France
- `admin-ch-vd-01` — Administrations canton de Vaud
- `pme-ch-01` — PME Suisse

## Segments & Pain Points

### Fiduciaires
- Saisie manuelle de pieces comptables
- Rapports de revision chronophages
- Conformite reglementaire changeante
- Reponses clients repetitives (TVA, declarations)
- Difficulte a recruter des juniors

### Family Offices
- Due diligence = montagnes de documents
- Reporting trimestriel/annuel aux familles
- Veille reglementaire (LSFin, LInFi, FATCA, CRS)
- Communication personnalisee avec chaque famille

### Administrations
- Traitement de dossiers citoyens lent
- Reponses standardisees aux demandes
- Documentation interne volumineuse
- Proces-verbaux et resumes de seances
- Budget serre, pas de departement IT

### PME generales
- "On a essaye ChatGPT 5 min, puis plus rien"
- Pas de departement IT / pas de budget IA
- Redaction commerciale (offres, emails, contrats)
- Support client sans ressources
- Processus manuels partout

## Personnalisation des templates

Variables disponibles :
- `{{PRENOM}}` — Prenom du contact (fallback: "Madame, Monsieur")
- `{{ENTREPRISE}}` — Nom de l'entreprise
- `{{VILLE}}` — Ville du prospect
- `{{SEGMENT}}` — Segment du prospect

Pour modifier les templates : editer directement les fichiers HTML dans `templates/cold-emails/`.

## Integration avec le reste de consulting-ops

- Le CRM prospects est SEPARE du tracker mandats (mandats.md)
- Si un prospect se convertit en client -> creer une entree dans mandats.md manuellement
- Les scripts outreach utilisent le meme SMTP que send-email.mjs
- Hunter.io est partage avec find-email.mjs
