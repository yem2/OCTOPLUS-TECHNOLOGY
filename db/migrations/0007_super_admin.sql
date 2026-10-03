-- Rôle « super administrateur » : promeut le plus ancien compte administrateur (le compte créé en premier).
-- À exécuter une seule fois dans Neon (SQL Editor). Sans effet s'il existe déjà un super administrateur.
update "user" set role = 'superadmin', "updatedAt" = now()
where id = (select id from "user" where role = 'admin' order by "createdAt" asc limit 1)
  and not exists (select 1 from "user" where role = 'superadmin');
