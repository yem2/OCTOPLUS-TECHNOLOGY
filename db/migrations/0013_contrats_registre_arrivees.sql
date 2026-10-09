-- Arrivées et départs, contrats, registre du personnel. Idempotent, sans danger : ne modifie aucune donnée existante.
create table if not exists onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  flow text not null check (flow in ('arrivee', 'depart')),
  position integer not null default 0,
  label text not null,
  done boolean not null default false,
  done_at timestamptz,
  done_by text,
  created_at timestamptz not null default now()
);
create index if not exists onboarding_tasks_employee_idx on onboarding_tasks (employee_id, flow, position);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  kind text not null check (kind in ('CDI', 'CDD')),
  start_on date not null,
  end_on date,
  trial_months integer,
  trial_end_on date,
  salary numeric,
  position text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists contracts_employee_idx on contracts (employee_id, created_at desc);

alter table employees add column if not exists birth_place text;
alter table employees add column if not exists nationality text;
alter table employees add column if not exists address text;
alter table employees add column if not exists exit_date date;
alter table employees add column if not exists exit_reason text;
