-- ============================================================================
-- Oleada 16 — El código visible de una pensión (NID-0001), como dato real
--
--   Idempotente. Aditiva: no borra ni reescribe ningún dato de negocio.
--
--   ⚠️ NO ESTÁ APLICADA. La aplica el fundador en el editor SQL del panel:
--      https://supabase.com/dashboard/project/ayznnqkacpdvvufclhon/sql
--
--   ⚠️ ORDEN DE DESPLIEGUE — aplicar la migración ANTES de fusionar y desplegar
--      el código que lee este campo. Es la única dirección segura, y la razón
--      está MEDIDA en este repositorio, no supuesta
--      (docs/aplicar-migraciones-pendientes.md:37-46): `lib/supabase/mapeo.ts`
--      pide las columnas por su nombre, así que una columna que falte **no llega
--      vacía: hace fallar la consulta** (`HTTP 400`, `code 42703`). `lib/datos.ts`
--      recibe ese error y devuelve `catalogoSinBase("error")` → lista vacía
--      (lib/catalogo-respaldo.ts:92-97), o sea portada sin un solo enlace a
--      fichas. Es exactamente lo que ocurrió con `verificado_en` mientras
--      `oleada-13` estaba sin aplicar. Al revés no hay problema: añadir una
--      columna y conceder su lectura es compatible con el código que hoy está en
--      producción, que simplemente no la pide.
--
--   Por eso la verificación de la sección 7 no es un adorno: **hasta que E.6
--   devuelva `t`, no se fusiona ni se despliega nada que lea este campo.**
--
-- QUÉ RESUELVE
--   Con un solo anuncio, la lista del panel maestro se recorre a ojo. Con cien,
--   no: hace falta un identificador corto, único y **dictable por teléfono**
--   para nombrar un anuncio sin ambigüedad («el NID-0004») y para buscarlo en el
--   panel. Hoy no existe ningún identificador así: `pensiones.id` es un `uuid`
--   (ilegible y no dictable) y `slug` es la dirección pública del anuncio, que
--   puede cambiar si el anfitrión lo renombra.
--
-- LA DECISIÓN DE FONDO: LO GENERA LA BASE, NO LA INTERFAZ
--   `codigo_visible` es un valor DERIVADO, igual que `precio_mensual` (oleada 2)
--   y `verificado_en` (oleada 13): lo escribe la base, y lo que envíe el llamante
--   se ignora. Tres consecuencias, y las tres son el motivo:
--     1. Ninguna pantalla puede inventar un código ni «elegirlo bonito». El
--        formulario no lo pide y no lo envía.
--     2. Se asigna cuando el anuncio NACE, no cuando se lista. Un anuncio tiene
--        el mismo código en el panel, en la ficha y en cualquier consulta futura.
--     3. **Un código no se reasigna nunca.** El relleno de la sección 2 mira solo
--        las filas que todavía no tienen código y respeta las que ya lo tienen
--        (sección 5). Por eso el relleno es por orden de creación (`creada_en`,
--        con `id` como desempate para que el orden sea total): el anuncio más
--        antiguo es el `NID-0001`, y ese reparto no cambia si mañana se aplica
--        otra vez, ni si se retira un anuncio, ni si se renombra el slug.
--
--   Formato: `NID-` + el número con ceros a la izquierda hasta 4 dígitos
--   (`NID-0001`), en mayúsculas. A partir del anuncio 10000 el número crece a
--   cinco dígitos (`NID-10000`) en lugar de desbordar: la restricción de formato
--   de la sección 4 admite las dos formas a propósito, porque el requisito es que
--   el código sea corto y dictable, no que tenga siempre cuatro dígitos.
--
-- QUIÉN PUEDE CAMBIARLO: NADIE POR LA API
--   · El anfitrión no: `authenticated` no tiene UPDATE sobre `codigo_visible`
--     (la sección 6 lo reafirma en vez de darlo por heredado, y E.5 lo mide).
--   · El maestro tampoco: la lista blanca de `maestro_actualizar_campos_pension`
--     (supabase/oleada-9.sql:206) admite solo `calificacion`, `verificado`,
--     `latitud` y `longitud`, y rechaza cualquier otra clave con `22023`.
--   · Y quien insertara una fila con un código a mano NO se lo queda: el
--     disparador de la sección 5 **pisa** el valor que llegue en el alta y pone
--     el que toca. Esto no es teórico: la política `pensiones: crear las propias`
--     (supabase/esquema.sql:134) permite a un anfitrión insertar en la tabla, así
--     que el sello tiene que ser el disparador y no un privilegio. Se descartó
--     cerrar el `insert` por columna: el alta real pasa por
--     `crear_pension_con_habitaciones` (supabase/oleada-11-aplicar-seguridad-e-integridad.sql:301),
--     que es `security invoker` y escribe trece columnas, así que recortar el
--     privilegio de columnas de INSERT sería tocar una puerta que esta migración
--     no posee — y no haría falta: el disparador impone el valor igual.
--   Por eso esta migración NO toca `maestro_actualizar_campos_pension` ni
--   `crear_pension_con_habitaciones`. Cero cambios en código privilegiado es cero
--   superficie nueva.
--
-- ALTERNATIVA DESCARTADA: DEDUCIR EL CÓDIGO EN LA APLICACIÓN
--   Sería no tocar la base: numerar las filas al pintar la lista por `creada_en`.
--   Se descarta por una razón de una línea: **el número dejaría de ser único**.
--   El catálogo público filtra por `activa = true` (lib/datos.ts:117) y el panel
--   del maestro no (lib/datos.ts:461), así que la misma pensión saldría con dos
--   números distintos según la pantalla, y al retirar un anuncio los de los demás
--   se correrían. Un identificador que cambia no identifica nada.
--
-- LO QUE ESTA MIGRACIÓN NO HACE
--   · No toca `whatsapp` ni `autorizacion_contacto_en`, que siguen fuera de la
--     lista de lectura a propósito.
--   · No cambia ninguna política RLS ni ninguna función existente.
--   · No crea índices adicionales: el único que necesita —para buscar por código
--     en el panel— lo crea la restricción de unicidad de la sección 4.
--   · No decide si el código se muestra en la ficha pública. Eso lo fija la
--     especificación de interfaz (ficha #86) y no requiere migración: la lectura
--     de la columna se concede a `anon` en la sección 6, así que el día que se
--     decida mostrarla, el cambio es de interfaz y de proyección, no de base.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) La columna
--
--    Anulable y SIN `default`. Las dos cosas son deliberadas:
--      · Sin `default`: el valor no sale de una expresión de tabla, sale del
--        sello (sección 5) o del relleno (sección 2). Un `default` que calcule
--        un código sería un segundo camino para asignarlo, y dos caminos son dos
--        formas de que el mismo número acabe en dos anuncios.
--      · Anulable de momento: la columna nace vacía en las filas que ya existen
--        y se rellena tres líneas más abajo. Lo que NO se quedará anulable es el
--        contenido: la sección 4 impone `not null` cuando ya no queda ningún
--        hueco.
-- ---------------------------------------------------------------------------
alter table public.pensiones
  add column if not exists codigo_visible text;

