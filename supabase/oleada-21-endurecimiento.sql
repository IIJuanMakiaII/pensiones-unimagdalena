-- ============================================================================
-- Oleada 21 — Endurecimiento de permisos y límite del formulario público
-- Proyecto: Nido · Supabase/Postgres · auditoría de seguridad del 2026-11-03
--
-- ⚠ ORDEN DE DESPLIEGUE — leer antes de pegar
--
--   1. Respaldo (§7.2 de `docs/aplicar-migraciones-pendientes.md`).
--   2. Se aplica ESTA migración sola, entera, en una transacción.
--   3. Se ejecuta el bloque A. A.1 y A.2 son las que deciden.
--   4. No hay código que dependa de esto: la aplicación no cambia.
--
-- QUÉ RESUELVE
--
--   Dos huecos medidos el 2026-11-03 con la clave anónima (detalle y evidencia
--   en `docs/auditorias/seguridad-datos-20261103.md`):
--
--   F1 · `anon` conserva privilegios de tabla que RLS estaba tapando.
--        `DELETE` sobre `pensiones`, `habitaciones` y `usuarios` devuelve `200`
--        con cero filas: hoy no borra nada porque no hay política que lo
--        permita, pero la única barrera es la ausencia de política. Una política
--        nueva mal escrita (`using (true)`) convertiría eso en un borrado real.
--        Lo mismo con `INSERT` sobre `usuarios`: la petición llega hasta RLS.
--
--   F2 · La función pública `registrar_contacto_respaldo` no tiene límite.
--        Cualquiera con la clave anónima —que es pública por diseño— puede
--        llamarla en bucle y llenar la tabla de contactos falsos. No hay IP
--        disponible para limitar por origen, así que se limita por volumen y
--        por repetición del mismo contacto.
--
-- QUÉ **NO** HACE, A PROPOSITO
--
--   · No toca los permisos por columna. La proyección de 20 columnas de
--     `pensiones` y la de 7 de `habitaciones` son el contrato con `mapeo.ts`:
--     revocar o conceder de más las rompe con `42501`.
--   · No toca `authenticated`. El anfitrión y el maestro siguen escribiendo por
--     las mismas funciones y las mismas columnas que hoy.
--   · No toca `storage`. El bucket `fotos-pensiones` es público a propósito y
--     la subida anónima ya está rechazada por política (medido).
--   · No cambia ninguna firma de función ni el comportamiento del formulario
--     para una persona real.
--
-- CONSECUENCIA QUE CONVIENE SABER
--
--   El límite del §3 es un freno de emergencia, no una cuota de producto:
--   más de 20 contactos en un minuto, o el mismo contacto cuatro veces en una
--   hora, se rechazan. Con una pensión y tráfico real es inalcanzable; si algún
--   día se alcanza, el número se sube con una línea.
--
-- Idempotente: se puede pegar dos veces sin efecto añadido.
-- No se ha aplicado: lo aplica quien administra el proyecto.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0) Guardas de dependencia — fallar aquí es mejor que fallar a medias
-- ---------------------------------------------------------------------------

do $$
begin
  if pg_catalog.to_regclass('public.pensiones') is null
     or pg_catalog.to_regclass('public.habitaciones') is null
     or pg_catalog.to_regclass('public.usuarios') is null
     or pg_catalog.to_regclass('public.contactos_respaldo') is null then
    raise exception 'Faltan tablas base: aplica esquema.sql y las oleadas 1-16 antes de esta migracion';
  end if;

  -- Aviso, no error: el endurecimiento funciona igual sin la oleada 19.
  if pg_catalog.to_regprocedure('public.registrar_contacto_respaldo(text,text,text,text,boolean)') is null then
    raise notice 'AVISO 21: no existe registrar_contacto_respaldo(text,text,text,text,boolean). La oleada 19 sigue pendiente; esta migracion no la necesita, pero el formulario no guardara la autorizacion hasta aplicarla.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) F1 · `anon` pierde lo que RLS estaba tapando
--
--    Se revoca por tabla y por operación, no `all`: `SELECT` sobre `pensiones`
--    y `habitaciones` ya está concedido por columna desde las oleadas 10 y 17,
--    y un `revoke all` dejaría el catálogo público en `42501`. Sobre `usuarios`
--    sí se revoca también `SELECT`: la política devuelve cero filas para `anon`
--    y nada del sitio lee esa tabla con la clave pública.
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger
  on table public.pensiones from anon;

revoke insert, update, delete, truncate, references, trigger
  on table public.habitaciones from anon;

revoke select, insert, update, delete, truncate, references, trigger
  on table public.usuarios from anon;

