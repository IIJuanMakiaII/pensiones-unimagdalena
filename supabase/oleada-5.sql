-- ============================================================================
-- Oleada 5 — Dirección pública legible de cada anuncio (slug)
-- Ejecutar después de esquema.sql, storage-fotos.sql, oleada-1.sql, oleada-2.sql,
-- oleada-3.sql y oleada-4.sql. Es idempotente.
--
-- Qué resuelve (tarea #26 · hallazgo M-07 del informe maestro, el último 🔴)
--
--   Hasta hoy la semilla de demostración y la base de datos vivían en dos
--   espacios de identificadores incompatibles: la semilla usa identificadores
--   legibles (`pension-costa-verde`) y la base usa UUID
--   (`f555e5b3-6629-402a-ae37-32c366c3f022`). La consecuencia práctica:
--
--     · el enlace de un anuncio real es imposible de leer, dictar o recordar, y
--       al pegarlo en WhatsApp no dice nada de lo que hay detrás;
--     · al pedir una ficha por un identificador del espacio equivocado, la
--       consulta fallaba y la capa de datos caía a la semilla, mezclando datos
--       ficticios con reales en la misma pantalla.
--
--   La decisión (tomada en el informe y no reabierta aquí): **slug en la URL +
--   UUID como clave primaria**. La base no se reescribe, `pensiones.id` sigue
--   siendo el UUID, y se añade una columna `slug` que es la cara pública del
--   anuncio.
--
-- Las tres propiedades que la dirección tiene que cumplir
--
--   1. ÚNICA y NO NULA. Una dirección pública que se repita o que falte no puede
--      resolver nada. Lo garantizan un índice único y un `not null`, no la
--      aplicación.
--
--   2. ESTABLE. **No cambia al editar el título.** El disparador se declara
--      `before insert` a propósito: al no dispararse nunca en un `update`, un
--      anfitrión que corrija el nombre de su pensión no puede romper un enlace
--      que ya haya repartido por WhatsApp. Y como refuerzo, `slug` tampoco está
--      en la lista de columnas que `authenticated` puede escribir (ver la
--      comprobación al final): no se cambia ni por la puerta de atrás.
--
--   3. RESUMIBLE. Se genera sin acentos, en minúsculas, solo con letras, cifras
--      y guiones: `Pensión Costa Verde` → `pension-costa-verde` — exactamente el
--      mismo formato que ya usaba la semilla, así que las direcciones de la demo
--      no cambian ni una letra.
--
-- Qué NO cambia
--
--   · La semilla de demostración y sus direcciones: siguen igual (la demo debe
--     seguir funcionando, es requisito del fundador).
--   · `pensiones.id`: sigue siendo el UUID y la clave primaria. Los enlaces con
--     UUID que ya se hayan compartido siguen resolviendo (la capa de datos acepta
--     las dos formas; una sola función decide cuál usar).
--   · La lectura pública: no se toca ningún privilegio de SELECT ni política.
--   · Las restricciones ya existentes: solo se añade una.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Cómo se convierte un título en una dirección
--
--    `translate` + `regexp_replace`: se quitan los acentos (incluidas las
--    vocales acentuadas de las mayúsculas), se pasa a minúsculas y todo lo que no
--    sea letra o cifra se convierte en un guion. `immutable` para que pueda usarse
--    en índices y en columnas calculadas sin sorpresas.
-- ---------------------------------------------------------------------------
create or replace function public.slugificar(texto text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
           lower(translate(
             coalesce(texto, ''),
             'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
             'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
           )),
           '[^a-z0-9]+', '-', 'g'));
$$;

revoke execute on function public.slugificar(text) from public;
revoke execute on function public.slugificar(text) from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2) La columna
-- ---------------------------------------------------------------------------
alter table public.pensiones add column if not exists slug text;

comment on column public.pensiones.slug is
  'Dirección pública del anuncio (/pensiones/<slug>): única, minúscula, sin acentos y ESTABLE. Se asigna una sola vez, al publicar, y no cambia al editar el título — una URL ya compartida no puede morir. El UUID (`id`) sigue siendo la clave primaria.';


