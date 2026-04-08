# Mode : scan -- Scanner de portails (Decouverte de mandats)

Scanne les portails d'emploi et plateformes de mandats configures, filtre par pertinence de titre, et ajoute les nouveaux mandats au pipeline pour evaluation ulterieure.

## Execution recommandee

Executer comme sous-agent pour ne pas consommer le contexte du main :

```
Agent(
    subagent_type="general-purpose",
    prompt="[contenu de ce fichier + donnees specifiques]",
    run_in_background=True
)
```

## Configuration

Lire `portals.yml` qui contient :
- `search_queries` : Liste de queries WebSearch avec filtres `site:` par portail (decouverte large)
- `tracked_companies` : Entreprises specifiques avec `careers_url` pour navigation directe
- `title_filter` : Keywords positifs/negatifs/seniority_boost pour le filtrage des titres

## Strategie de decouverte (3 niveaux)

### Niveau 1 -- Playwright direct (PRINCIPAL)

**Pour chaque entreprise dans `tracked_companies` :** Naviguer vers sa `careers_url` avec Playwright (`browser_navigate` + `browser_snapshot`), lire TOUS les job listings visibles, et extraire titre + URL de chaque mandat. C'est la methode la plus fiable car :
- Voit la page en temps reel (pas de resultats caches Google)
- Fonctionne avec les SPAs (Ashby, Lever, Workday)
- Detecte les nouveaux mandats instantanement
- Ne depend pas de l'indexation Google

**Chaque entreprise DOIT avoir `careers_url` dans portals.yml.** Si elle n'existe pas, la chercher une fois, la sauvegarder, et l'utiliser pour les prochains scans.

### Niveau 2 -- Greenhouse API (COMPLEMENTAIRE)

Pour les entreprises avec Greenhouse, l'API JSON (`boards-api.greenhouse.io/v1/boards/{slug}/jobs`) renvoie des donnees structurees propres. Utiliser en complement rapide du Niveau 1 -- plus rapide que Playwright mais ne fonctionne qu'avec Greenhouse.

### Niveau 3 -- WebSearch queries (DECOUVERTE LARGE)

Les `search_queries` avec filtres `site:` couvrent les portails de maniere transversale (tous les Ashby, tous les Greenhouse, etc.). Utile pour decouvrir de NOUVELLES entreprises pas encore dans `tracked_companies`, mais les resultats peuvent etre desactualises.

**Priorite d'execution :**
1. Niveau 1 : Playwright -> toutes les `tracked_companies` avec `careers_url`
2. Niveau 2 : API -> toutes les `tracked_companies` avec `api:`
3. Niveau 3 : WebSearch -> tous les `search_queries` avec `enabled: true`

Les niveaux sont additifs -- tous sont executes, les resultats sont fusionnes et dedupliques.

## Workflow

1. **Lire la configuration** : `portals.yml`
2. **Lire l'historique** : `data/scan-history.tsv` -> URLs deja vues
3. **Lire les sources de dedup** : `data/mandats.md` + `data/pipeline.md`

4. **Niveau 1 -- Scan Playwright** (parallele par lots de 3-5) :
   Pour chaque entreprise dans `tracked_companies` avec `enabled: true` et `careers_url` definie :
   a. `browser_navigate` vers la `careers_url`
   b. `browser_snapshot` pour lire tous les listings
   c. Si la page a des filtres/departements, naviguer les sections pertinentes
   d. Pour chaque listing extraire : `{title, url, company}`
   e. Si la page pagine les resultats, naviguer les pages supplementaires
   f. Accumuler dans la liste de candidats
   g. Si `careers_url` echoue (404, redirect), essayer `scan_query` en fallback et noter pour mise a jour de l'URL

5. **Niveau 2 -- APIs Greenhouse** (parallele) :
   Pour chaque entreprise dans `tracked_companies` avec `api:` definie et `enabled: true` :
   a. WebFetch de l'URL d'API -> JSON avec liste de mandats
   b. Pour chaque mandat extraire : `{title, url, company}`
   c. Accumuler dans la liste de candidats (dedup avec Niveau 1)

6. **Niveau 3 -- WebSearch queries** (parallele si possible) :
   Pour chaque query dans `search_queries` avec `enabled: true` :
   a. Executer WebSearch avec le `query` defini
   b. De chaque resultat extraire : `{title, url, company}`
      - **title** : du titre du resultat (avant le " @ " ou " | ")
      - **url** : URL du resultat
      - **company** : apres le " @ " dans le titre, ou extraire du domaine/path
   c. Accumuler dans la liste de candidats (dedup avec Niveau 1+2)

7. **Filtrer par titre** en utilisant `title_filter` de `portals.yml` :
   - Au moins 1 keyword de `positive` doit apparaitre dans le titre (case-insensitive)
   - 0 keywords de `negative` ne doivent apparaitre
   - Les keywords `seniority_boost` donnent la priorite mais ne sont pas obligatoires

8. **Dedupliquer** contre 3 sources :
   - `scan-history.tsv` -> URL exacte deja vue
   - `mandats.md` -> client + mandat normalise deja evalue
   - `pipeline.md` -> URL exacte deja en attente ou traitee

