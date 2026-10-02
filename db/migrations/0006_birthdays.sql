-- Anniversaires : date de naissance + journal des notifications déjà envoyées (une par employé et par année).
-- Déjà appliqué sur la base Neon de production.
alter table employees add column if not exists birth_date date;
create table if not exists birthday_notices (
  employee_id uuid not null references employees (id) on delete cascade,
  year int not null,
  created_at timestamptz not null default now(),
  primary key (employee_id, year)
);
