# Correctif OCTOPLUS : Supervision visible, départements, sécurité (construit sur la version en ligne 77cb768)

## Avant de pousser
1. **Ne poussez que ce zip.** Ne renvoyez plus l'ancien zip « sécurité » : il écrasait `lib/authz.ts` et cassait le déploiement.
2. Poussez d'abord sur une branche, vérifiez l'aperçu Vercel, puis fusionnez dans `master`.
3. Ne cliquez jamais sur « Redeploy » sur un ancien déploiement.

## Ce que contient ce correctif
- **Supervision** : l'entrée « Supervision » (menu Administration) est de retour pour le super administrateur, avec ses graphiques.
- **Départements (super administrateur)** : modifier et supprimer un département. Fiche complète : code, nom, responsable, e-mail, téléphone, lieu, missions, budget, effectif et date de création. Renommer met à jour les employés concernés ; la suppression est refusée tant que des employés y sont rattachés.
- **Sécurité** : en-têtes de sécurité (CSP, HSTS, anti-clickjacking…), 5 essais par minute sur la connexion et les codes 2FA, bannière d'activation de la double authentification pour les administrateurs, blocage possible avec `REQUIRE_ADMIN_2FA=1`.
- **Paie en lot** (bouton dans Paie) et **consentement** photo + GPS au pointage.

## Base de données
La migration `0010_departments.sql` est **déjà appliquée** dans Neon.

## Vercel
- `REQUIRE_ADMIN_2FA=1` : à ajouter **seulement après** avoir activé la 2FA sur votre compte (Mon profil).
