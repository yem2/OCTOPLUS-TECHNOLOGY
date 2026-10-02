# Correctifs OCTOPLUS TECHNOLOGY

Copiez le contenu de ce dossier **par-dessus la racine de votre dépôt GitHub** (mêmes chemins), puis `git commit` + `git push` : Vercel redéploie.

## Routes API recréées (le front les appelait mais elles n'existaient plus)
- Messagerie : `/api/chat/channels`, `/api/chat/messages`
- Profil : `/api/profile/photo`, `/api/profile/payment`, `/api/avatar/[id]` (photos déjà en base)
- Paramètres administrateur : `/api/settings`
- Sécurité : `/api/security/reset-2fa`, `/api/security/set-password`
- Documents générés (+ PDF signé, vérification par QR) : `/api/generated-documents`, `/pdf`, `/verify`
- Documents : `/api/documents`, `/api/documents/file`
- Notifications, formations (+ inscriptions), paie (montants chiffrés), rapports, calendrier, performances

## Routes réécrites (accès contrôlé + fonctions manquantes)
- `employees` : réservé aux connectés ; création/modification/suppression = admin ; **création du compte de connexion** (mot de passe temporaire) ; coordonnées de paie visibles seulement par l'admin
- `departments`, `tasks` (+ mise à jour du statut), `leave-requests` (+ validation/refus)

## Autres
- `lib/http.ts`, `lib/chat.ts` : utilitaires
- `components/hr-dashboard.tsx` : les boutons de pointage du tableau de bord renvoient vers « Présences » (photo + GPS obligatoires)
- Pointage avec photo + localisation visibles par l'admin : **déjà en place** (`/api/attendance`, `/api/attendance/photo`), inchangé

## Après déploiement
Aucune migration à lancer : les tables existent déjà dans Neon (données conservées).