comment on column public.pensiones.codigo_visible is
  'Codigo publico y dictable de una publicacion (NID-0001). Lo asigna la base: el disparador antes_de_asignar_codigo en el alta, o el relleno de oleada-16 por orden de creacion. Un codigo NO se reasigna nunca; el relleno solo toca las filas que aun no lo tienen.';


-- ---------------------------------------------------------------------------
-- 2) El relleno: un código por anuncio, por orden de creación
--
--    El requisito es que un código no cambie NUNCA después. De ahí las dos
--    reglas del relleno, y las dos están en el SQL:
--
--      · Solo se tocan las filas con `codigo_visible is null`. Volver a aplicar
--        esta migración no renumera nada: los anuncios que ya tienen código no
--        entran en el cálculo. Es lo que hace la migración idempotente **y** es
--        lo que protege al código de un anuncio ya publicado.
--      · El número sale de `row_number()` sobre `order by creada_en asc, id asc`.
--        `creada_en` es el orden de creación —lo que se pidió—, y el `id` solo
--        entra como desempate para que el orden sea TOTAL: si dos anuncios
--        comparten el mismo instante, sin desempate el reparto no estaría
--        determinado y dos ejecuciones podrían dar números distintos.
--
--    El desplazamiento `ultimo` existe para el caso de una aplicación a medias:
--    si algún anuncio ya tuviera código (por ejemplo, porque el relleno se
--    interrumpió o porque alguien aplicó primero el disparador), los que falten
--    se numeran DESPUÉS del mayor existente en lugar de chocar con él. En la
--    primera aplicación `ultimo` es 0 y el reparto es 1, 2, 3…  por creación.
--
--    No se usa `nextval` aquí a propósito: el orden en que PostgreSQL evaluaría
--    las llamadas dentro de un `update ... from` no está garantizado, y el
--    reparto tiene que ser el mismo siempre (lo contrario de un contador).
-- ---------------------------------------------------------------------------
with existentes as (
  select coalesce(
           max(nullif(regexp_replace(codigo_visible, '^NID-', ''), '')::integer),
           0
         ) as ultimo
  from public.pensiones
  where codigo_visible is not null
),
pendientes as (
  select p.id,
         row_number() over (order by p.creada_en asc, p.id asc) as posicion
  from public.pensiones p
  where p.codigo_visible is null
)
update public.pensiones p
set codigo_visible = 'NID-' || lpad((e.ultimo + d.posicion)::text, 4, '0')
from pendientes d
cross join existentes e
where p.id = d.id;


