# Base de données

`migrations/0001_hr_core.sql` crée (ou met à jour) tout le schéma : comptes Better Auth, employés,
départements, congés, présences, tâches, annonces, notifications, documents, paie, formations,
performances, rapports, calendrier, paramètres et journal d'audit immuable.

Le script est idempotent : il peut être rejoué sans risque.

    psql "$DATABASE_URL" -f db/migrations/0001_hr_core.sql

Rôles d'accès : `admin` et `employee` (colonne `user.role`). Le premier compte créé devient admin ;
les inscriptions publiques sont ensuite fermées (les admins créent les comptes depuis « Ajouter un employé »).