-- ---------------------------------------------------------------------------
-- 2) Reafirmar el cierre de las tablas que ya estaban cerradas
--
--    Hoy responden `42501`, así que estas cuatro líneas no cambian nada. Se
--    repiten para que el archivo, por sí solo, deje el mismo estado aunque
--    alguien haya concedido de más por otra vía.
-- ---------------------------------------------------------------------------

revoke all on table public.contacto_anfitrion from anon;
revoke all on table public.contactos_respaldo from anon;
revoke all on table public.reservas from anon;

revoke all on sequence public.contactos_respaldo_id_seq from anon;

-- ---------------------------------------------------------------------------
-- 3) F2 · Límite del formulario público
--
--    Va en un disparador y no dentro de la función por dos razones: no hay que
--    volver a reemplazar `registrar_contacto_respaldo` (y volver a arriesgar la
--    firma de cuatro argumentos que usa el formulario en producción), y el
--    límite se aplica también si alguien escribe por otra vía.
--
--    `security definer` porque el disparador cuenta filas de la tabla y quien
--    inserta es un rol sin `select` sobre ella. `set search_path` explícito
--    porque es lo único que impide que un esquema ajeno cambie a qué tabla se
--    refiere `contactos_respaldo`.
-- ---------------------------------------------------------------------------

create or replace function public.limitar_contactos_respaldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ultimo_minuto  integer;
  v_mismo_contacto integer;
begin
  -- Freno global: si en el último minuto entraron 20 o más, algo está
  -- automatizado. Una pensión real no recibe veinte consultas por minuto.
  select count(*)
    into v_ultimo_minuto
    from public.contactos_respaldo
   where creado_en > now() - interval '1 minute';

  if v_ultimo_minuto >= 20 then
    raise exception 'Demasiados contactos en el ultimo minuto.'
      using errcode = '54000';
  end if;

  -- Repetición del mismo contacto: tres en una hora es insistir; la cuarta es
  -- un bucle. Se cuenta el valor ya normalizado que llega a la fila.
  select count(*)
    into v_mismo_contacto
    from public.contactos_respaldo
   where contacto = new.contacto
     and creado_en > now() - interval '1 hour';

  if v_mismo_contacto >= 3 then
    raise exception 'Ese contacto ya ha escrito varias veces en la ultima hora.'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

comment on function public.limitar_contactos_respaldo() is
  'Freno del formulario publico de respaldo: rechaza mas de 20 contactos por minuto o el cuarto del mismo contacto en una hora (auditoria 2026-11-03, hallazgo F2). No es una cuota de producto; es un tope de emergencia ajustable.';

-- Un disparador no necesita EXECUTE del rol que inserta, así que se cierra a
-- todos: nadie debe poder invocarlo como RPC.
revoke all on function public.limitar_contactos_respaldo() from public, anon, authenticated;

drop trigger if exists antes_de_guardar_contacto on public.contactos_respaldo;
create trigger antes_de_guardar_contacto
  before insert on public.contactos_respaldo
  for each row execute function public.limitar_contactos_respaldo();

commit;

