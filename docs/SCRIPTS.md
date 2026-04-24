# Scripts Reference

All scripts live in the project root as `.mjs` modules and are exposed via `npm run <name>`.

## Quick Reference

| Command | Script | Purpose |
|---------|--------|---------|
| `npm run doctor` | `doctor.mjs` | Validate setup prerequisites |
| `npm run verify` | `verify-pipeline.mjs` | Check pipeline data integrity |
| `npm run normalize` | `normalize-statuses.mjs` | Fix non-canonical statuses |
| `npm run dedup` | `dedup-tracker.mjs` | Remove duplicate tracker entries |
| `npm run merge` | `merge-tracker.mjs` | Merge batch TSVs into applications.md |
| `npm run pdf` | `generate-pdf.mjs` | Convert HTML to ATS-optimized PDF |
| `npm run sync-check` | `cv-sync-check.mjs` | Validate CV/profile consistency |
| `npm run accounts` | `account-growth.mjs` | Prioritize delegation-ready consulting accounts |
| `npm run outreach` | `outreach-sequence.mjs` | Generate email + follow-up + LinkedIn sequences per target account |
| `npm run outreach:prepare` | `outreach-runner.mjs` | Prepare the next email send step and ready-to-run SMTP commands |
| `npm run outreach:dispatch` | `outreach-dispatch.mjs` | Preview or send the next outbound step and update the prospection CRM |
| `npm run prospects:scan` | `industrial-prospect-scan.mjs` | Find new industrial prospects in Romandie from high-signal searches |
| `npm run prospects:enrich` | `industrial-prospect-enrich.mjs` | Enrich identified prospects with domain, decision-maker, and email when possible |
| `npm run prospects:loop` | `industrial-prospect-loop.mjs` | Run the sourcing loop end-to-end: scan, enrich, then rank accounts |
| `npm run prospects:classify` | `prospect-classification.mjs` | Persist account classes such as client_final, concurrent, integrateur, recruteur |
| `npm run prospects:review` | `prospects-review.mjs` | Review dynamic target accounts and the best Vanguard services to pitch next |
| `npm run update:check` | `update-system.mjs check` | Check for upstream updates |
| `npm run update` | `update-system.mjs apply` | Apply upstream update |
| `npm run rollback` | `update-system.mjs rollback` | Rollback last update |
| `npm run liveness` | `check-liveness.mjs` | Test if job URLs are still active |
| `npm run scan` | `scan.mjs` | Zero-token portal scanner |

---

## doctor

Validates that all prerequisites are in place: Node.js >= 18, dependencies installed, Playwright chromium, required files (`cv.md`, `config/profile.yml`, `portals.yml`), fonts directory, and auto-creates `data/`, `output/`, `reports/` if missing.

```bash
npm run doctor
```

**Exit codes:** `0` all checks passed, `1` one or more checks failed (fix messages printed).

---

## verify

Health check for pipeline data integrity. Validates `data/applications.md` against seven rules: canonical statuses (per `templates/states.yml`), no duplicate company+role pairs, all report links point to existing files, scores match `X.XX/5` / `N/A` / `DUP`, rows have proper pipe-delimited format, no pending TSVs in `batch/tracker-additions/`, and no markdown bold in scores.

```bash
npm run verify
```

**Exit codes:** `0` pipeline clean (zero errors), `1` errors found. Warnings (e.g. possible duplicates) do not cause a non-zero exit.

---

## normalize

Maps non-canonical statuses to their canonical equivalents and strips markdown bold and dates from the status column. Aliases like `Enviada` become `Aplicado`, `CERRADA` becomes `Descartado`, etc. DUPLICADO info is moved to the notes column.

```bash
npm run normalize             # apply changes
npm run normalize -- --dry-run  # preview without writing
```

Creates a `.bak` backup of `applications.md` before writing.

**Exit codes:** `0` always (changes or no changes).

---

## dedup

Removes duplicate entries from `applications.md` by grouping on normalized company name + fuzzy role match. Keeps the entry with the highest score. If a removed entry had a more advanced pipeline status, that status is promoted to the keeper.

```bash
npm run dedup             # apply changes
npm run dedup -- --dry-run  # preview without writing
```

