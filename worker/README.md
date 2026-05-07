# Vanguard tracker — déploiement Cloudflare Worker

## Étapes (5 min)

### 1. Setup Cloudflare Tunnel (expose le CRM local)

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create vanguard-crm
cloudflared tunnel route dns vanguard-crm crm.vanguard-systems.ch
```

Créer `~/.cloudflared/config.yml` :

```yaml
tunnel: vanguard-crm
credentials-file: /Users/tai/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: crm.vanguard-systems.ch
    service: http://localhost:7777
  - service: http_status:404
```

Lancer :

```bash
cloudflared tunnel run vanguard-crm
```

### 2. Déployer le Worker

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

### 3. Mapper le Worker à un sous-domaine

Dashboard Cloudflare → Workers & Pages → vanguard-tracker → Settings → Triggers → Custom Domains → ajouter `track.vanguard-systems.ch`.

### 4. Activer le tracking

Créer `config/tracking.yml` :

```yaml
enabled: true
base_url: "https://track.vanguard-systems.ch"
```

Dès que ce fichier existe, `outreach-dispatch.mjs` injecte automatiquement le pixel + wrappe les liens dans chaque mail.

### 5. Vérifier

Envoyer un mail test, l'ouvrir, cliquer un lien. Dans le CRM (http://localhost:7777, onglet Aujourd'hui), les KPIs `Opens trackés` et `Clicks` augmentent.

## Coûts

- Cloudflare Workers : gratuit jusqu'à 100k req/jour
- Cloudflare Tunnel : gratuit
- Total : 0 CHF/mois

## Limitations

- **Apple Mail Privacy Protection** : pré-fetch les pixels → ~30% de faux positifs
- **Gmail/Outlook** : images bloquées par défaut → pas d'open tant que user ne clique pas "Charger images"
- **Click tracking** : 100% fiable
- Logs sauvegardés dans `data/tracking.tsv`
