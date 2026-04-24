# Prospection Intégrateurs -- Design Spec
Date: 2026-04-24
Revision: 2 (post auto-challenge)

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
    Phase 1 (MVP) : LinkedIn Playwright + Jobup existant
    Phase 2 : Google Maps + Kompass (nouveau Playwright, risque CAPTCHA)
    - Dédup contre prospection.tsv (email + company slug)
         |
         v
[2] ENRICHISSEMENT (find-email.mjs adapté + enrich-context.mjs adapté)
    - find-email.mjs : Hunter.io domain search + name match + vérification
      ATTENTION : nécessite plan payant Hunter (>25 recherches/mois)
      Fallback : enrichissement manuel si quota dépassé
    - enrich-context.mjs : DOIT être adapté pour lire prospection.tsv
      (actuellement il lit data/prospects.tsv -- Scaliab CRM, mauvais fichier)
    - Website visit : signal douleur, offres emploi, actualités expansion
    - Score géo : romande=5, nationwide remote=3, exclu=0
         |
         v
[3] PREPAGENT (Agent subagent via prospect-loop.mjs)
    Contexte chargé : modes/prospection.md + modes/_profile.md + config/profile.yml
    - Sélectionne template selon signal détecté
    - Personnalise : nom contact, signal, proof point (Siemens/Rockwell/secteur)
    - Score confiance message (1-5) -- si < 3, quarantaine directe
    Output : output/prospection/queue/{YYYY-MM-DD}.tsv
    (aligné avec chemin existant outreach-dispatch.mjs, gitignored)
         |
         v
[4] REVIEWAGENT (Agent subagent, second pass)
    Checklist 8 critères (voir détail ci-dessous)
    - Approuvé → output/prospection/approved/{date}.tsv
    - Rejeté → tentative correction unique → si toujours KO → output/prospection/quarantine/{date}.tsv + rejection_reason
         |
         v
[5] SEND (outreach-dispatch.mjs modifié)
    FIX REQUIS : supprimer le filtre ligne 210 qui exclut 'integrateur'
    - SMTP email : max 20/jour, délai 30-60s entre envois
    - LinkedIn : PrepAgent génère le message, envoi manuel via Chrome MCP
      (send-linkedin.mjs = documentation uniquement, pas de code exécutable)
    - Met à jour prospection.tsv : statut envoye, date_envoi
         |
         v
[6] RELANCES (relance-scheduler.mjs nouveau)
    - Scan prospection.tsv : statut=envoye, date_envoi <= J-7
    - Génère relance → ReviewAgent → envoie
    - J+7 → relance_1 / J+14 → relance_2 / silence → archive
```

---

## Composants à construire

| Composant | Type | Action | Priorité |
|---|---|---|---|
| `config/profile.yml` | existant | Pivot positionnement + geo option C | P0 |
| `config/lead-sources.yml` | nouveau | Sources leads intégrateurs | P0 |
| `modes/prospection.md` | existant | Mise à jour templates intégrateur + règles dual-agent | P0 |
| `modes/_profile.md` | existant | Archetypes pivotés vers intégrateur/OEM | P0 |
| `prospection-core.mjs` | existant | Nouveaux services intégrateur (pitch "renfort terrain") | P0 |
| `outreach-dispatch.mjs:210` | existant | Supprimer filtre `integrateur` (BLOQUANT) | P0 |
| `enrich-context.mjs` | existant | Adapter pour lire prospection.tsv au lieu de prospects.tsv | P0 |
| `industrial-prospect-scan.mjs` | existant | Étendre : LinkedIn Playwright (phase 1) | P1 |
| `prospect-loop.mjs` | nouveau | Orchestrateur principal (modes + flags) | P1 |
| `relance-scheduler.mjs` | nouveau | Relances J+7/J+14 automatiques | P1 |
| `prospection.tsv` | existant | +2 colonnes (lire par header, pas par index) | P1 |
| `industrial-prospect-scan.mjs` | existant | Google Maps + Kompass (phase 2) | P2 |

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
# Phase 1 (MVP -- implémenté maintenant)
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

# Phase 2 (nouveau Playwright, risque CAPTCHA -- implémenté après MVP)
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

## Fix critique : `outreach-dispatch.mjs`

**Ligne 210 -- supprimer le filtre exclusif :**
```js
// AVANT (à supprimer)
selected = selected.filter((row) =>
  !['concurrent', 'integrateur', 'recruteur'].includes(inferClassification(row, profile))
);

