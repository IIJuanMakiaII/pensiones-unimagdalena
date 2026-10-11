-- ============================================================================
-- Oleada 12 · Contacto de respaldo (tarea #59)
--
-- QUÉ RESUELVE
-- Hasta hoy, un estudiante que no pudiera usar WhatsApp no tenía ninguna forma
-- de dejar sus datos: el contacto entero del sitio era un enlace a un solo
-- número. Este archivo crea el sitio donde queda guardado lo que se envía por
-- el formulario de /contacto.
--
-- POR QUÉ UNA FUNCIÓN Y NO UN PERMISO DE ESCRITURA
-- El cliente de servidor de la aplicación usa la clave anónima (`utils/supabase/server.ts`).
-- Para que un visitante sin cuenta pueda escribir, habría que abrir una política
-- de INSERT pública sobre la tabla: eso deja la tabla abierta a cualquiera que
-- tenga la clave anónima —que es pública—, sin ninguna validación de por medio.
-- En su lugar se expone una única función `security definer` que valida los
-- datos antes de escribir. Es el mismo patrón que ya usan
-- `crear_pension_con_habitaciones` y `maestro_actualizar_campos_pension`.
--
-- La tabla queda con RLS activo y SIN ninguna política: nadie puede leerla ni
-- escribirla directamente con la clave anónima. Solo la función escribe.
--
-- LO QUE ESTE ARCHIVO **NO** RESUELVE
-- Un formulario público sin verificación se puede inundar. La trampa para robots
-- del formulario frena a los rellenadores automáticos tontos, no a un atacante
-- decidido. Un límite de frecuencia o una verificación de terceros exigen una
-- decisión sobre el proveedor y no se han introducido aquí.
--
-- ES IDEMPOTENTE: se puede pegar dos veces sin efecto añadido.
-- No se ha aplicado todavía: lo aplica quien administra el proyecto.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) La tabla
-- ---------------------------------------------------------------------------

create table if not exists public.contactos_respaldo (
  id           bigint generated always as identity primary key,
  creado_en    timestamptz not null default now(),
  nombre       text        not null,
  contacto     text        not null,
  mensaje      text,
  pension_slug text,
  origen       text        not null default 'formulario_respaldo',
  atendido     boolean     not null default false,

  -- Los mismos límites que valida la aplicación, aquí también. Sin esto, la
  -- validación del formulario sería la única puerta, y una llamada directa a la
  -- función la esquivaría.
  constraint contactos_respaldo_nombre_largo
    check (char_length(btrim(nombre)) between 2 and 80),
  constraint contactos_respaldo_contacto_largo
    check (char_length(btrim(contacto)) between 5 and 120),
  constraint contactos_respaldo_mensaje_largo
    check (mensaje is null or char_length(mensaje) <= 1200),
  -- El slug viene de la dirección pública del anuncio: forma previsible o nulo.
  -- No se comprueba que exista: un anuncio retirado entre la visita y el envío
  -- no debe hacer perder el contacto, que es justo lo que hay que conservar.
  constraint contactos_respaldo_slug_formato
    check (pension_slug is null or pension_slug ~ '^[a-z0-9-]{1,80}$')
);

comment on table public.contactos_respaldo is
  'Contactos dejados por el formulario de respaldo de /contacto (tarea #59). '
  'Datos personales: se conservan solo el tiempo necesario para responder y '
  'mientras el aviso de privacidad lo permita.';

-- Se ordena por fecha para atender lo más reciente primero.
create index if not exists contactos_respaldo_creado_en_idx
  on public.contactos_respaldo (creado_en desc);

-- Los pendientes de atender, para no recorrer toda la tabla.
create index if not exists contactos_respaldo_pendientes_idx
  on public.contactos_respaldo (creado_en desc)
  where not atendido;

-- ---------------------------------------------------------------------------
-- 2) Nadie la toca directamente
-- ---------------------------------------------------------------------------

alter table public.contactos_respaldo enable row level security;

-- Sin políticas y sin privilegios: la clave anónima no puede leer ni escribir.
revoke all on table public.contactos_respaldo from anon, authenticated;
revoke all on sequence public.contactos_respaldo_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) La única puerta: una función que valida y escribe
-- ---------------------------------------------------------------------------

