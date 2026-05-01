#!/bin/bash
# daily-outreach.sh — Lance la routine Claude /consulting-ops prospection lun-ven 9h00.
# Charge la skill consulting-ops, fait le ramp-up J2-J3=15, J4-J6=20, S2+=30/jour,
# enrichit le pipeline status=identifie, envoie via outreach-dispatch.mjs, commit + push.

set -uo pipefail

PROJECT_DIR="/Volumes/Tai_SSD/dev/Projects/Prospection"
CLAUDE_BIN="/Users/tai/.local/bin/claude"
LOG_DIR="$PROJECT_DIR/output/cron"
LOG_FILE="$LOG_DIR/daily-outreach-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR" || exit 1

# Calcule le quota du jour selon le ramp-up
TODAY=$(date +%Y-%m-%d)
case "$TODAY" in
  2026-05-04|2026-05-05) QUOTA=15 ;;        # J2-J3
  2026-05-06|2026-05-07|2026-05-08) QUOTA=20 ;;  # J4-J6
  *) QUOTA=30 ;;                             # Semaine 2+
esac

PROMPT="Tu es en mode batch quotidien cold mail. Aujourd'hui $(date +%A\ %Y-%m-%d), quota du jour: $QUOTA envois.

Charge la skill consulting-ops mode prospection. Suis exactement ce workflow :

1. Lis data/prospection.tsv. Compte les rows status=nouveau (déjà enrichis prêts à envoyer) et status=identifie (à enrichir).
2. Si rows status=nouveau >= $QUOTA, passe direct à l'étape 5.
3. Sinon, prends les rows status=identifie où email est vide, dans l'ordre du score décroissant. Pour chaque cible, jusqu'à atteindre $QUOTA enrichies :
   a. Détermine le domaine (extrait du nom d'entreprise ou via WebFetch sur le site web)
   b. node find-email.mjs --domain {domain} et choisis le meilleur contact (priorité management/engineering/executive, > 85%% confidence)
   c. Si rien trouvé, tente WebFetch sur le site /contact ou /equipe pour identifier un nom, puis node find-email.mjs --domain {domain} --name '{Prenom Nom}'
   d. **Re-écris le champ 'signal' en phrase humaine concrète et personnalisée** (pas une description sèche). Exemples :
      - mauvais : 'recrutement Director of Industrial Automation'
      - bon : 'vous renforcez votre équipe automation avec un nouveau directeur'
      - mauvais : 'OEM emballage Ecublens, automation team leader'
      - bon : 'vous concevez des machines d'emballage haute précision pour vos clients pharma'
      Si le contact recruté est senior (Head, Director, VP, C-level), ne formule PAS le pitch en mode 'remplacer pendant le recrutement', utilise un angle générique cohérent (renfort sur projet, partenariat FAT/SAT, etc.).
   e. Mets à jour la row : contact, email, linkedin (si trouvé), notes (Hunter %% + role), status=nouveau
4. Si pipeline status=identifie épuisé avant d'atteindre $QUOTA, scanne 5 nouvelles cibles via WebSearch sur OEM machines spéciales / intégrateurs FAT-SAT en Suisse romande (Vaud Genève Fribourg Neuchâtel Valais Jura), ajoute-les en status=identifie, puis recommence l'enrichissement.
5. Lance node outreach-dispatch.mjs --status nouveau --top $QUOTA --live et capture la sortie.
6. Vérifie que les envois sont OK. Pour chaque ENVOI confirmé, le statut bascule en envoye automatiquement.
7. Stage et commit data/prospection.tsv avec un message précis : 'chore: outreach J+N quota=$QUOTA, envoyés=X, contacts clés=Y'. Push si ahead of origin.
8. En fin, écris un résumé en français de 5 lignes max : nombre envoyé, contacts clés identifiés (nom + boîte), blockers s'il y en a, prochain quota.

Règles strictes (consulting-ops):
- Vouvoiement, salutation Bonjour Monsieur/Madame [NOM]
- Pas d'em-dashes en corps (parenthèses ou virgules)
- Français avec accents corrects partout
- Max 120 mots par mail
- Si une boîte fait partie de excluded_companies du profile.yml, skip
- Si une cible apparait déjà dans prospection.tsv (par company), ne pas la dupliquer

Travaille efficacement, ne pose aucune question, exécute jusqu'au bout."

echo "=== $(date) — Daily outreach quota=$QUOTA ===" >> "$LOG_FILE"
"$CLAUDE_BIN" -p "$PROMPT" --dangerously-skip-permissions >> "$LOG_FILE" 2>&1
EXIT_CODE=$?
echo "=== exit=$EXIT_CODE $(date) ===" >> "$LOG_FILE"
exit $EXIT_CODE