8.5. **Verifier la vivacite des resultats WebSearch (Niveau 3)** -- AVANT d'ajouter au pipeline :

   Les resultats de WebSearch peuvent etre desactualises (Google cache les resultats pendant des semaines ou mois). Pour eviter d'evaluer des mandats expires, verifier avec Playwright chaque URL nouvelle provenant du Niveau 3. Les Niveaux 1 et 2 sont inherement en temps reel et ne necessitent pas cette verification.

   Pour chaque URL nouvelle de Niveau 3 (sequentiel -- JAMAIS Playwright en parallele) :
   a. `browser_navigate` vers l'URL
   b. `browser_snapshot` pour lire le contenu
   c. Classifier :
      - **Actif** : titre du poste visible + description du mandat + bouton Postuler/Apply/Submit
      - **Expire** (l'un de ces signaux) :
        - URL finale contient `?error=true` (Greenhouse redirige ainsi quand le mandat est ferme)
        - Page contient : "job no longer available" / "no longer open" / "position has been filled" / "this job has expired" / "page not found"
        - Seulement navbar et footer visibles, pas de contenu (contenu < ~300 chars)
   d. Si expire : enregistrer dans `scan-history.tsv` avec statut `skipped_expired` et ignorer
   e. Si actif : continuer a l'etape 9

   **Ne pas interrompre le scan entier si une URL echoue.** Si `browser_navigate` donne une erreur (timeout, 403, etc.), marquer comme `skipped_expired` et passer a la suivante.

9. **Pour chaque mandat nouveau verifie passant les filtres** :
   a. Ajouter a `pipeline.md` section "En attente" : `- [ ] {url} | {company} | {title}`
   b. Enregistrer dans `scan-history.tsv` : `{url}\t{date}\t{query_name}\t{title}\t{company}\tadded`

10. **Mandats filtres par titre** : enregistrer dans `scan-history.tsv` avec statut `skipped_title`
11. **Mandats dupliques** : enregistrer avec statut `skipped_dup`
12. **Mandats expires (Niveau 3)** : enregistrer avec statut `skipped_expired`

## Extraction de titre et entreprise des resultats WebSearch

Les resultats de WebSearch viennent au format : `"Job Title @ Company"` ou `"Job Title | Company"` ou `"Job Title -- Company"`.

Patterns d'extraction par portail :
- **Ashby** : `"Senior Automation Engineer (Remote) @ Roche"` -> title: `Senior Automation Engineer`, company: `Roche`
- **Greenhouse** : `"OT Security Consultant at Novartis"` -> title: `OT Security Consultant`, company: `Novartis`
- **Lever** : `"Process Automation Lead - Pharma @ Lonza"` -> title: `Process Automation Lead - Pharma`, company: `Lonza`

Regex generique : `(.+?)(?:\s*[@|—–-]\s*|\s+at\s+)(.+?)$`

## URLs privees

Si une URL non accessible publiquement est trouvee :
1. Sauvegarder le cahier des charges dans `jds/{company}-{role-slug}.md`
2. Ajouter a pipeline.md comme : `- [ ] local:jds/{company}-{role-slug}.md | {company} | {title}`

## Historique des scans

`data/scan-history.tsv` trace TOUTES les URLs vues :

```
url	first_seen	portal	title	company	status
https://...	2026-02-10	Ashby — Automation	Automation Engineer	Roche	added
https://...	2026-02-10	Greenhouse — OT	Junior Dev	Novartis	skipped_title
https://...	2026-02-10	Ashby — Pharma	Process Lead	Lonza	skipped_dup
https://...	2026-02-10	WebSearch — PCS7	Migration PCS7	ClosedCo	skipped_expired
```

## Resume de sortie

```
Scan des portails -- {YYYY-MM-DD}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Queries executes : N
Mandats trouves : N total
Filtres par titre : N pertinents
Dupliques : N (deja evalues ou en pipeline)
Expires ignores : N (liens morts, Niveau 3)
Nouveaux ajoutes a pipeline.md : N

  + {company} | {title} | {query_name}
  ...

-> Execute /consulting-ops pipeline pour evaluer les nouveaux mandats.
```

## Gestion des careers_url

Chaque entreprise dans `tracked_companies` doit avoir `careers_url` -- l'URL directe vers sa page de mandats. Cela evite de la chercher a chaque fois.

**Patterns connus par plateforme :**
- **Ashby :** `https://jobs.ashbyhq.com/{slug}`
- **Greenhouse :** `https://job-boards.greenhouse.io/{slug}` ou `https://job-boards.eu.greenhouse.io/{slug}`
- **Lever :** `https://jobs.lever.co/{slug}`
- **Custom :** L'URL propre de l'entreprise (ex : `https://careers.roche.com/`)

**Si `careers_url` n'existe pas** pour une entreprise :
1. Essayer le pattern de sa plateforme connue
2. Si ca echoue, faire un WebSearch rapide : `"{company}" careers jobs`
3. Naviguer avec Playwright pour confirmer que ca fonctionne
4. **Sauvegarder l'URL trouvee dans portals.yml** pour les prochains scans

**Si `careers_url` renvoie 404 ou redirect :**
1. Noter dans le resume de sortie
2. Essayer scan_query en fallback
3. Marquer pour mise a jour manuelle

## Maintenance du portals.yml

- **TOUJOURS sauvegarder `careers_url`** quand une nouvelle entreprise est ajoutee
- Ajouter de nouveaux queries selon les portails ou mandats decouverts
- Desactiver les queries avec `enabled: false` s'ils generent trop de bruit
- Ajuster les keywords de filtrage selon l'evolution des mandats cibles
- Ajouter des entreprises a `tracked_companies` quand on souhaite les suivre de pres
- Verifier `careers_url` periodiquement -- les entreprises changent de plateforme ATS