create or replace function public.registrar_contacto_respaldo(
  p_nombre       text,
  p_contacto     text,
  p_mensaje      text default null,
  p_pension_slug text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Misma limpieza que `lib/contacto-respaldo.ts`: colapsar el espacio y
  -- recortar los extremos. Sin esto, un nombre de solo espacios pasaría el
  -- `check` de longitud si la comprobación se hiciera antes de normalizar.
  v_nombre   text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_contacto text := btrim(regexp_replace(coalesce(p_contacto, ''), '\s+', ' ', 'g'));
  v_mensaje  text := nullif(btrim(coalesce(p_mensaje, '')), '');
  v_slug     text := nullif(btrim(coalesce(p_pension_slug, '')), '');
begin
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'El nombre debe tener entre 2 y 80 caracteres.'
      using errcode = '22023';
  end if;

  if char_length(v_contacto) < 5 or char_length(v_contacto) > 120 then
    raise exception 'El contacto debe tener entre 5 y 120 caracteres.'
      using errcode = '22023';
  end if;

  if v_mensaje is not null and char_length(v_mensaje) > 1200 then
    raise exception 'El mensaje no puede pasar de 1200 caracteres.'
      using errcode = '22023';
  end if;

  if v_slug is not null and v_slug !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'El identificador del anuncio no tiene un formato válido.'
      using errcode = '22023';
  end if;

  insert into public.contactos_respaldo (nombre, contacto, mensaje, pension_slug)
  values (v_nombre, v_contacto, v_mensaje, v_slug);
end;
$$;

comment on function public.registrar_contacto_respaldo(text, text, text, text) is
  'Guarda un contacto del formulario de respaldo. Valida dentro para que una '
  'llamada directa no pueda saltarse las reglas del formulario.';

-- Primero quitar todo, después conceder lo justo: `anon` puede llamar a esta
-- función y nada más.
revoke all on function public.registrar_contacto_respaldo(text, text, text, text) from public;
revoke all on function public.registrar_contacto_respaldo(text, text, text, text) from anon, authenticated;
grant execute on function public.registrar_contacto_respaldo(text, text, text, text) to anon, authenticated;

commit;

-- ============================================================================
-- 4) Verificación · ejecutar después y comparar con lo esperado
-- ============================================================================
--
-- D.1 · La tabla existe y tiene RLS activo → `rowsecurity = t` y `policies = 0`
--
--   select c.relname,
--          c.relrowsecurity as rls_activo,
--          (select count(*) from pg_policies p
--            where p.schemaname = 'public' and p.tablename = c.relname) as politicas
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relname = 'contactos_respaldo';
--
--   Esperado: 1 fila · `t` · `0`
--
-- D.2 · La función es SECURITY DEFINER y anon puede invocarla
--
--   select p.proname,
--          p.prosecdef as security_definer,
--          has_function_privilege('anon', p.oid, 'execute') as anon_puede
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'registrar_contacto_respaldo';
--
--   Esperado: 1 fila · `t` · `t`
--
-- D.3 · La clave anónima NO puede leer la tabla  (esto es lo que impide que los
--       contactos de los estudiantes queden al aire)
--
--   Con la clave anónima:  GET /rest/v1/contactos_respaldo?select=*
--   Esperado: `200` con `[]`  — o `401/403`. Nunca una fila.
--   Si devuelve filas, la tabla quedó legible y hay que revisar los `revoke`.
--
-- D.4 · Una llamada con datos fuera de rango es rechazada
--
--   select public.registrar_contacto_respaldo('a', 'x');
--   Esperado: ERROR 22023 «El nombre debe tener entre 2 y 80 caracteres.»
--
-- D.5 · La llamada válida guarda  (ESTA ES LA ÚNICA QUE ESCRIBE)
--
--   select public.registrar_contacto_respaldo(
--     'Prueba Nido', 'prueba@ejemplo.com', 'Comprobación de la oleada 12', 'residencia-makia');
--   select nombre, contacto, pension_slug, atendido
--     from public.contactos_respaldo order by creado_en desc limit 1;
--   Esperado: 1 fila con esos valores y `atendido = f`.
--
--   -- Limpieza de la prueba:
--   -- delete from public.contactos_respaldo where contacto = 'prueba@ejemplo.com';
--
-- ============================================================================
-- 5) Decisión abierta, para quien administra · NO ejecutar sin decidirla
-- ============================================================================
--
-- Ni el formulario ni esta función limitan cuántas veces se puede enviar. Un
-- formulario público siempre se puede inundar; la trampa para robots del
-- formulario solo detiene a los rellenadores automáticos más simples.
--
-- Si se quiere cerrar de verdad, hay dos caminos y ninguno es código:
--
--   A) Límite de frecuencia por IP en el borde de la red (Vercel/WAF), sin
--      tocar la base ni el formulario.
--   B) Verificación de terceros (reCAPTCHA o similar) en el formulario: es un
--      proveedor nuevo y exige decidirlo antes de introducirlo, además de
--      declararlo en el aviso de privacidad.
--
-- Mientras no se decida, lo recomendable es revisar la tabla antes de que sus
-- filas se acumulen y borrar lo que no sean contactos reales.
