-- Détail des lignes du bulletin de paie (JSON chiffré AES-256-GCM). Déjà appliqué sur la base Neon de production.
alter table payslips add column if not exists details text;
