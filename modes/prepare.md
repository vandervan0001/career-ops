# Mode : prepare -- Preparation de reunion client

Genere un dossier de preparation complet pour une reunion avec un client ou prospect. Couvre l'ouverture, les questions de decouverte, les points de valeur, les objections anticipees, la negociation et les prochaines etapes.

## Declenchement

Quand le consultant a une reunion planifiee avec un client. Input : nom du client, contexte de la reunion (premier contact, presentation, negociation, suivi de mandat).

## Workflow

1. **Charger le contexte** : rechercher dans `reports/` un report client existant (`client-{slug}-*.md`) ou un report de mandat
2. **Si pas de recherche client existante** : executer automatiquement `modes/client.md` en abrege (axes 1, 2, 5)
3. **Generer le dossier de preparation** selon les sections ci-dessous
4. **Sauvegarder** dans `reports/prep-{client-slug}-{YYYY-MM-DD}.md`

## Sections du dossier

### 1. Ouverture (2-3 min)

- **Accroche** : un fait recent sur le client ou son secteur (actualite, projet annonce, publication)
- **Cadrage** : objectif de la reunion en 1 phrase
- **Agenda propose** : 3-4 points, avec durees estimees
- **Phrase de transition** : vers les questions de decouverte

Exemple :
> "J'ai vu que vous lancez la modernisation de votre ligne 3 a Kaiseraugst -- c'est exactement le type de projet ou nous intervenons. Aujourd'hui, j'aimerais comprendre vos contraintes pour voir si et comment on peut vous aider. On couvre le perimetre technique, le planning, et les criteres de selection en 30 min ?"

### 2. Questions de decouverte (8-10 questions par theme)

Generer des questions ouvertes, specifiques au contexte du client. Organiser par theme :

**Theme A -- Perimetre technique**
- Quels systemes sont concernes par le projet ? (marque, version, nombre de points I/O)
- Quelle est l'architecture cible ? Avez-vous deja un avant-projet ?
- Y a-t-il des interfaces critiques avec d'autres systemes (MES, ERP, LIMS) ?

**Theme B -- Contraintes et delais**
- Quel est le planning ideal ? Y a-t-il des arrets de production prevus ?
- Quelles sont les contraintes reglementaires (validation, qualification, audits) ?
- Quel est le budget alloue (ordre de grandeur) ?

**Theme C -- Organisation et decision**
- Qui sont les parties prenantes du projet ? Qui decide ?
- Avez-vous une equipe interne sur le projet ? Quel est le perimetre interne vs externe ?
- Comment se passe la selection des prestataires ? (appel d'offres formel, consultation directe, contrat-cadre)

**Theme D -- Historique et contexte**
- Avez-vous deja travaille avec des consultants externes sur ce type de projet ?
- Qu'est-ce qui a bien/mal fonctionne dans les projets precedents ?
- Pourquoi maintenant ? Quel est le declencheur du projet ?

### 3. Points de valeur Vanguard

Pour chaque pain point probable (issu de la recherche client ou des questions de decouverte) :
- **Le probleme** : reformulation empathique
- **Notre reponse** : experience concrete, projet similaire, resultat mesurable
- **La preuve** : reference, metrique, temoignage

Generer 4-6 points de valeur adaptes au contexte.

### 4. Objections anticipees

| Objection probable | Reponse preparee |
|---------------------|------------------|
| "Vous etes trop petit / pas assez connu" | "Notre taille est notre avantage : vous travaillez directement avec le consultant senior, pas avec un junior. Voici 3 references comparables." |
| "On a deja un integrateur" | "Je ne cherche pas a remplacer votre integrateur. On intervient souvent en complement sur [expertise specifique] ou en audit independant." |
| "C'est trop cher" | "Notre TJM reflete 15+ ans d'expertise pharma. Sur un projet de migration, ca represente [X]% du budget total pour [Y]% de la valeur ajoutee." |
| "On va faire en interne" | "C'est souvent la meilleure option pour la maintenance courante. Pour [type de projet specifique], un regard externe evite les biais et accelere le projet de [X] semaines." |
| "On n'a pas le budget maintenant" | "Je comprends. Quand est le prochain cycle budgetaire ? En attendant, un audit de 2-3 jours peut cadrer le projet et justifier le budget." |

Adapter les objections au contexte specifique de la reunion.

### 5. Strategie de negociation

- **Ancrage** : quel TJM/budget presenter en premier (si le sujet arrive)
- **BATNA** (Best Alternative To Negotiated Agreement) : que faire si ca ne marche pas ?
- **Zone d'accord possible** : TJM min/max, duree min/max, conditions de paiement
- **Concessions preparees** : que peut-on lacher ? (ex : 5% de remise contre un engagement de duree, paiement a 30j contre 60j)
- **Deal-breakers** : conditions non negociables (propriete intellectuelle, delais de paiement > 90j, etc.)

### 6. Red flags a surveiller

Signaux d'alerte pendant la reunion :
- Le decideur n'est pas present et ne sera pas implique
- Le budget n'est pas encore alloue et la timeline est "ASAP"
- Le client veut un devis fixe sans cahier des charges clair
- Demande de travail gratuit ("faites-nous une maquette/PoC d'abord")
- Le client compare uniquement sur le prix (course au TJM le plus bas)
- Historique de conflits avec les prestataires precedents
- Perimetre flou qui risque de gonfler ("on verra en avancant")

### 7. Prochaines etapes

Actions concretes a proposer en fin de reunion :
- **Si interet confirme** : proposition commerciale sous X jours, visite de site, PoC cadre
- **Si en reflexion** : envoyer un document de synthese, planifier un suivi dans 2 semaines
- **Si pas de fit** : remercier, rester en contact, proposer un autre type d'intervention
- **Dans tous les cas** : envoyer un email de synthese dans les 24h

## Format de sortie

```markdown
# Preparation reunion : {Client} -- {Date}

**Type :** {Premier contact / Presentation / Negociation / Suivi}
**Interlocuteurs :** {noms et roles si connus}
**Objectif :** {1 phrase}

---

## 1. Ouverture
(contenu)

## 2. Questions de decouverte
(contenu par theme)

## 3. Points de valeur
(contenu)

## 4. Objections anticipees
(tableau)

## 5. Negociation
(contenu)

## 6. Red flags
(liste)

## 7. Prochaines etapes
(actions)
```

## Sauvegarde

Sauvegarder dans `reports/prep-{client-slug}-{YYYY-MM-DD}.md`.
