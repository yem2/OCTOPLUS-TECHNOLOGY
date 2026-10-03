-- Super administrateur, informations de paie de l'employé, suivi du paiement des bulletins.
-- Déjà appliqué sur la base Neon de production (le premier administrateur devient super administrateur).
create table if not exists super_admins (user_id text primary key references "user" (id) on delete cascade, created_at timestamptz not null default now());
insert into super_admins (user_id) select id from "user" where role = 'admin' order by "createdAt" asc limit 1 on conflict do nothing;
alter table employees add column if not exists matricule text, add column if not exists cnps_number text;
alter table payslips add column if not exists payment_status text not null default 'À payer', add column if not exists payment_method text, add column if not exists payment_ref text, add column if not exists paid_at timestamptz;
