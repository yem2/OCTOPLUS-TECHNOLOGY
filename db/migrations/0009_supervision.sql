-- Module Supervision : compteur d'appels d'API par heure. Idempotent, sans danger.
create table if not exists request_metrics (
  hour timestamptz primary key,
  hits integer not null default 0
);
create index if not exists audit_logs_action_at_idx on audit_logs (action, at desc);
