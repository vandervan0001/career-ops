# Mode : auto-pipeline -- Pipeline complet automatique (full-auto)

Quand l'utilisateur colle un cahier des charges (texte ou URL) sans sous-commande explicite, executer TOUT le pipeline en sequence :

## Etape 0 -- Extraire le cahier des charges

Si l'input est une **URL** (pas du texte colle), suivre cette strategie pour extraire le contenu :

**Ordre de priorite :**

1. **Playwright (prefere) :** La plupart des plateformes d'appels d'offres et portails d'emploi sont des SPAs. Utiliser `browser_navigate` + `browser_snapshot` pour rendre et lire le cahier des charges.
2. **WebFetch (fallback) :** Pour les pages statiques (sites institutionnels, pages carrieres classiques).
3. **WebSearch (dernier recours) :** Rechercher titre du mandat + entreprise sur des portails secondaires indexant le cahier des charges en HTML statique.

**Si aucune methode ne fonctionne :** Demander au consultant de coller le cahier des charges manuellement ou de partager une capture d'ecran.

**Si l'input est du texte** (pas une URL) : utiliser directement, sans fetch.

## Etape 0.5 -- Filtre geographique

**Avant toute evaluation**, verifier la localisation du mandat :

1. Lire `config/profile.yml` -> section `location`.
2. Si `strict_geo: true` :
   - Extraire la localisation du mandat (ville, canton, region mentionnes dans le cahier des charges).
   - Verifier contre `rejected_locations` : si la localisation du mandat contient un terme de cette liste -> **SKIP immediat**.
   - Verifier contre `accepted_locations` : si aucun terme de cette liste ne correspond -> **SKIP immediat**.
   - Si la localisation n'est pas mentionnee dans le cahier des charges, tenter une recherche WebSearch `"{entreprise}" localisation site Suisse` pour determiner le lieu.
   - Si impossible a determiner : continuer mais ajouter une note "Localisation non confirmee -- verifier manuellement".
3. Si SKIP :
   - Statut dans le tracker : `skip`
   - Note : "Hors zone geographique (Suisse romande uniquement)"
   - **Ne PAS continuer le pipeline.** Ecrire le TSV dans `batch/tracker-additions/` et s'arreter.

## Etape 1 -- Evaluation A-F
Executer exactement comme le mode `mandat` (lire `modes/mandat.md` pour tous les blocs A-F).

## Etape 2 -- Sauvegarder le report .md
Sauvegarder l'evaluation complete dans `reports/{###}-{client-slug}-{YYYY-MM-DD}.md` (voir format dans `modes/mandat.md`).

## Arbre de decision post-evaluation

Apres l'evaluation, le pipeline se branche selon le score :

- **Score >= 4.0** : Continuer etapes 3 a 6 (full-auto : CV + message + envoi)
- **Score >= 3.5 et < 4.0** : Executer etapes 3 et 4 (CV + message) mais **PAS** d'envoi automatique. Sauvegarder dans `output/` pour review manuel.
- **Score < 3.5** : SKIP. Mettre a jour le tracker uniquement (etape 7). Ne pas generer de CV ni de message.

## Etape 3 -- Generer CV PDF (score >= 3.5)

Executer le pipeline complet du mode `cv` (lire `modes/cv.md`) :

1. Lire `cv.md` comme source de verite
2. Extraire 15-20 mots-cles du cahier des charges
3. Adapter le CV au mandat (profil, projets cles, competences)
4. Generer le HTML depuis le template
5. Ecrire dans `/tmp/cv-vanguard-{client-slug}.html`
6. Executer : `node generate-pdf.mjs /tmp/cv-vanguard-{client-slug}.html output/cv-vanguard-{client-slug}-{YYYY-MM-DD}.pdf --format=a4`

## Etape 4 -- Generer message d'approche (score >= 3.5)

Generer un message personnalise en suivant le framework 3 phrases de `modes/contact.md` :

