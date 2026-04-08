---
name: consulting-ops
description: Pipeline de mandats freelance -- evaluer mandats, generer CV, propositions, scanner portails, tracker mandats
user_invocable: true
args: mode
---

# consulting-ops -- Router

## Mode Routing

Determine the mode from `{{mode}}`:

| Input | Mode |
|-------|------|
| (empty / no args) | `discovery` -- Show command menu |
| JD text or URL (no sub-command) | **`auto-pipeline`** |
| `mandat` | `mandat` |
| `mandats` | `mandats` |
| `cv` | `cv` |
| `proposition` | `proposition` |
| `scan` | `scan` |
| `batch` | `batch` |
| `pipeline` | `pipeline` |
| `client` | `client` |
| `contact` | `contact` |
| `tracker` | `tracker` |
| `prepare` | `prepare` |
| `veille` | `veille` |
| `projet` | `projet` |
| `prospection` | `prospection` |

**Auto-pipeline detection:** If `{{mode}}` is not a known sub-command AND contains JD text (keywords: "responsibilities", "requirements", "qualifications", "profil recherche", "missions", "competences", company name + role) or a URL to a JD, execute `auto-pipeline`.

If `{{mode}}` is not a sub-command AND doesn't look like a JD, show discovery.

---

## Discovery Mode (no arguments)

Show this menu:

```
consulting-ops -- Centre de Commande

Commandes disponibles:
  /consulting-ops {JD}         -> AUTO-PIPELINE: evaluer + report + PDF + tracker (coller texte ou URL)
  /consulting-ops pipeline     -> Traiter les URLs en attente (data/pipeline.md)
  /consulting-ops mandat       -> Evaluation A-F uniquement (sans auto PDF)
  /consulting-ops mandats      -> Comparer et classer plusieurs mandats
  /consulting-ops cv           -> PDF uniquement, CV ATS-optimise
  /consulting-ops proposition  -> Generer une proposition commerciale
  /consulting-ops contact      -> Trouver contacts + rediger message
  /consulting-ops client       -> Recherche approfondie sur un client
  /consulting-ops tracker      -> Vue d'ensemble des mandats
  /consulting-ops prepare      -> Preparer une rencontre client
  /consulting-ops veille       -> Intelligence marche et tendances
  /consulting-ops projet       -> Evaluer une opportunite de projet
  /consulting-ops scan         -> Scanner les portails pour nouveaux mandats
  /consulting-ops batch        -> Traitement par lot avec workers paralleles

Inbox: ajouter URLs dans data/pipeline.md -> /consulting-ops pipeline
Ou collez un JD directement pour lancer le pipeline complet.
```

---

## Context Loading by Mode

After determining the mode, load the necessary files before executing:

### Modes that require `_shared.md` + their mode file:
Read `modes/_shared.md` + `modes/{mode}.md`

Applies to: `auto-pipeline`, `mandat`, `mandats`, `cv`, `proposition`, `contact`, `prepare`, `pipeline`, `scan`, `batch`

### Standalone modes (only their mode file):
Read `modes/{mode}.md`

Applies to: `tracker`, `client`, `veille`, `projet`

### Modes delegated to subagent:
For `scan`, `prepare` (with Playwright), and `pipeline` (3+ URLs): launch as Agent with the content of `_shared.md` + `modes/{mode}.md` injected into the subagent prompt.

```
Agent(
  subagent_type="general-purpose",
  prompt="[content of modes/_shared.md]\n\n[content of modes/{mode}.md]\n\n[invocation-specific data]",
  description="consulting-ops {mode}"
)
```

Execute the instructions from the loaded mode file.
