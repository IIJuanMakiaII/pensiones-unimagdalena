-- ============================================================================
-- Oleada 13 — La fecha de verificación de un anuncio, como dato real
--
--   Idempotente. Aditiva: no borra ni reescribe ningún dato de negocio.
--
--   ⚠️ NO ESTÁ APLICADA. La aplica el fundador en el editor SQL del panel:
--      https://supabase.com/dashboard/project/ayznnqkacpdvvufclhon/sql
--
--   ⚠️ ORDEN DE DESPLIEGUE — aplicar la migración ANTES de desplegar el código.
--      Es la única dirección segura, y la razón está medida en el propio
--      repositorio: `lib/supabase/mapeo.ts` pide las columnas por su nombre, así
--      que una columna que falte **no llega vacía: hace fallar la consulta**. Si
--      el código se desplegara primero, `lib/datos.ts` recibiría un error y
--      devolvería `catalogoSinBase("error")` — el catálogo en estado de error
--      hasta que se aplicara esto. Al revés no hay problema: añadir una columna
--      y conceder su lectura es compatible con el código que ya está en
--      producción, que simplemente no la pide.
--
-- QUÉ RESUELVE
--   El sello «Verificado por Nido» afirma una verificación sin decir cuándo. La
--   auditoría externa lo marcó como promesa sin evidencia (sección 1, moderado):
--   en Colombia una afirmación de «verificado» tiene implicaciones de protección
--   al consumidor, así que tiene que ser demostrable. Hoy no existe el dato:
--   `verificado` es un booleano y no hay ninguna columna de fecha. Se buscaron
--   `verificado_en`, `verificacion_en`, `verificado_el`, `ultima_verificacion` y
--   `fecha_verificacion` en todo el repositorio: cero coincidencias.
--
-- LA DECISIÓN DE FONDO: LA FECHA LA SELLA LA BASE, NO LA INTERFAZ
--   `verificado_en` es un valor DERIVADO, igual que `precio_mensual` desde la
--   oleada 2: lo escribe un disparador, y lo que envíe el llamante se ignora.
--   Tres consecuencias, y las tres son el motivo:
--     1. Ninguna pantalla puede inventar una fecha. Ni la del anfitrión, ni la
--        del panel del maestro.
--     2. Se sella cuando la verificación OCURRE —en la transición
--        `verificado` de falso a verdadero—, no cuando se lee.
--     3. No hay valor por defecto ni «hoy» de relleno. Un anuncio sin constancia
--        se queda SIN fecha, y la interfaz tendrá que decir «verificado» a secas.
--        Antes un sello sin fecha que una fecha falsa.
--
-- QUIÉN PUEDE CAMBIARLO: NADIE POR LA API
--   · El anfitrión no: `authenticated` no tiene UPDATE sobre `verificado_en`
--     (la sección 3 lo reafirma en vez de darlo por heredado).
--   · El maestro tampoco, y esto ya estaba cerrado en la base: la lista blanca de
--     `maestro_actualizar_campos_pension` (supabase/oleada-9.sql:206) admite solo
--     `calificacion`, `verificado`, `latitud` y `longitud`, y rechaza cualquier
--     otra clave con `22023`. Es decir: el maestro enciende el sello y la fecha la
--     pone la base; no puede teclear una fecha.
--   Por eso esta migración NO toca esa función. Cero cambios en código
--   privilegiado es cero superficie nueva.
--
--   Si algún día hiciera falta declarar una fecha de inspección DISTINTA de la de
--   registro —una visita del 5 anotada el 8—, el cambio es permitir esa clave en
--   la lista blanca y validarla. Es una decisión de producto, no de integridad, y
--   queda anotada al final, sin tomar.
--
-- LO QUE ESTA MIGRACIÓN NO HACE
--   · No rellena ninguna fecha hacia atrás. Ver la sección 5.
--   · No toca `whatsapp`, `autorizacion_contacto_en` ni ningún otro permiso.
--   · No crea índices: la columna se lee por fila en la tarjeta y la ficha, y
--     nadie filtra ni ordena por ella. Un índice aquí solo costaría escrituras.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) La columna
--
--    Anulable y SIN `default`. Las dos cosas son deliberadas:
--      · Sin `default now()`: un valor por defecto sería una fecha inventada en
--        cada fila que se cree, incluidas las que nunca se inspeccionen.
--      · Anulable: `null` es un estado con significado —«verificado, pero no hay
--        constancia de cuándo»— y es el estado honesto de los anuncios que ya
--        estaban verificados antes de que esta columna existiera.
--
--    `timestamptz` y no `date`: se guarda un instante, no un día, para que quede
--    claro el orden entre dos verificaciones del mismo día. Se muestra como fecha
--    en la interfaz, que es donde esa precisión se descarta a propósito.
-- ---------------------------------------------------------------------------
alter table public.pensiones
  add column if not exists verificado_en timestamptz;

