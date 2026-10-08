# Audit de sécurité des actions (ajouter, modifier, enregistrer, supprimer)

Périmètre : les 61 routes de l'API qui modifient des données (POST, PATCH, PUT, DELETE), relues une par une.

## Ce qui était déjà correct
- 59 routes sur 61 exigent une session ; les 2 autres sont des appels de serveur à serveur protégés par un secret (webhook Telegram) ou neutralisés.
- Niveaux d'accès : 11 actions réservées au super administrateur, 12 aux administrateurs, 10 à des permissions précises (paie, RH…), le reste à tout utilisateur connecté **avec contrôle de propriété** (tâche assignée, document déposé par soi, message écrit par soi, demande à son propre nom).
- Aucune injection SQL : toutes les requêtes sont paramétrées ; les seules interpolations sont des fragments constants ou des numéros de paramètres.
- Fichiers envoyés : extension et contenu réel vérifiés, taille limitée ; photo de profil limitée au JPEG de 300 Ko.
- Connexion : 5 essais par minute (mot de passe et codes 2FA). Écritures sensibles consignées dans le journal d'activité.

## Corrections apportées
1. **Origine des requêtes (CSRF)** : nouveau `proxy.ts`. Toute requête qui modifie des données doit venir de l'application elle-même ; une requête venant d'un autre site reçoit un refus 403 avant d'atteindre l'API.
2. **Secrets à durée constante** : webhook Telegram et les deux tâches planifiées comparent leur secret sans fuite par le temps de réponse.
3. **Séparation des tâches** : personne ne peut valider sa propre demande de congé, avance ou note de frais ; seul le super administrateur (seul au sommet) le peut.
4. Deux erreurs de typage corrigées (notes de frais, réinitialisation de mot de passe).

## Points restants à connaître (non modifiés)
- La création / modification de bulletins de paie par un administrateur ou le comptable pour lui-même n'est pas bloquée (elle reste tracée dans le journal).
- Les rôles RH peuvent modifier des fiches mais jamais l'e-mail, le CNPS, la paie ni un compte administrateur.
- Penser à passer les variables sensibles de Vercel (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `PAYROLL_ENCRYPTION_KEY`, clés WhatsApp / SMS) en type « Sensitive ».
