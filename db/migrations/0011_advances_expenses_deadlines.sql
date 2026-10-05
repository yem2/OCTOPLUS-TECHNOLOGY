-- Avances et prêts, notes de frais, échéances. Idempotent, sans danger : ne touche à aucune donnée existante.
create table if not exists salary_advances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  kind text not null default 'Avance',
  amount numeric not null check (amount > 0),
  installments integer not null default 1 check (installments between 1 and 24),
  reason text,
  status text not null default 'En attente',
  start_month date,
  requested_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_comment text
);
create index if not exists salary_advances_employee_idx on salary_advances (employee_id, status);

create table if not exists expense_claims (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  category text not null,
  amount numeric not null check (amount > 0),
  spent_on date not null,
  description text,
  receipt_id uuid references documents (id) on delete set null,
  status text not null default 'En attente',
  created_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_comment text
);
create index if not exists expense_claims_employee_idx on expense_claims (employee_id, created_at desc);

create table if not exists employee_deadlines (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  kind text not null,
  due_on date not null,
  notes text,
  last_alert_days integer,
  created_at timestamptz not null default now()
);
create index if not exists employee_deadlines_due_idx on employee_deadlines (due_on);
