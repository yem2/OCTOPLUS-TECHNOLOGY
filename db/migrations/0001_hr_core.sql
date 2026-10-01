-- OCTOPLUS TECHNOLOGY — Étape 1 : schéma PostgreSQL + RBAC + audit
-- Idempotent : peut être rejoué sans risque.

-- ============ Authentification (Better Auth + plugin admin) ============
create table if not exists "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null default false,
  "image" text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);
alter table "user" add column if not exists "role" text not null default 'employee';
alter table "user" add column if not exists "banned" boolean not null default false;
alter table "user" add column if not exists "banReason" text;
alter table "user" add column if not exists "banExpires" timestamptz;

create table if not exists "session" (
  "id" text not null primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);
alter table "session" add column if not exists "impersonatedBy" text;
create index if not exists "session_userId_idx" on "session" ("userId");

create table if not exists "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null
);
create index if not exists "account_userId_idx" on "account" ("userId");

create table if not exists "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);
create index if not exists "verification_identifier_idx" on "verification" ("identifier");

-- ============ Structure RH ============
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  manager text,
  budget numeric(14,2),
  created_at timestamptz not null default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null,                       -- intitulé du poste (≠ rôle d'accès)
  team text not null default 'Ressources humaines',
  status text not null default 'Présent',
  initials text not null,
  color text not null default 'bg-[#c6d6ee]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table employees add column if not exists user_id text references "user" ("id") on delete set null;
alter table employees add column if not exists department_id uuid references departments (id) on delete set null;
alter table employees add column if not exists manager_id uuid references employees (id) on delete set null;
alter table employees add column if not exists phone text;
alter table employees add column if not exists hire_date date;
alter table employees add column if not exists contract_type text not null default 'CDI';
create unique index if not exists employees_user_id_key on employees (user_id) where user_id is not null;
create index if not exists employees_department_idx on employees (department_id);

alter table departments add column if not exists manager_id uuid references employees (id) on delete set null;

-- ============ Congés ============
create table if not exists leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  paid boolean not null default true,
  days_per_year numeric(5,1) not null default 0
);
insert into leave_types (name, paid, days_per_year) values
  ('Congé payé', true, 30), ('Maladie', true, 0), ('Maternité', true, 0),
  ('Exceptionnel', true, 0), ('Sans solde', false, 0)
on conflict (name) do nothing;

create table if not exists leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  leave_type_id uuid not null references leave_types (id) on delete cascade,
  year int not null,
  balance numeric(5,1) not null default 0,
  unique (employee_id, leave_type_id, year)
);

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  type text not null,
  starts_at timestamp not null,
  ends_at timestamp not null,
  status text not null default 'En attente',
  created_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
alter table leave_requests add column if not exists leave_type_id uuid references leave_types (id) on delete set null;
alter table leave_requests add column if not exists reason text;
alter table leave_requests add column if not exists reviewed_by text;
alter table leave_requests add column if not exists reviewed_at timestamptz;
alter table leave_requests add column if not exists review_comment text;
create index if not exists leave_requests_employee_idx on leave_requests (employee_id);

-- ============ Présences ============
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  attendance_date timestamp not null,
  status text not null default 'Présent',
  check_in timestamptz,
  check_out timestamptz,
  created_at timestamptz not null default now()
);
alter table attendance_records add column if not exists note text;
alter table attendance_records add column if not exists overtime_minutes int not null default 0;
alter table attendance_records add column if not exists overtime_validated boolean not null default false;
create index if not exists attendance_employee_date_idx on attendance_records (employee_id, attendance_date);

-- ============ Tâches & missions ============
create table if not exists hr_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assignee_id uuid references employees (id) on delete set null,
  status text not null default 'À faire',
  due_date timestamp,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table hr_tasks add column if not exists priority text not null default 'Normale';
alter table hr_tasks add column if not exists progress int not null default 0;
alter table hr_tasks add column if not exists created_by text;
create index if not exists hr_tasks_assignee_idx on hr_tasks (assignee_id);

-- ============ Annonces, notifications ============
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  department_id uuid references departments (id) on delete set null,  -- null = tout le personnel
  requires_ack boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists announcement_reads (
  announcement_id uuid not null references announcements (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

-- ============ Documents, paie ============
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees (id) on delete cascade,
  category text not null,               -- attestation, identité, diplôme, bulletin, modèle…
  name text not null,
  storage_key text,                     -- clé dans le stockage objet (S3 compatible)
  mime_type text,
  size_bytes bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists documents_employee_idx on documents (employee_id);

create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  period date not null,                 -- 1er jour du mois
  gross numeric(14,2) not null,
  net numeric(14,2) not null,
  bonuses numeric(14,2) not null default 0,
  overtime numeric(14,2) not null default 0,
  deductions numeric(14,2) not null default 0,
  document_id uuid references documents (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_id, period)
);

-- ============ Formations, performances ============
create table if not exists trainings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  provider text,
  starts_at timestamp,
  ends_at timestamp,
  budget numeric(14,2),
  mandatory boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists training_enrollments (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  status text not null default 'Demandée',
  created_at timestamptz not null default now(),
  unique (training_id, employee_id)
);
create table if not exists performance_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  reviewer_id text,
  period text not null,
  kind text not null default 'manager',   -- auto | manager | 360
  objectives jsonb not null default '[]'::jsonb,
  score numeric(3,1),
  comments text,
  status text not null default 'Brouillon',
  created_at timestamptz not null default now()
);

-- ============ Rapports, calendrier, paramètres ============
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees (id) on delete cascade,
  kind text not null default 'activité',
  period_start date,
  period_end date,
  content text not null,
  created_at timestamptz not null default now()
);
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  department_id uuid references departments (id) on delete set null,
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ============ Journal d'audit immuable ============
create table if not exists audit_logs (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id text,
  user_email text,
  action text not null,                  -- create | update | delete | export | login…
  entity text not null,
  entity_id text,
  ip text,
  details jsonb
);
create index if not exists audit_logs_at_idx on audit_logs (at desc);
create index if not exists audit_logs_user_idx on audit_logs (user_id, at desc);

create or replace function audit_logs_immutable() returns trigger as $$
begin
  raise exception 'audit_logs est immuable : % interdit', tg_op;
end;
$$ language plpgsql;
drop trigger if exists audit_logs_no_update on audit_logs;
create trigger audit_logs_no_update before update or delete on audit_logs
  for each row execute function audit_logs_immutable();
drop trigger if exists audit_logs_no_truncate on audit_logs;
create trigger audit_logs_no_truncate before truncate on audit_logs
  for each statement execute function audit_logs_immutable();