-- ---------------------------------------------------------------------------
-- 3) La secuencia: de dónde sale el código de los anuncios NUEVOS
--
--    El relleno numera lo que ya existe; de aquí en adelante numera esta
--    secuencia. Una secuencia y no un `max(...) + 1` en el disparador: con dos
--    anfitriones publicando a la vez, dos `max(...) + 1` simultáneos calculan el
--    mismo número y el segundo choca con la restricción de unicidad —es decir,
--    el error se lo come el anfitrión en el formulario—. Una secuencia reparte
--    números distintos sin bloquear y sin fallar.
--
--    Contrapartida honesta: `nextval` no es transaccional. Si una publicación
--    falla después de asignar el número, ese número se quema y queda un hueco en
--    la serie (`NID-0007` puede no existir nunca). Es el precio correcto: un
--    hueco no molesta a nadie, y **reutilizar un número sí**, porque dos anuncios
--    distintos habrían compartido código a lo largo del tiempo.
--
--    `setval(…, max + 1, false)` deja la secuencia apuntando al siguiente número
--    libre: `false` significa «este valor todavía no se ha entregado», así que el
--    próximo `nextval` devuelve exactamente `max + 1`. Se calcula sobre la tabla y
--    no sobre un literal para que volver a aplicar la migración sea inofensivo.
-- ---------------------------------------------------------------------------
create sequence if not exists public.pensiones_codigo_visible_seq as bigint start with 1;

alter sequence public.pensiones_codigo_visible_seq
  owned by public.pensiones.codigo_visible;

select setval(
         'public.pensiones_codigo_visible_seq',
         coalesce(max(nullif(regexp_replace(codigo_visible, '^NID-', ''), '')::integer), 0) + 1,
         false
       )
from public.pensiones;

-- El anfitrión que publica NO puede leer el contador: solo necesita poder pedir
-- el siguiente número. `usage` es exactamente eso; `select`/`update` sobre la
-- secuencia se retiran a propósito. Y `anon` no lo necesita: publicar exige
-- sesión (`crear_pension_con_habitaciones` la exige en su primera línea).
revoke all on sequence public.pensiones_codigo_visible_seq from public;
revoke all on sequence public.pensiones_codigo_visible_seq from anon;
grant usage on sequence public.pensiones_codigo_visible_seq to authenticated;