comment on column public.pensiones.verificado_en is
  'Instante en que la plataforma registro la verificacion. Lo escribe el disparador sellar_fecha_verificacion, nunca el llamante. NULL = verificado sin constancia de cuando; no rellenar con una fecha inventada.';


-- ---------------------------------------------------------------------------
-- 2) El sello: el disparador que deriva la fecha
--
--    BEFORE INSERT OR UPDATE, para cubrir las dos puertas por las que `verificado`
--    puede pasar a verdadero: el alta y la edición del maestro.
--
--    No es SECURITY DEFINER, y a diferencia de `imponer_precio_pension` no lo
--    necesita: este cuerpo no lee ninguna tabla, solo asigna campos de la fila
--    que está entrando. Menos privilegio, no más.
--
--    El cuerpo no toca `old` en un INSERT a propósito: en un disparador de alta
--    el registro `old` no está asignado, y leerlo da error en tiempo de
--    ejecución. Por eso la rama de alta sale antes.
--
--    Convive con los otros dos disparadores BEFORE de `pensiones`
--    (`antes_de_asignar_slug`, de la oleada 5, y `antes_de_escribir_pension`, de
--    la oleada 2). PostgreSQL los ejecuta en orden alfabético, pero el orden es
--    indiferente aquí: cada uno escribe columnas distintas —`slug`,
--    `precio_mensual` y `verificado_en`— y ninguno lee lo que escribe otro.
-- ---------------------------------------------------------------------------
create or replace function public.sellar_fecha_verificacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sin sello no hay fecha: si se retira la verificación, la fecha se borra.
  -- Dejar la fecha de una verificación retirada sería peor que no tener fecha.
  if new.verificado is not true then
    new.verificado_en := null;
    return new;
  end if;

  -- Alta: se verifica ahora (nadie puede insertar una fecha a mano; lo que venga
  -- en la fila se ignora).
  if tg_op = 'INSERT' then
    new.verificado_en := now();
    return new;
  end if;

  -- Edición: si ya estaba verificado, se CONSERVA la fecha original —verificar
  -- dos veces no re-fecha una inspección que ocurrió antes—. Si no lo estaba,
  -- este es el instante de la verificación y se sella ahora.
  --
  -- Nota para el caso heredado: si una fila ya verificada y sin fecha se edita,
  -- `old.verificado_en` es NULL y se conserva NULL. Es lo correcto: no hay
  -- constancia, y no se inventa.
  if coalesce(old.verificado, false) then
    new.verificado_en := old.verificado_en;
  else
    new.verificado_en := now();
  end if;

  return new;
end;
$$;

drop trigger if exists antes_de_sellar_verificacion on public.pensiones;
create trigger antes_de_sellar_verificacion
  before insert or update on public.pensiones
  for each row execute function public.sellar_fecha_verificacion();

-- Cinturón y tirantes, en la misma línea que las otras funciones de disparador
-- del proyecto: una función que devuelve `trigger` no se puede invocar por RPC
-- (PostgreSQL lo rechaza), así que esto no cierra nada real. Se deja para que
-- todas las funciones de disparador queden igual de declaradas.
revoke execute on function public.sellar_fecha_verificacion() from public;
revoke execute on function public.sellar_fecha_verificacion() from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3) La coherencia, y la escritura cerrada
--
--    La restricción impide el único estado incoherente que puede producirse:
--    una fecha de verificación en un anuncio que no está verificado.
--
--    NO exige lo contrario (`verificado` implica fecha) a propósito. Exigirlo
--    rompería con los anuncios que ya estaban verificados antes de esta columna:
--    habría que inventarles una fecha para que pasara la validación, que es justo
--    lo que no se va a hacer. El estado «verificado sin fecha» es legítimo y
--    visible.
--
--    Sobre el coste: añadir una CHECK valida las filas existentes y toma un
--    bloqueo breve. Hoy hay 1 fila y la columna acaba de nacer con todo en NULL,
--    así que no puede fallar.
-- ---------------------------------------------------------------------------
alter table public.pensiones
  drop constraint if exists pensiones_verificado_fecha_coherente;
alter table public.pensiones
  add constraint pensiones_verificado_fecha_coherente
  check (verificado or verificado_en is null);

