'use client'

import { useState } from 'react'
import { Activity, ArrowUpRight, CalendarDays, Check, Clock3, FileText, Filter, LockKeyhole, Mail, MessageSquare, Plus, Search, Send, ShieldCheck, Target, Users, WalletCards, X } from 'lucide-react'

const sectionCopy: Record<string, { eyebrow: string; title: string; description: string; action: string; icon: typeof Activity }> = {
  Employés: { eyebrow: 'Administration', title: 'Annuaire & dossiers employés', description: 'Centralisez les profils, postes, contrats et parcours de vos collaborateurs.', action: 'Ajouter un employé', icon: Users },
  Départements: { eyebrow: 'Organisation', title: 'Structure des équipes', description: 'Visualisez les pôles, responsables et capacités budgétaires.', action: 'Créer un département', icon: Users },
  Présences: { eyebrow: 'Temps de travail', title: 'Présences en temps réel', description: 'Suivez les pointages, retards et heures supplémentaires.', action: 'Déclarer une anomalie', icon: Clock3 },
  Congés: { eyebrow: 'Demandes RH', title: 'Congés & absences', description: 'Gérez les demandes avec un circuit clair : en attente, accepté ou refusé.', action: 'Nouvelle demande', icon: CalendarDays },
  Rapports: { eyebrow: 'Pilotage', title: 'Rapports d’activité', description: 'Consolidez les rapports quotidiens et hebdomadaires par période et département.', action: 'Créer un rapport', icon: FileText },
  'Tâches & Missions': { eyebrow: 'Productivité', title: 'Tâches & missions', description: 'Planifiez, assignez et suivez les missions de chaque équipe.', action: 'Nouvelle mission', icon: Target },
  Performances: { eyebrow: 'Talent', title: 'Performances & objectifs', description: 'Suivez les objectifs SMART, évaluations et feedbacks de vos équipes.', action: 'Lancer une campagne', icon: Target },
  Formations: { eyebrow: 'Développement', title: 'Formations & compétences', description: 'Pilotez les demandes de formation et les parcours de montée en compétences.', action: 'Ajouter une formation', icon: Activity },
  Paie: { eyebrow: 'Confidentiel', title: 'Paie & éléments variables', description: 'Consultez les périodes, primes et documents de paie dans un espace protégé.', action: 'Importer une période', icon: WalletCards },
  Documents: { eyebrow: 'Coffre-fort', title: 'Documents RH sécurisés', description: 'Retrouvez contrats, attestations et pièces administratives au même endroit.', action: 'Téléverser un document', icon: LockKeyhole },
  Calendrier: { eyebrow: 'Planification', title: 'Calendrier partagé', description: 'Réunions, congés, formations et échéances de projets réunis dans une seule vue.', action: 'Ajouter un événement', icon: CalendarDays },
  Annonces: { eyebrow: 'Communication', title: 'Annonces internes', description: 'Publiez des informations ciblées et suivez leur lecture.', action: 'Publier une annonce', icon: Send },
  Messagerie: { eyebrow: 'Communication', title: 'Messagerie interne', description: 'Échangez avec les équipes dans un espace professionnel et sécurisé.', action: 'Nouveau message', icon: MessageSquare },
  Statistiques: { eyebrow: 'Décisionnel', title: 'Statistiques RH', description: 'Transformez les données RH en indicateurs lisibles pour vos décisions.', action: 'Exporter un rapport', icon: Activity },
  Notifications: { eyebrow: 'Centre d’alertes', title: 'Notifications', description: 'Retrouvez les validations, rappels et événements qui nécessitent votre attention.', action: 'Tout marquer comme lu', icon: Activity },
  'Documents générés': { eyebrow: 'Automatisation', title: 'Documents générés', description: 'Générez des attestations et ordres de mission avec QR code de vérification.', action: 'Générer un document', icon: FileText },
  'Journal d’activité': { eyebrow: 'Conformité', title: 'Journal d’activité', description: 'Tracez les actions sensibles avec l’utilisateur, la date, l’IP et le contexte.', action: 'Exporter le journal', icon: ShieldCheck },
  'Mon profil': { eyebrow: 'Compte', title: 'Mon profil', description: 'Gérez vos informations, votre sécurité et vos préférences personnelles.', action: 'Modifier le profil', icon: Users },
  Paramètres: { eyebrow: 'Configuration', title: 'Paramètres de la plateforme', description: 'Configurez les règles RH, les accès, les notifications et l’identité de votre entreprise.', action: 'Enregistrer les réglages', icon: ShieldCheck },
}