Creates a `.bak` backup before writing.

**Exit codes:** `0` always.

---

## merge

Merges batch tracker additions (`batch/tracker-additions/*.tsv`) into `applications.md`. Handles 9-column TSV, 8-column TSV, and pipe-delimited markdown formats. Detects duplicates by report number, entry number, and company+role fuzzy match. Higher-scored re-evaluations update existing entries in place.

```bash
npm run merge                 # apply merge
npm run merge -- --dry-run    # preview without writing
npm run merge -- --verify     # merge then run verify-pipeline
```

Processed TSVs are moved to `batch/tracker-additions/merged/`.

**Exit codes:** `0` success, `1` verification errors (with `--verify`).

---

## pdf

Renders an HTML file to a print-quality, ATS-parseable PDF via headless Chromium. Resolves font paths from `fonts/`, normalizes Unicode for ATS compatibility (em-dashes, smart quotes, zero-width characters), and reports page count and file size.

```bash
npm run pdf -- input.html output.pdf
npm run pdf -- input.html output.pdf --format=letter   # US letter
npm run pdf -- input.html output.pdf --format=a4        # A4 (default)
```

**Exit codes:** `0` PDF generated, `1` missing arguments or generation failure.

---

## sync-check

Validates that the career-ops setup is internally consistent: `cv.md` exists and is not too short, `config/profile.yml` exists with required fields, no hardcoded metrics in `modes/_shared.md` or `batch/batch-prompt.md`, and `article-digest.md` freshness (warns if older than 30 days).

```bash
npm run sync-check
```

**Exit codes:** `0` no errors (warnings allowed), `1` errors found.

---

## accounts

Builds a delegation-first account report from `data/prospection.tsv`. It ranks companies by entry potential, delegation potential, expansion potential, and current momentum, then recommends the right offer to land the account as Vanguard rather than as generic staff augmentation.

```bash
npm run accounts
npm run accounts -- --top 8
npm run accounts -- --stdout-only
```

By default it writes `reports/account-growth-YYYY-MM-DD.md` and also prints the report to stdout.

**Exit codes:** `0` success, `1` only if Node fails before report generation.

---

## outreach

Generates a ready-to-send outreach sequence for consulting targets in `data/prospection.tsv`: subject line, initial email, follow-up 1, follow-up 2, and a short LinkedIn note. The sequence stays client-facing and does not mention any internal staffing transition.

```bash
npm run outreach -- --company "Straumann Group"
npm run outreach -- --company "OM Pharma" --write
npm run outreach -- --top 5
npm run outreach -- --status relance_1 --write
```

With `--write`, files are saved under `output/prospection/`.

**Exit codes:** `0` success, `1` no matching account or Node failure.

---

## outreach:prepare

Prepares the next outbound email step from `data/prospection.tsv` based on CRM status:
- `nouveau` -> initial email
- `envoye` -> follow-up 1
- `relance_1` -> follow-up 2

It prints the email body and the exact `send-email.mjs` command to run. With `--write`, it saves the draft files under `output/prospection/queue/` and creates a `send-commands.sh` batch file.

```bash
npm run outreach:prepare -- --status envoye --top 5
npm run outreach:prepare -- --status relance_1 --top 10 --write
npm run outreach:prepare -- --company "Straumann Group" --write
```

**Exit codes:** `0` success, `1` no matching email-ready account or Node failure.

---

## outreach:dispatch

Runs the outbound loop against `data/prospection.tsv`.

- Preview mode by default: selects eligible rows, writes the message body to `output/prospection/queue/`, and shows what would be sent.
- Live mode with `--live`: sends the email through SMTP and updates the row status plus notes in `data/prospection.tsv`.

Status transitions:
- `nouveau` -> sends initial email -> `envoye`
- `envoye` -> sends follow-up 1 -> `relance_1`
- `relance_1` -> sends follow-up 2 -> `relance_2`

```bash
npm run outreach:dispatch -- --status nouveau --top 5
npm run outreach:dispatch -- --status envoye --top 5 --live
npm run outreach:dispatch -- --company "Straumann Group"
```

Use `--live` only when you are ready to send and persist CRM updates.

