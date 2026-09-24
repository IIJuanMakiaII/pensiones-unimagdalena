-- Verificación funcional de la Oleada 7 (se ejecuta y se limpia sola).
--
-- Qué comprueba (criterios de aceptación de la tarea #33):
--   1. Solo el dueño borra: otro anfitrión y un anónimo quedan rechazados, con
--      el código de error delante (42501) y con control positivo (el dueño sí).
--   2. Borrar un anuncio no deja habitaciones huérfanas.
--   3. **La dirección de un anuncio borrado no se reutiliza**: ni el generador se
--      la da a un anuncio nuevo con el mismo título, ni una carga manual puede
--      tomarla. La dirección queda muerta.
--   4. Retirar (`activa = false`) NO reserva la dirección: borrar no es retirar.
--   5. Las restricciones anteriores siguen en pie: columnas prohibidas (probadas
--      ejecutando el intento) y la autorización del contacto.
--
-- Precauciones de método (las mismas que en oleada-2 … oleada-5):
--   · El rol de sesión se cambia y se restaura tras cada prueba.
--   · Las publicaciones de prueba se crean retiradas (`activa = false`).
--   · La prueba limpia lo que escribe, INCLUIDAS las reservas que crea: la tabla
--     es append-only para la aplicación, pero los restos de una prueba son basura
--     de la prueba y se retiran al terminar.
--
-- Antes de aplicar la Oleada 7 no existía ninguna forma de borrar desde la
-- aplicación (`borrar_pension`), no había registro de direcciones retiradas y el
-- slug de un anuncio borrado quedaba libre para el siguiente.

drop table if exists qa_oleada7;
create temp table qa_oleada7 (paso text, ok boolean, detalle text);

do $qa$
declare
  v_rol          text := current_user;
  v_uid          uuid;
  v_otro         uuid := gen_random_uuid();
  v_a            uuid;
  v_b            uuid;
  v_c            uuid;
  v_slug         text;
  v_slug_b       text;
  v_esperado     text := 'prueba-qa-oleada-7-anuncio-efimero';
  v_filas        integer;
  v_cuenta       integer;
  v_ok           boolean;
  v_detalle      text;
begin
  select id into v_uid from auth.users order by created_at limit 1;

  if v_uid is null then
    insert into qa_oleada7 values ('0. usuario de prueba', false, 'no hay usuarios en auth.users');
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);

  -- ========================================================================
  -- Preparación: un anuncio con dos habitaciones, como lo publica un anfitrión
  -- ========================================================================
  begin
    perform set_config('role', 'authenticated', true);
    select public.crear_pension_con_habitaciones(
      jsonb_build_object(
        'titulo', 'Prueba QA oleada 7 Anuncio Efimero',
        'descripcion', 'Publicacion temporal creada por la verificacion automatica.',
        'direccion', 'Carrera 19 # 25-40',
        'barrio', 'Mamatoco',
        'activa', false
      ),
      jsonb_build_array(
        jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 450000, 'disponible', true),
        jsonb_build_object('tipo', 'compartida', 'genero', 'femenino', 'precio_mensual_cop', 380000, 'disponible', false)
      )
    ) into v_a;
    v_ok := v_a is not null;
    v_detalle := format('anuncio de prueba creado=%s', v_a is not null);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada7 values ('1. Preparación: anuncio con 2 habitaciones', v_ok, v_detalle);

  select slug into v_slug from public.pensiones where id = v_a;
  select count(*) into v_cuenta from public.habitaciones where pension_id = v_a;
  insert into qa_oleada7 values ('2. Preparación coherente (dirección y habitaciones)',
    v_slug = v_esperado and v_cuenta = 2,
    format('slug=%s (esperado %s) · habitaciones=%s (esperado 2)', coalesce(v_slug, 'NULL'), v_esperado, v_cuenta));

  -- ========================================================================
  -- 1) SOLO EL DUEÑO BORRA
  -- ========================================================================
  -- Otro anfitrión (con sesión válida, pero sin ser el dueño)
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_otro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_otro::text, true);
    perform public.borrar_pension(v_a);
    v_ok := false; v_detalle := 'PERMITIDO: otro anfitrión borró un anuncio ajeno';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  insert into qa_oleada7 values ('3. Otro anfitrión NO puede borrar (42501)', v_ok, v_detalle);

  select count(*) into v_cuenta from public.pensiones where id = v_a;
  insert into qa_oleada7 values ('4. Tras el intento, el anuncio sigue existiendo',
    v_cuenta = 1, format('anuncios con ese id=%s (esperado 1)', v_cuenta));

  -- Un anónimo, sin sesión
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    perform public.borrar_pension(v_a);
    v_ok := false; v_detalle := 'PERMITIDO: un anónimo borró un anuncio';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada7 values ('5. Un anónimo NO puede borrar (42501)', v_ok, v_detalle);

  -- Un DELETE directo contra la tabla (el camino que no pasa por la función):
  -- la RLS lo deja en 0 filas, sin borrar nada.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_otro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_otro::text, true);
    delete from public.pensiones where id = v_a;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 0);
    v_detalle := format('filas borradas por otro anfitrión=%s (esperado 0)', v_filas);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada7 values ('6. DELETE directo de otro anfitrión: 0 filas (RLS)', v_ok, v_detalle);

  -- Y la dirección NO se reserva por un intento fallido.
  select count(*) into v_cuenta from public.slugs_reservados where slug = v_esperado;
  insert into qa_oleada7 values ('7. Un intento fallido no reserva la dirección',
    v_cuenta = 0, format('reservas con esa dirección=%s (esperado 0)', v_cuenta));

  -- ========================================================================
  -- 2) RETIRAR NO ES BORRAR: no reserva la dirección
  -- ========================================================================
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set activa = false where id = v_a;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('retirado, filas=%s', v_filas);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);

  select count(*) into v_cuenta from public.slugs_reservados where slug = v_esperado;
  insert into qa_oleada7 values ('8. Retirar NO reserva la dirección (borrar ≠ retirar)',
    v_ok and v_cuenta = 0,
    format('retirado y reservas con esa dirección=%s (esperado 0)', v_cuenta));

  -- ========================================================================
  -- 3) EL DUEÑO BORRA: control positivo
  -- ========================================================================
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    select public.borrar_pension(v_a) into v_slug_b;
    v_ok := (v_slug_b = v_esperado);
    v_detalle := format('dirección devuelta=%s (esperado %s)', coalesce(v_slug_b, 'NULL'), v_esperado);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada7 values ('9. El dueño SÍ borra su anuncio', v_ok, v_detalle);

  select count(*) into v_cuenta from public.pensiones where id = v_a;
  insert into qa_oleada7 values ('10. El anuncio ya no existe', v_cuenta = 0, format('anuncios con ese id=%s (esperado 0)', v_cuenta));

  select count(*) into v_cuenta from public.habitaciones where pension_id = v_a;
  insert into qa_oleada7 values ('11. No quedan habitaciones huérfanas', v_cuenta = 0,
    format('habitaciones de ese anuncio=%s (esperado 0)', v_cuenta));

  -- ========================================================================
  -- 4) LA DIRECCIÓN QUEDA MUERTA (el punto que más importa)
  -- ========================================================================
  select count(*) into v_cuenta from public.slugs_reservados where slug = v_esperado;
  insert into qa_oleada7 values ('12. La dirección del anuncio borrado queda reservada',
    v_cuenta = 1, format('reservas con esa dirección=%s (esperado 1)', v_cuenta));

  select count(*) into v_cuenta from public.pensiones where slug = v_esperado;
  insert into qa_oleada7 values ('13. Ningún anuncio ocupa ya esa dirección',
    v_cuenta = 0, format('anuncios con esa dirección=%s (esperado 0)', v_cuenta));

  -- Un anuncio nuevo con EL MISMO título no la hereda: recibe `-2`.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    select public.crear_pension_con_habitaciones(
      jsonb_build_object(
        'titulo', 'Prueba QA oleada 7 Anuncio Efimero',
        'descripcion', 'Segundo anuncio con el mismo titulo que el borrado.',
        'direccion', 'Carrera 19 # 25-42',
        'barrio', 'Mamatoco',
        'activa', false
      ),
      jsonb_build_array(
        jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 500000, 'disponible', true)
      )
    ) into v_b;
    v_ok := v_b is not null;
    v_detalle := 'segundo anuncio con el mismo título creado';
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);

  select slug into v_slug_b from public.pensiones where id = v_b;
  insert into qa_oleada7 values ('14. Un anuncio nuevo con el mismo título NO hereda la dirección',
    v_ok and v_slug_b = v_esperado || '-2',
    format('dirección del nuevo=%s (esperado %s-2)', coalesce(v_slug_b, 'NULL'), v_esperado));

  -- Y una carga manual que traiga la dirección escrita a mano tampoco puede tomarla.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    insert into public.pensiones (anfitrion_id, titulo, activa, slug)
    values (v_uid, 'Prueba QA oleada 7 Manual', false, v_esperado);
    v_ok := false; v_detalle := 'PERMITIDO: una carga manual revivió una dirección borrada';
  exception when others then
    v_ok := (sqlstate = '23505');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada7 values ('15. Una carga manual NO puede reutilizar la dirección (23505)', v_ok, v_detalle);

  -- ========================================================================
  -- 5) LAS RESTRICCIONES ANTERIORES SIGUEN EN PIE
  -- ========================================================================
  -- Sobre un anuncio vivo del anfitrión, intentando escribir lo prohibido.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set verificado = true, calificacion = 5.0 where id = v_b;
    v_ok := false; v_detalle := 'PERMITIDO: el anfitrión se otorgó el sello';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada7 values ('16. Sigue prohibido escribir `verificado`/`calificacion` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set precio_mensual = 1000 where id = v_b;
    v_ok := false; v_detalle := 'PERMITIDO: el anfitrión cambió el precio a mano';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada7 values ('17. Sigue prohibido escribir `precio_mensual` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set slug = 'direccion-nueva' where id = v_b;
    v_ok := false; v_detalle := 'PERMITIDO: el anfitrión cambió su dirección';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada7 values ('18. Sigue prohibido escribir `slug` (42501)', v_ok, v_detalle);

  -- La autorización del contacto (oleada 6): un número sin autorización no se guarda.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set whatsapp = '3001234567' where id = v_b;
    v_ok := false; v_detalle := 'PERMITIDO: se publicó un número sin autorización';
  exception when others then
    v_ok := (sqlstate = '23514');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada7 values ('19. Sigue en pie la autorización del contacto (23514)', v_ok, v_detalle);

  select count(*) into v_cuenta from pg_constraint
   where conrelid = 'public.pensiones'::regclass and conname = 'pensiones_autorizacion_para_whatsapp';
  insert into qa_oleada7 values ('20. La restricción de autorización sigue declarada',
    v_cuenta = 1, format('restricciones encontradas=%s (esperado 1)', v_cuenta));

  -- ========================================================================
  -- 6) El borrado directo del dueño también reserva la dirección
  -- ========================================================================
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    delete from public.pensiones where id = v_b;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('borrado directo del dueño, filas=%s', v_filas);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada7 values ('21. El dueño también borra por DELETE directo', v_ok, v_detalle);

  select count(*) into v_cuenta from public.slugs_reservados where slug = v_esperado || '-2';
  insert into qa_oleada7 values ('22. Ese borrado directo también reservó su dirección',
    v_cuenta = 1, format('reservas con esa dirección=%s (esperado 1)', v_cuenta));

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
end $qa$;

-- Limpieza: las publicaciones de prueba, sus habitaciones y las reservas que creó
-- esta prueba. La tabla de reservas es append-only para la aplicación; los restos
-- de una prueba son basura de la prueba.
delete from public.habitaciones
 where pension_id in (select id from public.pensiones where titulo like 'Prueba QA oleada 7%');
delete from public.pensiones where titulo like 'Prueba QA oleada 7%';
delete from public.slugs_reservados where slug like 'prueba-qa-oleada-7%';

insert into qa_oleada7
select '23. limpieza sin residuos',
       (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 7%') = 0
       and (select count(*) from public.habitaciones h
             where not exists (select 1 from public.pensiones p where p.id = h.pension_id)) = 0
       and (select count(*) from public.slugs_reservados where slug like 'prueba-qa-oleada-7%') = 0,
       format('publicaciones=%s · habitaciones huérfanas=%s · reservas de prueba=%s · anuncios reales=%s',
              (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 7%'),
              (select count(*) from public.habitaciones h
                where not exists (select 1 from public.pensiones p where p.id = h.pension_id)),
              (select count(*) from public.slugs_reservados where slug like 'prueba-qa-oleada-7%'),
              (select count(*) from public.pensiones where titulo not like 'Prueba QA%'));

select paso, ok, detalle from qa_oleada7 order by paso;
