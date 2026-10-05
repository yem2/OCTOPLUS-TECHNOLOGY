-- Journal des SMS envoyés (sans le contenu des messages, numéro masqué). Idempotent.
create table if not exists sms_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees (id) on delete set null,
  to_masked text not null,
  kind text not null default 'alerte',
  status text not null,
  provider text,
  provider_ref text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists sms_log_created_idx on sms_log (created_at desc);
