# Mode: mandats -- Comparaison multi-mandat

Matrice de scoring a 10 dimensions ponderees pour comparer plusieurs mandats simultanement.

## Dimensions de scoring

| # | Dimension | Poids | Criteres 1-5 |
|---|-----------|-------|---------------|
| 1 | Fit technique | 20% | 5 = 90%+ match competences, 1 = <40% |
| 2 | Archetype match | 15% | 5 = archetype cible exact, 1 = hors perimetre |
| 3 | TJM / Budget | 15% | 5 = top quartile marche suisse, 1 = nettement sous marche |
| 4 | Duree & volume | 10% | 5 = 6+ mois temps plein, 1 = <1 mois ou flou |
| 5 | Localisation | 10% | 5 = Suisse romande / remote, 1 = relocation exigee |
| 6 | Client / Reputation | 10% | 5 = grand pharma / reference secteur, 1 = red flags |
| 7 | Potentiel commercial | 5% | 5 = upsell/extension probable, 1 = one-shot sans suite |
| 8 | Conformite reglementaire | 5% | 5 = GAMP5/FDA/GxP = terrain connu, 1 = domaine non maitrise |
| 9 | Autonomie & cadre | 5% | 5 = autonomie totale, scope clair, 1 = micromanagement / scope flou |
| 10 | Red flags | 5% | 5 = aucun, 1 = blockers multiples |

## Processus de comparaison

### 1. Collecte des mandats

Demander au consultant les mandats a comparer. Accepter :
- Texte colle directement
- URLs de plateformes (Freelancermap, Michael Page, Hays, LinkedIn, etc.)
- References a des mandats deja evalues dans le tracker

### 2. Scoring individuel

Pour chaque mandat, evaluer les 10 dimensions et calculer le score pondere :

```
Score = sum(dimension_i * poids_i) pour i = 1..10
```

### 3. Matrice de comparaison

| Dimension (poids) | Mandat A | Mandat B | Mandat C |
|-------------------|----------|----------|----------|
| 1. Fit technique (20%) | X/5 | X/5 | X/5 |
| 2. Archetype match (15%) | X/5 | X/5 | X/5 |
| 3. TJM / Budget (15%) | X/5 | X/5 | X/5 |
| 4. Duree & volume (10%) | X/5 | X/5 | X/5 |
| 5. Localisation (10%) | X/5 | X/5 | X/5 |
| 6. Client / Reputation (10%) | X/5 | X/5 | X/5 |
| 7. Potentiel commercial (5%) | X/5 | X/5 | X/5 |
| 8. Conformite reglementaire (5%) | X/5 | X/5 | X/5 |
| 9. Autonomie & cadre (5%) | X/5 | X/5 | X/5 |
| 10. Red flags (5%) | X/5 | X/5 | X/5 |
| **Score pondere** | **X.X/5** | **X.X/5** | **X.X/5** |

### 4. Ranking et recommandation

Classer les mandats par score pondere decroissant.

Pour chaque mandat, indiquer :
- **Verdict** : Prioritaire (4.5+) / Bon (4.0-4.4) / Acceptable (3.5-3.9) / Passer (<3.5)
- **Archetype detecte**
- **Points forts** : 2-3 dimensions ou le mandat excelle
- **Points faibles** : 2-3 dimensions a risque
- **Consideration temporelle** : disponibilite de demarrage, duree du process de selection

### 5. Recommandation finale

Synthese en 3-5 phrases :
- Quel mandat prioriser et pourquoi
- Quels mandats poursuivre en parallele
- Quels mandats passer (et pourquoi)
- Considerations de pipeline : eviter de s'engager sur un mandat moyen si un meilleur est en vue