-- ---------------------------------------------------------------------------
-- 4) Las tres restricciones
--
--    `not null` va aquí, y no en la sección 1, porque una columna `not null` no
--    se puede añadir a una tabla con filas: primero el relleno, después la
--    exigencia. Con el relleno hecho y el disparador puesto, no existe ningún
--    camino que deje la columna vacía.
--
--    `unique` es la restricción que hace cierto lo que promete el formato: dos
--    anuncios no pueden compartir código. Además crea el índice que el buscador
--    del panel necesita para resolver una búsqueda por código sin recorrer la
--    tabla — es el único índice de esta migración, y viene de regalo con la
--    restricción.
--
--    El formato se cierra con un CHECK para que la base no pueda contener algo
--    que no sea un código dictable. `{4,}` y no `{4}`: a partir del anuncio 10000
--    el número crece, y una restricción de cuatro dígitos exactos empezaría a
--    rechazar altas legítimas sin que nadie entendiera por qué. También rechaza
--    las minúsculas: el formato se escribe en mayúsculas y así se dicta.
-- ---------------------------------------------------------------------------
alter table public.pensiones
  alter column codigo_visible set not null;

alter table public.pensiones
  drop constraint if exists pensiones_codigo_visible_unico;
alter table public.pensiones
  add constraint pensiones_codigo_visible_unico unique (codigo_visible);

alter table public.pensiones
  drop constraint if exists pensiones_codigo_visible_formato;
alter table public.pensiones
  add constraint pensiones_codigo_visible_formato
  check (codigo_visible ~ '^NID-[0-9]{4,}$');


-- ---------------------------------------------------------------------------
-- 5) El sello: el disparador que asigna el código en el alta
--
--    BEFORE INSERT, y solo INSERT. Nada más:
--      · En un UPDATE no hay nada que hacer: PostgreSQL conserva las columnas
--        que la sentencia no menciona, y la columna no está en el `grant update`
--        de la sección 6, así que ningún anfitrión puede escribirla. Un
--        disparador de UPDATE aquí solo añadiría una forma de que el código
--        cambiara, que es justo lo que hay que impedir.
--      · El cuerpo PISA el valor que llegue en la fila. No es una precaución
--        teórica: la política `pensiones: crear las propias` permite a un
--        anfitrión insertar en `pensiones`, así que un cliente podría intentar
--        mandar su propio código. Lo que mande se ignora.
--      · No es SECURITY DEFINER, y a diferencia de `imponer_precio_pension` no lo
--        necesita: el cuerpo no lee ninguna tabla, solo pide el siguiente número
--        a la secuencia. Menos privilegio, no más. El privilegio que sí hace
--        falta —`usage` sobre la secuencia— se concede explícitamente en la
--        sección 3 en vez de esconderlo dentro de una función privilegiada.
--
--    Convive con los otros tres disparadores BEFORE de `pensiones`
--    (`antes_de_asignar_slug`, de la oleada 5; `antes_de_escribir_pension`, de la
--    oleada 2; y `antes_de_sellar_verificacion`, de la oleada 13). PostgreSQL los
--    ejecuta en orden alfabético, y el orden es indiferente aquí: cada uno escribe
--    columnas distintas —`codigo_visible`, `slug`, `precio_mensual` y
--    `verificado_en`— y ninguno lee lo que escribe otro.
-- ---------------------------------------------------------------------------
create or replace function public.asignar_codigo_pension()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Un anuncio, un código. Si el llamante envió uno, se descarta sin discusión:
  -- el código es de la base y de nadie más.
  new.codigo_visible := 'NID-' || lpad(nextval('public.pensiones_codigo_visible_seq')::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists antes_de_asignar_codigo on public.pensiones;
create trigger antes_de_asignar_codigo
  before insert on public.pensiones
  for each row execute function public.asignar_codigo_pension();

-- Cinturón y tirantes, en la misma línea que las otras funciones de disparador
-- del proyecto: una función que devuelve `trigger` no se puede invocar por RPC
-- (PostgreSQL lo rechaza), así que esto no cierra nada real. Se deja para que
-- todas las funciones de disparador queden igual de declaradas.
revoke execute on function public.asignar_codigo_pension() from public;
revoke execute on function public.asignar_codigo_pension() from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 6) Los privilegios: la escritura cerrada y la lectura concedida
--
--    Aquí está la trampa que ya se cobró una tarde en este proyecto, y por eso
--    la lista se reemite ENTERA en vez de darla por heredada. `pensiones` NO
--    tiene `select` a nivel de tabla: se revocó y se volvió a conceder por
--    columna (oleada-10:110-131, dieciocho columnas; oleada-13:211-233, diecinueve).
--    Por tanto **una columna nueva nace sin privilegio de lectura**, y el aviso
--    está escrito en esa misma migración: «una columna que falte aquí no llega
--    vacía, hace fallar la consulta con 42501». Si `codigo_visible` no estuviera
--    en esta lista, el catálogo entero dejaría de cargar.
--
--    La lista es la de la oleada 13 —que es la de `lib/supabase/mapeo.ts`— más
--    `codigo_visible`, en el mismo orden.
--
--    La ESCRITURA no se concede a nadie, y también se reafirma aquí: se reemite
--    la lista vigente del editor de publicaciones (oleada-10:151-163) sin la
--    columna nueva. `codigo_visible` no está, no puede estar, y una migración no
--    debe depender de que otra esté en el orden esperado.
-- ---------------------------------------------------------------------------
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
  codigo_visible,
  imagenes,
  activa,
  creada_en,
  latitud,
  longitud
) on public.pensiones to anon, authenticated;

