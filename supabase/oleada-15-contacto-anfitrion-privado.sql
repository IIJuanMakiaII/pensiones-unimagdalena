-- ============================================================================
-- Oleada 15 · El WhatsApp del anfitrión, en una tabla privada (tarea #76)
--
--   Idempotente. **Aditiva**: no modifica ninguna tabla existente, no reemite
--   ningún permiso de `pensiones` y no toca ningún dato de negocio.
--
--   ⚠️ NO ESTÁ APLICADA. La aplica el fundador en el editor SQL del panel:
--      https://supabase.com/dashboard/project/ayznnqkacpdvvufclhon/sql
--      Desde el entorno del equipo no se puede: el MCP responde
--      `site_owner_denied` y la única credencial del repositorio es la clave
--      anónima, que no puede aplicar DDL (docs/aplicar-migraciones-pendientes.md §5).
--
--   ⚠️ ORDEN DE DESPLIEGUE — **aplicar esta migración ANTES de desplegar el
--      código que la lee.** Es la única dirección segura, y el motivo está
--      medido en este mismo repositorio: la capa de datos pide las columnas por
--      su nombre, así que contra una base a la que le falte la tabla la consulta
--      **no devuelve vacío: falla**. Al revés no hay problema — crear la tabla y
--      conceder su lectura es compatible con el código que ya está en
--      producción, que simplemente todavía no la pide.
--      El detalle completo, en la sección 6. Y por si el orden se invierte, el
--      lector de la aplicación (lib/contacto-anfitrion.ts) **tolera que la tabla
--      falte**: informa «sin-tabla» y el panel no dibuja el botón. Nunca tumba
--      una página. Las dos defensas están puestas a propósito; ver sección 6.
--
-- QUÉ RESUELVE (petición del propietario, literal)
--
--   «Guarda el número en una tabla independiente, por ejemplo
--    `contacto_anfitrion`, con RLS que permita leerlo únicamente al rol maestro
--    y al anfitrión propietario. No lo añadas a `pensiones`, porque esa tabla usa
--    `select` por columna y no debe incorporar datos sensibles.»
--
--   Su motivo es técnico y es correcto: hoy la protección del número que ya
--   existe depende de que **cada consulta** enumere bien sus columnas
--   (`oleada-10` revocó el privilegio de tabla y volvió a concederlo columna por
--   columna). Eso funciona, pero es una protección que se rompe en silencio el
--   día que alguien añada `whatsapp` a una lista o use un comodín. Una tabla
--   propia **sin privilegio alguno para `anon`** no depende de que nadie se
--   acuerde de nada: la API responde `42501` antes de evaluar ninguna política.
--   Es defensa en profundidad, y es lo que construye este archivo.
--
-- LO QUE ESTE ARCHIVO **NO** HACE
--
--   · **No borra ni traslada `pensiones.whatsapp`.** Existe, está revocada desde
--     `oleada-10` y hoy no la lee nadie. La recomendación está razonada en la
--     sección 5, **sin ejecutarla**: la decide el propietario.
--   · **No toca `pensiones`, `habitaciones`, `usuarios` ni ninguna política
--     existente.** Cero cambios en tablas que ya están en producción es cero
--     superficie nueva sobre lo que hoy funciona.
--   · **No crea ninguna función.** La tabla la escribe una sesión con cuenta
--     (el propio anfitrión), no un visitante anónimo: la RLS y los privilegios
--     bastan. Es distinto de `contactos_respaldo` (oleada-12), donde el que
--     escribe es un desconocido sin sesión y por eso hizo falta una función
--     `security definer` que validara. Aquí no hace falta, y no se añade.
--   · **No publica el número en ningún sitio.** Ese es el objetivo, no un
--     efecto secundario: ver la sección 5 del guion `verificar:contacto-privado`.
-- ============================================================================


begin;

-- ---------------------------------------------------------------------------
-- 1) Precondición: el rol maestro tiene que existir ya
--
--    Las dos políticas de lectura y escritura preguntan `public.es_maestro()`,
--    que la define `supabase/oleada-9.sql` (aplicada). Si esa función no
--    estuviera, el `create policy` fallaría con un error de función inexistente
--    y —al ir todo dentro de una transacción— no se aplicaría nada. Se dice con
--    un mensaje propio para que el diagnóstico no haya que buscarlo.
-- ---------------------------------------------------------------------------
do $precondiciones$
begin
  if to_regprocedure('public.es_maestro()') is null then
    raise exception 'Falta public.es_maestro(): aplica supabase/oleada-9.sql antes de esta migracion';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_roles
     where rolname = 'anon'
  ) or not exists (
    select 1
      from pg_catalog.pg_roles
     where rolname = 'authenticated'
  ) then
    raise exception 'Este proyecto no tiene los roles anon/authenticated de Supabase; los privilegios de la seccion 3 no significarian lo mismo';
  end if;
