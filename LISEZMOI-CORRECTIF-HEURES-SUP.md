# Correctif : anomalie de paie liée aux heures supplémentaires

## Anomalie trouvée
La **paie du mois en lot** recopiait, pour chaque employé, le montant d'heures supplémentaires du bulletin du mois précédent (tout comme les autres gains). Les heures supplémentaires variant chaque mois, un employé pouvait donc être payé en heures supplémentaires qu'il n'avait pas faites.

## Corrections
1. **Paie en lot** : les heures supplémentaires ne sont plus jamais recopiées. Elles viennent des pointages du mois généré (0 s'il n'y en a pas).
2. **Injection depuis Heures sup** : un bulletin sans aucun pointage n'est pas touché (une saisie manuelle n'est jamais effacée) ; un bulletin déjà payé n'est jamais modifié.
3. **Départs oubliés** : une journée de plus de 14 h (variable OVERTIME_MAX_DAY_HOURS) est écartée du calcul et signalée dans la colonne « À vérifier », au lieu d'être payée par erreur.

## Données
Au moment du contrôle, aucun bulletin ni pointage n'existait en ligne : aucune donnée à réparer. Les bulletins déjà générés avec l'ancienne paie en lot sont à vérifier à la main (ligne « Heures supplémentaires »).