-- Fuera de la lista siguen estando, a propósito: `whatsapp` (el teléfono del
-- propietario) y `autorizacion_contacto_en` (la fecha en que autorizó).


-- ---------------------------------------------------------------------------
-- 7) Verificación posterior — ninguna de estas consultas escribe nada
--
--    **La migración no está terminada hasta que E.6 devuelva `t | t`.** Es la
--    comprobación que decide si el catálogo sigue en pie, y es la que hay que
--    mirar antes de fusionar y desplegar el código que lee el campo.
-- ---------------------------------------------------------------------------

-- E.1 La columna existe, ya NO es anulable y no tiene valor por defecto.
--     -> esperado: 1 fila · `text` · is_nullable NO · column_default NULL
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'pensiones'
  and column_name = 'codigo_visible';

-- E.2 El reparto está completo y no hay repetidos. Es la constancia del relleno.
--     -> esperado: `total` = `con_codigo` · `sin_codigo` = 0 · `codigos_distintos`
--        = total
select count(*)                                  as total,
       count(codigo_visible)                     as con_codigo,
       count(*) filter (where codigo_visible is null) as sin_codigo,
       count(distinct codigo_visible)            as codigos_distintos
from public.pensiones;

-- E.3 Quién tiene qué código. El más antiguo es el NID-0001.
--     -> esperado: los códigos en orden de creación, empezando por NID-0001
select codigo_visible, slug, creada_en, activa
from public.pensiones
order by creada_en asc, id asc;

-- E.4 Ningún código se sale del formato dictable.
--     -> esperado: 0
select count(*) as fuera_de_formato
from public.pensiones
where codigo_visible !~ '^NID-[0-9]{4,}$';

-- E.5 ¿Quién puede escribir el código? NADIE. Es la comprobación que decide si el
--     dato es fiable: si alguno de los tres primeros saliera `t`, el código sería
--     falsificable.
--     -> esperado: f | f | f | t   (el último es la secuencia: el anfitrión
--        necesita `usage` para que el alta funcione)
select has_column_privilege('anon','public.pensiones','codigo_visible','UPDATE')          as anon_update,           -- f
       has_column_privilege('authenticated','public.pensiones','codigo_visible','UPDATE') as authenticated_update,  -- f
       has_table_privilege('authenticated','public.pensiones','UPDATE')                   as update_de_tabla,       -- f
       has_sequence_privilege('authenticated','public.pensiones_codigo_visible_seq','USAGE') as secuencia_usage;    -- t

