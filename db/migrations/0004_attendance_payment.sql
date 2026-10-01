-- OCTOPLUS TECHNOLOGY — Étape 6 : présence géolocalisée + photo, moyen de paiement, mot de passe admin. Idempotent.

alter table attendance_records add column if not exists check_in_lat double precision;
alter table attendance_records add column if not exists check_in_lng double precision;
alter table attendance_records add column if not exists check_in_address text;
alter table attendance_records add column if not exists check_out_lat double precision;
alter table attendance_records add column if not exists check_out_lng double precision;
alter table attendance_records add column if not exists check_out_address text;

create table if not exists attendance_photos (
  attendance_id uuid not null references attendance_records (id) on delete cascade,
  kind text not null check (kind in ('check-in', 'check-out')),
  data bytea not null,
  created_at timestamptz not null default now(),
  primary key (attendance_id, kind)
);

alter table employees add column if not exists payment_method text;
alter table employees add column if not exists payment_details text;
