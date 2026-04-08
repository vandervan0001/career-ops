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
Objet: {poste} chez {company} — alternative rapide

Bonjour {prenom},

J'ai vu que vous cherchez un(e) {poste}. Le recrutement prend souvent 3-6 mois en automation — en attendant, {company_name} peut etre impact(e).

Chez Vanguard Systems, on intervient en delegation senior : {proof_point_pertinent}.

Un echange de 15 min pour voir si on peut aider en attendant votre recrutement ?

Tai Van | Vanguard Systems
+41 79 172 08 08 | vanguard-systems.ch
```

#### Entreprise en expansion / nouveau projet (signal moyen)
```
Objet: {type_projet} chez {company} — support automation

Bonjour {prenom},

J'ai lu que {company} {detail_expansion}. Ce type de projet genere souvent des besoins en {type_expertise}.

On a accompagne {client_reference} sur un projet similaire : {proof_point}.

Seriez-vous ouvert a un echange de 15 min ?

Tai Van | Vanguard Systems
```

#### Prospection a froid (pas de signal specifique)
```
Objet: Automation industrielle — {company}

Bonjour {prenom},

Je me permets de vous contacter car {company} evolue dans un secteur ou l'automation et la fiabilite des systemes sont critiques.

Vanguard Systems est un reseau de consultants seniors en automation industrielle. Nos clients (Merck, Novartis, Roche, Takeda) font appel a nous pour {type_besoin_secteur}.

Si {company} a des projets de {migration/modernisation/digitalisation/qualification}, je serais ravi d'en discuter.

Tai Van | Vanguard Systems
```

### Phase 5 — Envoi

- **Email** : via `node send-email.mjs --to "{email}" --subject "{objet}" --body-file /tmp/prospection-{company}.txt`
- **LinkedIn** : via Chrome MCP — connection request avec message court (300 chars)
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

## Regles

- JAMAIS envoyer de spam generique
- TOUJOURS personnaliser avec un fait specifique sur l'entreprise
- TOUJOURS proposer de la valeur (pas "je cherche du travail" mais "voici comment je peux aider")
- Respecter les limites de rate (email + LinkedIn)
- Si une entreprise demande de ne plus etre contactee → blacklist immediate
- Le ton est celui d'un pair, pas d'un vendeur