// APRÈS -- garder uniquement concurrents et recruteurs
selected = selected.filter((row) =>
  !['concurrent', 'recruteur'].includes(inferClassification(row, profile))
);
```

---

## Fix critique : `enrich-context.mjs`

Actuellement lit `data/prospects.tsv` (CRM Scaliab). Doit être adapté pour accepter `--file data/prospection.tsv` avec mapping de colonnes dynamique par header (pas par index).

---

## Fix critique : `prospection.tsv` -- colonnes

**Règle de parsing :** tous les scripts qui lisent prospection.tsv DOIVENT utiliser le header pour mapper les colonnes, jamais par index fixe. Permet d'ajouter des colonnes sans casser l'existant.

**Nouvelles colonnes** (ajout après `notes`) :
- `target_type` : integrateur / OEM / industriel / client_final
- `geo_priority` : 1 (romande) / 2 (nationwide remote)

**Scripts à auditer pour migration index → header :**
- `outreach-dispatch.mjs` (loadTable function)
- `industrial-prospect-scan.mjs` (dedup check)
- `relance-scheduler.mjs` (nouveau, écrire en header-first dès le départ)

---

## `prospection-core.mjs` -- Nouveaux services intégrateur

Ajouter aux `DEFAULT_SERVICES` :
```js
{
  id: 'renfort_miseenservice',
  label: 'un renfort mise en service',
  pitch: 'intervenir rapidement sur chantier pour débloquer une mise en service ou absorber un pic de charge',
  trigger_signals: ['mise en service', 'commissioning', 'chantier', 'démarrage', 'recrutement automaticien'],
  preferred_sectors: ['intégrateur', 'OEM', 'bureau d\'études'],
},
{
  id: 'renfort_retrofit',
  label: 'un renfort retrofit / migration',
  pitch: 'prendre en charge une migration PLC/SCADA ou un retrofit machine sans mobiliser l\'équipe interne',
  trigger_signals: ['retrofit', 'migration', 'upgrade', 'modernisation', 'remplacement'],
  preferred_sectors: ['intégrateur', 'industriel', 'OEM'],
},
```

---

## PrepAgent

**Invocation :** `Agent(subagent_type='general-purpose', prompt=...)` depuis `prospect-loop.mjs`
Prompt composite = contenu de `modes/prospection.md` + `modes/_profile.md` + batch de prospects enrichis (JSON)

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
`company | contact | email | linkedin_url | signal | subject | body | confidence | template_used`

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
node prospect-loop.mjs --mode=prep-only   # acquisition + enrichissement + queue PrepAgent
node prospect-loop.mjs --mode=relances    # relances du jour uniquement
node prospect-loop.mjs --mode=leads       # acquisition nouveaux leads seulement
node prospect-loop.mjs --dry-run          # tout sauf envoi réel
```

**Chemin fichiers output (gitignored) :**
- `output/prospection/queue/{date}.tsv` -- PrepAgent output
- `output/prospection/approved/{date}.tsv` -- ReviewAgent approved
- `output/prospection/quarantine/{date}.tsv` -- ReviewAgent rejeté + reason

---

## `relance-scheduler.mjs`

```
1. Lit prospection.tsv par header (pas par index)
2. Filtre : statut IN [envoye, relance_1] ET date colonne <= J-7
3. Génère message relance (template court, rappel contexte)
4. Passe par ReviewAgent
5. Envoie via outreach-dispatch.mjs
6. Met à jour statut → relance_1 / relance_2 / archive
```

---

## LinkedIn -- clarification

Le PrepAgent génère le message LinkedIn (colonne `linkedin_url` + `body`). **L'envoi réel reste manuel via Chrome MCP** (`send-linkedin.mjs` est documentation uniquement). L'agent prépare le message dans la queue, l'humain clique.

Option future : Playwright automatisé si le compte LinkedIn n'est pas à risque.

---

## Scheduling recommandé

| Jour | Mode | Heure |
|---|---|---|
| Lundi / Mercredi / Vendredi | `--mode=full` | 08h00 |
| Mardi / Jeudi | `--mode=relances` | 08h00 |

Via `/schedule` ou cron : `node prospect-loop.mjs --mode=full`

---

## Contraintes et limites

- **Hunter.io** : plan gratuit = 25 recherches/mois. Pour 100 contacts/semaine, plan Starter (~49$/mois) requis. Sans plan payant, cap à ~6 nouveaux leads/semaine avec enrichissement auto.
- **LinkedIn** : max 15 connexions/jour strict (risque ban). Envoi reste manuel.
- **SMTP** : max 20 emails/jour, délai 30-60s entre envois.
- **Google Maps / Kompass** : phase 2 uniquement -- nouveau dev Playwright, risque CAPTCHA, pas dans le MVP.
- **ReviewAgent** : 1 retry max par message pour éviter boucles infinies.
- **TSV parsing** : tous les scripts DOIVENT lire par header, jamais par index fixe.

---

## Hors scope

- Téléphone (closing manuel)
- Salons / networking (manuel)
- LinkedIn envoi automatisé (risque ban, reste manuel)
- Google Maps / Kompass (phase 2)
- Reporting dashboard (existant via generate-dashboard.mjs)
- Canva / PDF pour intégrateurs (pas nécessaire pour prospection B2B)
