-- ============================================================================
-- Oleada 1 — Habitaciones, integridad en la base y coherencia de precio
-- Ejecutar después de esquema.sql y storage-fotos.sql. Es idempotente.
--
-- Qué resuelve
--  1. Crear pensión + habitaciones en UNA sola transacción (RPC), para que una
--     publicación nunca quede sin habitaciones (hoy una pensión sin habitaciones
--     desaparece al filtrar por género o alimentación).
--  2. Poner la integridad DONDE CORRESPONDE: en la base, no solo en el
--     formulario. Antes, cualquier cuenta autenticada podía escribir directo
--     contra la API saltándose las validaciones.
--  3. Corregir la política UPDATE de `habitaciones`: le faltaba `with check`, así
--     que un anfitrión podía mover su habitación al anuncio de OTRO.
--  4. Mantener `pensiones.precio_mensual` sincronizado con la habitación más
--     barata disponible (antes era una denormalización de la que nadie
--     respondía y que se desincronizaba en silencio).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Candados de integridad en las tablas
-- ---------------------------------------------------------------------------

alter table public.pensiones drop constraint if exists pensiones_titulo_longitud;
alter table public.pensiones
  add constraint pensiones_titulo_longitud
  check (char_length(titulo) between 6 and 120);

alter table public.pensiones drop constraint if exists pensiones_descripcion_longitud;
alter table public.pensiones
  add constraint pensiones_descripcion_longitud
  check (char_length(descripcion) <= 2000);

alter table public.pensiones drop constraint if exists pensiones_precio_rango;
alter table public.pensiones
  add constraint pensiones_precio_rango
  check (precio_mensual between 0 and 20000000);

alter table public.pensiones drop constraint if exists pensiones_imagenes_limite;
alter table public.pensiones
  add constraint pensiones_imagenes_limite
  check (imagenes is null or array_length(imagenes, 1) is null or array_length(imagenes, 1) <= 8);

alter table public.habitaciones drop constraint if exists habitaciones_precio_rango;
alter table public.habitaciones
  add constraint habitaciones_precio_rango
  check (precio_mensual_cop between 0 and 20000000);

-- ---------------------------------------------------------------------------
-- 2) Política UPDATE de habitaciones: faltaba `with check`
-- ---------------------------------------------------------------------------

drop policy if exists "habitaciones: editar las propias" on public.habitaciones;
create policy "habitaciones: editar las propias"
  on public.habitaciones for update
  using (
    exists (
      select 1 from public.pensiones p
      where p.id = habitaciones.pension_id
        and p.anfitrion_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.pensiones p
      where p.id = habitaciones.pension_id
        and p.anfitrion_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Precio de la pensión siempre igual a la habitación más barata disponible
-- ---------------------------------------------------------------------------

create or replace function public.sincronizar_precio_pension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pension_id uuid;
  v_minimo integer;
begin
  v_pension_id := coalesce(new.pension_id, old.pension_id);

  select min(precio_mensual_cop) into v_minimo
  from public.habitaciones
  where pension_id = v_pension_id and disponible;

  -- Sin habitaciones disponibles se conserva el precio declarado por el anfitrión.
  if v_minimo is not null then
    update public.pensiones set precio_mensual = v_minimo where id = v_pension_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists al_cambiar_habitacion on public.habitaciones;
create trigger al_cambiar_habitacion
  after insert or update or delete on public.habitaciones
  for each row execute function public.sincronizar_precio_pension();

revoke execute on function public.sincronizar_precio_pension() from public;
revoke execute on function public.sincronizar_precio_pension() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) RPC transaccional: pensión + habitaciones en una sola operación
--    Se ejecuta con los permisos del llamante, así que RLS sigue aplicando.
-- ---------------------------------------------------------------------------

create or replace function public.crear_pension_con_habitaciones(
  p_pension jsonb,
  p_habitaciones jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_pension_id uuid;
  v_cantidad integer;
  v_precio_minimo integer;
begin
  if v_usuario is null then
    raise exception 'Sesión requerida para publicar';
  end if;

  -- Validaciones de negocio (además de las restricciones de la tabla).
  if coalesce(trim(p_pension->>'titulo'), '') = '' then
    raise exception 'El título es obligatorio';
  end if;

  v_cantidad := coalesce(jsonb_array_length(p_habitaciones), 0);
  if v_cantidad = 0 then
    raise exception 'Publica al menos una habitación: los estudiantes filtran por tipo, género y alimentación';
  end if;
  if v_cantidad > 20 then
    raise exception 'Demasiadas habitaciones en una publicación (máximo 20)';
  end if;

  insert into public.pensiones (
    anfitrion_id, titulo, descripcion, precio_mensual, direccion, barrio,
    distancia_a_pie_minutos, servicios, normas, imagenes, activa,
    latitud, longitud
  )
  values (
    v_usuario,
    trim(p_pension->>'titulo'),
    coalesce(p_pension->>'descripcion', ''),
    coalesce((p_pension->>'precio_mensual')::integer, 0),
    coalesce(p_pension->>'direccion', ''),
    coalesce(p_pension->>'barrio', ''),
    coalesce((p_pension->>'distancia_a_pie_minutos')::smallint, 10),
    coalesce(
      (select array_agg(valor) from jsonb_array_elements_text(p_pension->'servicios') as valor),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(valor) from jsonb_array_elements_text(p_pension->'normas') as valor),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(valor) from jsonb_array_elements_text(p_pension->'imagenes') as valor),
      '{}'::text[]
    ),
    coalesce((p_pension->>'activa')::boolean, true),
    nullif(p_pension->>'latitud', '')::double precision,
    nullif(p_pension->>'longitud', '')::double precision
  )
  returning id into v_pension_id;

  insert into public.habitaciones (
    pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible
  )
  select
    v_pension_id,
    coalesce(h->>'tipo', 'individual'),
    coalesce(h->>'genero', 'mixto'),
    (h->>'precio_mensual_cop')::integer,
    coalesce((h->>'alimentacion_incluida')::boolean, false),
    coalesce((h->>'disponible')::boolean, true)
  from jsonb_array_elements(p_habitaciones) as h;

  -- El precio de la tarjeta debe coincidir con la habitación más barata.
  select min(precio_mensual_cop) into v_precio_minimo
  from public.habitaciones
  where pension_id = v_pension_id and disponible;

  if v_precio_minimo is not null then
    update public.pensiones set precio_mensual = v_precio_minimo where id = v_pension_id;
  end if;

  return v_pension_id;
end;
$$;

revoke execute on function public.crear_pension_con_habitaciones(jsonb, jsonb) from public;
revoke execute on function public.crear_pension_con_habitaciones(jsonb, jsonb) from anon;
grant execute on function public.crear_pension_con_habitaciones(jsonb, jsonb) to authenticated;