end
$precondiciones$;


-- ---------------------------------------------------------------------------
-- 2) La tabla
--
--    UNA FILA POR ANFITRIÓN, no una por anuncio. Los dos motivos:
--
--      · Es el número de una persona, no de un inmueble. Un anfitrión con tres
--        anuncios tiene un solo teléfono; guardarlo tres veces son tres copias
--        del mismo dato sensible que pueden divergir (y la divergencia es un
--        fallo silencioso: el panel llamaría a un número que ya no es).
--      · La política de RLS queda en `auth.uid() = anfitrion_id`, que es una
--        comparación directa contra la fila. Con una fila por anuncio, la
--        política tendría que preguntar por `pensiones` dentro de la política
--        de `contacto_anfitrion`: más superficie y una dependencia entre dos
--        tablas dentro de una regla de seguridad.
--
--    El panel del maestro necesita el número **por anuncio**, y lo obtiene
--    uniendo por `anfitrion_id` — eso es una consulta, no un cambio de modelo.
--
--    `anfitrion_id` es la clave primaria y apunta a `public.usuarios`, que es el
--    perfil 1:1 con `auth.users` que ya usa `pensiones.anfitrion_id`
--    (supabase/esquema.sql:25). Se apunta a `usuarios` y no a `auth.users` para
--    ser coherente con la única tabla del proyecto que ya guarda un
--    propietario; `on delete cascade` en los dos saltos, así que borrar la
--    cuenta se lleva el número: no queda un teléfono huérfano de nadie.
-- ---------------------------------------------------------------------------
create table if not exists public.contacto_anfitrion (
  anfitrion_id  uuid        primary key references public.usuarios(id) on delete cascade,
  -- NOT NULL, y es deliberado: una fila sin número no significa nada. Para
  -- quitar el número, el anfitrión borra la fila. Así «sin número» es «sin fila»
  -- y no hay dos formas de representar lo mismo.
  whatsapp      text        not null,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- Formato: las dos formas del plan de numeración colombiano, y nada más.
  --
  --   · `3`  + 9 dígitos  → celular (el caso normal: el botón es un enlace
  --                          `wa.me`, y WhatsApp vive en un celular).
  --   · `60` + 8 dígitos  → fijo con su indicativo (el 605 de Santa Marta entra
  --                          aquí). Se sigue aceptando A PROPÓSITO: hay
  --                          pensiones familiares que atienden por el fijo, y
  --                          `oleada-4.sql:21-26` ya razonó que rechazarlo sería
  --                          un error. Esta migración no revierte esa decisión,
  --                          solo la precisa.
  --
  -- Es más estricta que el `^[0-9]{10}$` de `pensiones.whatsapp`, y la
  -- diferencia es intencionada: «diez dígitos cualesquiera» admite cadenas como
  -- `1234567890`, que producirían un botón «Escribir al anfitrión» que no lleva
  -- a ninguna parte. La justificación completa y la decisión sobre endurecer la
  -- columna vieja, en la sección 5.
  constraint contacto_anfitrion_whatsapp_formato
    check (whatsapp ~ '^(3[0-9]{9}|60[0-9]{8})$')
);

comment on table public.contacto_anfitrion is
  'WhatsApp privado del anfitrion (tarea #76). Dato personal: NO se publica en '
  'ninguna pagina, ni en JSON-LD, ni en metadatos, ni en el sitemap. Solo lo lee '
  'el rol maestro y el propio anfitrion, por RLS. anon no tiene ningun privilegio '
  'sobre esta tabla: la API responde 42501 antes de evaluar ninguna politica.';