-- ============================================================================
-- 4) Verificación · ejecutar después y comparar con lo esperado
-- ============================================================================
--
-- A.1 · `anon` ya no puede escribir ni borrar en las tres tablas
--
--   select pg_catalog.has_table_privilege('anon', 'public.pensiones', 'INSERT') as pen_ins,
--          pg_catalog.has_table_privilege('anon', 'public.pensiones', 'UPDATE') as pen_upd,
--          pg_catalog.has_table_privilege('anon', 'public.pensiones', 'DELETE') as pen_del,
--          pg_catalog.has_table_privilege('anon', 'public.habitaciones', 'DELETE') as hab_del,
--          pg_catalog.has_table_privilege('anon', 'public.usuarios', 'SELECT') as usu_sel,
--          pg_catalog.has_table_privilege('anon', 'public.usuarios', 'DELETE') as usu_del;
--
--   Esperado: f | f | f | f | f | f
--   Antes de aplicar: pen_del, hab_del, usu_del daban `t` y usu_sel daba `t`.
--
-- A.2 · El catálogo público sigue leyéndose (esto es lo que no puede romperse)
--
--   select pg_catalog.has_column_privilege('anon','public.pensiones','titulo','SELECT')     as titulo,
--          pg_catalog.has_column_privilege('anon','public.pensiones','precio_mensual','SELECT') as precio,
--          pg_catalog.has_column_privilege('anon','public.pensiones','whatsapp','SELECT')     as whatsapp,
--          pg_catalog.has_column_privilege('anon','public.habitaciones','disponible','SELECT') as disponible,
--          pg_catalog.has_column_privilege('anon','public.habitaciones','reservada_en','SELECT') as reservada;
--
--   Esperado: t | t | f | t | f
--
-- A.3 · El disparador existe y está activo
--
--   select t.tgname, c.relname, t.tgenabled
--     from pg_trigger t
--     join pg_class c on c.oid = t.tgrelid
--    where t.tgname = 'antes_de_guardar_contacto';
--
--   Esperado: 1 fila · `antes_de_guardar_contacto` · `contactos_respaldo` · `O`
--
-- A.4 · RLS activo en las seis tablas
--
--   select c.relname, c.relrowsecurity as rls
--     from pg_class c
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public'
--      and c.relname in ('usuarios','pensiones','habitaciones','contacto_anfitrion',
--                        'contactos_respaldo','reservas')
--    order by c.relname;
--
--   Esperado: 6 filas, todas con `t`.
--
-- A.5 · Ninguna política abierta de par en par
--
--   select tablename, policyname, cmd
--     from pg_policies
--    where schemaname = 'public'
--      and (coalesce(qual, '') in ('true','(true)')
--        or coalesce(with_check, '') in ('true','(true)'));
--
--   Esperado: 0 filas.
--
-- A.6 · Ninguna función `security definer` sin `search_path` fijado
--
--   select p.oid::regprocedure as firma
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.prosecdef
--      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
--                       where c like 'search_path=%');
--
--   Esperado: 0 filas.
--
-- A.7 · La escalada a maestro sigue cerrada por privilegio de columna
--       (esta es la que no se pudo medir desde fuera)
--
--   select pg_catalog.has_column_privilege('authenticated','public.usuarios','rol','UPDATE')      as rol,
--          pg_catalog.has_column_privilege('authenticated','public.usuarios','nombre','UPDATE')   as nombre,
--          pg_catalog.has_column_privilege('authenticated','public.usuarios','email','UPDATE')    as email,
--          pg_catalog.has_function_privilege('anon','public.es_maestro()','EXECUTE')             as anon_es_maestro;
--
--   Esperado: f | t | t | f
--
-- A.8 · Los roles de cliente no pueden crear objetos en `public`
--       (si esto diera `t`, `set search_path = public` de las funciones antiguas
--        sería un riesgo real y habría que pasarlas a `pg_catalog`)
--
--   select pg_catalog.has_schema_privilege('anon','public','CREATE')          as anon_create,
--          pg_catalog.has_schema_privilege('authenticated','public','CREATE') as auth_create;
--
--   Esperado: f | f
--
-- A.9 · Prueba del límite, sin dejar filas (opcional)
--
--   begin;
--     -- 21 llamadas seguidas: la 21 tiene que fallar con 54000
--     select public.registrar_contacto_respaldo('Prueba Limite', 'limite@ejemplo.invalid');
--     -- repetir la línea anterior 21 veces, cambiando el nombre
--   rollback;
--
--   Esperado: a partir de la vigésima primera, ERROR 54000. El `rollback` no
--   deja ni una fila.
--
-- ============================================================================
-- 5) Reversión
-- ============================================================================
--
--   Deshace F2 primero y deja F1 como estaba; reabre el hueco a propósito.
--
--   begin;
--     drop trigger if exists antes_de_guardar_contacto on public.contactos_respaldo;
--     drop function if exists public.limitar_contactos_respaldo();
--
--     grant insert, delete on table public.pensiones    to anon;
--     grant insert, delete on table public.habitaciones to anon;
--     grant select, insert, delete on table public.usuarios to anon;
--   commit;
--
-- ============================================================================
-- 6) Lo que queda pendiente, y no se resuelve aquí
-- ============================================================================
--
--   1. EL LÍMITE POR ORIGEN. El freno del §3 cuenta volumen, no direcciones IP:
--      PostgREST no las expone a la función. Un límite por IP va en el borde
--      (Vercel/WAF) o con un proveedor de captcha en el formulario, y las dos
--      cosas son decisiones de producto, no de esquema.
--   2. LOS PERMISOS POR COLUMNA SE COMPRUEBAN A MANO. `has_column_privilege`
--      exige privilegios que la clave anónima no tiene, así que el contrato con
--      `mapeo.ts` solo se puede verificar en el editor (A.2). Dejarlo en el
--      bloque de verificación de cada oleada es lo que evita que se rompa en
--      silencio.
--   3. LAS OLEADAS 17, 18, 19 Y 20 NO ESTÁN EN EL REPOSITORIO. Están aplicadas
--      en producción y viven solo en la copia de trabajo. Mientras no se
--      commiteen, la base no es reproducible y este archivo se apoya en un
--      esquema que el repositorio no describe.