-- La escritura de la columna NO se concede a nadie, y se reafirma aquí en vez de
-- darlo por heredado: la lista de la oleada 10 no la incluye, así que ya está
-- fuera, pero una migración no debe depender de que otra esté en el orden
-- esperado. Se reemite exactamente la lista vigente (oleada-10:151-163).
revoke update on public.pensiones from anon, authenticated;
grant update (
  activa,
  titulo,
  descripcion,
  direccion,
  barrio,
  distancia_a_pie_minutos,
  servicios,
  normas,
  imagenes
) on public.pensiones to authenticated;


-- ---------------------------------------------------------------------------
-- 4) La lectura: hay que concederla, o el catálogo se rompe
--
--    `pensiones` NO tiene `select` a nivel de tabla: se revocó y se volvió a
--    conceder por columna (oleada-10:110-131, dieciocho columnas). Por tanto una
--    columna nueva **nace sin privilegio de lectura**, y el aviso está escrito en
--    esa misma migración: «una columna que falte aquí no llega vacía, hace fallar
--    la consulta con 42501».
--
--    `verificado_en` es un dato público —la fecha de una verificación que ya se
--    anuncia en la ficha—, así que se concede la lectura a `anon` y a
--    `authenticated`, igual que `verificado`. Lo que NO se concede es la
--    escritura, que es lo que acaba de afirmar la sección 3.
--
--    La lista es la de la oleada 10 más la columna nueva, en el mismo orden.
-- ---------------------------------------------------------------------------
revoke select on public.pensiones from anon, authenticated;

grant select (
  id,
  slug,
  anfitrion_id,
  titulo,
  descripcion,
  precio_mensual,
  direccion,
  barrio,
  distancia_a_pie_minutos,
  servicios,
  normas,
  calificacion,
  verificado,
  verificado_en,
  imagenes,
  activa,
  creada_en,
  latitud,
  longitud
) on public.pensiones to anon, authenticated;

-- Fuera de la lista siguen estando, a propósito: `whatsapp` (el teléfono del
-- propietario) y `autorizacion_contacto_en` (la fecha en que autorizó).


-- ---------------------------------------------------------------------------
-- 5) Qué queda sin fecha, y con qué criterio
--
--    MEDIDO el 2026-10-09 contra la base real, con la clave anónima:
--      · `pensiones` devuelve 1 fila: «Residencia 101 (Pension de Prueba)»,
--        slug `residencia-makia`, y su `verificado` es **false**.
--    Es decir: hoy hay CERO anuncios verificados, así que al aplicar esta
--    migración el relleno hacia atrás no tiene ni una fila que tocar. El conteo
--    de la primera consulta de la sección 6 lo confirma sobre la base real.
--
--    Y para cualquier base donde sí hubiera anuncios ya verificados, el criterio
--    es el mismo y no se negocia: **quedan con `verificado_en = NULL`**. No hay
--    constancia de cuándo se inspeccionaron —esa fecha no se guardó nunca— y no
--    se va a deducir de `creada_en` ni a rellenar con la fecha de la migración.
--    Una fecha inventada en un sello de verificación es peor que la ausencia de
--    fecha: convierte una promesa verificable en una afirmación falsa.
--
--    Consecuencia para la interfaz, que dibuja el UX/UI Senior: con `null` la
--    etiqueta debe decir «Verificado por Nido ✓» sin fecha. No un «—», no un
--    «fecha desconocida».
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 6) Verificación posterior — ninguna de estas consultas escribe nada
-- ---------------------------------------------------------------------------

-- D.1 La columna existe, es anulable y NO tiene valor por defecto.
--     -> esperado: 1 fila · tipo `timestamp with time zone` · is_nullable YES ·
--        column_default NULL
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'pensiones'
  and column_name = 'verificado_en';

-- D.2 ¿Cuántos anuncios quedan sin fecha? Es la constancia del relleno vacío.
--     -> esperado tras aplicar: `sin_fecha` = número de anuncios verificados, y
--        si hoy no hay ninguno, 0 y 0.
select count(*) filter (where verificado)                as verificados,
       count(*) filter (where verificado_en is not null) as con_fecha,
       count(*) filter (where verificado
                          and verificado_en is null)     as verificados_sin_fecha
from public.pensiones;
-- Un `verificados_sin_fecha` mayor que cero es lo esperado y NO es un defecto:
-- son los anuncios verificados antes de que esta columna existiera. Lo que sí
-- sería un defecto es `con_fecha > verificados` (una fecha en algo no verificado),
-- que la restricción de la sección 3 impide.