comment on column public.contacto_anfitrion.whatsapp is
  'Exactamente 10 digitos, SIN codigo de pais (el +57 lo anade quien construye '
  'el enlace wa.me). Celular (3xxxxxxxxx) o fijo con indicativo (60xxxxxxxx). '
  'Nunca sale de la plataforma.';

comment on column public.contacto_anfitrion.actualizado_en is
  'Lo escribe el disparador antes_de_tocar_contacto, nunca el llamante. Es la '
  'unica forma de saber si el numero sigue vigente.';


-- ---------------------------------------------------------------------------
-- 3) RLS y privilegios: dos lectores, y `anon` fuera de la tabla
--
--    El orden importa y es el mismo de `oleada-10`: primero **quitar todo**,
--    después **conceder lo justo**. Y aquí hay una trampa de Supabase que hay
--    que desactivar a mano: un proyecto Supabase estándar tiene privilegios por
--    defecto que conceden las tablas nuevas del esquema `public` a `anon` y a
--    `authenticated`. Es decir: **la tabla nace legible por `anon`**, y sin este
--    `revoke` el resto del archivo estaría decorando una puerta abierta.
--
--    `revoke all … from public` va delante por el mismo motivo por el que
--    `oleada-10:200-206` lo menciona: una concesión a `PUBLIC` se hereda y un
--    `revoke … from anon` no la retira.
--
--    No hay `sequence` que revocar: la clave es un `uuid` que viene de fuera, no
--    una identidad generada (a diferencia de `contactos_respaldo`, oleada-12:86).
-- ---------------------------------------------------------------------------
alter table public.contacto_anfitrion enable row level security;

revoke all on table public.contacto_anfitrion from public;
revoke all on table public.contacto_anfitrion from anon, authenticated;

-- Solo la sesión con cuenta toca la tabla. Las FILAS las decide la RLS de
-- abajo; el privilegio decide si siquiera se llega a preguntar.
grant select, insert, update, delete on table public.contacto_anfitrion to authenticated;

-- `anon` no aparece en ningún `grant`. No es un olvido: es el objetivo.

-- Las cuatro operaciones, explícitas y con nombre propio, en vez de un
-- `for all`. Se leen mejor en un `pg_policies` y el guion de verificación cuenta
-- exactamente cuatro.
drop policy if exists "contacto_anfitrion: lo lee el dueno o el maestro" on public.contacto_anfitrion;
create policy "contacto_anfitrion: lo lee el dueno o el maestro" on public.contacto_anfitrion
  for select to authenticated
  using ((select auth.uid()) = anfitrion_id or public.es_maestro());

drop policy if exists "contacto_anfitrion: lo escribe el dueno o el maestro" on public.contacto_anfitrion;
create policy "contacto_anfitrion: lo escribe el dueno o el maestro" on public.contacto_anfitrion
  for insert to authenticated
  with check ((select auth.uid()) = anfitrion_id or public.es_maestro());

drop policy if exists "contacto_anfitrion: lo corrige el dueno o el maestro" on public.contacto_anfitrion;
create policy "contacto_anfitrion: lo corrige el dueno o el maestro" on public.contacto_anfitrion
  for update to authenticated
  using ((select auth.uid()) = anfitrion_id or public.es_maestro())
  with check ((select auth.uid()) = anfitrion_id or public.es_maestro());

drop policy if exists "contacto_anfitrion: lo retira el dueno o el maestro" on public.contacto_anfitrion;
create policy "contacto_anfitrion: lo retira el dueno o el maestro" on public.contacto_anfitrion
  for delete to authenticated
  using ((select auth.uid()) = anfitrion_id or public.es_maestro());

-- Nota sobre `(select auth.uid())`: es la forma que ya usa el esquema
-- (supabase/esquema.sql:111-113) para que Postgres lo evalúe una vez por
-- consulta y no una vez por fila. Se copia tal cual para que las cuatro
-- políticas se comporten igual que las del resto del proyecto.


