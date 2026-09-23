-- Verificación funcional de la Oleada 5 (se ejecuta y se limpia sola).
--
-- Qué comprueba (criterios de aceptación de la tarea #26):
--   1. La dirección legible existe, es única, no nula y con formato estricto.
--   2. Se genera sola al publicar, en el mismo formato que ya usaba la semilla.
--   3. **Editar el título NO cambia la dirección** (una URL ya compartida no
--      puede morir), y el anfitrión tampoco puede escribirla directamente.
--   4. Dos anuncios con el mismo título reciben direcciones distintas.
--   5. La lectura pública sigue igual.
--
-- Precauciones de método (las mismas que en oleada-2 a oleada-4):
--   · El rol de sesión se cambia y se restaura tras cada prueba.
--   · Las publicaciones de prueba se crean retiradas (`activa = false`).
--   · No se toca la publicación real del anfitrión: solo se LEE su dirección.
--
-- Antes de aplicar la Oleada 5, la dirección de un anuncio real era un UUID
-- (`f555e5b3-6629-402a-ae37-32c366c3f022`) y no existía ninguna columna `slug`.

drop table if exists qa_oleada5;
create temp table qa_oleada5 (paso text, ok boolean, detalle text);

do $qa$
declare
  v_rol       text := current_user;
  v_uid       uuid;
  v_a         uuid;
  v_b         uuid;
  v_prueba    uuid;
  v_slug      text;
  v_slug_ini  text;
  v_filas     integer;
  v_ok        boolean;
  v_detalle   text;
  v_anon      integer;
  v_reales    integer;
begin
  select id into v_uid from auth.users order by created_at limit 1;

  if v_uid is null then
    insert into qa_oleada5 values ('0. usuario de prueba', false, 'no hay usuarios en auth.users');
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);

  -- ------------------------------------------------------------------------
  -- 1) Cómo se convierte un título en dirección
  -- ------------------------------------------------------------------------
  -- Los acentos y la eñe se convierten a su letra base; los símbolos (incluidos
  -- los indicadores ordinales «º»/«ª», que no son letras) se sustituyen por un
  -- guion. Por eso «2º piso» da `2-piso` y no `2o-piso`: la dirección sigue
  -- siendo legible y no arrastra caracteres raros a una URL.
  insert into qa_oleada5 values ('1. Título → dirección (acentos, mayúsculas, símbolos)',
    public.slugificar('Pensión José Ñandú — Mamatoco 2º piso') = 'pension-jose-nandu-mamatoco-2-piso',
    format('slugificar(...) = %s', public.slugificar('Pensión José Ñandú — Mamatoco 2º piso')));

  insert into qa_oleada5 values ('1b. No deja guiones dobles ni en los extremos',
    public.slugificar('  ¡¡ Casa   Sol !!  ') = 'casa-sol',
    format('slugificar(límites) = %s', public.slugificar('  ¡¡ Casa   Sol !!  ')));

  -- ------------------------------------------------------------------------
  -- 2) La columna y sus garantías
  -- ------------------------------------------------------------------------
  insert into qa_oleada5 values ('2. slug es NOT NULL',
    (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'pensiones' and column_name = 'slug') = 'NO',
    format('is_nullable=%s',
      (select is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'pensiones' and column_name = 'slug')));

  insert into qa_oleada5 values ('3. Índice único sobre slug',
    exists (select 1 from pg_indexes
             where schemaname = 'public' and tablename = 'pensiones'
               and indexname = 'pensiones_slug_uk' and indexdef like '%UNIQUE%'),
    coalesce((select indexdef from pg_indexes
               where schemaname = 'public' and tablename = 'pensiones' and indexname = 'pensiones_slug_uk'),
             'NO EXISTE'));

  insert into qa_oleada5 values ('4. Restricción de formato',
    (select pg_get_constraintdef(oid) from pg_constraint
      where conrelid = 'public.pensiones'::regclass and conname = 'pensiones_slug_formato') like '%[a-z0-9]%',
    coalesce((select pg_get_constraintdef(oid) from pg_constraint
               where conrelid = 'public.pensiones'::regclass and conname = 'pensiones_slug_formato'),
             'NO EXISTE'));

  -- Las publicaciones que ya existían quedaron con dirección legible.
  select count(*) into v_reales from public.pensiones where slug is null or slug = '';
  insert into qa_oleada5 values ('5. Las publicaciones existentes ya tienen dirección',
    v_reales = 0, format('publicaciones sin dirección=%s (esperado 0)', v_reales));

  -- ------------------------------------------------------------------------
  -- 3) La vía real de publicación (la RPC) asigna la dirección
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    select public.crear_pension_con_habitaciones(
      jsonb_build_object(
        'titulo', 'Prueba QA oleada 5 Pensión Ñandú',
        'descripcion', 'Publicacion temporal creada por la verificacion automatica.',
        'direccion', 'Calle 30 # 12-45',
        'barrio', 'Mamatoco',
        'activa', false
      ),
      jsonb_build_array(
        jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 500000, 'disponible', true)
      )
    ) into v_prueba;
    v_ok := v_prueba is not null;
    v_detalle := format('publicacion creada=%s', v_prueba is not null);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada5 values ('6. La publicación por RPC genera dirección sola', v_ok, v_detalle);

  select slug into v_slug_ini from public.pensiones where id = v_prueba;
  insert into qa_oleada5 values ('7. La dirección se deriva del título',
    v_slug_ini = 'prueba-qa-oleada-5-pension-nandu',
    format('slug=%s (esperado prueba-qa-oleada-5-pension-nandu)', coalesce(v_slug_ini, 'NULL')));

  -- ------------------------------------------------------------------------
  -- 4) LA PRUEBA CLAVE: editar el título no cambia la dirección
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones
       set titulo = 'Prueba QA oleada 5 (título corregido por el anfitrión)'
     where id = v_prueba;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('título editado, filas=%s', v_filas);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);

  select slug into v_slug from public.pensiones where id = v_prueba;
  insert into qa_oleada5 values ('8. Editar el título NO cambia la dirección',
    v_ok and v_slug = v_slug_ini,
    format('antes=%s · después=%s (deben ser iguales)', v_slug_ini, coalesce(v_slug, 'NULL')));

  -- ------------------------------------------------------------------------
  -- 5) El anfitrión no puede escribir la dirección ni directamente
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set slug = 'direccion-secuestrada' where id = v_prueba;
    get diagnostics v_filas = row_count;
    v_ok := false; v_detalle := format('PERMITIDO: filas=%s', v_filas);
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada5 values ('9. Denegado: el anfitrión escribe el slug (42501)', v_ok, v_detalle);

  -- La dirección sigue siendo la de antes del intento.
  select slug into v_slug from public.pensiones where id = v_prueba;
  insert into qa_oleada5 values ('10. Tras el intento, la dirección no cambió',
    v_slug = v_slug_ini, format('slug=%s (esperado %s)', coalesce(v_slug, 'NULL'), v_slug_ini));

  -- ------------------------------------------------------------------------
  -- 6) Dos anuncios con el mismo título → direcciones distintas
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    insert into public.pensiones (anfitrion_id, titulo, activa)
    values (v_uid, 'Prueba QA oleada 5 Colision', false)
    returning id into v_a;

    insert into public.pensiones (anfitrion_id, titulo, activa)
    values (v_uid, 'Prueba QA oleada 5 Colision', false)
    returning id into v_b;
    v_ok := true;
    v_detalle := 'dos publicaciones insertadas con el mismo título';
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);

  insert into qa_oleada5 values ('11. Dos títulos iguales → direcciones distintas',
    v_ok and (select slug from public.pensiones where id = v_a) <> (select slug from public.pensiones where id = v_b)
        and (select slug from public.pensiones where id = v_b) = 'prueba-qa-oleada-5-colision-2',
    format('%s · %s',
      coalesce((select slug from public.pensiones where id = v_a), 'NULL'),
      coalesce((select slug from public.pensiones where id = v_b), 'NULL')));

  -- ------------------------------------------------------------------------
  -- 7) Otra dirección ya ocupada no se puede duplicar (índice único)
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    insert into public.pensiones (anfitrion_id, titulo, activa, slug)
    values (v_uid, 'Prueba QA oleada 5 Duplicado', false, v_slug_ini);
    v_ok := false; v_detalle := 'PERMITIDO: se guardó una dirección duplicada';
  exception when others then
    v_ok := (sqlstate = '23505');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada5 values ('12. Rechaza una dirección duplicada (23505)', v_ok, v_detalle);

  -- ------------------------------------------------------------------------
  -- 8) Lectura pública
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    select count(*) into v_anon from public.pensiones where slug is not null;
    v_ok := (v_anon >= 1);
    v_detalle := format('publicaciones con dirección visibles para anon=%s', v_anon);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada5 values ('13. anon lee el catálogo con direcciones', v_ok, v_detalle);

  -- Un anónimo no debe ver las publicaciones retiradas de la prueba.
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    select count(*) into v_anon from public.pensiones where id in (v_prueba, v_a, v_b);
    v_ok := (v_anon = 0);
    v_detalle := format('filas visibles de las publicaciones de prueba=%s (esperado 0)', v_anon);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada5 values ('14. Las publicaciones retiradas siguen ocultas', v_ok, v_detalle);

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
end $qa$;

-- Limpieza: ningún rastro de la prueba.
delete from public.habitaciones
 where pension_id in (select id from public.pensiones where titulo like 'Prueba QA oleada 5%');
delete from public.pensiones where titulo like 'Prueba QA oleada 5%';

insert into qa_oleada5
select '15. limpieza sin residuos',
       (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 5%') = 0,
       format('residuos=%s · publicaciones reales con dirección=%s',
              (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 5%'),
              (select count(*) from public.pensiones where slug is not null));

select paso, ok, detalle from qa_oleada5 order by paso;
