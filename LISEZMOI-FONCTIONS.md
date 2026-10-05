# OCTOPLUS : fonctions ajoutées (construit sur la version en ligne a207521)

Pousser sur une branche d'abord, vérifier l'aperçu Vercel, puis fusionner. Les tables sont déjà créées dans Neon (migration 0011).

## Nouveautés
- **Avances et prêts** (Paie > Avances & prêts) : demande, validation avec mois de première retenue, suivi du remboursement. Nouvelle rubrique « Avance sur salaire / prêt » dans les bulletins ; le lot de paie la recalcule chaque mois au lieu de la recopier.
- **Notes de frais** (Paie > Notes de frais) : justificatif PDF/JPG/PNG, validation, remboursement.
- **Échéances** (Employés > Échéances, RH et administrateurs) : fin de CDD, fin d'essai, pièces expirantes ; alertes aux administrateurs à J-30, J-7 et à l'échéance (tâche planifiée quotidienne existante).
- **Organigramme** (Employés > Organigramme).
- **Import d'employés** (Employés > Import) : fichier CSV (Excel > Enregistrer sous > CSV), modèle téléchargeable, 300 lignes max, fiches créées sans compte de connexion.
- **Rapports** : l'employé peut joindre Word, Excel, PowerPoint, PDF, image ou texte (2,5 Mo), avec contrôle du contenu.
- **Page de connexion** : le cadre autour du logo est retiré.

## WhatsApp
Le module Baileys déjà en ligne (Communication > WhatsApp, dossier `whatsapp-gateway/`) est conservé tel quel : cette mise à jour n'y touche pas.

## RÉPARATION DU DÉPLOIEMENT (important)
Les derniers envois ont cassé le build : le fichier `package.json` à la racine avait été remplacé par celui de la passerelle WhatsApp. Cette archive remet le bon `package.json` et le bon `.gitignore`.
**À supprimer à la main sur GitHub** (fichiers de la passerelle poussés par erreur à la racine) : `Dockerfile`, `README.md`, `.env.example` et le dossier `src/` (fichier `src/index.js`). Ne jamais poser le contenu de la passerelle à la racine du projet.

## Module SMS (super administrateur : Communication > SMS)
- Chaîne : l'administrateur crée ou modifie une information → base de données → serveur OCTOPLUS → API SMS → téléphone de l'employé.
- Fournisseurs pris en charge : Africa's Talking, Twilio, Infobip (variables dans le module).
- Chaque employé choisit « SMS » comme canal dans Mon profil ; `SMS_FALLBACK=1` envoie aussi un SMS quand WhatsApp / Telegram échoue.
- L'employé est prévenu quand l'administration modifie sa fiche. SMS sans accents (160 caractères), plafond journalier `SMS_DAILY_LIMIT` (200), journal des envois sans le contenu des messages.
- Migration `0012_sms.sql` déjà appliquée dans Neon.
