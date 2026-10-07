# WhatsApp avec QR code dans OCTOPLUS (Communication > WhatsApp)

L'onglet WhatsApp propose maintenant trois façons d'envoyer. Un seul canal suffit ; s'il y en a plusieurs, l'ordre est : passerelle Baileys, puis service par QR code, puis API officielle de Meta.

## A. Le plus rapide : QR code sans serveur (service Green-API), environ 10 minutes
1. Créez un compte sur green-api.com, puis une instance (la formule gratuite permet de tester).
2. Dans la console de l'instance, recopiez **idInstance**, **apiTokenInstance** et **apiUrl**.
3. Dans Vercel (Settings > Environment Variables, Production) : `GREENAPI_ID`, `GREENAPI_TOKEN` (type Sensitive), `GREENAPI_URL`. Redéployez.
4. OCTOPLUS > Communication > WhatsApp : le QR code s'affiche en haut de la page. Sur le téléphone du numéro de l'entreprise : WhatsApp > Appareils connectés > Connecter un appareil > scannez.
5. Envoyez le message test affiché.
Limites : solution non officielle (risque de blocage du numéro), messages hébergés chez le prestataire, formule gratuite limitée (vérifiez ses conditions).

## B. Baileys sur votre propre serveur (Railway), environ 30 minutes
1. Créez un dépôt GitHub **privé** séparé (ex. `octoplus-whatsapp-gateway`) et mettez-y, **à la racine de ce dépôt**, le contenu du dossier `whatsapp-gateway/` (index.js, package.json, Dockerfile…). Ne le mettez jamais à la racine du dépôt OCTOPLUS.
2. Sur railway.com : New Project > Deploy from GitHub repo > ce dépôt (il détecte le Dockerfile).
3. Ajoutez un **Volume** monté sur `/data`, et ces variables : `GATEWAY_SECRET` (au moins 16 caractères aléatoires) et `AUTH_DIR` = `/data/auth`.
4. Settings > Networking > Generate Domain. Notez l'adresse https.
5. Dans Vercel : `WA_GATEWAY_URL` = cette adresse (sans / final), `WA_GATEWAY_SECRET` = la même valeur que `GATEWAY_SECRET`. Redéployez.
6. OCTOPLUS > Communication > WhatsApp > bloc « Messagerie WhatsApp (Baileys) » : le QR code (ou le code de jumelage) s'affiche.
Le Dockerfile a été corrigé (installation de git, nécessaire à Baileys).

## C. API officielle de Meta (la plus fiable, aucun risque de blocage)
Étapes affichées dans le bloc « WhatsApp officiel » de la même page : `WHATSAPP_TOKEN`, modèle `alerte_octoplus`, `WHATSAPP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG`.

## SMS (Communication > SMS)
Le plus rapide : téléphone Android avec l'application gratuite « SMS Gateway for Android » en mode Cloud, puis dans Vercel `SMS_PROVIDER` = `smsgate`, `SMS_GATE_USER`, `SMS_GATE_PASSWORD`. Voir LISEZMOI-MESSAGERIE.md.

## Onglet « Canaux »
Il montre l'état de WhatsApp, du SMS et de l'e-mail, et permet un message groupé avec bascule automatique WhatsApp puis SMS.
