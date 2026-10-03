-- Matricule automatique, canaux d'alerte (WhatsApp / Telegram) et pièces jointes des rapports. Idempotent.
-- À exécuter une seule fois dans Neon (SQL Editor).

-- 1) Matricule auto-incrémenté : OCT-0001, OCT-0002… (attribué à l'insertion, anciens employés rattrapés par ordre d'arrivée)
create sequence if not exists employee_matricule_seq;
alter table employees add column if not exists matricule text;
do $$ declare r record; begin
  for r in select id from employees where matricule is null order by created_at, id loop
    update employees set matricule = 'OCT-' || lpad(nextval('employee_matricule_seq')::text, 4, '0') where id = r.id;
  end loop;
end $$;
alter table employees alter column matricule set default ('OCT-' || lpad(nextval('employee_matricule_seq')::text, 4, '0'));
create unique index if not exists employees_matricule_key on employees (matricule);

-- 2) Alertes : canal choisi par l'employé (le numéro utilisé est employees.phone) + lien Telegram
alter table employees add column if not exists alert_channel text not null default 'whatsapp';
alter table employees add column if not exists telegram_chat_id text;
alter table employees add column if not exists telegram_link_code text;

-- 3) Rapports : fichier Word ou PDF joint (stocké comme un document, visible par l'auteur et les administrateurs)
alter table reports add column if not exists attachment_id uuid references documents (id) on delete set null;