-- ---------------------------------------------------------------------------
-- 3) Relleno de las publicaciones que ya existen
--
--    Se deriva del título y, si dos coinciden, se numeran (`casa-sol`, `casa-sol-2`).
--    Un título sin letras ni cifras útiles (por ejemplo «¡¡¡¡») cae a `pension`,
--    porque el formato de la dirección no admite otra cosa.
-- ---------------------------------------------------------------------------
with base as (
  select id, creada_en,
         case
           when length(public.slugificar(titulo)) >= 3 then public.slugificar(titulo)
           else 'pension'
         end as base_slug
    from public.pensiones
   where slug is null or slug = ''
),
numerada as (
  select id, base_slug,
         row_number() over (partition by base_slug order by creada_en, id) as n
    from base
)
update public.pensiones p
   set slug = case
                when numerada.n = 1 then numerada.base_slug
                else numerada.base_slug || '-' || numerada.n
              end
  from numerada
 where numerada.id = p.id;

alter table public.pensiones alter column slug set not null;

create unique index if not exists pensiones_slug_uk on public.pensiones (slug);

-- Una dirección pública con formato raro (mayúsculas, acentos, espacios) es un
-- enlace que se rompe al copiarlo. La restricción lo impide en la base; la
-- aplicación genera el valor, pero un `PATCH` directo no puede inventarse otro.
alter table public.pensiones drop constraint if exists pensiones_slug_formato;
alter table public.pensiones
  add constraint pensiones_slug_formato
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80);


-- ---------------------------------------------------------------------------
-- 4) Quién asigna la dirección
--
--    Solo al INSERTAR. Es la pieza que hace cumplir «no cambia al editar el
--    título»: no hay ningún camino que regenere el slug de un anuncio existente.
--    Si el INSERT ya trae un slug (por ejemplo una carga de datos con direcciones
--    decididas a mano), se respeta.
--
--    SECURITY DEFINER + search_path fijo: la comprobación de duplicados debe ver
--    TODAS las filas, no solo las que la RLS deja ver al llamante; si no, un
--    anfitrión podría generar una dirección ya ocupada por otro y el índice único
--    fallaría con un error incomprensible en mitad de su publicación.
-- ---------------------------------------------------------------------------
create or replace function public.asignar_slug_pension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_candidato text;
  v_n int := 1;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  v_base := public.slugificar(new.titulo);
  if length(v_base) < 3 then
    v_base := 'pension';
  end if;

  v_candidato := v_base;
  while exists (
    select 1 from public.pensiones
     where slug = v_candidato and id is distinct from new.id
  ) loop
    v_n := v_n + 1;
    v_candidato := v_base || '-' || v_n;
  end loop;

  new.slug := v_candidato;
  return new;
end;
$$;

drop trigger if exists antes_de_asignar_slug on public.pensiones;
create trigger antes_de_asignar_slug
  before insert on public.pensiones
  for each row execute function public.asignar_slug_pension();

revoke execute on function public.asignar_slug_pension() from public;
revoke execute on function public.asignar_slug_pension() from anon, authenticated;


-- ============================================================================
-- Verificación rápida tras aplicar (no escribe nada):
--
--   -- 1. Transformación de un título en dirección (acentos y mayúsculas):
--   select public.slugificar('Pensión José Ñandú — Mamatoco 2º piso');
--   -- esperado: pension-jose-nandu-mamatoco-2-piso
--   -- (los acentos y la eñe pasan a su letra base; los símbolos, incluido el
--   --  ordinal «º», se convierten en un guion)
--
--   -- 2. La columna y sus garantías:
--   select is_nullable from information_schema.columns
--    where table_schema='public' and table_name='pensiones' and column_name='slug';
--   -- esperado: NO
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid='public.pensiones'::regclass and conname in ('pensiones_slug_formato','pensiones_slug_uk');
--   -- esperado: la restricción de formato y el índice único
--
--   -- 3. Direcciones asignadas a lo que ya existía:
--   select titulo, slug from public.pensiones order by creada_en;
--
--   -- 4. El anfitrión NO puede escribir la dirección (ni por PATCH):
--   select has_column_privilege('authenticated','public.pensiones','slug','UPDATE');
--   -- esperado: f
--
-- Pruebas de aceptación completas (se revierten solas):
--   supabase/pruebas/oleada-5.sql
--
-- Reversión:
--   drop trigger if exists antes_de_asignar_slug on public.pensiones;
--   drop function if exists public.asignar_slug_pension();
--   alter table public.pensiones drop constraint if exists pensiones_slug_formato;
--   drop index if exists public.pensiones_slug_uk;
--   alter table public.pensiones drop column if exists slug;
-- ============================================================================