-- ---------------------------------------------------------------------------
-- 4) `actualizado_en`: lo sella la base, no el llamante
--
--    Mismo criterio que `verificado_en` (oleada-13): un valor derivado no se
--    acepta del cliente. Si el formulario pudiera escribir esta fecha, la
--    columna no serviría para saber si el número sigue vigente —que es
--    exactamente para lo que existe—, porque un `PATCH` directo podría dejar la
--    fecha vieja sobre un número nuevo.
--
--    BEFORE INSERT OR UPDATE y no solo UPDATE: en un alta la fecha de creación y
--    la de modificación son el mismo instante, y fijarlas en el mismo sitio
--    evita que una quede en `now()` y la otra en lo que mandara el cliente.
-- ---------------------------------------------------------------------------
create or replace function public.sellar_contacto_anfitrion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Nada se acepta del llamante: ni la fecha de alta ni la de modificación.
    new.creado_en := now();
    new.actualizado_en := now();
    return new;
  end if;

  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists antes_de_tocar_contacto on public.contacto_anfitrion;
create trigger antes_de_tocar_contacto
  before insert or update on public.contacto_anfitrion
  for each row execute function public.sellar_contacto_anfitrion();

-- Cinturón y tirantes, en la misma línea que las otras funciones de disparador
-- del proyecto (oleada-13:147-152): una función que devuelve `trigger` no se
-- puede invocar por RPC, así que esto no cierra nada real. Se deja para que
-- todas queden igual de declaradas.
revoke execute on function public.sellar_contacto_anfitrion() from public;
revoke execute on function public.sellar_contacto_anfitrion() from anon, authenticated;


commit;


