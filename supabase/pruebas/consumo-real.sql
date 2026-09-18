-- Consumo real del sistema: lo que de verdad ocupa hoy la plataforma.
--
-- Sirve para responder con datos si los planes gratuitos bastan al lanzar, en
-- lugar de suponerlo. Devuelve una sola línea QARESULT.
select 'QARESULT|base=' || pg_size_pretty(pg_database_size(current_database()))
  || '|pensiones=' || (select count(*) from public.pensiones)
  || '|habitaciones=' || (select count(*) from public.habitaciones)
  || '|usuarios=' || (select count(*) from auth.users)
  || '|buckets=' || coalesce((select string_agg(b.name || '(' || coalesce(b.file_size_limit::text, 'sin limite') || ')', ', ') from storage.buckets b), 'ninguno')
  || '|objetos=' || coalesce((select count(*)::text from storage.objects), '0')
  || '|peso_objetos=' || coalesce((select pg_size_pretty(sum(coalesce((o.metadata->>'size')::bigint, 0))) from storage.objects o), '0 bytes')
  as r;