1. **Identifier la cible** : Chercher via WebSearch le decideur technique (CTO, chef de projet, responsable automation) de l'entreprise. Privilegier les decideurs operationnels, PAS les recruteurs.
2. **Generer le message** (framework 3 phrases) :
   - **Phrase 1 (Accroche)** : Element specifique sur LEUR entreprise ou defi actuel
   - **Phrase 2 (Preuve)** : Realisation la plus pertinente du consultant pour CE contexte
   - **Phrase 3 (Proposition)** : Echange de 15 min sur un sujet specifique
3. **Contrainte** : Maximum 300 caracteres (limite LinkedIn connection request)
4. **Generer 2 versions** :
   - Version email (plus longue, 5-8 phrases, inclut references et proposition de valeur)
   - Version LinkedIn (300 chars max, framework 3 phrases)
5. **Sauvegarder** :
   - Message email : `output/message-email-{client-slug}-{YYYY-MM-DD}.txt`
   - Message LinkedIn : `output/message-linkedin-{client-slug}-{YYYY-MM-DD}.txt`

Si score >= 3.5 et < 4.0 : generer les messages mais afficher un avertissement :
> "Score 3.X/5 -- messages generes dans output/ pour review manuel. Envoi automatique desactive."

## Etape 5 -- Envoi email (score >= 4.0 uniquement)

**Pre-requis** : Un email de contact a ete identifie (dans le cahier des charges, sur le site de l'entreprise, ou via WebSearch).

1. Ecrire le message email dans `/tmp/message-{client-slug}.txt`
2. Executer :
   ```bash
   node send-email.mjs --to "{contact_email}" --subject "Automation Engineer -- {mandat_title}" --body-file /tmp/message-{client-slug}.txt --attachment output/cv-vanguard-{client-slug}-{YYYY-MM-DD}.pdf
   ```
3. **Si aucun email trouve** : noter dans le tracker "Pas d'email de contact trouve -- envoi manuel requis" et continuer.
4. **Si l'envoi echoue** : noter l'erreur dans le tracker et continuer.

## Etape 6 -- Envoi LinkedIn (score >= 4.0 uniquement)

**Pre-requis** : Un profil LinkedIn cible a ete identifie a l'etape 4.

Utiliser les outils Chrome MCP pour envoyer une demande de connexion avec note :

1. `navigate` vers le profil LinkedIn du decideur cible
2. Chercher le bouton "Se connecter" / "Connect" et cliquer
3. Chercher le bouton "Ajouter une note" / "Add a note" et cliquer
4. Lire le contenu de `output/message-linkedin-{client-slug}-{YYYY-MM-DD}.txt`
5. Taper le message dans le champ de texte (300 chars max)
6. **Screenshot avant envoi** pour traçabilite
7. Cliquer sur "Envoyer" / "Send"

**Si le profil LinkedIn n'est pas trouve** : noter dans le tracker "Profil LinkedIn non identifie -- envoi manuel requis" et continuer.

**Si LinkedIn demande un CAPTCHA ou verification** : s'arreter et notifier le consultant.

**Voir `send-linkedin.mjs` pour la documentation detaillee du workflow.**

## Etape 7 -- Mettre a jour le tracker

Enregistrer dans `data/mandats.md` via `batch/tracker-additions/` avec toutes les colonnes :

| Colonne | Valeur |
|---------|--------|
| Statut | `skip` / `evalue` / `qualifie` (si envoye) |
| PDF | Oui/Non selon generation |
| Notes | Resume + canaux d'envoi utilises (email/LinkedIn/aucun) |

**Si une etape echoue**, continuer avec les suivantes et marquer l'etape en echec dans les notes du tracker.

## Resume du flux

```
URL/texte
   |
   v
[Etape 0] Extraire cahier des charges
   |
   v
[Etape 0.5] Filtre geo --> SKIP si hors zone
   |
   v
[Etape 1] Evaluation A-F --> Score
   |
   v
[Etape 2] Sauvegarder report
   |
   +-- Score < 3.5 ---------> Tracker only (SKIP)
   |
   +-- Score 3.5-3.9 -------> CV + Message (review manuel)
   |
   +-- Score >= 4.0 --------> CV + Message + Email + LinkedIn (full-auto)
   |
   v
[Etape 7] Tracker
```