-- ============================================================================
-- 5) `pensiones.whatsapp`: recomendación razonada — **NO se ejecuta aquí**
--
--   QUÉ HAY HOY, medido y no supuesto:
--     · La columna existe desde `oleada-4.sql:63`, con la restricción laxa
--       `pensiones_whatsapp_formato` (`^[0-9]{10}$`, `:76-79`).
--     · `oleada-10-cerrar-whatsapp.sql` le retiró la lectura y la escritura a
--       `anon` y a `authenticated`. La migración vigente `oleada-9.sql` no la
--       reemite, así que sigue cerrada.
--     · **Ningún camino de la aplicación la lee ni la escribe**: no está en
--       `COLUMNAS_PENSION` (lib/supabase/mapeo.ts:89-111), el formulario no la
--       envía, y `lib/formato.ts` construye el contacto con el número de la
--       plataforma desde la tarea #39. Su única mención viva en el código es un
--       comentario en pasado (app/actions/pensiones.ts:95).
--
--   CUÁNTOS NÚMEROS HAY EN JUEGO — se cuenta con la consulta C.6 del final,
--   antes de decidir nada. La migración NO lo da por sabido: el número de filas
--   con valor solo lo ve quien pueda leer la columna, y desde aquí no se puede.
--
--   RECOMENDACIÓN: **trasladar y después eliminar, pero como un acto aparte y
--   deliberado — no dentro de este archivo.**
--
--     El motivo de fondo es que aquí el riesgo de divergencia es **cero**,
--     precisamente porque la columna está congelada: nadie tiene `UPDATE` sobre
--     ella, así que no puede aparecer un segundo número distinto del de la tabla
--     nueva. Dos copias que no se pueden mover no divergen; son una copia
--     muerta. Eso quita la urgencia, pero no quita la deuda.
--
--     Y las tres razones por las que la eliminación no va en este archivo:
--       1. `drop column` **pierde el dato**. Un archivo de seguridad no debe
--          destruir información como efecto secundario de aplicarse.
--       2. Este archivo tiene que poder aplicarse **sin saber** cuántos números
--          hay. Una sentencia cuyo resultado depende de un recuento que no se ha
--          hecho todavía no es una migración, es una apuesta.
--       3. Si el traslado y el borrado van juntos y el traslado se equivoca, el
--          error es irreversible en el mismo acto.
--
--   POR ESO EL TRASLADO SE ENTREGA ESCRITO Y COMENTADO, para que se ejecute
--   después de mirar C.6 y de comprobar que los valores pasan el formato nuevo:
--
--     -- Paso 1 (solo lectura): ¿cuántos hay y cuántos NO cumplirían el formato
--     -- nuevo de la sección 2? El segundo número es el que importa: un fijo o
--     -- un valor basura se quedaría por el camino sin que nadie lo note.
--     select count(whatsapp)                                                 as con_numero,
--            count(whatsapp) filter (
--              where whatsapp !~ '^(3[0-9]{9}|60[0-9]{8})$'
--            )                                                              as no_pasan_el_formato_nuevo
--       from public.pensiones;
--
--     -- Paso 2 (ESCRIBE): trasladar solo lo que cumple, sin pisar un número
--     -- que el anfitrión ya haya dejado en la tabla nueva. `do nothing` es
--     -- deliberado: el dato más reciente (el que él acaba de escribir) manda.
--     insert into public.contacto_anfitrion (anfitrion_id, whatsapp)
--     select p.anfitrion_id, p.whatsapp
--       from public.pensiones as p
--      where p.whatsapp ~ '^(3[0-9]{9}|60[0-9]{8})$'
--     on conflict (anfitrion_id) do nothing;
--
--     -- Paso 3 (solo lectura): ninguna fila de la tabla nueva debe quedar sin
--     -- correspondencia en `pensiones`, y ningún anfitrión con número debe
--     -- quedarse fuera. Los dos números tienen que dar 0.
--     select count(*) as anfitriones_sin_numero_trasladado
--       from public.pensiones as p
--      where p.whatsapp ~ '^(3[0-9]{9}|60[0-9]{8})$'
--        and not exists (
--          select 1 from public.contacto_anfitrion c where c.anfitrion_id = p.anfitrion_id
--        );
--
--     -- Paso 4 (ESCRIBE y es irreversible): eliminar la columna y su restricción.
--     -- Solo después de que el paso 3 dé 0.
--     alter table public.pensiones drop constraint if exists pensiones_whatsapp_formato;
--     alter table public.pensiones drop column if exists whatsapp;
--     -- Al borrarla hay que reemitir la lista de columnas de `select` y `update`
--     -- de `pensiones`: la de `oleada-13:211-233` (19 de select) y la de
--     -- `oleada-10:151-163` (9 de update). `whatsapp` NO estaba en ninguna de
--     -- las dos, así que las listas quedan válidas tal cual — pero conviene
--     -- volver a ejecutarlas y comprobarlas, porque una lista de columnas que
--     -- nombra una columna que ya no existe falla en silencio hasta que alguien
--     -- hace un `grant` con ella.
--
--   SI SE PREFIERE NO ELIMINAR NUNCA, la alternativa es buena y no exige nada:
--   dejarla revocada y congelada como está, y que `contacto_anfitrion` sea la
--   única fuente viva. Lo que **no** se debe hacer es reabrirla, y desde
--   `oleada-10` no se puede sin un `grant` explícito.
-- ============================================================================


-- ============================================================================
-- 6) EL ORDEN ENTRE APLICAR Y DESPLEGAR — decidido y con su consecuencia
--
--   **La migración va PRIMERO. Siempre.** Y no es una preferencia de estilo: es
--   la misma restricción que ya está medida con `oleada-13`.
--
--   POR QUÉ EN ESE ORDEN
--     La capa de datos pide las columnas por su nombre. Contra una base a la que
--     le falte la tabla, la consulta **no devuelve vacío: falla** (PostgREST
--     responde 404 `PGRST205`, «Could not find the table»). Es decir: desplegar
--     antes de aplicar no da «aún no hay números», da un error.
--
--   QUÉ PASA SI SE HACE AL REVÉS — y aquí está la parte que no se deja implícita
--     Al revés **no se cae nada**, porque están puestas dos defensas:
--       1. `lib/contacto-anfitrion.ts` reconoce el caso «la tabla no existe»
--          (`PGRST205` / `42P01`) y lo devuelve como el estado `sin-tabla`, que
--          **no es un error**: el panel del maestro simplemente no dibuja el
--          botón «Escribir al anfitrión» y el formulario no pide el campo. Un
--          despliegue temprano degrada, no rompe.
--       2. La página pública no lee esta tabla en ningún caso, así que el
--          catálogo no depende de este orden en absoluto.
--
--     Lo que sí hay que saber: la degradación es silenciosa por diseño. Si el
--     botón no aparece, la causa probable es que la migración no se ha aplicado
--     — no que el anfitrión no tenga número. Por eso el lector devuelve el
--     MOTIVO y no solo un valor vacío, y por eso `verificar:contacto-privado`
--     distingue «sin aplicar» de «cerrado» en vez de decir «bien» en los dos
--     casos.
--
--   LA ÚNICA COSA QUE NO SE PUEDE HACER
--     Desplegar el código y aplicar la migración después **sin** el lector
--     tolerante. Con la tolerancia puesta, cualquier orden funciona; sin ella,
--     el único orden seguro es migración → despliegue.
-- ============================================================================


