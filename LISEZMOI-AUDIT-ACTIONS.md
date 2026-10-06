# Audit de sécurité des actions (ajouter, modifier, enregistrer, supprimer)

Périmètre : 55 actions d'écriture (POST, PUT, PATCH, DELETE) de l'application.

## Ce qui était déjà solide
- Connexion exigée partout (sauf la vérification publique d'un document et les appels protégés par secret : tâches planifiées, webhook Telegram).
- Droits par rôle et par propriétaire (un employé ne modifie que ses propres données), suppressions réservées au super administrateur, requêtes SQL paramétrées, journal d'audit sur les actions sensibles.

## Failles trouvées et corrigées
1. **Requêtes venant d'un autre site (CSRF)** : aucune vérification de provenance. Corrigé : toute requête dont l'origine n'est pas celle du site est refusée (lib/authz.ts).
2. **Texte géant** : plusieurs actions (annonces, tâches, formations, agenda…) acceptaient des textes de plusieurs Mo. Corrigé : plafonds de longueur appliqués à toutes les entrées, caractère nul retiré (qui faisait échouer la base), clés dangereuses (`__proto__`) ignorées (lib/http.ts).
3. **Annonces et présences** : lecture JSON sans protection (erreur 500 sur un corps invalide), identifiants non vérifiés, département non validé. Corrigé.
4. **Documents envoyés** : n'importe quel type de fichier était accepté, avec le type déclaré par l'utilisateur. Corrigé : liste de formats autorisés (PDF, Word, Excel, PowerPoint, images, texte) et contrôle du contenu réel.
5. **Mots de passe** : 8 caractères minimum, sans contrôle. Corrigé : 10 caractères, mélange de caractères, refus des mots de passe courants et de ceux contenant l'adresse e-mail (création de compte, changement par l'administrateur, inscription).
6. **Abus par un compte connecté** : aucune limite de débit sur les actions. Corrigé : 400 requêtes par minute et par utilisateur (en plus des règles du pare-feu Vercel à créer).
7. **Déploiement cassé (erreur de ma part)** : l'import de `gatewayReady` dans la messagerie unifiée était faux. Corrigé.

## Restant à faire de votre côté
- Règles du pare-feu Vercel (limiter /api/auth/ et /api/), 2FA obligatoire pour les administrateurs (REQUIRE_ADMIN_2FA=1 après activation sur votre compte).
- Retirer « Preview » des variables DATABASE_URL, BETTER_AUTH_SECRET et PAYROLL_ENCRYPTION_KEY dans Vercel, et les passer en « Sensitive ».
- Une erreur de type existe dans app/api/payslips/route.ts (ligne 33, comparaison sur une valeur de type inconnu) : elle ne bloque pas le build (les erreurs de types sont ignorées) mais mérite un nettoyage.
