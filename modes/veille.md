# Mode : veille -- Intelligence marche

Evalue un sujet, une technologie ou une tendance selon 6 dimensions orientees business consulting. Aide le consultant a decider s'il faut investir du temps/argent sur un sujet et comment le monetiser.

## Declenchement

Quand le consultant demande une analyse de sujet technique, une tendance du marche, une nouvelle reglementation, ou un evenement sectoriel.

## Les 6 dimensions d'evaluation

| Dimension | Ce qu'elle evalue | Score 1-5 |
|-----------|-------------------|-----------|
| Pertinence business | Impact direct sur les mandats Vanguard ? | 5 = genere des mandats directement, 1 = aucun lien |
| Signal marche suisse | Adoption en Suisse et pays limitrophes ? | 5 = deja en deploiement, 1 = pas encore sur le radar |
| Competitivite | Avantage concurrentiel pour Vanguard ? | 5 = rare expertise, 1 = tout le monde le fait |
| Investissement requis | Temps/argent pour maitriser le sujet | 5 = quelques jours, 1 = plusieurs mois + certification couteuse |
| Risques | Risques d'investir dans ce sujet | 5 = aucun risque, 1 = technologie immature ou en declin |
| Opportunite commerciale | Potentiel de chiffre d'affaires | 5 = marche large et solvable, 1 = niche sans budget |

## Sujets prioritaires (Vanguard Systems)

### Tier 1 -- Core business (suivi continu)
- **Migrations PCS7 -> TIA Portal** : Siemens pousse la fin de vie PCS7. Marche massif en pharma et chimie
- **Cybersecurite OT** : IEC 62443, NIS2, directive suisse sur la cybersecurite. Urgence reglementaire
- **Pharma AI / Data Integrity** : IA appliquee a la production pharma, Annexe 11, 21 CFR Part 11
- **Industry 4.0 / Smart Manufacturing** : IoT industriel, digital twins, MES avance

### Tier 2 -- Croissance (veille active)
- **Nouvelles reglementations GMP** : EU GMP Annex 1 (revision), PIC/S guidelines, Swissmedic updates
- **Cloud pour l'OT** : edge computing, SCADA dans le cloud, OPC UA over MQTT
- **Robotique et AGV en pharma** : automatisation logistique, clean rooms
- **Sustainability / Green manufacturing** : efficacite energetique, monitoring CO2

### Tier 3 -- Emergence (veille passive)
- **Quantum computing pour la pharma** : simulation moleculaire, optimisation de processus
- **AR/VR pour la maintenance** : assistance a distance, formation immersive
- **Blockchain pour la supply chain pharma** : tracabilite, serialisation

## Format d'analyse

Pour chaque sujet evalue, produire :

```markdown
# Veille : {Sujet}

**Date :** {YYYY-MM-DD}
**Categorie :** {Tier 1 / Tier 2 / Tier 3}
**Score global :** {moyenne ponderee}/5

---

## Evaluation

| Dimension | Score | Justification |
|-----------|-------|---------------|
| Pertinence business | X/5 | ... |
| Signal marche suisse | X/5 | ... |
| Competitivite | X/5 | ... |
| Investissement requis | X/5 | ... |
| Risques | X/5 | ... |
| Opportunite commerciale | X/5 | ... |

## Contexte et analyse

(3-5 paragraphes : etat de l'art, tendances, acteurs cles)

## Impact sur le marche suisse

(Specificites du marche suisse : reglementation, acteurs locaux, calendrier d'adoption)

## Implications pour Vanguard

- **Opportunites de mandats** : types de missions que ca genere
- **Competences a developper** : ce qu'il faut apprendre/certifier
- **Positionnement recommande** : comment communiquer sur ce sujet
- **Timeline** : quand agir (maintenant, 6 mois, 1 an)

## Sources

(liste des sources utilisees avec dates)
```

## Verdicts

- **INVESTIR** -> plan d'action concret (formation, certification, article, offre commerciale) avec budget temps
- **SURVEILLER** -> ajout a la watchlist, point de revue dans X mois
- **IGNORER** -> justification, sujet alternatif recommande

## Recherche

Utiliser WebSearch pour :
1. Actualites recentes sur le sujet (dernieres 6 mois)
2. Adoption en Suisse et en Europe (conferences, white papers, cas d'usage)
3. Offres d'emploi mentionnant le sujet (signal de demande)
4. Concurrents positiones sur le sujet (integrateurs, societes de conseil)
5. Publications reglementaires (Swissmedic, EMA, FDA)

## Sauvegarde

Sauvegarder dans `reports/veille-{sujet-slug}-{YYYY-MM-DD}.md`.