-- E.6 La LECTURA sí está concedida, o el catálogo fallaría con 42501.
--     -> esperado: t | t
select has_column_privilege('anon','public.pensiones','codigo_visible','SELECT')          as anon_select,          -- t
       has_column_privilege('authenticated','public.pensiones','codigo_visible','SELECT') as authenticated_select; -- t

-- E.7 El disparador, la secuencia y la lista blanca del maestro.
--     -> esperado: `antes_de_asignar_codigo` en la lista de disparadores; la
--        secuencia apuntando al siguiente número libre con is_called = f; y la
--        definición de `maestro_actualizar_campos_pension` con solo
--        'calificacion', 'verificado', 'latitud' y 'longitud' (por eso el maestro
--        no puede teclear un código)
select tgname
from pg_trigger
where tgrelid = 'public.pensiones'::regclass
  and not tgisinternal
order by tgname;

select last_value, is_called from public.pensiones_codigo_visible_seq;

select pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'maestro_actualizar_campos_pension';

-- E.8 Prueba funcional del sello. ESTA SÍ ESCRIBE, pero dentro de una transacción
--     que se deshace al final: no queda ni una fila. Se puede ejecutar desde el
--     propio editor, que ya es el dueño de la tabla.
--
-- begin;
--   -- 1. Un alta normal recibe el siguiente número de la serie.
--   insert into public.pensiones (anfitrion_id, titulo, precio_mensual, activa)
--   values ((select id from public.pensiones limit 1), 'Prueba de codigo', 0, false)
--   returning codigo_visible;   -- esperado: el correlativo siguiente, p. ej. NID-0002
--
--   -- 2. Lo que el llamante envíe para el código se IGNORA. Este es el aserto
--   --    que sostiene «no falsificable desde el cliente»:
--   insert into public.pensiones (anfitrion_id, titulo, precio_mensual, activa, codigo_visible)
--   values ((select id from public.pensiones limit 1), 'Prueba de falsificacion', 0, false, 'NID-9999')
--   returning codigo_visible;   -- esperado: el correlativo siguiente, NUNCA NID-9999
--
--   -- 3. La unicidad muerde: dos anuncios no pueden compartir código.
--   --    -> esperado: error 23505 sobre pensiones_codigo_visible_unico
--   insert into public.pensiones (anfitrion_id, titulo, precio_mensual, activa, codigo_visible)
--   values ((select id from public.pensiones limit 1), 'Prueba de duplicado', 0, false,
--           (select codigo_visible from public.pensiones order by creada_en asc limit 1));
-- rollback;
--
-- El `rollback` final importa: sin él quedarían dos anuncios de prueba en el
-- catálogo, y el estado sin inventario no es un caso de borde en este proyecto.


-- ---------------------------------------------------------------------------
-- 8) Reversión
--
--   drop trigger if exists antes_de_asignar_codigo on public.pensiones;
--   drop function if exists public.asignar_codigo_pension();
--   alter table public.pensiones drop constraint if exists pensiones_codigo_visible_formato;
--   alter table public.pensiones drop constraint if exists pensiones_codigo_visible_unico;
--   alter table public.pensiones drop column if exists codigo_visible;
--   -- `drop column` se lleva la secuencia por delante (`owned by`); si no,
--   --   drop sequence if exists public.pensiones_codigo_visible_seq;
--   -- y volver a emitir la lista de diecinueve columnas de oleada-13:211-233
--
--   `drop column` NO es inocuo: se pierden los códigos ya repartidos. Es
--   reversible en el sentido de que el esquema vuelve, pero el dato no vuelve, y
--   volver a aplicar la migración renumeraría los anuncios por creación —los
--   mismos números solo si nadie ha publicado entretanto—.
--
-- DECISIÓN ABIERTA que esta migración deja escrita y no toma: si el código se
-- muestra en la ficha pública. Hoy la lectura está concedida a `anon`, así que
-- mostrarlo es un cambio de interfaz y de proyección, sin migración nueva. Lo
-- fija la especificación de la ficha #86, no esta capa.
-- ============================================================================
