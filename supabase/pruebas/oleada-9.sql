-- Verificación funcional de la Oleada 9 (se ejecuta y se limpia sola).
--
-- Qué comprueba (criterios de aceptación de la tarea #33, alcance nuevo):
--   1. El maestro LEE una publicación retirada; otro anfitrión no lee la ajena.
--   2. El maestro BORRA la de otro; un anfitrión solo borra la suya.
--   3. `whatsapp` deja de ser legible por el rol anónimo (y deja de poder
--      escribirse).
--   4. Las cinco columnas prohibidas siguen prohibidas, probando el intento.
--   5. El rol maestro NO se puede pedir desde el registro.
--
-- Preparación: esta prueba crea un usuario sintético (auth.users + su perfil) que
-- hace de maestro, y una publicación retirada del usuario real del proyecto que
-- hace de «anónima» para él. **No modifica ninguna fila existente**: la
-- publicación de prueba es nueva y se borra al final, junto con el usuario
-- sintético y las direcciones que la prueba reserve.

drop table if exists qa_oleada9;
create temp table qa_oleada9 (paso text, ok boolean, detalle text);

do $qa$
declare
  v_rol_sesion text := current_user;
  v_uid        uuid;
  v_maestro    uuid := gen_random_uuid();
  v_pension    uuid;
  v_pension2   uuid;
  v_rol_previo text;
  v_cuenta     integer;
  v_valor      text;
  v_ok         boolean;
  v_detalle    text;
begin
  select id into v_uid from auth.users order by created_at limit 1;

  if v_uid is null then
    insert into qa_oleada9 values ('0. usuario real de prueba', false, 'no hay usuarios en auth.users');
    return;
  end if;

  -- ------------------------------------------------------------------------
  -- Preparación: un maestro sintético y una publicación retirada del anfitrión
  -- ------------------------------------------------------------------------
  begin
    insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
    values (v_maestro, 'authenticated', 'authenticated',
            'prueba-qa-oleada9-' || substr(v_maestro::text, 1, 8) || '@example.invalid',
            now(), now(), now());

    update public.usuarios set rol = 'maestro' where id = v_maestro;
    v_ok := true; v_detalle := 'maestro sintético creado con su perfil';
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  insert into qa_oleada9 values ('1. Preparación: usuario maestro', v_ok, v_detalle);

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    perform set_config('role', 'authenticated', true);
    select public.crear_pension_con_habitaciones(
      jsonb_build_object(
        'titulo', 'Prueba QA oleada 9 Retirada',
        'descripcion', 'Publicacion temporal retirada creada por la verificacion automatica.',
        'direccion', 'Carrera 21 # 30-10',
        'barrio', 'Mamatoco',
        'activa', false
      ),
      jsonb_build_array(
        jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 460000, 'disponible', true)
      )
    ) into v_pension;
    v_ok := v_pension is not null;
    v_detalle := format('publicación retirada creada=%s', v_pension is not null);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('2. Preparación: publicación retirada del anfitrión', v_ok, v_detalle);

  -- ========================================================================
  -- 1) LECTURA: el maestro ve lo retirado; otro anfitrión no ve lo ajeno
  -- ========================================================================
  -- Primero con el rol del maestro BAJADO a anfitrión: no debe ver nada.
  begin
    update public.usuarios set rol = 'anfitrion' where id = v_maestro;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    select count(*) into v_cuenta from public.pensiones where id = v_pension;
    v_ok := (v_cuenta = 0);
    v_detalle := format('filas visibles como anfitrión ajeno=%s (esperado 0)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('3. Un anfitrión NO lee la publicación retirada de otro', v_ok, v_detalle);

  -- Ahora con el rol maestro: debe verla.
  begin
    update public.usuarios set rol = 'maestro' where id = v_maestro;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    select count(*) into v_cuenta from public.pensiones where id = v_pension;
    v_ok := (v_cuenta = 1);
    v_detalle := format('filas visibles como maestro=%s (esperado 1)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('4. El maestro SÍ lee la publicación retirada', v_ok, v_detalle);

  -- Y las habitaciones de esa publicación también.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    select count(*) into v_cuenta from public.habitaciones where pension_id = v_pension;
    v_ok := (v_cuenta = 1);
    v_detalle := format('habitaciones visibles para el maestro=%s (esperado 1)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('5. El maestro lee también las habitaciones', v_ok, v_detalle);

  -- `es_maestro()` responde bien en los dos casos.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    select public.es_maestro() into v_ok;
    v_detalle := format('es_maestro() para el anfitrión=%s (esperado false)', v_ok);
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('6. es_maestro() es falso para un anfitrión', v_ok = false, v_detalle);

  -- ========================================================================
  -- 2) ESCRITURA: disponibilidad, y borrado
  -- ========================================================================
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    update public.habitaciones set disponible = false where pension_id = v_pension;
    get diagnostics v_cuenta = row_count;
    v_ok := (v_cuenta = 1);
    v_detalle := format('habitaciones actualizadas por el maestro=%s (esperado 1)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('7. El maestro edita la disponibilidad de una habitación ajena', v_ok, v_detalle);

  -- Un anfitrión NO puede borrar lo ajeno (control negativo).
  begin
    update public.usuarios set rol = 'anfitrion' where id = v_maestro;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    perform public.borrar_pension(v_pension);
    v_ok := false; v_detalle := 'PERMITIDO: un anfitrión borró la publicación de otro';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('8. Un anfitrión NO borra la publicación de otro (42501)', v_ok, v_detalle);

  -- El maestro SÍ borra la de otro.
  begin
    update public.usuarios set rol = 'maestro' where id = v_maestro;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    select public.borrar_pension(v_pension) into v_valor;
    v_ok := v_valor is not null;
    v_detalle := format('dirección devuelta=%s', coalesce(v_valor, 'NULL'));
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('9. El maestro SÍ borra la publicación de otro', v_ok, v_detalle);

  select count(*) into v_cuenta from public.pensiones where id = v_pension;
  insert into qa_oleada9 values ('10. La publicación borrada ya no existe', v_cuenta = 0,
    format('filas con ese id=%s (esperado 0)', v_cuenta));

  select count(*) into v_cuenta from public.habitaciones where pension_id = v_pension;
  insert into qa_oleada9 values ('11. No quedan habitaciones huérfanas', v_cuenta = 0,
    format('habitaciones de esa publicación=%s (esperado 0)', v_cuenta));

  -- El anfitrión conserva borrar la suya.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    select public.crear_pension_con_habitaciones(
      jsonb_build_object(
        'titulo', 'Prueba QA oleada 9 Propia',
        'descripcion', 'Publicacion temporal propia creada por la verificacion automatica.',
        'direccion', 'Carrera 21 # 30-12',
        'barrio', 'Mamatoco',
        'activa', false
      ),
      jsonb_build_array(
        jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 470000, 'disponible', true)
      )
    ) into v_pension2;
    select public.borrar_pension(v_pension2) into v_valor;
    v_ok := v_valor is not null;
    v_detalle := format('el dueño borró la suya, dirección=%s', coalesce(v_valor, 'NULL'));
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('12. El anfitrión SÍ borra la suya', v_ok, v_detalle);

  -- ========================================================================
  -- 3) EL NÚMERO DEL ANFITRIÓN FUERA DEL ALCANCE PÚBLICO
  -- ========================================================================
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    select whatsapp into v_valor from public.pensiones limit 1;
    v_ok := false; v_detalle := 'PERMITIDO: un anónimo leyó el número del anfitrión';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('13. Un anónimo NO puede leer `whatsapp` (42501)', v_ok, v_detalle);

  insert into qa_oleada9
  select '14. El privilegio de lectura de `whatsapp` está retirado',
         not has_column_privilege('anon', 'public.pensiones', 'whatsapp', 'SELECT')
         and not has_column_privilege('authenticated', 'public.pensiones', 'whatsapp', 'SELECT')
         and not has_column_privilege('anon', 'public.pensiones', 'autorizacion_contacto_en', 'SELECT'),
         format('anon/whatsapp=%s · authenticated/whatsapp=%s · anon/autorizacion=%s',
                has_column_privilege('anon', 'public.pensiones', 'whatsapp', 'SELECT'),
                has_column_privilege('authenticated', 'public.pensiones', 'whatsapp', 'SELECT'),
                has_column_privilege('anon', 'public.pensiones', 'autorizacion_contacto_en', 'SELECT'));

  -- Y la lectura pública de lo que sí hace falta sigue funcionando.
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    select count(*) into v_cuenta from public.pensiones where activa;
    v_ok := (v_cuenta >= 1);
    v_detalle := format('publicaciones activas visibles para un anónimo=%s (esperado >=1)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('15. El catálogo público sigue leyéndose', v_ok, v_detalle);

  -- ========================================================================
  -- 4) LO QUE YA ESTABA CERRADO SIGUE CERRADO
  -- ========================================================================
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set verificado = true, calificacion = 5.0 where activa;
    v_ok := false; v_detalle := 'PERMITIDO: se escribió `verificado`/`calificacion`';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('16. Siguen prohibidas `verificado`/`calificacion` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set precio_mensual = 1000 where activa;
    v_ok := false; v_detalle := 'PERMITIDO: se escribió `precio_mensual`';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('17. Sigue prohibido `precio_mensual` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set anfitrion_id = v_maestro where activa;
    v_ok := false; v_detalle := 'PERMITIDO: se transfirió una publicación a otra cuenta';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('18. Sigue prohibido `anfitrion_id` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set slug = 'direccion-inventada' where activa;
    v_ok := false; v_detalle := 'PERMITIDO: se cambió la dirección de una publicación';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('19. Sigue prohibido `slug` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set whatsapp = '3001234567' where activa;
    v_ok := false; v_detalle := 'PERMITIDO: se escribió un número de WhatsApp';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('20. Ya no se puede escribir `whatsapp` (42501)', v_ok, v_detalle);

  -- El rol no se puede ascender desde la aplicación (ni el maestro puede hacerlo).
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.usuarios set rol = 'maestro' where id = v_uid;
    v_ok := false; v_detalle := 'PERMITIDO: un usuario se ascendió a maestro';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('21. Nadie se asciende a maestro por la API (42501)', v_ok, v_detalle);

  -- Y el registro sigue sin admitir el rol nuevo.
  select case when position('maestro' in prosrc) = 0 then false else true end
    into v_ok
    from pg_proc where proname = 'crear_perfil_usuario';
  insert into qa_oleada9 values ('22. El registro no admite pedir el rol maestro',
    v_ok = false, format('la función de alta menciona «maestro»=%s (esperado false)', v_ok));

  -- El `check` del rol sí lo admite (para poder concederlo por SQL).
  select case when pg_get_constraintdef(oid) like '%maestro%' then true else false end
    into v_ok
    from pg_constraint where conname = 'usuarios_rol_check';
  insert into qa_oleada9 values ('23. El rol maestro existe y se puede conceder por SQL',
    v_ok, format('el check del rol admite maestro=%s (esperado true)', v_ok));

end $qa$;

-- Limpieza: publicaciones de prueba, sus habitaciones, las direcciones que la
-- prueba reservó y el usuario sintético (arrastra su perfil en cascada).
delete from public.habitaciones
 where pension_id in (select id from public.pensiones where titulo like 'Prueba QA oleada 9%');
delete from public.pensiones where titulo like 'Prueba QA oleada 9%';
delete from public.slugs_reservados where slug like 'prueba-qa-oleada-9%';
delete from auth.users where email like 'prueba-qa-oleada9-%@example.invalid';

insert into qa_oleada9
select '24. limpieza sin residuos',
       (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 9%') = 0
       and (select count(*) from public.habitaciones h
             where not exists (select 1 from public.pensiones p where p.id = h.pension_id)) = 0
       and (select count(*) from public.slugs_reservados where slug like 'prueba-qa-oleada-9%') = 0
       and (select count(*) from auth.users where email like 'prueba-qa-oleada9-%@example.invalid') = 0
       and (select count(*) from public.usuarios u
             where not exists (select 1 from auth.users a where a.id = u.id)) = 0,
       format('publicaciones=%s · huérfanas=%s · reservas de prueba=%s · usuarios sintéticos=%s · perfiles sin cuenta=%s',
              (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 9%'),
              (select count(*) from public.habitaciones h
                where not exists (select 1 from public.pensiones p where p.id = h.pension_id)),
              (select count(*) from public.slugs_reservados where slug like 'prueba-qa-oleada-9%'),
              (select count(*) from auth.users where email like 'prueba-qa-oleada9-%@example.invalid'),
              (select count(*) from public.usuarios u
                where not exists (select 1 from auth.users a where a.id = u.id)));

select paso, ok, detalle from qa_oleada9 order by paso;
