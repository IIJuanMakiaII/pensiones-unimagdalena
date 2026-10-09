-- ============================================================================
-- Oleada 9 — Administracion total de publicaciones por el rol maestro
--
-- Requisitos: esquema.sql, oleadas 1-7 y oleada-10-cerrar-whatsapp.sql.
-- Estado: APLICADA en el proyecto de produccion (verificado el 2026-10-09).
-- Nombre anterior: supabase/oleada-9-maestro.sql (se renombro el 2026-10-09 para
-- que el nombre canonico oleada-9.sql quede en la migracion vigente).
-- Esta propuesta NO repite ni modifica los grants SELECT/UPDATE de Oleada 10.
-- Idempotente respecto a sus propias constraints, funciones y policies.
--
-- El rol maestro se concede manualmente por SQL. El registro publico y
-- crear_perfil_usuario() conservan la lista de roles normales.
--
-- Precio: pensiones.precio_mensual es DERIVADO. El maestro cambia el precio de
-- las habitaciones; el trigger de Oleada 1/2 actualiza el precio de la pension.
-- Nunca se concede UPDATE directo de pensiones.precio_mensual.
--
-- WhatsApp: whatsapp y autorizacion_contacto_en siguen fuera de SELECT/UPDATE,
-- tal como las dejo Oleada 10. Esta migracion no las incluye en ninguna funcion.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Precondiciones de seguridad y compatibilidad
-- ---------------------------------------------------------------------------
do $precondiciones$
begin
  if not exists (
    select 1
      from pg_catalog.pg_trigger
     where tgrelid = 'public.pensiones'::regclass
       and tgname = 'despues_de_borrar_publicacion'
       and not tgisinternal
  ) then
    raise exception 'Falta el trigger de Oleada 7: aplica supabase/oleada-7.sql antes de esta propuesta';
  end if;

  if has_column_privilege('anon', 'public.pensiones', 'whatsapp', 'SELECT')
     or has_column_privilege('authenticated', 'public.pensiones', 'whatsapp', 'SELECT')
     or has_column_privilege('anon', 'public.pensiones', 'autorizacion_contacto_en', 'SELECT')
     or has_column_privilege('authenticated', 'public.pensiones', 'autorizacion_contacto_en', 'SELECT') then
    raise exception 'Oleada 10 no parece aplicada: whatsapp/autorizacion_contacto_en siguen siendo legibles';
  end if;

  if has_column_privilege('authenticated', 'public.pensiones', 'whatsapp', 'UPDATE')
     or has_column_privilege('authenticated', 'public.pensiones', 'autorizacion_contacto_en', 'UPDATE') then
    raise exception 'Oleada 10 no parece aplicada: whatsapp/autorizacion_contacto_en siguen siendo editables';
  end if;

  if has_column_privilege('authenticated', 'public.pensiones', 'id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.pensiones', 'slug', 'UPDATE')
     or has_column_privilege('authenticated', 'public.pensiones', 'anfitrion_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.pensiones', 'precio_mensual', 'UPDATE')
     or has_column_privilege('authenticated', 'public.pensiones', 'verificado', 'UPDATE')
     or has_column_privilege('authenticated', 'public.pensiones', 'calificacion', 'UPDATE')
     or has_column_privilege('authenticated', 'public.pensiones', 'latitud', 'UPDATE')
     or has_column_privilege('authenticated', 'public.pensiones', 'longitud', 'UPDATE') then
    raise exception 'Los campos estructurales o administrativos tienen UPDATE directo; revisa los grants antes de continuar';
  end if;

  if has_column_privilege('authenticated', 'public.habitaciones', 'id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.habitaciones', 'pension_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.habitaciones', 'creada_en', 'UPDATE') then
    raise exception 'Las columnas estructurales de habitaciones tienen UPDATE directo; restaura los grants de Oleada 2/3 antes de continuar';
  end if;

  if has_column_privilege('authenticated', 'public.usuarios', 'rol', 'UPDATE') then
    raise exception 'authenticated puede actualizar usuarios.rol; restaura los permisos de Oleada 2 antes de continuar';
  end if;

  if not has_table_privilege('authenticated', 'public.habitaciones', 'INSERT')
     or not has_table_privilege('authenticated', 'public.habitaciones', 'DELETE') then
    raise exception 'Faltan los privilegios de tabla INSERT/DELETE de habitaciones que usa la operacion existente';
  end if;
