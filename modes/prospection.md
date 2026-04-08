# Mode : prospection — Machine a leads outbound

Prospection froide automatisee : identifier des entreprises qui ont besoin de services automation/OT, trouver les decideurs, et envoyer des messages personnalises.

## Strategie de ciblage

### Signaux d'achat (comment detecter qu'une entreprise a besoin de nous)

1. **Offres d'emploi ouvertes en automation** — Si une boite cherche un "Automation Engineer" ou "Chef de projet automation", c'est qu'elle a un gap. On peut proposer nos services en attendant qu'elle recrute (ou a la place).
2. **Projets d'expansion / investissement** — Nouvelles lignes, nouveaux batiments, acquisitions. WebSearch : "{company} expansion investment site Suisse"
3. **Vieillissement des systemes** — Entreprises qui tournent encore sur PCS7 v7, S5, vieilles versions de WinCC. Signal : offres mentionnant "migration", "upgrade", "modernisation"
4. **Reglementation / compliance** — NIS2, IEC 62443, nouvelles annexes GMP. Les entreprises doivent se mettre en conformite.
5. **Incidents / recalls** — Si une entreprise a eu des problemes de qualite, des rappels de produits, des deviations FDA — elle a besoin d'aide.
6. **Turnover equipe automation** — Beaucoup de departs sur LinkedIn = equipe fragilisee = besoin de renfort externe.

### Industries cibles (Suisse romande)

Toute industrie avec des systemes automatises et un budget >= 1000 CHF/jour :
- Pharma / biotech / medtech
- Chimie fine / specialty chemicals
- Agroalimentaire / F&B
- Horlogerie / luxe (manufacturing)
- Energie / utilities
- Cleantech
- Logistique avancee
- Batiment industriel

## Workflow

### Phase 1 — Recherche de cibles

Pour chaque secteur, executer ces recherches :

```
WebSearch: "{secteur}" automation OR "chef de projet" OR "ingenieur" site:linkedin.com/company Suisse romande OR Lausanne OR Geneve OR Vaud
WebSearch: "{secteur}" "investissement" OR "expansion" OR "nouvelle ligne" OR "nouveau batiment" Suisse romande 2026
WebSearch: "{secteur}" entreprise Vaud OR Geneve OR Fribourg OR Neuchatel OR Valais manufacturing automation
```

Aussi :
- Scanner les membres de associations : ISPE Suisse, Swiss Biotech, SSIC, Swissmem
- Registre du commerce cantonal (zefix.ch) pour nouvelles entreprises
- Swiss startup radar (startupticker.ch)

### Phase 2 — Qualification

Pour chaque entreprise trouvee, evaluer :

