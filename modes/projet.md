# Mode : projet -- Evaluation de projet portfolio

Scoring de 6 dimensions (1-5) pour evaluer si un projet interne merite d'etre developpe comme vitrine commerciale pour Vanguard Systems.

## Grille d'evaluation

| Dimension | Poids | 5 = ... | 1 = ... |
|-----------|-------|---------|---------|
| Signal pour mandats | 25% | Demontre directement une competence du cahier des charges type | Aucun lien avec les mandats cibles |
| Unicite | 20% | Personne d'autre ne propose ca en Suisse | Tous les integrateurs le font |
| Demo-ability | 20% | Demo live en 2 min devant un client | Seulement du code, rien de visuel |
| Potentiel de metriques | 15% | Metriques claires (temps d'arret, cout, conformite) | Aucune metrique possible |
| Temps a MVP | 10% | 1 semaine | 3+ mois |
| Potentiel commercial | 10% | Peut devenir une offre packagee ou un accelerateur de mandat | Aucune valeur commerciale directe |

## Exemples de projets pertinents pour Vanguard

| Projet | Signal | Unicite | Demo | Metriques | MVP | Commercial |
|--------|--------|---------|------|-----------|-----|------------|
| Outil audit cybersecurite OT | 5 | 4 | 4 | 5 | 3 | 5 |
| Dashboard migration PCS7 | 5 | 3 | 5 | 4 | 4 | 4 |
| Generateur de docs validation CSV | 4 | 4 | 3 | 3 | 4 | 5 |
| Template IQ/OQ/PQ automatise | 4 | 3 | 3 | 3 | 5 | 4 |

## Livrables pour chaque projet approuve

### 1. One-pager commercial
- Probleme client resolu + solution + architecture + metriques + plan d'evaluation
- Format : PDF A4, 1 page, design coherent avec les propositions Vanguard

### 2. Demo
- URL live ou walkthrough enregistre de 2 min
- Scenario de demo calque sur un cas client reel
- Donnees de demo realistes (pas de Lorem ipsum)

### 3. Fiche technique
- Stack technique, prerequis, limites connues
- Effort d'adaptation pour un contexte client
- Licence / propriete intellectuelle

## Plan 80/20

- **Semaine 1** -> MVP avec metrique core + demo minimale
- **Semaine 2** -> polish + one-pager commercial + integration dans le portfolio Vanguard

## Verdicts

- **CONSTRUIRE** -> plan avec jalons hebdomadaires, budget temps, objectif commercial clair
- **PASSER** -> justification et projet alternatif recommande
- **PIVOTER** -> variante plus impactante commercialement, avec description du pivot

## Format de sortie

```markdown
# Evaluation projet : {Nom du projet}

**Date :** {YYYY-MM-DD}
**Score global :** {moyenne ponderee}/5
**Verdict :** {CONSTRUIRE / PASSER / PIVOTER}

---

## Scores

| Dimension | Poids | Score | Justification |
|-----------|-------|-------|---------------|
| Signal pour mandats | 25% | X/5 | ... |
| Unicite | 20% | X/5 | ... |
| Demo-ability | 20% | X/5 | ... |
| Potentiel de metriques | 15% | X/5 | ... |
| Temps a MVP | 10% | X/5 | ... |
| Potentiel commercial | 10% | X/5 | ... |

## Analyse

(3-5 paragraphes : pourquoi ce projet, pour quel type de client, quel avantage concurrentiel)

## Plan d'action

(si CONSTRUIRE : jalons semaine par semaine)
(si PIVOTER : description du pivot + nouveau plan)
(si PASSER : alternatives recommandees)
```

## Sauvegarde

Sauvegarder dans `reports/projet-{nom-slug}-{YYYY-MM-DD}.md`.