**Exit codes:** `0` success, `1` no eligible account or send/runtime failure.

---

## prospects:scan

Searches for new Romandie industrial prospects using high-signal queries around:
- automation / OT hiring
- manufacturing expansion / investment
- OT / cyber / IEC 62443 / NIS2

It filters out staffing firms and irrelevant geographies, scores the hits, and appends new rows to `data/prospection.tsv` with `status=identifie`.

```bash
npm run prospects:scan
npm run prospects:scan -- --limit 20
npm run prospects:scan -- --dry-run
```

---

## prospects:enrich

Takes identified or partially enriched prospects from `data/prospection.tsv` and tries to add:
- official website domain
- likely decision-maker via search results
- email via Hunter when `config/hunter.yml` is present

```bash
npm run prospects:enrich
npm run prospects:enrich -- --top 10
npm run prospects:enrich -- --company "Straumann Group"
```

---

## prospects:loop

Runs the acquisition loop end-to-end:
1. `prospects:scan`
2. `prospects:enrich`
3. `accounts`
4. `prospects:review`

```bash
npm run prospects:loop
npm run prospects:loop -- --scan-limit 20 --enrich-top 12
npm run prospects:loop -- --dry-run
```

Use this as the autonomous sourcing pass for Vanguard.

---

## prospects:classify

Stores persistent account classification directly in the `notes` field of `data/prospection.tsv` using a `class:<type>` tag. The rest of the pipeline filters out `concurrent`, `integrateur`, and `recruteur`.

```bash
npm run prospects:classify -- --auto
npm run prospects:classify -- --company "Hydro Exploitation" --class concurrent
npm run prospects:classify -- --company "Takeda" --class client_final
npm run prospects:classify -- --list
```

---

## prospects:review

Builds a dynamic review from `data/prospection.tsv` and recommends the best Vanguard services for each target account based on the current signal, sector, and CRM notes. This is the command to use when you want the machine to say not just `who`, but also `what to sell`.

```bash
npm run prospects:review
npm run prospects:review -- --top 12
npm run prospects:review -- --stdout-only
```

By default it writes `reports/prospect-review-YYYY-MM-DD.md` and also prints the review to stdout.

---

## update:check

Checks whether a newer version of career-ops is available upstream. Outputs JSON to stdout:

```bash
npm run update:check
```

Possible JSON responses:

| `status` | Meaning |
|----------|---------|
| `up-to-date` | Local version matches remote |
| `update-available` | Newer version exists (includes `local`, `remote`, `changelog`) |
| `dismissed` | User dismissed the update prompt |
| `offline` | Could not reach GitHub |

**Exit codes:** `0` always.

---

## update

Applies the upstream update. Creates a backup branch (`backup-pre-update-{version}`), fetches from the canonical repo, checks out only system-layer files, runs `npm install`, and commits. User-layer files (`cv.md`, `config/profile.yml`, `data/`, etc.) are never touched.

```bash
npm run update
```

**Exit codes:** `0` success, `1` lock conflict or safety violation.

---

## rollback

Restores system-layer files from the most recent backup branch created during an update.

```bash
npm run rollback
```

**Exit codes:** `0` success, `1` no backup branch found or git error.

---

## liveness

Tests whether job posting URLs are still live using headless Chromium. Detects expired patterns (e.g. "job no longer available"), HTTP 404/410, ATS redirect patterns, and apply-button presence. Supports multi-language expired patterns (English, German, French).

```bash
npm run liveness -- https://example.com/job/123
npm run liveness -- https://a.com/job/1 https://b.com/job/2
npm run liveness -- --file urls.txt
```

Each URL gets a verdict: `active`, `expired`, or `uncertain` with a reason.

**Exit codes:** `0` all URLs active, `1` any expired or uncertain.

---

## scan

Zero-token portal scanner. Hits ATS APIs (Greenhouse, Ashby, Lever) and career pages directly — no LLM tokens consumed. Reads `portals.yml` for target companies and search queries, outputs matching listings to stdout and optionally appends to `data/pipeline.md`.

```bash
npm run scan
```

**Exit codes:** `0` scan completed, `1` configuration error or no portals.yml found.
