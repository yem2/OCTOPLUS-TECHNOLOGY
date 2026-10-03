# Correctifs OCTOPLUS : rôles, paie, menu

Copiez ces fichiers par-dessus la racine du dépôt (mêmes chemins), puis poussez sur une branche pour tester l'aperçu Vercel avant la production.

## Après le déploiement (une seule fois)
Dans Neon > SQL Editor, exécutez `db/migrations/0007_super_admin.sql` : le plus ancien compte administrateur devient super administrateur.

## Rôles
- **Super administrateur** : tout, plus la gestion des administrateurs (Paramètres > Comptes administrateurs), les paramètres de l'entreprise, la suppression d'employés, le journal d'activité complet, la réinitialisation 2FA / mot de passe de n'importe quel compte.
- **Administrateur** : employés (création, modification), paie, présences, congés, tâches, rapports, documents, annonces. Il ne peut pas agir sur un compte administrateur, ni modifier les paramètres de l'entreprise, ni supprimer un employé, ni voir le journal complet.

## Paie
- Rubrique « Prime de tonnage » retirée (les anciens bulletins gardent leur total : le montant apparaît sous « Autres primes »).
- Bulletin PDF refait : employeur / salarié, tableau Désignation - Gains - Retenues, totaux, net à payer, montant en lettres, mode de paiement, signatures.
- Module Paie : nouveau tableau « Informations personnelles des employés » avec un bouton Modifier (ouvre la fiche complète de l'employé).

## Menu
Regroupé : Pilotage, Équipe, Activité, Paie et documents, Communication, Administration.