const rows = [
  ['Demande de congé', 'Camille Moreau', 'En attente', 'Aujourd’hui'],
  ['Rapport hebdomadaire', 'Thomas Bernard', 'Accepté', 'Hier'],
  ['Réunion d’équipe', 'Sophie Martin', 'En attente', 'Lun. 24'],
]

export function PortalView({ title, onAction }: { title: string; onAction: () => void }) {
  const [query, setQuery] = useState('')
  const copy = sectionCopy[title] || sectionCopy.Employés
  const Icon = copy.icon
  const filtered = rows.filter((row) => row.join(' ').toLowerCase().includes(query.toLowerCase()))
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#c62828]">{copy.eyebrow}</p><h1 className="text-3xl font-semibold tracking-[-0.05em] text-black sm:text-4xl">{copy.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#7d8794]">{copy.description}</p></div><button onClick={onAction} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#c62828] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a61f1f]"><Plus size={17}/>{copy.action}</button></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Total actif" value="0" detail="Aucune donnée"/><Metric label="En attente" value="0" detail="À traiter"/><Metric label="Taux de suivi" value="0%" detail="Ce mois-ci"/></div>
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] sm:p-6"><div className="flex flex-col gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff1f1] text-[#c62828]"><Icon size={21}/></span><div><h2 className="font-semibold text-[#20353b]">Vue opérationnelle</h2><p className="mt-1 text-xs text-[#929aa5]">Les nouvelles activités apparaîtront automatiquement ici.</p></div></div><div className="flex gap-2"><label className="relative flex min-h-10 items-center"><Search size={16} className="absolute left-3 text-black/35"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher" className="h-10 w-full rounded-xl border border-black/10 pl-9 pr-3 text-base outline-none focus:border-[#c62828] sm:w-44"/></label><button className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 text-black/55" aria-label="Filtrer"><Filter size={16}/></button></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-[11px] uppercase tracking-[0.12em] text-black/40"><tr><th className="pb-3 font-semibold">Élément</th><th className="pb-3 font-semibold">Responsable</th><th className="pb-3 font-semibold">Statut</th><th className="pb-3 font-semibold">Échéance</th><th/></tr></thead><tbody>{filtered.map((row) => <tr key={row[0]} className="border-t border-black/5"><td className="py-4 font-medium text-[#20353b]">{row[0]}</td><td className="py-4 text-black/60">{row[1]}</td><td className="py-4"><Status value={row[2]}/></td><td className="py-4 text-black/55">{row[3]}</td><td className="py-4 text-right"><button className="text-[#c62828]" aria-label={`Ouvrir ${row[0]}`}><ArrowUpRight size={17}/></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="py-10 text-center text-sm text-black/45">Aucun élément trouvé.</div>}</div></section>
    <div className="grid gap-4 lg:grid-cols-2"><InfoCard icon={ShieldCheck} title="Accès et confidentialité" text="Les données sensibles sont réservées aux profils autorisés et chaque action est journalisée."/><InfoCard icon={MessageSquare} title="Échanges avec l’administrateur" text="Les demandes employé restent en attente jusqu’à validation, refus ou traitement par l’administration."/></div>
  </div>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]"><p className="text-xs text-black/50">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#20353b]">{value}</p><p className="mt-1 text-[11px] text-black/40">{detail}</p></div> }
function Status({ value }: { value: string }) { const pending = value === 'En attente'; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${pending ? 'bg-[#fff5df] text-[#a36c1c]' : 'bg-[#eaf7f2] text-[#197158]'}`}>{pending ? value : <><Check size={13} className="mr-1"/>{value}</>}</span> }
function InfoCard({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) { return <div className="rounded-2xl border border-black/10 bg-[#fafbfb] p-5"><Icon size={20} className="text-[#c62828]"/><h3 className="mt-4 font-semibold text-[#20353b]">{title}</h3><p className="mt-2 text-sm leading-6 text-black/55">{text}</p></div> }
EOF
