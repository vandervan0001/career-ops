# Prospection Intégrateurs -- Design Spec
Date: 2026-04-24

## Contexte

Pivot du profil consulting-ops : de "consultant externalisé pharma/OT Suisse romande" vers "automaticien freelance, renfort rapide pour intégrateurs et industriels". Objectif : 100 contacts/semaine, 2-3 clients récurrents sous-traitance.

## Décisions clés

- **Pivot profil** : remplace archetypes pharma par positionnement intégrateur (option B)
- **Géographie** : Suisse romande priorité 1, nationwide remote/hybride accepté priorité 2 (option C)
- **Envoi** : fully automated avec dual-agent (PrepAgent + ReviewAgent) pour garantir qualité (option B)

---

## Architecture

```
/consulting-ops prospection  ou  node prospect-loop.mjs
         |
         v
[1] LEAD ACQUISITION (industrial-prospect-scan.mjs étendu)
    - LinkedIn Playwright (queries: automaticien, automation, intégrateur Siemens CH)
    - Google Maps (zones industrielles Suisse romande + nationwide)
    - Kompass/Europages (catégories: automation, intégration systèmes, CH)
    - Dédup contre prospection.tsv (email + company slug)
         |
         v
[2] ENRICHISSEMENT (find-email.mjs + enrich-context.mjs)
    - Hunter.io : email domain search + name match + vérification
    - Website visit : signal douleur, offres emploi, actualités expansion
    - Score géo : romande=5, nationwide remote=3, exclu=0
         |
         v
[3] PREPAGENT (claude -p)
    Contexte chargé : modes/prospection.md + modes/_profile.md + config/profile.yml
    - Sélectionne template selon signal détecté
    - Personnalise : nom contact, signal, proof point (Siemens/Rockwell/secteur)
    - Score confiance message (1-5) -- si < 3, quarantaine directe
    Output : batch/outreach-queue/{YYYY-MM-DD}.tsv
         |
         v
[4] REVIEWAGENT (claude -p, second pass)
    Checklist 8 critères (voir détail ci-dessous)
    - Approuvé → batch/outreach-approved/{date}.tsv
    - Rejeté → tentative correction unique → si toujours KO → batch/outreach-quarantine/{date}.tsv
         |
         v
[5] SEND (outreach-dispatch.mjs)
    - SMTP email : max 20/jour, délai 30-60s entre envois
    - LinkedIn Playwright : max 15 connexions/jour
    - Met à jour prospection.tsv : statut envoye, date_envoi
         |
         v
[6] RELANCES (relance-scheduler.mjs)
    - Scan prospection.tsv : statut=envoye, date_envoi <= J-7
    - Génère relance → ReviewAgent → envoie
    - J+7 → relance_1 / J+14 → relance_2 / silence → archive
```

---

## Composants à construire

| Composant | Type | Action |
|---|---|---|
| `config/profile.yml` | existant | Pivot positionnement + geo option C |
| `config/lead-sources.yml` | nouveau | Sources leads intégrateurs (LinkedIn, Maps, Kompass) |
| `modes/prospection.md` | existant | Mise à jour templates + règles dual-agent |
| `modes/_profile.md` | existant | Archetypes pivotés vers intégrateur/OEM |
| `industrial-prospect-scan.mjs` | existant | Étendu : LinkedIn Playwright + Google Maps + Kompass |
| `prospect-loop.mjs` | nouveau | Orchestrateur principal (modes + flags) |
| `relance-scheduler.mjs` | nouveau | Relances J+7/J+14 automatiques |
| `prospection.tsv` | existant | +2 colonnes : target_type, geo_priority |
| `batch/outreach-queue/` | nouveau | Queue PrepAgent |
| `batch/outreach-approved/` | nouveau | Approuvés par ReviewAgent |
| `batch/outreach-quarantine/` | nouveau | Rejetés avec raison |

---

## Pivot profil (`config/profile.yml`)

```yaml
positioning:
  primary: "Automaticien freelance -- renfort rapide intégrateurs et industriels"
  angle:
    - mise en service
    - renfort projet
    - retrofit
    - dispo rapide

geo:
  strict_geo: false
  priority_1: [Vaud, Genève, Fribourg, Neuchâtel, Valais, Jura]
  priority_2: [Zurich, Berne, Bâle]   # remote/hybride accepté
  excluded: [France, Allemagne, Italie]

targets:
  priority_1: [intégrateur automation, bureau d'études, société d'ingénierie]
  priority_2: [OEM machine, constructeur]
  priority_3: [industriel, maintenance, production]

outreach:
  daily_email_limit: 20
  daily_linkedin_limit: 15
  relance_j: 7
  relance_max: 2
```

