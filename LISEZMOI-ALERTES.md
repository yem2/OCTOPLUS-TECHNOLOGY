# OCTOPLUS : alertes WhatsApp / Telegram, bugs, matricule, rapports, profil

## 1) Base de données (une seule fois, Neon > SQL Editor)
Exécuter `db/migrations/0008_matricule_alertes_rapports.sql` (et `0007_super_admin.sql` si ce n'est pas déjà fait).
- Matricule : OCT-0001, OCT-0002… attribué automatiquement à chaque nouvel employé ; les anciens sont numérotés par ordre d'arrivée.

## 2) Variables d'environnement (Vercel > Settings > Environment Variables)
### WhatsApp (API Cloud de Meta)
- `WHATSAPP_TOKEN` : jeton d'accès permanent
- `WHATSAPP_PHONE_NUMBER_ID` : identifiant du numéro WhatsApp Business
- `WHATSAPP_TEMPLATE` (recommandé) : nom d'un modèle de message approuvé par Meta, avec 2 variables : {{1}} = titre, {{2}} = texte. Sans modèle, WhatsApp n'accepte les messages que si l'employé a écrit à votre numéro dans les dernières 24 h.
- `WHATSAPP_TEMPLATE_LANG` : code de langue du modèle (défaut `fr`)
### Telegram
- `TELEGRAM_BOT_TOKEN` et `TELEGRAM_BOT_USERNAME` (bot créé avec @BotFather, nom sans @)
- `TELEGRAM_WEBHOOK_SECRET` : mot de passe de votre choix
- Déclarer le webhook une fois, dans le navigateur :
  https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<VOTRE-SITE>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
### Autres
- `ALERT_DEFAULT_COUNTRY_CODE` (défaut 237) : indicatif ajouté aux numéros saisis sans « + ».
- `ALERT_CHANNEL_MESSAGES=1` (facultatif) : envoie aussi sur WhatsApp / Telegram les messages des canaux d'entreprise. Par défaut seules les conversations directes et toutes les notifications sont envoyées.

## 3) Comment ça marche
- Chaque notification (paie, congés, tâches, annonces, anniversaires, etc.) est enregistrée dans l'application ET envoyée au numéro de l'employé, selon son choix dans Mon profil (WhatsApp, Telegram ou application seulement).
- Chaque employé saisit sa date de naissance et son téléphone dans Mon profil. L'anniversaire est ensuite déclenché automatiquement (tâche planifiée Vercel existante, `CRON_SECRET` requis).
- Bugs : toute erreur serveur ou d'interface est consignée dans le journal et envoyée aux administrateurs (notification + WhatsApp / Telegram). Une même erreur n'est signalée qu'une fois toutes les 10 minutes.
- Rapports : l'employé peut joindre un fichier Word (.doc, .docx) ou PDF (2,5 Mo maximum) ; l'auteur et les administrateurs peuvent le télécharger.
- Administrateurs et super administrateur peuvent modifier leur nom et leur e-mail de connexion dans Mon profil (mot de passe actuel exigé).
