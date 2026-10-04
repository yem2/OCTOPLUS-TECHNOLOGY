# OCTOPLUS : fiabilité et gestion des bugs (construit sur la version en ligne f99c7ed)

Ne poussez que ce zip, sur une branche d'abord. Aucune migration SQL.

## Pourquoi vous avez reçu « Load failed »
C'est le message d'un navigateur quand une requête est interrompue (coupure réseau, page rechargée, site mis à jour). Les actions de l'interface (création, modification…) ne géraient pas cette coupure : l'erreur remontait comme un bug.

## La solution, en 4 couches
1. **Cause corrigée** : les actions gèrent maintenant la coupure et affichent « Connexion perdue. Vérifiez votre Internet puis réessayez. » ; les listes retentent une fois automatiquement et gardent les données déjà affichées.
2. **Filtre du bruit** : coupures réseau, requêtes annulées et extensions du navigateur ne déclenchent plus d'alerte.
3. **Rechargement automatique** : après une mise en ligne, un ancien onglet qui réclame un fichier disparu se recharge tout seul une fois, sans alerte.
4. **Alertes utiles seulement** : chaque vrai bug est consigné ; l'administrateur n'est prévenu qu'une fois toutes les 30 min par message, 5 alertes par heure au maximum. Supervision regroupe les erreurs avec un compteur (colonne « Fois »).

## Limite connue
Le projet ignore les erreurs de types au build (`ignoreBuildErrors`), ce qui peut masquer de vrais bugs. Les corriger demande d'installer les dépendances et de lancer `pnpm check` sur un poste de développement.