-- ============================================================================
-- 7) COMPROBACIONES · ejecutar después y comparar con lo esperado
--    Ninguna de estas sentencias escribe. La única que escribiría va comentada.
-- ============================================================================

-- C.1 · La tabla existe, con RLS activo, y tiene exactamente 4 políticas.
--       -> esperado: 1 fila · `rls_activo` = t · `politicas` = 4
select c.relname,
       c.relrowsecurity as rls_activo,
       (select count(*) from pg_catalog.pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as politicas
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'contacto_anfitrion';

-- C.2 · LAS DOS COLUMNAS, con su tipo y su nulabilidad.
--       -> esperado: anfitrion_id | uuid | NO   y   whatsapp | text | NO
--          (uuid = solo la clave primaria; sin `default`, porque el id viene de
--           la sesión, no de la base)
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'contacto_anfitrion'
 order by ordinal_position;

-- C.3 · LA COMPROBACIÓN QUE DECIDE SI EL DATO ES PRIVADO.
--       `anon` no puede tocar la tabla por NINGUNA de las cuatro vías.
--       -> esperado: f | f | f | f   (los cuatro en falso)
select has_table_privilege('anon','public.contacto_anfitrion','SELECT') as anon_select,   -- f
       has_table_privilege('anon','public.contacto_anfitrion','INSERT') as anon_insert,   -- f
       has_table_privilege('anon','public.contacto_anfitrion','UPDATE') as anon_update,   -- f
       has_table_privilege('anon','public.contacto_anfitrion','DELETE') as anon_delete;   -- f
-- Si alguno saliera `t`, la causa es una concesión heredada de `PUBLIC` o los
-- privilegios por defecto de Supabase sobre el esquema `public`. Se cierra con:
--   revoke all on table public.contacto_anfitrion from public;
--   revoke all on table public.contacto_anfitrion from anon;
-- y se vuelve a medir. NO se deja así «porque el guion lo dirá».

-- C.4 · El rol con sesión SÍ llega (la RLS decide qué filas), y por tabla, no
--       por columna: aquí no hay lista de columnas que mantener.
--       -> esperado: t | t | t | t
select has_table_privilege('authenticated','public.contacto_anfitrion','SELECT') as aut_select, -- t
       has_table_privilege('authenticated','public.contacto_anfitrion','INSERT') as aut_insert, -- t
       has_table_privilege('authenticated','public.contacto_anfitrion','UPDATE') as aut_update, -- t
       has_table_privilege('authenticated','public.contacto_anfitrion','DELETE') as aut_delete; -- t

-- C.5 · Las cuatro políticas, con su operación y sus roles.
--       -> esperado: 4 filas · cmd = SELECT, INSERT, UPDATE, DELETE ·
--          roles = {authenticated}
select policyname, cmd, roles, qual, with_check
  from pg_catalog.pg_policies
 where schemaname = 'public' and tablename = 'contacto_anfitrion'
 order by cmd;

-- C.6 · CUÁNTOS NÚMEROS HAY EN JUEGO EN LA COLUMNA VIEJA. Es la medición que
--       exige la sección 5 antes de decidir nada sobre `pensiones.whatsapp`.
--       -> esperado: `con_numero` puede ser 0 o más; `no_pasan_el_formato_nuevo`
--          dice cuántos se perderían si se borrara la columna sin revisarlos.
select count(whatsapp) as con_numero,
       count(whatsapp) filter (where whatsapp !~ '^(3[0-9]{9}|60[0-9]{8})$')
         as no_pasan_el_formato_nuevo
  from public.pensiones;

-- C.7 · La restricción de formato, con su definición real.
--       -> esperado: 1 fila con
--          CHECK ((whatsapp ~ '^(3[0-9]{9}|60[0-9]{8})$'::text))
select conname, pg_get_constraintdef(oid) as definicion
  from pg_catalog.pg_constraint
 where conrelid = 'public.contacto_anfitrion'::regclass
   and conname = 'contacto_anfitrion_whatsapp_formato';

-- C.8 · El disparador está montado y la clave primaria es la esperada.
--       -> esperado: `antes_de_tocar_contacto` · `contacto_anfitrion_pkey`
select tgname from pg_catalog.pg_trigger
 where tgrelid = 'public.contacto_anfitrion'::regclass and not tgisinternal;
select conname, contype from pg_catalog.pg_constraint
 where conrelid = 'public.contacto_anfitrion'::regclass and contype in ('p','f');

-- C.9 · La tabla está vacía recién aplicada. Si tiene filas, alguien escribió
--       antes de que el formulario existiera y hay que mirar de dónde salieron.
--       -> esperado: 0
select count(*) as filas from public.contacto_anfitrion;

-- C.10 · PRUEBA FUNCIONAL de la RLS. NO se ejecuta sola: va en una transacción
--        que se revierte, y sustituye el uuid por el de una cuenta real.
--        Mide las tres cosas que importan: que el dueño se ve a sí mismo, que
--        un anfitrión NO ve a otro, y que la tabla no es legible sin sesión.
--
--   -- (a) Sin sesión: `anon` no tiene privilegio, así que esto falla con 42501
--   --     ANTES de evaluar ninguna política. Es la comprobación central.
--   --   begin;
--   --     set local role anon;
--   --     select * from public.contacto_anfitrion;               -- esperado: ERROR 42501
--   --   rollback;
--   --   (`set local` solo vale dentro de una transacción; sin el `begin` esto no
--   --    mide nada, da un error de sintaxis y se confundiría con el fallo real.)
--   --
--   -- (b) Con la sesión del anfitrión A: solo su fila.
--   --   begin;
--   --     set local role authenticated;
--   --     set local request.jwt.claims = '{"sub":"<uuid-del-anfitrion-A>"}';
--   --     select anfitrion_id, whatsapp from public.contacto_anfitrion;
--   --     -- esperado: la fila de A, y ninguna otra
--   --     -- y no debe poder escribir la de B:
--   --     insert into public.contacto_anfitrion (anfitrion_id, whatsapp)
--   --     values ('<uuid-del-anfitrion-B>', '3000000000');        -- esperado: ERROR 42501 / 0 filas
--   --   rollback;
--   --
--   -- (c) Con la sesión del maestro: todas las filas.
--   --   begin;
--   --     set local role authenticated;
--   --     set local request.jwt.claims = '{"sub":"<uuid-de-la-cuenta-maestra>"}';
--   --     select count(*) from public.contacto_anfitrion;         -- esperado: todas
--   --   rollback;
--   --
--   -- Si (a) devolviera filas en vez de fallar, la tabla NO es privada y el
--   -- resto del archivo no ha servido de nada: se revisa C.3.


-- ============================================================================
-- 8) REVERSIÓN (deja el esquema como estaba; no toca ninguna otra tabla)
--
--   drop trigger if exists antes_de_tocar_contacto on public.contacto_anfitrion;
--   drop function if exists public.sellar_contacto_anfitrion();
--   drop table if exists public.contacto_anfitrion;
--
--   `drop table` borra los números guardados: es reversible en el sentido de que
--   el esquema vuelve, pero el dato no vuelve. Si solo se quiere desactivar la
--   función, basta con `revoke all on table public.contacto_anfitrion from
--   authenticated`, que deja la tabla viva pero muda para todo el mundo menos el
--   rol de servicio.
--
--   Esta reversión NO toca `pensiones.whatsapp`: este archivo tampoco lo hace.
-- ============================================================================
