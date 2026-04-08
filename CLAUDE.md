# Consulting-Ops -- Pipeline de Mandats Freelance

## Origin

Adapted from [career-ops](https://github.com/santifer/career-ops) for [Vanguard Systems](https://vanguard-systems.ch), a senior consulting network specializing in automation for pharma and regulated environments (Swiss market). The archetypes, scoring logic, proposal structure, and proof point framing all reflect Vanguard Systems' positioning: hands-on execution by senior consultants in industrial automation, OT cybersecurity, and data/AI for pharma.

**It will work out of the box, but it's designed to be made yours.** If the archetypes don't match your consulting practice, the scoring doesn't fit your priorities, or the templates need adjustment -- just ask. You (AI Agent) can edit the user's files. The user says "change the archetypes to data engineering consulting" and you do it. That's the whole point.

## Data Contract (CRITICAL)

There are two layers. Read `DATA_CONTRACT.md` for the full list.

**User Layer (NEVER auto-updated, personalization goes HERE):**
- `cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml`
- `data/*`, `reports/*`, `output/*`

**System Layer (auto-updatable, DON'T put user data here):**
- `modes/_shared.md`, all other modes
- `CLAUDE.md`, `*.mjs` scripts, `dashboard/*`, `templates/*`, `batch/*`

**THE RULE: When the user asks to customize anything (archetypes, narrative, proposal scripts, proof points, location policy, TJM targets), ALWAYS write to `modes/_profile.md` or `config/profile.yml`. NEVER edit `modes/_shared.md` for user-specific content.** This ensures system updates don't overwrite their customizations.

## Update Check

On the first message of each session, run the update checker silently:

```bash
node update-system.mjs check
```

Parse the JSON output:
- `{"status": "update-available", "local": "1.0.0", "remote": "1.1.0", "changelog": "..."}` -> tell the user:
  > "consulting-ops update available (v{local} -> v{remote}). Your data (CV, profile, tracker, reports) will NOT be touched. Want me to update?"
  If yes -> run `node update-system.mjs apply`. If no -> run `node update-system.mjs dismiss`.
- `{"status": "up-to-date"}` -> say nothing
- `{"status": "dismissed"}` -> say nothing
- `{"status": "offline"}` -> say nothing

The user can also say "check for updates" or "update consulting-ops" at any time to force a check.
To rollback: `node update-system.mjs rollback`

## What is consulting-ops

AI-powered consulting pipeline built on Claude Code: mandate evaluation, CV generation, proposal generation, portal scanning, batch processing. Designed for freelance consultants and consulting networks operating in regulated industries.

### Main Files

| File | Function |
|------|----------|
| `data/mandats.md` | Mandate tracker (10-column TSV) |
| `data/pipeline.md` | Inbox of pending URLs |
| `data/scan-history.tsv` | Scanner dedup history |
| `portals.yml` | Query and company config |
| `templates/cv-template.html` | HTML template for CVs |
| `templates/proposal-template.html` | HTML template for proposals |
| `generate-pdf.mjs` | Playwright: HTML to PDF |
| `reports/` | Evaluation reports (format: `{###}-{company-slug}-{YYYY-MM-DD}.md`) |

### First Run -- Onboarding (IMPORTANT)

**Before doing ANYTHING else, check if the system is set up.** Run these checks silently every time a session starts:

1. Does `cv.md` exist?
2. Does `config/profile.yml` exist (not just profile.example.yml)?
3. Does `modes/_profile.md` exist (not just _profile.template.md)?
4. Does `portals.yml` exist (not just templates/portals.example.yml)?

If `modes/_profile.md` is missing, copy from `modes/_profile.template.md` silently. This is the user's customization file -- it will never be overwritten by updates.

**If ANY of these is missing, enter onboarding mode.** Do NOT proceed with evaluations, scans, or any other mode until the basics are in place. Guide the user step by step **in French** (default language).

#### Step 1: CV (required)
If `cv.md` is missing, ask:
> "Je n'ai pas encore votre CV. Vous pouvez :
> 1. Coller votre CV ici et je le convertis en markdown
> 2. Coller votre URL LinkedIn et j'extrais les infos cles
> 3. Me decrire votre experience et je redige un CV pour vous
>
> Quelle option preferez-vous ?"

Create `cv.md` from whatever they provide. Clean markdown with standard sections (Profil, Competences Techniques, Projets Cles, Certifications, Formation).

#### Step 2: Profile (required)
If `config/profile.yml` is missing, copy from `config/profile.example.yml` and then ask:
> "J'ai besoin de quelques details pour personnaliser le systeme :
> - Votre nom complet et email
> - Votre localisation et timezone
> - Quels types de mandats ciblez-vous ? (ex: 'Automation Engineer', 'Solution Architect OT')
> - Votre TJM cible (fourchette)
>
> Je configure tout pour vous."

Fill in `config/profile.yml` with their answers.

#### Step 3: Portals (recommended)
If `portals.yml` is missing:
> "Je configure le scanner avec les portails pre-configures pour le marche suisse pharma. Voulez-vous personnaliser les mots-cles de recherche ?"

Copy `templates/portals.example.yml` -> `portals.yml`. If they gave target mandates in Step 2, update filters to match.

#### Step 4: Tracker
If `data/mandats.md` doesn't exist, create it:
```markdown
# Mandats Tracker

| # | Date | Client | Mandat | Score | TJM | Statut | PDF | Report | Notes |
|---|------|--------|--------|-------|-----|--------|-----|--------|-------|
```

#### Step 5: Get to know the consultant (important for quality)

After the basics are set up, proactively ask for more context:

> "Les bases sont pretes. Le systeme fonctionne mieux quand il vous connait bien. Pouvez-vous me dire :
> - Quelle est votre valeur unique ? Votre 'superpower' que les autres consultants n'ont pas ?
> - Quel type de mandats vous passionne ? Lesquels vous drainent ?
> - Des deal-breakers ? (ex: pas de regie longue duree, pas de sites hors Suisse romande)
> - Votre meilleure realisation professionnelle -- celle que vous mettriez en avant
> - Des projets, articles, ou case studies publies ?
>
> Plus vous me donnez de contexte, mieux je filtre. C'est comme onboarder un agent de placement -- la premiere semaine j'apprends, ensuite je deviens indispensable."

Store insights in `config/profile.yml` or `modes/_profile.md`.

#### Step 6: Ready
Once all files exist, confirm:
> "Vous etes pret ! Vous pouvez maintenant :
> - Coller une URL de mandat pour l'evaluer
> - Lancer `/consulting-ops scan` pour scanner les portails
> - Lancer `/consulting-ops` pour voir toutes les commandes
>
> Tout est personnalisable -- demandez-moi de changer ce que vous voulez."

### Personalization

This system is designed to be customized by YOU (AI Agent). When the user asks you to change archetypes, translate modes, adjust scoring, add companies, or modify proposal templates -- do it directly.

**Common customization requests:**
- "Change the archetypes to [data/cloud/devops] consulting" -> edit `modes/_shared.md`
- "Add these companies to my portals" -> edit `portals.yml`
- "Update my profile" -> edit `config/profile.yml`
- "Change the CV template design" -> edit `templates/cv-template.html`
- "Adjust the scoring weights" -> edit `modes/_shared.md` and `batch/batch-prompt.md`

### Skill Modes

| If the user... | Mode |
|----------------|------|
| Pastes JD or URL | `auto-pipeline` (evaluate + report + PDF + tracker) |
| Asks to evaluate mandate | `mandat` |
| Asks to compare mandates | `mandats` |
| Wants to generate CV/PDF | `cv` |
| Wants to generate proposal | `proposition` |
| Searches for new mandates | `scan` |
| Batch processes mandates | `batch` |
| Processes pending URLs | `pipeline` |
| Asks for client research | `client` |
| Wants contact/outreach | `contact` |
| Asks about mandate status | `tracker` |
| Prepares for client meeting | `prepare` |
| Market intelligence / trends | `veille` |
| Evaluates a project opportunity | `projet` |

### CV Source of Truth

- `cv.md` in project root is the canonical CV
- **NEVER hardcode metrics** -- read them from cv.md at evaluation time

---

## Ethical Use -- CRITICAL

**This system is designed for quality, not quantity.** The goal is to help the consultant find and pursue mandates where there is a genuine match -- not to spam clients with mass proposals.

- **NEVER send a proposal without the consultant reviewing it first.** Draft proposals, generate PDFs, adapt CVs -- but always STOP before sending. The consultant makes the final call.
- **Strongly discourage low-fit mandates.** If a score is below 4.0/5, explicitly recommend against pursuing. The consultant's time and the client's time are both valuable. Only proceed if the consultant has a specific reason to override the score.
- **Quality over speed.** A well-targeted proposal to 5 clients beats a generic blast to 50. Guide the consultant toward fewer, better mandates.
- **Respect clients' time.** Every proposal a client reads costs someone's attention. Only send what's worth reading.

---

## Offer Verification -- MANDATORY

**NEVER trust WebSearch/WebFetch to verify if a mandate is still active.** ALWAYS use Playwright:
1. `browser_navigate` to the URL
2. `browser_snapshot` to read content
3. Only footer/navbar without JD = closed. Title + description + Apply = active.

**Exception for batch workers (`claude -p`):** Playwright is not available in headless pipe mode. Use WebFetch as fallback and mark the report header with `**Verification:** unconfirmed (batch mode)`. The consultant can verify manually later.

---

## Stack and Conventions

- Node.js (mjs modules), Playwright (PDF + scraping), YAML (config), HTML/CSS (template), Markdown (data), Canva MCP (optional visual CV)
- Scripts in `.mjs`, configuration in YAML
- Output in `output/` (gitignored), Reports in `reports/`
- JDs in `jds/` (referenced as `local:jds/{file}` in pipeline.md)
- Batch in `batch/` (gitignored except scripts and prompt)
- Report numbering: sequential 3-digit zero-padded, max existing + 1
- **RULE: After each batch of evaluations, run `node merge-tracker.mjs`** to merge tracker additions and avoid duplications.
- **RULE: NEVER create new entries in mandats.md if client+mandat already exists.** Update the existing entry.

### TSV Format for Tracker Additions

Write one TSV file per evaluation to `batch/tracker-additions/{num}-{company-slug}.tsv`. Single line, 10 tab-separated columns:

```
{num}\t{date}\t{client}\t{mandat}\t{status}\t{score}/5\t{tjm}\t{pdf_emoji}\t[{num}](reports/{num}-{slug}-{date}.md)\t{note}
```

**Column order (IMPORTANT -- status BEFORE score):**
1. `num` -- sequential number (integer)
2. `date` -- YYYY-MM-DD
3. `client` -- client / company name
4. `mandat` -- mandate title / role
5. `status` -- canonical status (e.g., `evalue`)
6. `score` -- format `X.X/5` (e.g., `4.2/5`)
7. `tjm` -- daily rate in CHF (e.g., `1200 CHF`)
8. `pdf` -- check or cross emoji
9. `report` -- markdown link `[num](reports/...)`
10. `notes` -- one-line summary

**Note:** In mandats.md, score comes BEFORE status. The merge script handles this column swap automatically.

### Pipeline Integrity

1. **NEVER edit mandats.md to ADD new entries** -- Write TSV in `batch/tracker-additions/` and `merge-tracker.mjs` handles the merge.
2. **YES you can edit mandats.md to UPDATE status/notes of existing entries.**
3. All reports MUST include `**URL:**` in the header (between Score and PDF).
4. All statuses MUST be canonical (see `templates/states.yml`).
5. Health check: `node verify-pipeline.mjs`
6. Normalize statuses: `node normalize-statuses.mjs`
7. Dedup: `node dedup-tracker.mjs`

### Canonical States (mandats.md)

**Source of truth:** `templates/states.yml`

| State | When to use |
|-------|-------------|
| `identifie` | Opportunite reperee, pas encore analysee |
| `evalue` | Scoring fait, report genere |
| `qualifie` | Decision de poursuivre, premier contact etabli |
| `proposition` | CV adapte et/ou offre commerciale envoyee |
| `discussion` | Echanges en cours, negociation TJM |
| `signe` | Mandat confirme, PO/contrat recu |
| `en_cours` | Mission active |
| `termine` | Mission livree |
| `perdu` | Pas retenu ou abandonne |
| `skip` | Pas interessant apres evaluation |

**RULES:**
- No markdown bold (`**`) in status field
- No dates in status field (use the date column)
- No extra text (use the notes column)
