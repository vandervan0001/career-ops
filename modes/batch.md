# Mode : batch -- Traitement massif de mandats

Deux modes d'utilisation : **conductor --chrome** (navigue les portails en temps reel) ou **standalone** (script pour URLs deja collectees).

## Architecture

```
Claude Conductor (claude --chrome --dangerously-skip-permissions)
  |
  |  Chrome : navigue les portails (sessions connectees)
  |  Lit le DOM directement -- le consultant voit tout en temps reel
  |
  +- Mandat 1 : lit le cahier des charges du DOM + URL
  |    +-> claude -p worker -> report .md + CV PDF + tracker-line
  |
  +- Mandat 2 : clic suivant, lit cahier des charges + URL
  |    +-> claude -p worker -> report .md + CV PDF + tracker-line
  |
  +- Fin : merge tracker-additions -> mandats.md + resume
```

Chaque worker est un `claude -p` fils avec un contexte propre de 200K tokens. Le conductor ne fait qu'orchestrer.

## Fichiers

```
batch/
  batch-input.tsv               # URLs (par conductor ou manuellement)
  batch-state.tsv               # Progression (auto-genere, gitignored)
  batch-runner.sh               # Script orchestrateur standalone
  batch-prompt.md               # Template de prompt pour les workers
  logs/                         # Un log par mandat (gitignored)
  tracker-additions/            # Lignes de tracker (gitignored)
```

## Mode A : Conductor --chrome

1. **Lire l'etat** : `batch/batch-state.tsv` -> savoir ce qui a deja ete traite
2. **Naviguer le portail** : Chrome -> URL de recherche
3. **Extraire les URLs** : Lire le DOM des resultats -> extraire la liste d'URLs -> append a `batch-input.tsv`
4. **Pour chaque URL en attente** :
   a. Chrome : clic sur le mandat -> lire le texte du cahier des charges depuis le DOM
   b. Sauvegarder le cahier des charges dans `/tmp/batch-jd-{id}.txt`
   c. Calculer le prochain REPORT_NUM sequentiel
   d. Executer via Bash :
      ```bash
      claude -p --dangerously-skip-permissions \
        --append-system-prompt-file batch/batch-prompt.md \
        "Traite ce mandat. URL: {url}. Cahier des charges: /tmp/batch-jd-{id}.txt. Report: {num}. ID: {id}"
      ```
   e. Mettre a jour `batch-state.tsv` (completed/failed + score + report_num)
   f. Log dans `logs/{report_num}-{id}.log`
   g. Chrome : retour en arriere -> mandat suivant
5. **Pagination** : Si plus de mandats -> clic "Suivant" -> repeter
6. **Fin** : Merge `tracker-additions/` -> `mandats.md` + resume

## Mode B : Script standalone

```bash
batch/batch-runner.sh [OPTIONS]
```

Options :
- `--dry-run` -- liste les mandats en attente sans executer
- `--retry-failed` -- ne retente que les mandats echoues
- `--start-from N` -- commence a partir de l'ID N
- `--parallel N` -- N workers en parallele
- `--max-retries N` -- tentatives par mandat (defaut : 2)

## Format batch-state.tsv

```
id	url	status	started_at	completed_at	report_num	score	error	retries
1	https://...	completed	2026-...	2026-...	002	4.2	-	0
2	https://...	failed	2026-...	2026-...	-	-	Error msg	1
3	https://...	pending	-	-	-	-	-	0
```

## Resumabilite

- Si arret inopiné -> relancer -> lit `batch-state.tsv` -> ignore les completes
- Fichier de verrou (`batch-runner.pid`) empeche l'execution double
- Chaque worker est independant : un echec sur le mandat #47 n'affecte pas les autres

## Workers (claude -p)

Chaque worker recoit `batch-prompt.md` comme system prompt. Il est autonome.

Le worker produit :
1. Report `.md` dans `reports/`
2. CV PDF dans `output/`
3. Ligne de tracker dans `batch/tracker-additions/{id}.tsv`
4. JSON de resultat sur stdout

### Format TSV du worker (10 colonnes)

```
#	Date	Client	Mandat	Score	TJM	Statut	PDF	Report	Notes
001	2026-04-08	Roche	Migration PCS7	4.2	1400	Evalue	oui	001-roche-2026-04-08.md	-
```

| Colonne | Description |
|---------|-------------|
| # | Numero sequentiel (3 chiffres, zero-padded) |
| Date | Date d'evaluation (YYYY-MM-DD) |
| Client | Nom du client |
| Mandat | Titre / description courte du mandat |
| Score | Score d'evaluation (1-5) |
| TJM | Taux Journalier Moyen en CHF (ou EUR) |
| Statut | Statut du mandat dans le pipeline |
| PDF | CV PDF genere (oui/non) |
| Report | Nom du fichier report |
| Notes | Notes additionnelles |

## Gestion des erreurs

| Erreur | Recovery |
|--------|----------|
| URL inaccessible | Worker echoue -> conductor marque `failed`, suivant |
| Cahier des charges derriere un login | Conductor tente de lire le DOM. Si echec -> `failed` |
| Portail change de layout | Conductor raisonne sur le HTML, s'adapte |
| Worker crashe | Conductor marque `failed`, suivant. Retry avec `--retry-failed` |
| Conductor s'arrete | Relancer -> lit l'etat -> ignore les completes |
| PDF echoue | Report .md sauvegarde. PDF reste en attente |
