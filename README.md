# Passerelle WhatsApp OCTOPLUS (Baileys)

Cette petite application envoie les alertes d'OCTOPLUS (congés, paie, tâches, messages, bugs…) sur WhatsApp, depuis **un numéro que vous reliez en scannant un QR code**, comme « WhatsApp Web ».

## À lire avant de commencer
- **Elle ne peut pas tourner sur Vercel** : elle doit rester connectée à WhatsApp en permanence. Il faut un petit serveur toujours allumé (Railway, Render, Fly.io, ou un VPS), environ 5 $/mois.
- Baileys est **non officiel** : WhatsApp peut bloquer le numéro utilisé. Utilisez **un numéro dédié à l'entreprise** (pas votre numéro personnel), n'envoyez pas de publicité, et gardez les plafonds par défaut.
- Alternative officielle et sans risque de blocage : l'API Cloud de Meta (déjà prise en charge par OCTOPLUS avec `WHATSAPP_TOKEN`).

## 1. Déployer la passerelle
### Option A : Railway ou Render (le plus simple)
1. Mettez ce dossier dans un dépôt GitHub **privé** (séparé du dépôt OCTOPLUS).
2. Créez un service à partir de ce dépôt (il détecte le `Dockerfile`).
3. Ajoutez un **volume persistant** monté sur `/data` (sans lui, il faudrait rescanner le QR code à chaque redémarrage).
4. Variables : `GATEWAY_API_KEY` (une longue clé aléatoire, 24 caractères minimum). Les autres sont facultatives (voir `.env.example`).
5. Notez l'adresse publique HTTPS du service, par exemple `https://octoplus-whatsapp.up.railway.app`.

### Option B : VPS avec Docker
```
docker build -t octoplus-whatsapp .
docker run -d --restart always --name octoplus-whatsapp -p 127.0.0.1:3000:3000 \
  -v octoplus-wa-data:/data -e GATEWAY_API_KEY=VOTRE_CLE_LONGUE octoplus-whatsapp
```
Mettez ensuite un reverse proxy HTTPS (Caddy ou Nginx) devant le port 3000.

## 2. Relier OCTOPLUS
Dans Vercel (Settings > Environment Variables, Production) ajoutez :
- `WHATSAPP_GATEWAY_URL` = l'adresse HTTPS de la passerelle (sans `/` final)
- `WHATSAPP_GATEWAY_KEY` = la même clé que `GATEWAY_API_KEY`

Redéployez, puis ouvrez OCTOPLUS (compte super administrateur) > **WhatsApp** : un QR code s'affiche.

## 3. Lier le numéro
Sur le téléphone du numéro dédié : WhatsApp > Paramètres > **Appareils connectés** > **Connecter un appareil**, puis scannez le QR code affiché dans OCTOPLUS. L'état passe à « Connecté ».
Envoyez un message test depuis la même page.

## Sécurité
- Toutes les routes (sauf `/health`) exigent la clé `x-api-key`. Ne la partagez jamais.
- La session WhatsApp est stockée dans `/data/auth` : protégez ce volume, il donne accès au compte WhatsApp.
- Les messages sont limités (pause aléatoire, plafond par heure) pour protéger le numéro.
- Pour délier le numéro : bouton « Déconnecter » dans OCTOPLUS, ou Appareils connectés sur le téléphone.
