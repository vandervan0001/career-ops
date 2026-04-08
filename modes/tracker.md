# Mode : tracker -- Suivi des mandats

Lit et affiche `data/mandats.md`.

## Format du tracker (10 colonnes)

```markdown
| # | Date | Client | Mandat | Score | TJM | Statut | PDF | Report | Notes |
```

| Colonne | Description |
|---------|-------------|
| # | Numero sequentiel (3 chiffres, zero-padded) |
| Date | Date d'evaluation (YYYY-MM-DD) |
| Client | Nom du client |
| Mandat | Titre / description courte du mandat |
| Score | Score d'evaluation (1-5) |
| TJM | Taux Journalier Moyen vise en CHF (ou EUR) |
| Statut | Statut du mandat dans le pipeline (voir ci-dessous) |
| PDF | CV PDF genere (oui/non) |
| Report | Lien relatif vers le fichier report (ex : `[001](reports/001-roche-2026-04-01.md)`) |
| Notes | Notes additionnelles (contact, prochaine etape, etc.) |

## Statuts du pipeline commercial

```
Evalue -> Contacte -> Proposition -> Negociation -> Signe -> En cours -> Termine
                                                          -> Perdu -> Abandonne
```

| Statut | Signification |
|--------|---------------|
| `Evalue` | Mandat evalue, pas encore de prise de contact |
| `Contacte` | Premier contact etabli avec le client (email, LinkedIn, telephone) |
| `Proposition` | Proposition commerciale envoyee |
| `Negociation` | En discussion sur les conditions (TJM, perimetre, planning) |
| `Signe` | Contrat ou bon de commande signe |
| `En cours` | Mandat en cours d'execution |
| `Termine` | Mandat livre et facture |
| `Perdu` | Mandat attribue a un concurrent ou annule par le client |
| `Abandonne` | Mandat ecarte par le consultant (pas de fit, TJM trop bas, etc.) |

Si le consultant demande de mettre a jour un statut, editer la ligne correspondante.

## Statistiques a afficher

Quand le consultant demande le tracker, afficher aussi :

### Vue d'ensemble
- Total de mandats dans le pipeline
- Par statut (nombre et %)
- Score moyen des mandats evalues

### Metriques commerciales
- **TJM moyen des mandats signes** (CHF)
- TJM moyen des propositions envoyees (CHF)
- Taux de conversion : Contacte -> Proposition -> Signe
- CA potentiel (somme TJM x jours estimes pour les mandats signes/en cours)

### Pipeline actif
- Mandats en attente de contact (Evalue, score >= 3.5)
- Mandats avec proposition en cours
- Mandats en negociation

### Alerte
- Mandats evalues depuis > 14 jours sans contact
- Propositions envoyees depuis > 7 jours sans reponse
- Mandats en negociation depuis > 21 jours

## Commandes

- `/consulting-ops tracker` : afficher le tracker + statistiques
- `/consulting-ops tracker update #NNN statut` : mettre a jour le statut d'un mandat
- `/consulting-ops tracker stats` : afficher uniquement les statistiques
