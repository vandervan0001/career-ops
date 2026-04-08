# Mode : contact -- Prise de contact decideurs

## Cibles

Les cibles ne sont PAS des recruteurs. Ce sont des **decideurs operationnels** qui ont le pouvoir de lancer un mandat :

- **CTO / Directeur technique** : decideur final pour les projets d'automatisation
- **Directeur de projet / Chef de projet** : pilote les appels d'offres, connait les besoins
- **Responsable automatisation / OT Manager** : connait les pain points quotidiens
- **Responsable achats / Procurement** : gere les budgets et les contrats-cadres
- **Head of Engineering / VP Manufacturing** : vision strategique, budgets d'investissement

## Workflow

1. **Identifier les cibles** via WebSearch :
   - Decideur technique de l'equipe / departement concerne
   - Responsable du projet ou du budget
   - 2-3 pairs techniques (ingenieurs automation, responsables de site)

2. **Selectionner la cible primaire** : la personne qui a le plus a gagner de l'expertise Vanguard

3. **Generer le message** avec le framework 3 phrases :
   - **Phrase 1 (Accroche)** : Quelque chose de specifique sur LEUR entreprise ou un defi actuel (PAS generique)
   - **Phrase 2 (Preuve)** : La realisation la plus pertinente du consultant pour CE contexte (ex : "J'ai pilote la migration PCS7->TIA Portal pour un site pharma de 200 boucles de controle en 12 semaines")
   - **Phrase 3 (Proposition)** : Echange rapide, sans pression ("Un echange de 15 min sur [sujet specifique] ?")

4. **Versions linguistiques** :

### Version FR (defaut -- Suisse romande, France)
```
[Accroche specifique sur leur projet/defi]
[Preuve quantifiee la plus pertinente]
[Proposition d'echange de 15 min sur un sujet precis]
```

### Version EN (multinationales, contexte international)
```
[Specific hook about their project/challenge]
[Most relevant quantified proof point]
[15-min exchange proposal on a specific topic]
```

### Version DE (Suisse alemanique, Allemagne, Autriche)
```
[Spezifischer Aufhänger zu ihrem Projekt/Herausforderung]
[Relevantester quantifizierter Nachweis]
[Vorschlag für einen 15-minütigen Austausch zu einem konkreten Thema]
```

5. **Cibles alternatives** avec justification de pourquoi ce sont de bons seconds choix

## Regles du message

- **Maximum 300 caracteres** (limite LinkedIn connection request)
- PAS de corporate-speak
- PAS de "je serais ravi de..." ou "je me permets de..."
- Quelque chose qui donne envie de repondre -- un insight, une question, une preuve
- **JAMAIS partager de numero de telephone**
- Le ton est celui d'un pair, pas d'un vendeur : "J'ai vu que vous faites X, j'ai fait Y, on pourrait echanger sur Z ?"
- Adapter le vouvoiement/tutoiement au contexte (vouvoiement par defaut en Suisse et France, "Sie" en allemand)

## Exemples par contexte

### Decideur pharma (migration SCADA)
```
J'ai vu que Roche Basel lance la modernisation de ses systemes DCS. 
J'ai pilote 3 migrations PCS7->TIA Portal en environnement GMP (0 deviation majeure). 
15 min pour echanger sur les pieges classiques de ce type de projet ?
```

### Responsable OT Security
```
La directive NIS2 impacte vos sites de production suisses aussi. 
J'ai deploye la segmentation OT/IT conforme IEC 62443 pour 2 sites pharma. 
Un cafe virtuel pour discuter des quick wins ?
```

### Chef de projet automatisation
```
Votre projet de digitalisation du batch recording m'a interpelle. 
J'ai implemente MES/EBR sur Werum PAS-X pour un site de 4 lignes. 
15 min pour comparer nos approches ?
```

## Recherche des cibles

Utiliser WebSearch pour :
1. `"{entreprise}" "{departement}" site:linkedin.com/in/`
2. `"{entreprise}" automation OR automatisation director OR head OR manager site:linkedin.com/in/`
3. Verifier les publications recentes de la cible (articles, presentations, changements de poste)
4. Chercher les projets recents de l'entreprise (communiques de presse, rapports annuels)

## Post-contact

Suggerer le suivi :
- Si reponse positive -> proposer `/consulting-ops prepare` pour preparer la reunion
- Si pas de reponse apres 7 jours -> relance avec un nouvel angle (article, actualite du secteur)
- Enregistrer le statut dans `data/mandats.md`