---

## Sources de leads (`config/lead-sources.yml`)

```yaml
linkedin:
  queries:
    - "automaticien Suisse"
    - "automation engineer Switzerland"
    - "intégrateur Siemens Suisse"
    - "bureau d'études automatisme"
  filters:
    country: CH
    company_size: "10-500"
  max_per_run: 50

google_maps:
  zones:
    - "zone industrielle Vaud"
    - "zone industrielle Genève"
    - "zone industrielle Fribourg"
    - "zone industrielle Neuchâtel"
    - "zone industrielle Valais"
  keywords: [automatisme, intégrateur, robotique, automate, PLC, SCADA]
  max_per_run: 30

kompass:
  categories: [automation, "intégration systèmes", robotique]
  country: CH
  max_per_run: 30
```

---

## PrepAgent

**Invocation :** `claude -p` avec prompt composite = `_shared.md` + `prospection.md` + `_profile.md` + batch de prospects enrichis

**Templates selon signal :**

| Signal | Objet | Accroche |
|---|---|---|
| Embauche automaticien | Renfort automatisme dispo | "J'ai vu que vous recrutez un automaticien..." |
| Expansion / nouveau site | Renfort mise en service | "En lisant votre actualité sur [expansion]..." |
| Cold (aucun signal) | Automaticien freelance dispo | "Automaticien freelance basé en Suisse..." |

**Score confiance (1-5) :**
- 5 : signal fort + contact nominatif + proof point exact
- 4 : signal moyen ou contact générique
- 3 : cold, message standard mais correct
- < 3 : quarantaine directe (pas de passage ReviewAgent)

**Output TSV colonnes :**
`company | contact | email | linkedin | signal | subject | body | confidence | template_used`

---

## ReviewAgent -- Checklist 8 critères

| # | Critère | Règle |
|---|---|---|
| 1 | Vouvoiement | "vous" partout, jamais "tu" |
| 2 | Langue | accents FR corrects, zéro anglicisme non justifié |
| 3 | Em-dash | aucun `--` ou `—`, remplacer par virgule/parenthèse |
| 4 | Ton | peer-to-peer, pas commercial, pas d'exclamation |
| 5 | Signal cohérent | message correspond exactement au signal détecté |
| 6 | Géo | romande = ok direct, nationwide = mention remote explicite |
| 7 | Longueur | max 120 mots corps, objet < 8 mots |
| 8 | Doublons | email absent de prospection.tsv sauf si statut=archive |

**Comportement sur échec :** tentative de correction unique (réécriture partielle). Si toujours KO après correction, quarantaine avec colonne `rejection_reason`.

---

## `prospect-loop.mjs` -- Flags

```
node prospect-loop.mjs --mode=full        # pipeline complet
node prospect-loop.mjs --mode=prep-only   # acquisition + enrichissement + queue
node prospect-loop.mjs --mode=relances    # relances du jour uniquement
node prospect-loop.mjs --mode=leads       # acquisition nouveaux leads seulement
node prospect-loop.mjs --dry-run          # tout sauf envoi réel
```

---

## `prospection.tsv` -- Nouvelles colonnes

Ajout après colonne `notes` :
- `target_type` : integrateur / OEM / industriel
- `geo_priority` : 1 (romande) / 2 (nationwide remote)

---

## Scheduling recommandé

| Jour | Mode | Heure |
|---|---|---|
| Lundi / Mercredi / Vendredi | `--mode=full` | 08h00 |
| Mardi / Jeudi | `--mode=relances` | 08h00 |

Via `/schedule` ou cron : `node prospect-loop.mjs --mode=full`

---

## Contraintes et limites

- Hunter.io : quota API à surveiller (plan gratuit = 25 recherches/mois)
- LinkedIn : max 15 connexions/jour strict (risque ban compte)
- SMTP : max 20 emails/jour, délai 30-60s entre envois
- Google Maps scraping : pas d'API officielle, Playwright requis, risque CAPTCHA
- Kompass : scraping HTML, structure peut changer
- ReviewAgent : 1 retry max par message pour éviter boucles infinies

---

## Hors scope

- Téléphone (closing manuel, pas automatisable)
- Salons / networking (manuel)
- Reporting dashboard (existant via generate-dashboard.mjs)
- Canva / PDF pour intégrateurs (pas nécessaire pour prospection B2B)
