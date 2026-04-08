# Mode : auto-pipeline -- Pipeline complet automatique

Quand l'utilisateur colle un cahier des charges (texte ou URL) sans sous-commande explicite, executer TOUT le pipeline en sequence :

## Etape 0 -- Extraire le cahier des charges

Si l'input est une **URL** (pas du texte colle), suivre cette strategie pour extraire le contenu :

**Ordre de priorite :**

1. **Playwright (prefere) :** La plupart des plateformes d'appels d'offres et portails d'emploi sont des SPAs. Utiliser `browser_navigate` + `browser_snapshot` pour rendre et lire le cahier des charges.
2. **WebFetch (fallback) :** Pour les pages statiques (sites institutionnels, pages carrieres classiques).
3. **WebSearch (dernier recours) :** Rechercher titre du mandat + entreprise sur des portails secondaires indexant le cahier des charges en HTML statique.

**Si aucune methode ne fonctionne :** Demander au consultant de coller le cahier des charges manuellement ou de partager une capture d'ecran.

**Si l'input est du texte** (pas une URL) : utiliser directement, sans fetch.

## Etape 1 -- Evaluation A-F
Executer exactement comme le mode `mandat` (lire `modes/mandat.md` pour tous les blocs A-F).

## Etape 2 -- Sauvegarder le report .md
Sauvegarder l'evaluation complete dans `reports/{###}-{client-slug}-{YYYY-MM-DD}.md` (voir format dans `modes/mandat.md`).

## Etape 3 -- Generer le PDF (CV)
Executer le pipeline complet de `cv` (lire `modes/cv.md`).

## Etape 4 -- Brouillon de reponse commerciale (uniquement si score >= 4.0)

Si le score final est >= 4.0, generer un brouillon de positionnement pour la reponse :

1. **Extraire les exigences cles du cahier des charges** : identifier les livrables, contraintes techniques, delais, budget si mentionne.
2. **Generer les elements de reponse** suivant le ton (voir ci-dessous).
3. **Sauvegarder dans le report** comme section `## G) Brouillon de positionnement`.

### Elements de positionnement

- Pourquoi Vanguard Systems est qualifie pour ce mandat ?
- Quelle approche methodologique proposer ?
- Quels livrables concrets ?
- Quelles references pertinentes mettre en avant ?
- Quelle estimation de charge (jours/homme) ?

### Ton pour le positionnement commercial

**Position : "Nous selectionnons nos mandats."** Le consultant a une expertise pointue et choisit les mandats ou il peut apporter le plus de valeur.

**Regles de ton :**
- **Expert sans arrogance** : "Notre experience de 15+ projets de migration PCS7 vers TIA Portal nous permet d'anticiper les risques specifiques a votre environnement"
- **Selectif sans condescendance** : "Ce mandat correspond exactement a notre axe d'expertise en automatisation pharma GMP"
- **Specifique et concret** : Toujours referencer quelque chose de REEL du cahier des charges et quelque chose de REEL de l'experience du consultant
- **Direct, sans blabla** : 2-4 phrases par element. Pas de "nous serions ravis de..." ni "nous nous tenons a votre disposition pour..."
- **La preuve avant l'affirmation** : Au lieu de "nous sommes experts en X", dire "nous avons deploye X chez Y avec Z resultats"

**Framework par element :**
- **Pourquoi ce mandat ?** -> "Votre [besoin specifique] correspond directement a [projet/competence concret de Vanguard]."
- **Pourquoi Vanguard ?** -> Mentionner un projet similaire. "Nous avons realise [projet] pour [client] avec [resultat mesurable]."
- **Approche ?** -> Une methodologie claire avec phases et jalons.
- **Valeur ajoutee ?** -> "Nous apportons [A] et [B], ce qui est exactement ce que ce mandat demande."

**Langue** : Toujours en francais pour le marche suisse romand. Anglais si le cahier des charges est en anglais. Allemand si le cahier des charges est en allemand.

## Etape 5 -- Mettre a jour le tracker
Enregistrer dans `data/mandats.md` avec toutes les colonnes incluant Report et PDF en oui/non.

**Si une etape echoue**, continuer avec les suivantes et marquer l'etape en echec comme en attente dans le tracker.
