// Listes de tâches par défaut pour l'arrivée et le départ d'un employé.
export const FLOWS = {
  arrivee: ['Contrat de travail signé', 'Pièces d’identité et diplômes reçus', 'Immatriculation CNPS faite (numéro enregistré sur la fiche)', 'Fiche employé complète (coordonnées, banque ou mobile money)', 'Matériel remis (ordinateur, téléphone, badge) avec signature', 'Accès créés (compte OCTOPLUS, e-mail)', 'Présentation à l’équipe et visite des locaux', 'Formation d’accueil planifiée'],
  depart: ['Démission ou notification de licenciement reçue', 'Préavis et date de sortie confirmés', 'Congés restants soldés', 'Solde de tout compte calculé et payé', 'Matériel restitué (ordinateur, téléphone, badge)', 'Accès désactivés (compte, e-mail)', 'Attestation de travail remise', 'Déclaration CNPS de sortie faite', 'Entretien de sortie réalisé'],
} as const
export type Flow = keyof typeof FLOWS
export const isFlow = (value: unknown): value is Flow => value === 'arrivee' || value === 'depart'