end
$precondiciones$;


-- ---------------------------------------------------------------------------
-- 1) El rol maestro: concedido manualmente, nunca desde el registro
-- ---------------------------------------------------------------------------
alter table public.usuarios drop constraint if exists usuarios_rol_check;
alter table public.usuarios
  add constraint usuarios_rol_check
  check (rol in ('estudiante', 'anfitrion', 'maestro'));

-- Ejemplo de concesion manual, para ejecutar por separado y con el correo real:
-- update public.usuarios set rol = 'maestro' where email = 'fundador@dominio';
-- No se modifica crear_perfil_usuario() ni el grant de UPDATE sobre usuarios.rol.


-- ---------------------------------------------------------------------------
-- 2) Predicado seguro para policies y funciones administrativas
-- ---------------------------------------------------------------------------
create or replace function public.es_maestro()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from public.usuarios as u
     where u.id = (select auth.uid())
       and u.rol = 'maestro'
  );
$$;

revoke execute on function public.es_maestro() from public, anon, authenticated;
grant execute on function public.es_maestro() to authenticated;


-- ---------------------------------------------------------------------------
-- 3) Lectura y gestion de cualquier pension
--
-- Las policies son permisivas y se suman a las del anfitrion. Los grants de
-- columna siguen siendo los de Oleada 10: UPDATE directo solo cubre los campos
-- normales concedidos alli; id/slug/anfitrion_id siguen sin UPDATE.
-- ---------------------------------------------------------------------------
drop policy if exists "pensiones: el maestro lee todas" on public.pensiones;
create policy "pensiones: el maestro lee todas" on public.pensiones
  for select to authenticated
  using (public.es_maestro());

drop policy if exists "pensiones: el maestro edita todas" on public.pensiones;
create policy "pensiones: el maestro edita todas" on public.pensiones
  for update to authenticated
  using (public.es_maestro())
  with check (public.es_maestro());


-- ---------------------------------------------------------------------------
-- 4) Gestion de habitaciones de cualquier pension
--
-- INSERT/DELETE usan los privilegios de tabla ya existentes y estas policies.
-- UPDATE queda limitado a las columnas que las oleadas 2/3 ya conceden:
-- disponible, tipo, genero, precio_mensual_cop y alimentacion_incluida.
-- pension_id e id no reciben UPDATE.
-- ---------------------------------------------------------------------------
drop policy if exists "habitaciones: el maestro lee todas" on public.habitaciones;
create policy "habitaciones: el maestro lee todas" on public.habitaciones
  for select to authenticated
  using (public.es_maestro());

drop policy if exists "habitaciones: el maestro crea en cualquier pension" on public.habitaciones;
create policy "habitaciones: el maestro crea en cualquier pension" on public.habitaciones
  for insert to authenticated
  with check (public.es_maestro());

drop policy if exists "habitaciones: el maestro edita todas" on public.habitaciones;
create policy "habitaciones: el maestro edita todas" on public.habitaciones
  for update to authenticated
  using (public.es_maestro())
  with check (public.es_maestro());

drop policy if exists "habitaciones: el maestro borra todas" on public.habitaciones;
create policy "habitaciones: el maestro borra todas" on public.habitaciones
  for delete to authenticated
  using (public.es_maestro());


