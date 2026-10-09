# Modules RH ajoutés (comparés à ce qui existait déjà en ligne)

## Déjà en ligne, donc NON refaits
IRPP / CAC / pension calculés sur les bulletins, paie du mois en lot, numéro CNPS sur la fiche, solde de congés, attestations (travail, prise de service, ordre de mission), échéances d'employés, import CSV, organigramme, Statistiques (indicateurs de direction), évaluations (module Performances), pointage avec retards et absences.

## Nouveaux (priorité 1 à 5)
1. **Paie > Déclarations** : tableau CNPS du mois (base plafonnée, cotisation salarié, pension / prestations familiales / accidents du travail employeur), récapitulatif IRPP, CAC et taxes pour la DGI, cumuls annuels par employé. Export Excel. Les cumuls annuels figurent aussi sur chaque bulletin PDF. Taux employeur modifiables (CNPS_RATE_PVID, CNPS_RATE_PF, CNPS_RATE_AT) : à faire valider par votre comptable.
2. **Paie > Heures sup** : calcul automatique d'après les pointages (au-delà de 40 h par semaine : 8 h à 120 %, 8 h à 130 %, le reste à 140 %), injection dans les bulletins « À payer » avec recalcul des cotisations et de l'IRPP. Un bulletin déjà payé n'est jamais modifié.
3. **Employés > Arrivée & départ** : listes de tâches à cocher (contrat, matériel, accès, solde de tout compte…), avec avancement et alerte aux administrateurs à la fin.
4. **Employés > Contrats** : génération du contrat CDI ou CDD en PDF, avec création automatique des échéances (fin de période d'essai, fin de CDD) et alertes. Modèle à faire valider par votre conseil juridique.
5. **Employés > Registre** : registre du personnel à jour, export PDF et Excel, avec saisie du lieu de naissance, nationalité, adresse et date de sortie.

## Demandes de ménage appliquées dans la même mise à jour
- Titre de la page sans tiret : « OCTOPLUS TECHNOLOGY Gestion RH ».
- Communication : onglet SMS retiré, bloc « Ordre d'envoi automatique » retiré, option SMS retirée de Mon profil.
- WhatsApp : un seul bloc « WhatsApp par QR code ». Il utilise le service géré (Green-API) tant que la passerelle Baileys n'est pas configurée, puis Baileys prend automatiquement le relais dès que WA_GATEWAY_URL et WA_GATEWAY_SECRET sont renseignées dans Vercel (serveur toujours connecté).

## Base de données
Migration 0013 déjà appliquée dans Neon (tables onboarding_tasks et contracts, colonnes du registre).

## À venir (liste « Ensuite »)
Recrutement, planning des équipes, matériel de l'entreprise, absences justifiées, évaluations 360° et objectifs, sondages, signature électronique.
