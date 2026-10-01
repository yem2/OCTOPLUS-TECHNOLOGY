-- OCTOPLUS TECHNOLOGY — Étape 4 : paie chiffrée (AES-256-GCM applicatif). Idempotent.
-- Les montants sont stockés chiffrés (texte « enc:v1:… ») ; les anciennes valeurs en clair restent lisibles.
alter table payslips alter column gross type text using gross::text;
alter table payslips alter column net type text using net::text;
alter table payslips alter column bonuses type text using bonuses::text;
alter table payslips alter column overtime type text using overtime::text;
alter table payslips alter column deductions type text using deductions::text;
alter table payslips alter column bonuses drop default;
alter table payslips alter column overtime drop default;
alter table payslips alter column deductions drop default;
create index if not exists reports_employee_idx on reports (employee_id, created_at desc);
create index if not exists calendar_events_start_idx on calendar_events (starts_at);
create index if not exists training_enrollments_employee_idx on training_enrollments (employee_id);