-- ---------------------------------------------------------------------------
-- 5) Campos administrativos de pensiones
--
-- PostgreSQL no puede variar grants de columna segun public.usuarios.rol:
-- conceder UPDATE directo de verificado/calificacion a authenticated tambien
-- se lo concederia a los anfitriones. Por eso solo el maestro puede llamar a
-- esta funcion SECURITY DEFINER. La allowlist excluye id, slug, anfitrion_id,
-- creada_en, precio_mensual, whatsapp y autorizacion_contacto_en.
--
-- El precio se cambia en habitaciones.precio_mensual_cop. El trigger existente
-- deriva pensiones.precio_mensual y conserva las reglas de integridad del precio.
-- latitud/longitud se permiten aqui, siempre sujetos al CHECK de coordenadas.
-- ---------------------------------------------------------------------------
create or replace function public.maestro_actualizar_campos_pension(
  p_pension_id uuid,
  p_cambios jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_pension_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Necesitas una sesion para administrar una publicacion'
      using errcode = '42501';
  end if;

  if not public.es_maestro() then
    raise exception 'Solo maestro puede cambiar campos administrativos de una publicacion'
      using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_cambios) is distinct from 'object'
     or p_cambios = '{}'::jsonb then
    raise exception 'Indica un objeto JSON con al menos un campo administrativo'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from pg_catalog.jsonb_object_keys(p_cambios) as entrada(campo)
     where entrada.campo <> all (array['calificacion', 'verificado', 'latitud', 'longitud']::text[])
  ) then
    raise exception 'La funcion solo admite calificacion, verificado, latitud y longitud; no admite identidad, propietario, precio derivado ni datos privados'
      using errcode = '22023';
  end if;

  if (p_cambios ? 'calificacion'
      and pg_catalog.jsonb_typeof(p_cambios->'calificacion') not in ('number', 'null'))
     or (p_cambios ? 'verificado'
      and pg_catalog.jsonb_typeof(p_cambios->'verificado') not in ('boolean', 'null'))
     or (p_cambios ? 'latitud'
      and pg_catalog.jsonb_typeof(p_cambios->'latitud') not in ('number', 'null'))
     or (p_cambios ? 'longitud'
      and pg_catalog.jsonb_typeof(p_cambios->'longitud') not in ('number', 'null')) then
    raise exception 'Tipo de dato no valido para un campo administrativo'
      using errcode = '22023';
  end if;

  update public.pensiones as p
     set calificacion = case
           when p_cambios ? 'calificacion' then (p_cambios->>'calificacion')::numeric
           else p.calificacion
         end,
         verificado = case
           when p_cambios ? 'verificado' then (p_cambios->>'verificado')::boolean
           else p.verificado
         end,
         latitud = case
           when p_cambios ? 'latitud' then (p_cambios->>'latitud')::double precision
           else p.latitud
         end,
         longitud = case
           when p_cambios ? 'longitud' then (p_cambios->>'longitud')::double precision
           else p.longitud
         end
   where p.id = p_pension_id
  returning p.id into v_pension_id;

  if not found then
    raise exception 'Esa publicacion no existe'
      using errcode = 'P0002';
  end if;

  return v_pension_id;
end;
$$;

revoke execute on function public.maestro_actualizar_campos_pension(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.maestro_actualizar_campos_pension(uuid, jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- 6) Borrado: anfitrion propio o maestro cualquier pension
-- ---------------------------------------------------------------------------
drop policy if exists "pensiones: borrar las propias" on public.pensiones;
drop policy if exists "pensiones: borrar las propias o el maestro" on public.pensiones;
create policy "pensiones: borrar las propias o el maestro" on public.pensiones
  for delete to authenticated
  using ((select auth.uid()) = anfitrion_id or public.es_maestro());

create or replace function public.borrar_pension(p_pension_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_propietario uuid;
  v_slug text;
  v_filas integer;
begin
  if v_usuario is null then
    raise exception 'Necesitas una sesion para borrar una publicacion'
      using errcode = '42501';
  end if;

  select p.anfitrion_id, p.slug
    into v_propietario, v_slug
    from public.pensiones as p
   where p.id = p_pension_id;

  if not found then
    raise exception 'Esa publicacion no existe'
      using errcode = 'P0002';
  end if;

  if v_propietario is distinct from v_usuario and not public.es_maestro() then
    raise exception 'Solo el propietario o maestro puede borrar esta publicacion'
      using errcode = '42501';
  end if;

  -- El DELETE del padre conserva intacto el trigger AFTER DELETE de Oleada 7,
  -- que reserva OLD.slug en public.slugs_reservados.
  delete from public.habitaciones where pension_id = p_pension_id;

  delete from public.pensiones as p
   where p.id = p_pension_id
     and (p.anfitrion_id = v_usuario or public.es_maestro());

  get diagnostics v_filas = row_count;
  if v_filas <> 1 then
    raise exception 'No se pudo borrar la publicacion (filas afectadas: %)', v_filas
      using errcode = 'P0001';
  end if;

  return v_slug;
end;
$$;

revoke execute on function public.borrar_pension(uuid) from public, anon, authenticated;
grant execute on function public.borrar_pension(uuid) to authenticated;


-- ==========================================================================
-- No reemitir permisos SELECT/UPDATE de public.pensiones aqui. Oleada 10 ya
-- mantiene las listas de columnas, excluyendo whatsapp y autorizacion_contacto_en.
-- Tampoco se concede UPDATE a id, slug, anfitrion_id ni usuarios.rol.
-- ==========================================================================
