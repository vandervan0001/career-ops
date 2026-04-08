# Mode : cv -- Generation de CV consulting (PDF A4)

## Pipeline complet

1. Lire `cv.md` comme source de verite
2. Demander au consultant le cahier des charges si pas en contexte (texte ou URL)
3. Extraire 15-20 mots-cles du cahier des charges
4. Detecter la langue du cahier des charges -> langue du CV (FR par defaut)
5. Format papier : **toujours A4** (marche suisse/europeen)
6. Detecter l'archetype du mandat -> adapter le cadrage
7. Reecrire le Profil en injectant les mots-cles du cahier des charges + narratif Vanguard ("15+ ans d'experience en automatisation industrielle pharma. Specialise [domaine du cahier des charges].")
8. Selectionner les 3-4 projets cles les plus pertinents pour le mandat
9. Reordonner les bullets d'experience par pertinence au cahier des charges
10. Construire la grille de competences depuis les exigences du cahier des charges (6-8 phrases-cles)
11. Injecter les mots-cles naturellement dans les realisations existantes (JAMAIS inventer)
12. Generer le HTML complet depuis le template + contenu personnalise
13. Ecrire le HTML dans `/tmp/cv-vanguard-{client}.html`
14. Executer : `node generate-pdf.mjs /tmp/cv-vanguard-{client}.html output/cv-vanguard-{client}-{YYYY-MM-DD}.pdf --format=a4`
15. Reporter : chemin du PDF, nombre de pages, % de couverture des mots-cles

## Sections du CV consulting

L'ordre et le contenu sont adaptes pour un consultant en automatisation industrielle, pas pour un candidat a un poste salarie.

### Ordre des sections (optimise "lecture en 30 secondes")

1. **En-tete** (nom, titre, coordonnees, logo Vanguard optionnel)
2. **Profil** (3-4 lignes, dense en mots-cles du mandat)
3. **Competences techniques** (grille structuree par domaine : Automatisation, SCADA/DCS, Informatique industrielle, Methodologies, Outils)
4. **Projets cles** (3-4 projets les plus pertinents avec client, perimetre, resultats)
5. **Certifications** (Siemens, Rockwell, cybersecurite OT, GMP, etc.)
6. **Formation** (diplomes, ecoles)
7. **Langues** (FR/EN/DE avec niveaux CECRL)

### Differences avec un CV d'emploi

| Aspect | CV emploi (ancien pdf.md) | CV consulting (cv.md) |
|--------|---------------------------|------------------------|
| Objectif | Decrocher un entretien RH | Convaincre un decideur technique |
| Ton | "Je cherche un poste" | "Voici mon expertise deployee" |
| Focus | Parcours chronologique | Projets et resultats |
| Sections | Work Experience principale | Projets cles + Competences techniques |
| Metriques | Soft (equipe de X, croissance de Y%) | Hard (temps d'arret reduit de X%, migration en Y semaines) |

## Regles de qualite (lisibilite pour decideurs pharma)

- Layout single-column (pas de sidebars, pas de colonnes paralleles)
- Headers standard en francais : "Profil", "Competences techniques", "Projets cles", "Certifications", "Formation", "Langues"
- Pas de texte dans des images/SVGs
- Pas d'info critique dans les headers/footers du PDF
- UTF-8, texte selectionnable (pas rasterise)
- Pas de tableaux imbriques
- Mots-cles du cahier des charges distribues : Profil (top 5), premier bullet de chaque projet, section Competences

## Design du PDF

- **Fonts** : Space Grotesk (titres, 600-700) + DM Sans (corps, 400-500)
- **Fonts self-hosted** : `fonts/`
- **En-tete** : nom en Space Grotesk 24px bold + ligne gradiente `linear-gradient(to right, hsl(187,74%,32%), hsl(270,70%,45%))` 2px + ligne de contact
- **Titres de section** : Space Grotesk 13px, uppercase, letter-spacing 0.05em, couleur cyan primaire
- **Corps** : DM Sans 11px, line-height 1.5
- **Noms de clients** : couleur accent violet `hsl(270,70%,45%)`
- **Marges** : 0.6in
- **Fond** : blanc pur

## Strategie d'injection de mots-cles (ethique, basee sur la verite)

Exemples de reformulation legitime :
- Cahier des charges dit "migration PCS7 vers TIA Portal" et CV dit "modernisation de systemes de controle" -> changer en "migration PCS7 vers TIA Portal et modernisation de l'architecture de controle"
- Cahier des charges dit "cybersecurite OT" et CV dit "securisation des reseaux industriels" -> changer en "cybersecurite OT : segmentation reseau, durcissement SCADA, conformite IEC 62443"
- Cahier des charges dit "validation CSV" et CV dit "documentation de conformite" -> changer en "validation CSV (GAMP5, Annexe 11) et documentation de conformite reglementaire"

**JAMAIS ajouter des competences que le consultant n'a pas. Uniquement reformuler l'experience reelle avec le vocabulaire exact du cahier des charges.**

## Template HTML

Utiliser le template dans `cv-template.html`. Remplacer les placeholders `{{...}}` avec le contenu personnalise :

| Placeholder | Contenu |
|-------------|---------|
| `{{LANG}}` | `fr` (defaut) ou `en` ou `de` |
| `{{PAGE_WIDTH}}` | `210mm` (toujours A4) |
| `{{NAME}}` | (depuis profile.yml) |
| `{{EMAIL}}` | (depuis profile.yml) |
| `{{LINKEDIN_URL}}` | (depuis profile.yml) |
| `{{LINKEDIN_DISPLAY}}` | (depuis profile.yml) |
| `{{PORTFOLIO_URL}}` | (depuis profile.yml) |
| `{{PORTFOLIO_DISPLAY}}` | (depuis profile.yml) |
| `{{LOCATION}}` | (depuis profile.yml) |
| `{{SECTION_PROFILE}}` | Profil |
| `{{PROFILE_TEXT}}` | Profil personnalise avec mots-cles |
| `{{SECTION_COMPETENCIES}}` | Competences techniques |
| `{{COMPETENCIES}}` | `<span class="competency-tag">keyword</span>` x 6-8 |
| `{{SECTION_PROJECTS}}` | Projets cles |
| `{{PROJECTS}}` | HTML des 3-4 projets les plus pertinents |
| `{{SECTION_CERTIFICATIONS}}` | Certifications |
| `{{CERTIFICATIONS}}` | HTML des certifications |
| `{{SECTION_EDUCATION}}` | Formation |
| `{{EDUCATION}}` | HTML de la formation |
| `{{SECTION_LANGUAGES}}` | Langues |
| `{{LANGUAGES}}` | HTML des langues avec niveaux CECRL |

## Nom du fichier de sortie

```
output/cv-vanguard-{client}-{YYYY-MM-DD}.pdf
```

Exemples :
- `output/cv-vanguard-roche-2026-04-08.pdf`
- `output/cv-vanguard-novartis-2026-04-08.pdf`

## Post-generation

Mettre a jour le tracker si le mandat est deja enregistre : changer PDF de non a oui.
