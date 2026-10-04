-- Départements : fiche d'entreprise complète (code, description, e-mail, téléphone, lieu). Idempotent, sans danger.
alter table departments add column if not exists code text;
alter table departments add column if not exists description text;
alter table departments add column if not exists email text;
alter table departments add column if not exists phone text;
alter table departments add column if not exists location text;
alter table departments add column if not exists updated_at timestamptz;
create unique index if not exists departments_code_key on departments (lower(code)) where code is not null;
