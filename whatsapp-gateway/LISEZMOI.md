# Passerelle WhatsApp (Baileys) pour OCTOPLUS RH

Petit serveur qui envoie les alertes et messages de l'application par WhatsApp, via un numéro **lié comme un appareil connecté** (comme WhatsApp Web).

## ⚠ À savoir avant de commencer
- Baileys n'est **pas** l'API officielle de WhatsApp : ce mode peut contrevenir aux conditions d'utilisation de WhatsApp et **le numéro peut être bloqué**.
  Utilisez un numéro **dédié** à l'entreprise (pas votre numéro personnel) et n'envoyez que des messages utiles aux employés.
- Le serveur doit **rester allumé en permanence** : il ne peut pas tourner sur Vercel.
- La session est enregistrée dans le dossier `/data` : gardez ce volume, sinon il faudra relier le téléphone à chaque redémarrage.
- Je n'ai pas pu tester la connexion réelle à WhatsApp ; seule l'API du serveur a été testée.

## Installation (Docker)
1. Sur votre serveur (VPS, Railway, Fly.io…), copiez ce dossier puis créez un secret :
   `openssl rand -hex 24`  → c'est votre `GATEWAY_SECRET` (32 caractères ou plus).
2. Lancez : `GATEWAY_SECRET=<le secret> docker compose up -d --build`
3. Mettez le serveur derrière **HTTPS** (Caddy, Nginx, ou le HTTPS fourni par Railway/Fly.io). Ne l'exposez jamais en HTTP simple sur Internet.
4. Sur **Vercel** → Settings → Environment Variables, ajoutez :
   - `WA_GATEWAY_URL` : l'adresse HTTPS du serveur (ex. `https://wa.mon-serveur.com`)
   - `WA_GATEWAY_SECRET` : le même secret
   puis redéployez le **dernier** déploiement.
5. Dans l'application, en tant que super administrateur : **Communication → WhatsApp**, puis liez le numéro par QR code ou par code de jumelage.

## Sans Docker
`npm install && GATEWAY_SECRET=<le secret> AUTH_DIR=./auth node index.js` (Node 20 ou plus).

## Réglages (variables d'environnement, facultatives)
| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | 8080 | Port du serveur |
| `AUTH_DIR` | ./auth (/data/auth en Docker) | Dossier de la session WhatsApp |
| `MAX_PER_HOUR` | 300 | Plafond de messages par heure |
| `MIN_DELAY_MS` / `MAX_DELAY_MS` | 2000 / 5000 | Pause aléatoire entre deux messages |

## Sécurité
- Toutes les routes (sauf `/health`) exigent `Authorization: Bearer <GATEWAY_SECRET>`.
- Les messages sont mis en file et envoyés un par un, avec une pause aléatoire et un « écrit… » simulé.
- Le numéro est d'abord vérifié (présent sur WhatsApp) avant l'envoi.

## Si la connexion échoue
La version de Baileys est fixée (6.7.24). Si WhatsApp refuse la connexion, essayez la version `7.0.0-rc14` dans `package.json`, puis `docker compose up -d --build`.
