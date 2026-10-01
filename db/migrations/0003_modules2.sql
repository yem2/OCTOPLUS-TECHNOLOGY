-- OCTOPLUS TECHNOLOGY — Étape 5 : 2FA, photos de profil, performances, documents, documents générés, messagerie. Idempotent.

-- Authentification à deux facteurs (plugin twoFactor de Better Auth)
alter table "user" add column if not exists "twoFactorEnabled" boolean default false;
create table if not exists "twoFactor" (
  "id" text not null primary key,
  "secret" text not null,
  "backupCodes" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "verified" boolean default true,
  "failedVerificationCount" integer default 0,
  "lockedUntil" timestamptz
);
create index if not exists "twoFactor_userId_idx" on "twoFactor" ("userId");

-- Photos de profil (image réduite côté navigateur, stockée en base)
create table if not exists user_photos (
  user_id text primary key references "user" ("id") on delete cascade,
  mime text not null,
  data bytea not null,
  updated_at timestamptz not null default now()
);

-- Performances : potentiel (1-5) pour la matrice talents (Nine-Box)
alter table performance_reviews add column if not exists potential smallint;
create index if not exists performance_reviews_employee_idx on performance_reviews (employee_id, created_at desc);

-- Documents : contenu des fichiers (stockage en base, 2,5 Mo max par fichier)
create table if not exists document_files (
  document_id uuid primary key references documents (id) on delete cascade,
  data bytea not null
);

-- Documents générés (attestations, ordres de mission…) avec code de vérification et signature
create table if not exists generated_documents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  employee_id uuid not null references employees (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'Demandée',
  requested_by text,
  issued_by text,
  issued_at timestamptz,
  signature text,
  created_at timestamptz not null default now()
);
create index if not exists generated_documents_employee_idx on generated_documents (employee_id, created_at desc);

-- Messagerie : canaux d'entreprise et conversations directes
create table if not exists chat_channels (
  id uuid primary key default gen_random_uuid(),
  name text,
  kind text not null default 'channel',
  archived boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists chat_channels_name_key on chat_channels (lower(name)) where kind = 'channel';
create table if not exists chat_members (
  channel_id uuid not null references chat_channels (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  primary key (channel_id, user_id)
);
create table if not exists chat_messages (
  id bigserial primary key,
  channel_id uuid not null references chat_channels (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_channel_idx on chat_messages (channel_id, id);
insert into chat_channels (name, kind, created_by)
  select 'Général', 'channel', 'system' where not exists (select 1 from chat_channels where kind = 'channel' and lower(name) = 'général');