-- D.3 El disparador y su función están montados.
--     -> esperado: `antes_de_sellar_verificacion` en la lista, junto a
--        `antes_de_asignar_slug` y `antes_de_escribir_pension`
select tgname
from pg_trigger
where tgrelid = 'public.pensiones'::regclass
  and not tgisinternal
order by tgname;

-- D.4 La restricción de coherencia existe.
--     -> esperado: 1 fila con `CHECK ((verificado OR (verificado_en IS NULL)))`
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'public.pensiones'::regclass
  and conname = 'pensiones_verificado_fecha_coherente';

-- D.5 NADA puede escribir la fecha. Es la comprobación que decide si el dato es
--     fiable: si alguno de estos saliera `true`, la fecha sería falsificable.
--     -> esperado: f | f | f  (el maestro NO tiene privilegio de columna; su
--        puerta es la lista blanca de la función, comprobada en D.6)
select has_column_privilege('anon','public.pensiones','verificado_en','UPDATE')          as anon_update,          -- f
       has_column_privilege('authenticated','public.pensiones','verificado_en','UPDATE') as authenticated_update, -- f
       has_table_privilege('authenticated','public.pensiones','UPDATE')                  as update_de_tabla;      -- f

-- D.6 La lectura sí está concedida, o el catálogo fallaría con 42501.
--     -> esperado: t | t
select has_column_privilege('anon','public.pensiones','verificado_en','SELECT')          as anon_select,          -- t
       has_column_privilege('authenticated','public.pensiones','verificado_en','SELECT') as authenticated_select; -- t

-- D.7 La lista blanca del maestro sigue sin admitir la fecha (por eso la
--     migración no toca esa función).
--     -> esperado: 1 fila, y la definición contiene solo
--        'calificacion', 'verificado', 'latitud', 'longitud'
select pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'maestro_actualizar_campos_pension';

-- D.8 Prueba funcional del sello. ESTA SÍ ESCRIBE, pero sobre una publicación
--     temporal que se borra al final, y nunca sobre un anuncio real.
--     Sustituye el correo por el de la cuenta maestra antes de ejecutarla.
--
-- begin;
--   -- Sesión del maestro (o ejecútala desde el propio editor, que ya es dueño).
--   select public.maestro_actualizar_campos_pension(
--     (select id from public.pensiones where slug = 'residencia-makia'),
--     jsonb_build_object('verificado', true)
--   );
--   -- esperado: verificado = t  y  verificado_en = el instante de ahora
--   select verificado, verificado_en from public.pensiones where slug = 'residencia-makia';
--
--   -- Lo que el llamante envíe para la fecha se ignora (la clave ni siquiera
--   -- está en la lista blanca, así que esto debe fallar con 22023 y no escribir):
--   --   select public.maestro_actualizar_campos_pension(
--   --     (select id from public.pensiones where slug = 'residencia-makia'),
--   --     jsonb_build_object('verificado_en', '2020-01-01T00:00:00Z'));
--
--   -- Retirar el sello debe BORRAR la fecha:
--   select public.maestro_actualizar_campos_pension(
--     (select id from public.pensiones where slug = 'residencia-makia'),
--     jsonb_build_object('verificado', false)
--   );
--   -- esperado: verificado = f  y  verificado_en = NULL
--   select verificado, verificado_en from public.pensiones where slug = 'residencia-makia';
-- rollback;
--
-- Con `rollback` al final no queda rastro: la fila real vuelve a su estado
-- anterior (verificado = false), que es el que tiene hoy.


-- ---------------------------------------------------------------------------
-- 7) Reversión
--
--   drop trigger if exists antes_de_sellar_verificacion on public.pensiones;
--   drop function if exists public.sellar_fecha_verificacion();
--   alter table public.pensiones drop constraint if exists pensiones_verificado_fecha_coherente;
--   alter table public.pensiones drop column if exists verificado_en;
--   -- y volver a emitir la lista de dieciocho columnas de oleada-10:110-131
--
--   `drop column` NO es inocuo: se pierden las fechas. Es reversible en el
--   sentido de que el esquema vuelve, pero el dato no vuelve.
--
-- DECISIÓN ABIERTA que esta migración deja escrita y no toma: si el sello debe
-- poder declarar la fecha de la INSPECCIÓN cuando difiere de la de registro
-- (visita el 5, anotada el 8), el cambio es añadir `verificado_en` a la lista
-- blanca de `maestro_actualizar_campos_pension` y validar su formato. Hoy no se
-- permite a propósito: la fecha es derivada y no falsificable.
-- ============================================================================