| Critere | Score 1-5 |
|---------|-----------|
| Taille (assez grande pour des mandats > 1000 CHF/j) | |
| Localisation (Suisse romande) | |
| Probabilite de besoin automation/OT | |
| Budget probable (industrie, taille) | |
| Accessibilite (a-t-on un angle d'approche ?) | |

Score >= 3.5 = cible qualifiee.

### Phase 3 — Trouver les decideurs

Pour chaque cible qualifiee :

1. **WebSearch LinkedIn** :
   ```
   site:linkedin.com/in "{company}" automation OR engineering OR production OR "chef de" OR "head of" OR "directeur" Suisse
   ```
2. **Identifier le bon contact** (par ordre de preference) :
   - Head of Engineering / Responsable automation
   - Directeur de production / Plant manager
   - CTO / Directeur technique
   - Directeur achats (si pas de profil technique trouve)

3. **Trouver l'email via Hunter.io** :
   ```bash
   # Chercher par nom + domaine (methode preferee, 1 credit)
   node find-email.mjs --domain company.ch --name "Jean Dupont"

   # Lister tous les emails d'un domaine avec departement (1 credit)
   node find-email.mjs --domain company.ch --role engineering

   # Verifier un email avant envoi (1 credit)
   node find-email.mjs --verify jean.dupont@company.ch
   ```
   **Ordre de priorite :**
   a. Hunter.io email-finder (nom + domaine) — le plus fiable
   b. Hunter.io domain-search filtré engineering/management — si le nom n'est pas trouvé
   c. Pattern standard (prenom.nom@domain.ch) vérifié via Hunter email-verifier
   d. En dernier recours : contact@ ou info@ du site web (moins efficace mais mieux que rien)

### Phase 4 — Message personnalise

**Framework par type d'entreprise :**

#### Entreprise qui recrute un poste automation (signal fort)
```
Objet : {poste} chez {company}

Bonjour,

J'ai vu que vous cherchez un(e) {poste}. Le recrutement prend souvent 3 à 6 mois en automation. En attendant, je peux intervenir en délégation senior.

J'ai accompagné {client_reference} sur un projet similaire : {proof_point_pertinent}.

Seriez-vous disponible pour un échange de 15 minutes ?

Bien cordialement,
Tai Van
Vanguard Systems
+41 79 172 08 08
vanguard-systems.ch
```

#### Entreprise en expansion / nouveau projet (signal moyen)
```
Objet : {type_projet} chez {company}

Bonjour,

J'ai lu que {company} {détail_expansion}. Ce type de projet génère souvent des besoins en {type_expertise}.

J'ai accompagné {client_référence} sur un projet similaire : {proof_point}.

Seriez-vous ouvert à un échange de 15 minutes ?

Bien cordialement,
Tai Van
Vanguard Systems
+41 79 172 08 08
vanguard-systems.ch
```

#### Prospection à froid (pas de signal spécifique)
```
Objet : Automation industrielle chez {company}

Bonjour,

Je me permets de vous contacter car {company} évolue dans un secteur où l'automation et la fiabilité des systèmes sont critiques.

Je suis consultant senior en automation industrielle, basé en Suisse romande. J'ai accompagné Merck, Novartis, Roche et Takeda sur des projets de {type_besoin_secteur}.

Si {company} a des projets de migration, modernisation ou qualification, je serais disponible pour en discuter.

Bien cordialement,
Tai Van
Vanguard Systems
+41 79 172 08 08
vanguard-systems.ch
```

**REGLE CRITIQUE : Tous les messages DOIVENT être rédigés en français correct avec les accents (é, è, ê, à, ù, ç, î, ô). Jamais de "e" sans accent quand il faut un "é". Jamais de "a" sans accent quand c'est "à". Le français sans accents donne une impression d'amateurisme.**

### Phase 5 — Envoi

- **Email** : via `node send-email.mjs --to "{email}" --subject "{objet}" --body-file /tmp/prospection-{company}.txt`
- **LinkedIn** : via Chrome MCP — workflow exact :
  1. `navigate` vers le profil LinkedIn
  2. `screenshot` pour verifier que c'est un decideur (titre dans le profil)
  3. `find` "Se connecter button on profile section" → `left_click` sur le ref
  4. `wait` 2 sec
  5. `key` "Tab Tab Return" → ouvre le champ de note
  6. `wait` 2 sec
  7. `type` le message (300 chars max)
  8. `key` "Tab Tab Return" → envoie
  9. `wait` 3 sec + `screenshot` → verifier "Invitation envoyee" dans le toast
  10. Si CAPTCHA ou rate limit → STOP, notifier, skip le reste
- **Tracking** : chaque envoi est enregistre dans `data/prospection.tsv`

### Phase 6 — Suivi

- J+7 sans reponse → relance avec un nouvel angle (article, actualite secteur, cas d'usage)
- J+14 sans reponse → derniere relance
- J+21 sans reponse → archiver, re-contacter dans 3 mois

## Fichier de tracking : data/prospection.tsv

```
date	company	contact	email	linkedin	sector	signal	score	message_sent	status	notes
2026-04-08	Firmenich	Jean Dupont	j.dupont@firmenich.com	linkedin.com/in/jeandupont	Chimie	Expansion	4.2	email+linkedin	envoye	Attente reponse
```

Statuts : identifie, qualifie, envoye, relance_1, relance_2, reponse, rdv, perdu, archive

## Cadence de prospection

- **Objectif** : 10-15 nouveaux contacts qualifies par semaine
- **Limite d'envoi** : max 50 emails/jour (reputation SMTP), max 20 connections LinkedIn/jour (anti-ban)
- **Personnalisation obligatoire** : JAMAIS de message generique. Chaque message reference un fait specifique sur l'entreprise.

## Regles generales

- JAMAIS envoyer de spam generique
- TOUJOURS personnaliser avec un fait specifique sur l'entreprise
- TOUJOURS proposer de la valeur (pas "je cherche du travail" mais "voici comment je peux aider")
- Respecter les limites de rate (email + LinkedIn)
- Si une entreprise demande de ne plus etre contactee → blacklist immediate
- Le ton est celui d'un pair, pas d'un vendeur

## Regles d'ecriture — STRICTES (email + LinkedIn)

### Style obligatoire
- Naturel, comme un humain ecrirait. Pas de ton IA.
- Phrases courtes. 2-3 phrases pour LinkedIn, 4-5 pour email.
- Vouvoiement en Suisse, toujours.
- Un fait specifique sur EUX, pas sur nous.

### Interdit
- Tirets longs (—), listes a puces dans les messages
- "Je serais ravi de...", "je me permets de...", "n'hesitez pas a..."
- Superlatifs ("excellent", "formidable", "impressionnant", "unique")
- Corporate-speak ("synergie", "valeur ajoutee", "win-win", "leverage")
- Emojis
- Exclamation marks (!)
- Mots en gras ou italique dans les messages

### LinkedIn — connection request (300 chars max)
- Max 2-3 phrases. Pas plus.
- Pas de pitch. On ne vend rien. On propose un echange ou on dit pourquoi on se connecte.
- Si possible, mentionner un contenu qu'ils ont publie ou partage.
- Ton = collegue senior de la meme industrie, pas vendeur.

#### Exemples qui marchent
```
Bonjour, j'ai vu votre projet d'expansion a Bulle. Je travaille en automation pharma dans la region, ca pourrait valoir un echange.
```
```
Bonjour, on evolue dans le meme secteur en Suisse romande. Je fais de l'automation industrielle pour des sites de production. Content de vous avoir dans mon reseau.
```
```
Votre post sur la digitalisation m'a interpelle. Je bosse sur des sujets similaires cote OT/automation. Ouvert a echanger ?
```

#### Ce qui tue le taux d'acceptation
- Messages generiques copier-coller
- Pitcher ses services dans la connection request
- Parler de soi au lieu de parler d'eux
- Ton trop formel ou robotique
- Envoyer sans avoir regarde le profil

### LinkedIn — qui connecter (filtre qualite)
**OUI :**
- C-level, VP, Directeurs, Head of
- Responsables de departement, Plant managers
- Decision-makers qui signent des bons de commande

**NON :**
- Ingenieurs individuels
- Recruteurs / RH / talent acquisition
- Commerciaux / sales
- Profils juniors
- Profils hors industrie/manufacturing
