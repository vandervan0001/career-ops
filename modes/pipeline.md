# Mode : pipeline -- Inbox d'URLs (Second Brain)

Traite les URLs de mandats accumules dans `data/pipeline.md`. Le consultant ajoute des URLs quand il veut et lance ensuite `/consulting-ops pipeline` pour toutes les traiter d'un coup.

## Workflow

1. **Lire** `data/pipeline.md` -> trouver les items `- [ ]` dans la section "En attente"
2. **Pour chaque URL en attente** :
   a. Calculer le prochain `REPORT_NUM` sequentiel (lire `reports/`, prendre le numero le plus eleve + 1)
   b. **Extraire le cahier des charges** avec Playwright (`browser_navigate` + `browser_snapshot`) -> WebFetch -> WebSearch
   c. Si l'URL n'est pas accessible -> marquer comme `- [!]` avec une note et continuer
   d. **Executer l'auto-pipeline complet** : Evaluation A-F -> Report .md -> CV PDF (si score >= 3.0) -> Tracker
   e. **Deplacer de "En attente" vers "Traites"** : `- [x] #NNN | URL | Client | Mandat | Score/5 | PDF oui/non`
3. **Si 3+ URLs en attente**, lancer des agents en parallele (Agent tool avec `run_in_background`) pour maximiser la vitesse.
4. **A la fin**, afficher un tableau recapitulatif :

```
| # | Client | Mandat | Score | PDF | Action recommandee |
```

## Format de pipeline.md

```markdown
## En attente
- [ ] https://jobs.example.com/posting/123
- [ ] https://boards.greenhouse.io/company/jobs/456 | Roche SA | Migration PCS7
- [!] https://private.url/job -- Erreur : login requis

## Traites
- [x] #143 | https://jobs.example.com/posting/789 | Novartis AG | Automatisation labo | 4.2/5 | PDF oui
- [x] #144 | https://boards.greenhouse.io/xyz/jobs/012 | Lonza | Validation CSV | 2.1/5 | PDF non
```

## Detection intelligente du cahier des charges depuis l'URL

1. **Playwright (prefere) :** `browser_navigate` + `browser_snapshot`. Fonctionne avec toutes les SPAs.
2. **WebFetch (fallback) :** Pour les pages statiques ou quand Playwright n'est pas disponible.
3. **WebSearch (dernier recours) :** Chercher sur des portails secondaires qui indexent le mandat.

**Cas particuliers :**
- **LinkedIn** : Peut necessiter un login -> marquer `[!]` et demander au consultant de coller le texte
- **PDF** : Si l'URL pointe vers un PDF, le lire directement avec le Read tool
- **Prefixe `local:`** : Lire le fichier local. Exemple : `local:jds/roche-migration-pcs7.md` -> lire `jds/roche-migration-pcs7.md`

## Numerotation automatique

1. Lister tous les fichiers dans `reports/`
2. Extraire le numero du prefixe (ex : `142-novartis...` -> 142)
3. Nouveau numero = maximum trouve + 1

## Synchronisation des sources

Avant de traiter une URL, verifier la sync :

```bash
node cv-sync-check.mjs
```

En cas de desynchronisation, alerter le consultant avant de continuer.
