# OCTOPLUS : sécurité renforcée + module Supervision

## Ce que contient cette mise à jour (construite sur la version `f3a205b`)
- **En-têtes de sécurité** sur toutes les pages (CSP, HSTS, anti-clickjacking, anti-sniffing, Referrer-Policy, Permissions-Policy limitée à caméra et position pour ce site). Les réponses de l'API ne sont jamais mises en cache.
- **Limitation des tentatives** : 5 essais par minute et par IP sur la connexion et les codes 2FA (en plus des règles du pare-feu Vercel).
- **Double authentification obligatoire pour les administrateurs** : bannière d'activation pour ceux qui n'ont pas la 2FA ; le blocage devient effectif quand vous ajoutez `REQUIRE_ADMIN_2FA=1` dans Vercel (voir l'ordre ci-dessous).
- **Module Supervision** (menu Administration, super administrateur uniquement) : utilisateurs actifs, actions par jour, connexions, bugs par jour, charge (appels d'API par heure), comportement (types d'actions, modules les plus utilisés), base de données (taille, connexions, plus grosses tables), dernières erreurs.
- **Paie en lot** : Paie > « Paie du mois en lot ».
- **Consentement** photo + GPS au pointage, et **suppression automatique** des photos et positions après 12 mois (`RETENTION_MONTHS` pour changer).
- **E-mail de secours** quand WhatsApp / Telegram échoue (Resend : `RESEND_API_KEY`, `EMAIL_FROM`).

## Base de données
La table de la Supervision (`request_metrics`) est déjà créée dans Neon. Le fichier `db/migrations/0009_supervision.sql` sert d'historique.

## Variables Vercel (Settings > Environment Variables, Production)
- `REQUIRE_ADMIN_2FA=1` : **ajoutez-la seulement après avoir activé la 2FA sur votre propre compte** (Mon profil), sinon vous serez bloqué.
- `RESEND_API_KEY`, `EMAIL_FROM` : e-mail de secours.
- `WHATSAPP_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` : alertes (voir LISEZMOI-ALERTES.md).
- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PAYROLL_ENCRYPTION_KEY` : passez-les en « Sensitive ». **Ne changez JAMAIS la valeur de `PAYROLL_ENCRYPTION_KEY`** : les bulletins existants deviendraient illisibles.

## À faire sur les plateformes (je n'y ai pas accès)
### Vercel
- Firewall (onglet du projet) : activer, puis 3 règles :
  1. Refuser les chemins qui contiennent `.env`, `.git`, `wp-admin`, `phpmyadmin`, `.php`.
  2. Limiter à 20 requêtes/minute/IP les chemins qui commencent par `/api/auth/` (blocage 10 min).
  3. Limiter à 300 requêtes/minute/IP les chemins qui commencent par `/api/`.
- Settings > Deployment Protection : activer **Vercel Authentication** pour les aperçus (Preview).
- Projet `new-chat` lié au même dépôt : le déconnecter (Settings > Git).
### GitHub
- Compte : double authentification. Dépôt : privé.
- Settings > Branches : protéger `master` (modifications par demande de fusion).
- Settings > Code security : Secret scanning, Push protection, Dependabot.
- **Supprimer à la racine du dépôt** les fichiers `auth.ts` et `auth (1).ts` (doublons inutiles ; le vrai fichier est `lib/auth.ts`).
### Neon
- Réinitialiser le mot de passe de la base s'il a été collé quelque part (Neon > Roles > Reset password), puis mettre à jour `DATABASE_URL` dans Vercel et redéployer.
- Sauvegarde manuelle chaque mois et avant toute grosse mise à jour (l'historique gratuit ne couvre que 6 heures).

## Limites à connaître
Aucun système n'est « sans faille » : cette mise à jour réduit fortement la surface d'attaque et vous alerte (bugs, activité) mais ne remplace ni les mises à jour régulières des dépendances (Dependabot), ni les bons mots de passe, ni la 2FA.
