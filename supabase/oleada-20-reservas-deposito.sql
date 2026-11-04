-- ============================================================================
-- Oleada 20 — Reservas y Depósito de Reserva (el 20 % del primer canon)
-- Proyecto: Nido · Supabase/Postgres · tarea #9
--
-- ⚠ ORDEN DE DESPLIEGUE — leer antes de pegar
--
--   1. Respaldo (§0 de la nota `docs/aplicar-migraciones-pendientes.md`).
--   2. Se aplica ESTA migración sola, entera, en una transacción.
--   3. Se ejecuta el bloque de verificación V. V.1 a V.7 tienen que dar lo que
--      dicen. Si alguna no cuadra, no se sigue. V.7 es la que confirma que esta
--      migración entró con la regla del anticipo decidida y no con la anterior.
--   4. No hay código que dependa de esta tabla todavía: se puede aplicar sin
--      desplegar nada. La primera reserva se registra a mano desde el editor
--      hasta que exista el panel.
--
-- POR QUE EXISTE ESTA OLEADA
--
--   El Depósito de Reserva —20 % del primer canon, mitad Tarifa de Servicio de
--   la Plataforma y mitad Anticipo del Arriendo— existe hoy en un solo sitio:
--   `lib/pension.ts:92-136`, una función que calcula y no guarda. Se ejecuta en
--   el navegador, se pinta en la ficha y desaparece cuando el estudiante cierra
--   la pestaña.
--
--   Consecuencia medida el 2026-10-31: `reservas` y `pagos` responden
--   `404 PGRST205`; no hay comisión que auditar, ni anticipo que seguir, ni
--   forma de saber si el dinero se retuvo, se liberó o se devolvió.
--
-- QUE HACE
--
--   Una tabla con el hecho económico completo y cuatro funciones que son la
--   única puerta de escritura. El reparto no lo decide quien llama: lo calcula
--   `registrar_reserva` con la misma aritmética que usa la ficha, para que la
--   pantalla y la base no puedan decir cosas distintas.
--
-- LA REGLA DEL ANTICIPO · decidida por Juan el 2026-10-31
--
--   El Anticipo del Arriendo (10 % del canon) se transfiere al propietario en
--   cuanto el estudiante reserva y paga: es lo que le guarda el cupo. No se
--   retiene hasta la llegada. Es la misma regla que ya publican las condiciones
--   §4.1, así que el texto legal y la base dicen por fin lo mismo.
--
--   Cómo lo ejecuta la base, sin depender de que alguien se acuerde:
--
--     · `cambiar_estado_reserva(..., 'confirmada')` sella `retenido_en` y
--       `liberado_en` en el mismo instante, y deja `liberado_motivo` en
--       'traslado_inmediato'. Confirmar el pago ES la orden de transferir.
--     · `liberar_deposito()` ya no tiene un valor por defecto que diga lo
--       contrario: si se llama sin motivo, también es traslado inmediato.
--     · `confirmacion_llegada` sigue admitido en el vocabulario para poder
--       registrar la verdad si alguna vez un anticipo se retuvo por acuerdo con
--       el propietario. Es una salida de emergencia auditable, no la regla.
--
--   Consecuencia operativa, y hay que tenerla presente: en cuanto se confirma,
--   ese dinero está en manos del propietario. Si después el estudiante cancela
--   con derecho a que se le devuelva el anticipo, Nido tiene que recuperarlo
--   primero del propietario para poder devolverlo. La tabla registra lo que se
--   devolvió al estudiante (`reembolsado_cop`); el acuerdo con el propietario
--   sobre cómo y cuándo lo reintegra es un documento, no una tabla. Ver
--   `docs/modelo-reservas.md` §5.
--
-- QUE **NO** HACE, A PROPOSITO
--
--   · No hay pasarela ni integración de pago. El dinero se cobra por fuera (hoy,
--     por WhatsApp) y esta tabla registra el hecho y su estado. No hay webhook,
--     no hay conciliación automática, no hay `pagos`.
--   · No toca `pensiones` ni `habitaciones`: ni una columna, ni una fila, ni una
--     función de las oleadas 17 y 18. La reserva apunta a la habitación; la
--     habitación no sabe que existe, y sigue gobernándose por `disponible` y
--     por `marcar_habitacion_reservada`, como hasta hoy.
--   · No mueve dinero. Registra el hecho y su fecha; la transferencia al
--     propietario se ejecuta por fuera (hoy, por el medio de pago que se acuerde
--     por WhatsApp). Lo que sí hace la base es no dejar lugar a dudas sobre
--     CUÁNDO corresponde transferir: ver la regla del anticipo, abajo.
--
-- ⚠ CONSECUENCIA DELIBERADA — LEER ANTES DE APLICAR
--
--   Las claves foráneas a `pensiones`, `habitaciones` y `usuarios` son
--   `on delete restrict`. Eso significa que **una pensión con reservas ya no se
--   puede borrar**: `borrar_pension` fallará con `23503 foreign_key_violation`
--   y el panel mostrará un error genérico.
--
--   Es intencional. Un registro de dinero no se borra; se anula, que es lo que
--   hace `cancelar_reserva`. Pero es un cambio de comportamiento que hay que
--   conocer: a partir de la primera reserva, la vía para retirar un anuncio es
--   `activa = false`, no el borrado.
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
     or pg_catalog.to_regclass('public.usuarios') is null then
    raise exception 'Faltan public.pensiones, public.habitaciones o public.usuarios: aplica supabase/esquema.sql antes de esta migracion';
  end if;

  -- Las políticas preguntan por el rol maestro con la función de oleada-9.
  if pg_catalog.to_regprocedure('public.es_maestro()') is null then
    raise exception 'Falta public.es_maestro(): aplica supabase/oleada-9.sql antes de esta migracion';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) La tabla
--
--    Los importes son `integer` en pesos, igual que `pensiones.precio_mensual` y
--    `habitaciones.precio_mensual_cop`: no hay centavos en este mercado y un
--    `numeric` invitaría a decimales que nadie ha definido.
--
--    `canon_mensual` es una FOTO del precio pactado al reservar, no una
--    referencia viva: si el anfitrión sube el canon el mes siguiente, la reserva
--    de ayer no puede cambiar de importe. Por eso se copia.
--
--    `estudiante_nombre` y `estudiante_contacto` también se copian: el
--    estudiante puede no tener cuenta —de hecho hoy no la tiene— y aunque la
--    tenga, un registro de dinero no puede depender de que esa cuenta siga
--    existiendo.
-- ---------------------------------------------------------------------------

create table if not exists public.reservas (
  id                  uuid primary key default gen_random_uuid(),

  -- A qué se reserva. `restrict` en las tres: ver la advertencia de la cabecera.
  pension_id          uuid not null references public.pensiones(id)    on delete restrict,
  habitacion_id       uuid not null references public.habitaciones(id) on delete restrict,
  -- Copia del dueño del anuncio. Existe para que la política de RLS no tenga
  -- que recorrer `pensiones` en cada fila: con `restrict`, el dueño de la
  -- pensión no puede borrarse mientras haya reservas, así que la copia no se
  -- queda huérfana.
  anfitrion_id        uuid not null references public.usuarios(id)     on delete restrict,

  -- Quién reserva. La cuenta es opcional; el nombre y el contacto, no.
  estudiante_id       uuid references public.usuarios(id) on delete set null,
  estudiante_nombre   text not null,
  estudiante_contacto text not null,

  -- El reparto del primer mes. Los cuatro importes se guardan, no se recalculan
  -- al leer: una tabla de dinero tiene que poder imprimirse igual dentro de dos
  -- años, aunque el porcentaje haya cambiado.
  canon_mensual       integer not null,
  tarifa_servicio     integer not null,
  anticipo            integer not null,
  deposito            integer not null,
  saldo_al_llegar     integer not null,

  -- El estado y sus fechas.
  estado              text not null default 'pendiente',
  fecha_entrada       date,
  retenido_en         timestamptz,
  liberado_en         timestamptz,
  liberado_motivo     text,
  cancelada_en        timestamptz,
  motivo_cancelacion  text,
  reembolsado_cop     integer not null default 0,
  reembolsado_en      timestamptz,

  -- Autoría.
  creada_por          uuid references public.usuarios(id) on delete set null,
  creada_en           timestamptz not null default now(),

  -- --- Las cuentas tienen que cerrar ---------------------------------------
  -- `tarifa + anticipo = deposito` y `deposito + saldo = canon` no son
  -- decoración: son la garantía de que la tabla del contrato y la de la base
  -- dicen lo mismo. Si alguna vez fallan, hay un error de aritmética en algún
  -- sitio y es mejor que salte aquí que en una reclamación.
  constraint reservas_canon_rango
    check (canon_mensual between 1000 and 20000000),
  constraint reservas_importes_no_negativos
    check (tarifa_servicio >= 0 and anticipo >= 0
       and deposito >= 0 and saldo_al_llegar >= 0),
  constraint reservas_deposito_suma
    check (deposito = tarifa_servicio + anticipo),
  constraint reservas_canon_suma
    check (canon_mensual = deposito + saldo_al_llegar),

  -- --- Estados --------------------------------------------------------------
  constraint reservas_estado_valido
    check (estado in ('pendiente', 'confirmada', 'en_curso', 'completada',
                      'cancelada', 'no_presentado')),

  -- --- Coherencia entre estado y fechas -------------------------------------
  -- Cancelar exige fecha de cancelación; devolver dinero exige decir cuándo.
  constraint reservas_cancelada_con_fecha
    check (estado <> 'cancelada' or cancelada_en is not null),
  constraint reservas_reembolso_con_fecha
    check (reembolsado_cop = 0 or reembolsado_en is not null),
  constraint reservas_reembolso_tope
    check (reembolsado_cop between 0 and deposito),
  constraint reservas_liberado_con_motivo
    check (liberado_en is null or liberado_motivo is not null),

  -- --- Vocabularios cerrados ------------------------------------------------
  -- Se cierran aquí para que un error de tecleo no cree un estado nuevo.
  --
  -- `traslado_inmediato` es la regla vigente y la que escribe la base al
  -- confirmar el pago. `confirmacion_llegada` no es una segunda regla abierta:
  -- existe para que una retención pactada con el propietario se pueda registrar
  -- sin mentir. Si un día sobra, se cierra con una migración que quite el valor.
  constraint reservas_liberado_motivo_valido
    check (liberado_motivo is null
           or liberado_motivo in ('traslado_inmediato', 'confirmacion_llegada')),
  constraint reservas_motivo_cancelacion_valido
    check (motivo_cancelacion is null
           or motivo_cancelacion in ('estudiante_ordinaria', 'fuerza_mayor',
                                     'propietario', 'no_presentado', 'otro')),

  -- Los mismos límites que el formulario de contacto, para que un nombre de
  -- solo espacios no entre por la puerta de atrás.
  constraint reservas_estudiante_nombre_largo
    check (char_length(btrim(estudiante_nombre)) between 2 and 80),
  constraint reservas_estudiante_contacto_largo
    check (char_length(btrim(estudiante_contacto)) between 5 and 120)
);

comment on table public.reservas is
  'Reservas y Deposito de Reserva (20 % del primer canon): 10 % Tarifa de Servicio de la Plataforma y 10 % Anticipo del Arriendo. Datos personales: no legible por anon. Se conserva como registro contable; se anula con cancelar_reserva(), no se borra.';

comment on column public.reservas.canon_mensual is
  'Foto del canon pactado al reservar. No se recalcula desde habitaciones.precio_mensual_cop: una reserva no cambia de importe si el anfitrion sube el precio despues.';

comment on column public.reservas.retenido_en is
  'Momento en que el Deposito de Reserva se recibio y quedo retenido por la plataforma (estado confirmada).';

comment on column public.reservas.liberado_en is
  'Momento en que el dinero dejo de estar retenido por la plataforma y salio hacia su destino. Ver liberado_motivo.';

comment on column public.reservas.liberado_motivo is
  'Regla aplicada al transferir el anticipo. traslado_inmediato es la regla vigente (decision de Juan, 2026-10-31; condiciones 4.1): el 10 % va al propietario en cuanto se confirma el pago, para que guarde el cupo. confirmacion_llegada queda admitido solo para registrar una retencion pactada con el propietario: es una excepcion auditable, no la regla.';

-- ---------------------------------------------------------------------------
-- 2) Índices
-- ---------------------------------------------------------------------------

-- Una sola reserva vigente por habitación. Es la garantía dura de que dos
-- estudiantes no reservan el mismo cuarto: la aplicación puede equivocarse,
-- este índice no. Las canceladas y las completadas quedan fuera del filtro
-- para que el historial de una habitación pueda crecer.
create unique index if not exists reservas_habitacion_vigente_uk
  on public.reservas (habitacion_id)
  where estado in ('pendiente', 'confirmada', 'en_curso');

-- El panel del maestro lista por fecha, lo más reciente primero.
create index if not exists reservas_creada_en_idx
  on public.reservas (creada_en desc);

-- El anfitrión consulta las de sus anuncios.
create index if not exists reservas_anfitrion_idx
  on public.reservas (anfitrion_id, creada_en desc);

-- El anuncio, para el resumen por publicación.
create index if not exists reservas_pension_idx
  on public.reservas (pension_id);

-- ---------------------------------------------------------------------------
-- 3) Privilegios y RLS
--
--    Dos capas, y las dos hacen falta:
--      · Los GRANT deciden qué puede intentar cada rol.
--      · Las POLÍTICAS deciden qué filas ve.
--
--    `anon` no recibe ningún privilegio: una reserva tiene nombre y contacto de
--    un estudiante, y no hay ninguna razón para que el visitante pueda leer ni
--    escribir aquí.
--
--    `authenticated` recibe SOLO `select`: el anfitrión necesita ver sus
--    reservas y no necesita escribirlas. La escritura va por las cuatro
--    funciones, que son `security definer` y validan dentro. Escribir una
--    reserva a mano es la forma más fácil de meter un reparto que no cuadre.
-- ---------------------------------------------------------------------------

alter table public.reservas enable row level security;

revoke all on table public.reservas from anon;
revoke all on table public.reservas from public;
grant select on table public.reservas to authenticated;

-- El maestro lo ve todo.
drop policy if exists "reservas: lectura del maestro o del anfitrion" on public.reservas;
create policy "reservas: lectura del maestro o del anfitrion"
  on public.reservas
  for select
  to authenticated
  using (
    public.es_maestro()
    or anfitrion_id = (select auth.uid())
  );

-- El maestro escribe todo. Se declara aunque hoy no haya `grant` de escritura:
-- si mañana se concede, la política ya está puesta y no queda una tabla abierta.
-- Con `(select auth.uid())` y no `auth.uid()`: Postgres lo evalúa una vez por
-- consulta, no una vez por fila (el aviso `auth_rls_initplan` de Supabase).
drop policy if exists "reservas: escritura del maestro" on public.reservas;
create policy "reservas: escritura del maestro"
  on public.reservas
  for all
  to authenticated
  using (public.es_maestro())
  with check (public.es_maestro());

-- NO hay política de escritura para el anfitrión. No es un olvido: el cierre de
-- la reserva lo lleva la plataforma (condiciones §2), y `marcar_habitacion_reservada`
-- ya es la herramienta del anfitrión para bloquear su habitación.

-- ---------------------------------------------------------------------------
-- 4) Las funciones: la única puerta de escritura
-- ---------------------------------------------------------------------------

-- --- 4.1 · Registrar -------------------------------------------------------
-- El reparto se calcula aquí y no se acepta del llamante. Es la misma
-- aritmética que `lib/pension.ts:126-137`: depósito 20 %, tarifa 10 % redondeada,
-- anticipo como RESTO (no otro 10 % redondeado). Con un canon que no sea
-- múltiplo de 10, dos redondeos por separado dejarían un peso suelto y la tabla
-- del sitio no cuadraría con la del contrato.

create or replace function public.registrar_reserva(
  p_habitacion_id       uuid,
  p_estudiante_nombre   text,
  p_estudiante_contacto text,
  p_canon_mensual       integer default null,
  p_estudiante_id       uuid    default null,
  p_fecha_entrada       date    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precio    integer;
  v_pension   uuid;
  v_anfitrion uuid;
  v_canon     integer;
  v_deposito  integer;
  v_tarifa    integer;
  v_anticipo  integer;
  v_habitacion_existe boolean;
  v_reserva_id uuid;
begin
  if not public.es_maestro() then
    raise exception 'Solo el equipo de Nido puede registrar una reserva.'
      using errcode = '42501';
  end if;

  select h.precio_mensual_cop, h.pension_id, p.anfitrion_id
    into v_precio, v_pension, v_anfitrion
    from public.habitaciones h
    join public.pensiones p on p.id = h.pension_id
   where h.id = p_habitacion_id;

  v_habitacion_existe := found;
  if not v_habitacion_existe then
    raise exception 'La habitación no existe.'
      using errcode = '22023';
  end if;

  -- Sin canon explícito se toma el precio de la habitación. Con canon explícito
  -- se respeta: es el precio pactado, y puede no coincidir con el publicado.
  v_canon := coalesce(p_canon_mensual, v_precio);

  if v_canon is null or v_canon < 1000 or v_canon > 20000000 then
    raise exception 'El canon debe estar entre 1000 y 20000000 COP.'
      using errcode = '22023';
  end if;

  v_deposito := round(v_canon * 0.2);
  v_tarifa   := round(v_canon * 0.1);
  v_anticipo := v_deposito - v_tarifa;

  insert into public.reservas (
    pension_id, habitacion_id, anfitrion_id,
    estudiante_id, estudiante_nombre, estudiante_contacto,
    canon_mensual, tarifa_servicio, anticipo, deposito, saldo_al_llegar,
    fecha_entrada, creada_por
  )
  values (
    v_pension, p_habitacion_id, v_anfitrion,
    p_estudiante_id,
    btrim(regexp_replace(coalesce(p_estudiante_nombre, ''), '\s+', ' ', 'g')),
    btrim(regexp_replace(coalesce(p_estudiante_contacto, ''), '\s+', ' ', 'g')),
    v_canon, v_tarifa, v_anticipo, v_deposito, v_canon - v_deposito,
    p_fecha_entrada, (select auth.uid())
  )
  returning id into v_reserva_id;

  return v_reserva_id;
end;
$$;

comment on function public.registrar_reserva(uuid, text, text, integer, uuid, date) is
  'Registra una reserva y calcula el Deposito de Reserva (20 %: 10 % tarifa + 10 % anticipo) a partir del canon. Solo maestro. No toca habitaciones: el bloqueo de la habitacion sigue siendo marcar_habitacion_reservada().';

-- --- 4.2 · Cambiar de estado ----------------------------------------------
-- Sin esta función, tres de los seis estados serían inalcanzables. Las
-- transiciones están escritas aquí, en un solo sitio, y no repartidas por el
-- panel.

create or replace function public.cambiar_estado_reserva(
  p_reserva_id uuid,
  p_estado     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual text;
begin
  if not public.es_maestro() then
    raise exception 'Solo el equipo de Nido puede cambiar el estado de una reserva.'
      using errcode = '42501';
  end if;

  select estado into v_actual
    from public.reservas
   where id = p_reserva_id
   for update;

  if not found then
    raise exception 'La reserva no existe.'
      using errcode = '22023';
  end if;

  -- `cancelada` no se alcanza por aquí: tiene su propia función, porque
  -- cancelar exige motivo y, casi siempre, un importe devuelto. Dos caminos al
  -- mismo estado acabarían en dos formas distintas de registrarlo.
  if not (
       (v_actual = 'pendiente'  and p_estado in ('confirmada'))
    or (v_actual = 'confirmada' and p_estado in ('en_curso', 'no_presentado'))
    or (v_actual = 'en_curso'   and p_estado in ('completada'))
  ) then
    raise exception 'Transición no permitida: % → %.', v_actual, p_estado
      using errcode = '22023';
  end if;

  update public.reservas
     set estado = p_estado,
         -- El depósito queda retenido en el momento en que se confirma el pago
         -- y no antes. Se sella una sola vez: si ya tenía fecha, no se pisa.
         retenido_en = case
                         when p_estado = 'confirmada' and retenido_en is null then now()
                         else retenido_en
                       end,
         -- Y en ese mismo instante sale el anticipo hacia el propietario: es la
         -- regla decidida (ver la cabecera). Confirmar el pago ES la orden de
         -- transferir, así que no depende de que alguien llame después a
         -- `liberar_deposito` y se acuerde. Se sella una sola vez, igual que
         -- `retenido_en`: un reintento no reescribe la fecha del hecho.
         liberado_en = case
                         when p_estado = 'confirmada' and liberado_en is null then now()
                         else liberado_en
                       end,
         liberado_motivo = case
                             when p_estado = 'confirmada' then coalesce(liberado_motivo, 'traslado_inmediato')
                             else liberado_motivo
                           end
   where id = p_reserva_id;
 end;
 $$;

comment on function public.cambiar_estado_reserva(uuid, text) is
  'Aplica una transicion valida del estado de una reserva (pendiente→confirmada→en_curso→completada, o confirmada→no_presentado). Al confirmar sella retenido_en Y liberado_en (regla traslado_inmediato: el anticipo va al propietario en cuanto se paga). Cancelar no se hace por aqui.';

-- --- 4.3 · Liberar el depósito (camino manual) -----------------------------
-- `liberado_en` significa «el dinero dejó de estar retenido por la plataforma».
--
-- Con la regla vigente, la vía normal ya no es esta función: al confirmar el
-- pago, `cambiar_estado_reserva` sella las dos fechas. `liberar_deposito` queda
-- para tres casos concretos y honestos:
--
--   · corregir una reserva confirmada antes de esta regla, que quedó sin fecha;
--   · dejar constancia de una retención pactada con el propietario
--     (`confirmacion_llegada`), que es una excepción y tiene que verse como tal;
--   · reintentar sin riesgo: es idempotente y no reescribe la fecha original.
--
-- El valor por defecto es traslado_inmediato porque un operador que llama sin
-- pensar no puede estar diciendo lo contrario de la regla.

create or replace function public.liberar_deposito(
  p_reserva_id uuid,
  p_motivo     text default 'traslado_inmediato'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado     text;
  v_liberado   timestamptz;
  v_retenido   timestamptz;
begin
  if not public.es_maestro() then
    raise exception 'Solo el equipo de Nido puede liberar un depósito.'
      using errcode = '42501';
  end if;

  if p_motivo not in ('traslado_inmediato', 'confirmacion_llegada') then
    raise exception 'Motivo de liberación no válido: use traslado_inmediato o confirmacion_llegada.'
      using errcode = '22023';
  end if;

  select estado, liberado_en, retenido_en
    into v_estado, v_liberado, v_retenido
    from public.reservas
   where id = p_reserva_id
   for update;

  if not found then
    raise exception 'La reserva no existe.'
      using errcode = '22023';
  end if;

  -- Idempotente por diseño: liberar dos veces no reescribe la fecha original.
  -- La primera liberación es el hecho; la segunda es un reintento del operador.
  if v_liberado is not null then
    return;
  end if;

  if v_retenido is null then
    raise exception 'No se puede liberar un depósito que todavía no se ha retenido (estado %).', v_estado
      using errcode = '22023';
  end if;

  if v_estado = 'cancelada' then
    raise exception 'Una reserva cancelada no libera depósito: se reembolsa. Use cancelar_reserva o registre el reembolso.'
      using errcode = '22023';
  end if;

  update public.reservas
     set liberado_en = now(),
         liberado_motivo = p_motivo
   where id = p_reserva_id;
end;
$$;

comment on function public.liberar_deposito(uuid, text) is
  'Camino manual para sellar liberado_en. Con la regla vigente ya lo hace cambiar_estado_reserva al confirmar el pago; queda para corregir registros anteriores o dejar constancia de una retencion pactada. Por defecto traslado_inmediato. Idempotente: no reescribe la fecha original.';

-- --- 4.4 · Cancelar -------------------------------------------------------
-- Guarda el hecho y el importe devuelto. NO decide cuánto se devuelve: las
-- reglas de §5 de las condiciones cambian con la causa y con los días de
-- anticipación, y una tabla que calcule eso se queda obsoleta el día que el
-- texto cambie. Aquí se registra lo que se decidió; la decisión se toma leyendo
-- la política.

create or replace function public.cancelar_reserva(
  p_reserva_id      uuid,
  p_motivo          text,
  p_reembolsado_cop integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado   text;
  v_deposito integer;
begin
  if not public.es_maestro() then
    raise exception 'Solo el equipo de Nido puede cancelar una reserva.'
      using errcode = '42501';
  end if;

  if p_motivo is null
     or p_motivo not in ('estudiante_ordinaria', 'fuerza_mayor', 'propietario', 'no_presentado', 'otro') then
    raise exception 'Motivo de cancelación no válido.'
      using errcode = '22023';
  end if;

  select estado, deposito
    into v_estado, v_deposito
    from public.reservas
   where id = p_reserva_id
   for update;

  if not found then
    raise exception 'La reserva no existe.'
      using errcode = '22023';
  end if;

  if v_estado not in ('pendiente', 'confirmada', 'en_curso') then
    raise exception 'Solo se cancela una reserva vigente. Esta está en estado %.', v_estado
      using errcode = '22023';
  end if;

  if p_reembolsado_cop is null or p_reembolsado_cop < 0 then
    raise exception 'El importe reembolsado no puede ser negativo.'
      using errcode = '22023';
  end if;

  if p_reembolsado_cop > v_deposito then
    raise exception 'El reembolso (%) no puede superar el depósito cobrado (%).', p_reembolsado_cop, v_deposito
      using errcode = '22023';
  end if;

  update public.reservas
     set estado              = 'cancelada',
         cancelada_en        = now(),
         motivo_cancelacion  = p_motivo,
         reembolsado_cop     = p_reembolsado_cop,
         reembolsado_en      = case when p_reembolsado_cop > 0 then now() else null end
   where id = p_reserva_id;
end;
$$;

comment on function public.cancelar_reserva(uuid, text, integer) is
  'Anula una reserva vigente con su motivo y el importe efectivamente devuelto. No calcula el reembolso: lo registra. La regla vive en condiciones de uso 5 y en la politica de reembolsos.';

-- --- 4.5 · Permisos de las cuatro -----------------------------------------
-- `security definer` no basta como permiso: sin estos `revoke`, `anon` podría
-- invocarlas. El control de rol está dentro de cada una, y esto lo repite por
-- fuera.

revoke all on function public.registrar_reserva(uuid, text, text, integer, uuid, date) from public;
revoke all on function public.registrar_reserva(uuid, text, text, integer, uuid, date) from anon, authenticated;
grant  execute on function public.registrar_reserva(uuid, text, text, integer, uuid, date) to authenticated;

revoke all on function public.cambiar_estado_reserva(uuid, text) from public;
revoke all on function public.cambiar_estado_reserva(uuid, text) from anon, authenticated;
grant  execute on function public.cambiar_estado_reserva(uuid, text) to authenticated;

revoke all on function public.liberar_deposito(uuid, text) from public;
revoke all on function public.liberar_deposito(uuid, text) from anon, authenticated;
grant  execute on function public.liberar_deposito(uuid, text) to authenticated;

revoke all on function public.cancelar_reserva(uuid, text, integer) from public;
revoke all on function public.cancelar_reserva(uuid, text, integer) from anon, authenticated;
grant  execute on function public.cancelar_reserva(uuid, text, integer) to authenticated;

commit;

-- ============================================================================
-- 5) Verificación · ejecutar después y comparar con lo esperado
-- ============================================================================
--
-- V.1 · La tabla existe, con RLS activo y dos políticas
--
--   select c.relname,
--          c.relrowsecurity as rls_activo,
--          (select count(*) from pg_policies p
--            where p.schemaname = 'public' and p.tablename = c.relname) as politicas
--     from pg_class c
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relname = 'reservas';
--
--   Esperado: 1 fila · `reservas` · `t` · `2`
--
-- V.2 · `anon` no puede hacer NADA con la tabla
--
--   select pg_catalog.has_table_privilege('anon', 'public.reservas', 'SELECT') as anon_select,
--          pg_catalog.has_table_privilege('anon', 'public.reservas', 'INSERT') as anon_insert,
--          pg_catalog.has_table_privilege('anon', 'public.reservas', 'UPDATE') as anon_update,
--          pg_catalog.has_table_privilege('anon', 'public.reservas', 'DELETE') as anon_delete;
--
--   Esperado: f | f | f | f
--
-- V.3 · `authenticated` solo lee
--
--   select pg_catalog.has_table_privilege('authenticated', 'public.reservas', 'SELECT') as auth_select,
--          pg_catalog.has_table_privilege('authenticated', 'public.reservas', 'INSERT') as auth_insert,
--          pg_catalog.has_table_privilege('authenticated', 'public.reservas', 'UPDATE') as auth_update,
--          pg_catalog.has_table_privilege('authenticated', 'public.reservas', 'DELETE') as auth_delete;
--
--   Esperado: t | f | f | f
--
-- V.4 · Las cuatro funciones existen, son `security definer` y `anon` no las ve
--
--   select p.oid::regprocedure as firma,
--          p.prosecdef as security_definer,
--          pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')           as anon_puede,
--          pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')  as auth_puede
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('registrar_reserva', 'cambiar_estado_reserva',
--                        'liberar_deposito', 'cancelar_reserva')
--    order by p.proname;
--
--   Esperado: 4 filas · `t` en las cuatro de `security_definer` · `f` · `t`
--
-- V.5 · El índice de una sola reserva vigente por habitación existe
--
--   select indexname, indexdef
--     from pg_indexes
--    where schemaname = 'public' and tablename = 'reservas'
--    order by indexname;
--
--   Esperado: `reservas_habitacion_vigente_uk` con `WHERE (estado = ANY (...))`,
--             más `reservas_anfitrion_idx`, `reservas_creada_en_idx`,
--             `reservas_pension_idx` y `reservas_pkey`.
--
-- V.6 · La clave anónima no ve nada (sonda desde fuera, con `.env.local`)
--
--   GET /rest/v1/reservas?select=id
--   Esperado: `401` `42501`. Nunca un `200`.
--
-- V.7 · La regla del anticipo quedó cableada, no solo escrita en un comentario
--
--   select pg_catalog.pg_get_function_arguments(
--            'public.liberar_deposito(uuid, text)'::regprocedure) as argumentos;
--   Esperado: `p_reserva_id uuid, p_motivo text DEFAULT 'traslado_inmediato'::text`
--   Si dijera `confirmacion_llegada`, la 20 se aplicó con la versión anterior.
--
--   Y en la prueba funcional de §6, después de confirmar, esto tiene que dar
--   dos fechas no nulas, idénticas, y el motivo correcto:
--
--   select retenido_en is not null as retenido,
--          liberado_en  is not null as liberado,
--          liberado_en = retenido_en as mismo_instante,
--          liberado_motivo
--     from public.reservas order by creada_en desc limit 1;
--   Esperado: `t` · `t` · `t` · `traslado_inmediato`
--
--   `mismo_instante` sale `t` porque `now()` es fijo dentro de la transacción:
--   confirmar el pago y ordenar la transferencia son un solo acto.
--
-- ============================================================================
-- 6) Prueba funcional · OPCIONAL, escribe y deshace
-- ============================================================================
--
--   En el editor SQL `auth.uid()` es nulo, así que `es_maestro()` devuelve
--   falso y las cuatro funciones rechazan la llamada. Para probarlas hay que
--   ponerse en la piel de una sesión. Este bloque lo hace y **deshace todo**:
--   termina en `rollback`, así que no deja ni una fila.
--
--   begin;
--     select set_config('request.jwt.claims',
--       json_build_object('sub', (select id from public.usuarios where rol = 'maestro' limit 1))::text,
--       true);
--     set local role authenticated;
--
--     -- una habitación real, la más barata disponible
--     select public.registrar_reserva(
--              (select h.id from public.habitaciones h
--                where h.disponible order by h.precio_mensual_cop limit 1),
--              'Prueba Nido', '573000000000', null, null, current_date + 20);
--
--     select canon_mensual, tarifa_servicio, anticipo, deposito, saldo_al_llegar, estado
--       from public.reservas order by creada_en desc limit 1;
--     -- Esperado con un canon de 700000: 700000 | 70000 | 70000 | 140000 | 560000 | pendiente
--     -- Y las cuentas cierran: 70000 + 70000 = 140000 · 140000 + 560000 = 700000
--
--     -- La segunda reserva de la MISMA habitación tiene que fallar:
--     select public.registrar_reserva(
--              (select h.id from public.habitaciones h
--                where h.disponible order by h.precio_mensual_cop limit 1),
--              'Prueba Dos', '573000000001', null, null, current_date + 25);
--     -- Esperado: ERROR 23505 «duplicate key value violates unique constraint
--     --          reservas_habitacion_vigente_uk»
--
--     -- Transición válida y transición inválida:
--     select public.cambiar_estado_reserva(
--              (select id from public.reservas order by creada_en desc limit 1), 'confirmada');
--
--     -- Aquí se ve la regla del anticipo (V.7): al confirmar el pago quedan
--     -- selladas las dos fechas y el motivo es traslado_inmediato.
--     select retenido_en is not null as retenido,
--            liberado_en  is not null as liberado,
--            liberado_en = retenido_en as mismo_instante,
--            liberado_motivo
--       from public.reservas order by creada_en desc limit 1;
--     -- Esperado: t | t | t | traslado_inmediato
--
--     select public.cambiar_estado_reserva(
--              (select id from public.reservas order by creada_en desc limit 1), 'completada');
--     -- Esperado: ERROR 22023 «Transición no permitida: confirmada → completada.»
--
--   rollback;
--
--   Si algo de esto no cuadra, no se ha roto nada: el `rollback` lo deshace.
--
-- ============================================================================
-- 7) Lo que queda pendiente, y no se resuelve aquí
-- ============================================================================
--
--   1. RECUPERAR EL ANTICIPO DEL PROPIETARIO. Con la regla vigente, confirmar
--      el pago transfiere el 10 % al propietario para que guarde el cupo. Si el
--      estudiante cancela después con derecho a que se le devuelva ese 10 %,
--      Nido tiene que recuperarlo primero del propietario. Aquí solo se registra
--      lo devuelto al estudiante (`reembolsado_cop`); el estado de esa
--      recuperación no tiene tabla. Se cubre con el acuerdo escrito con el
--      propietario (reintegrar en X días hábiles si hay cancelación con
--      derecho). Si con varios propietarios hace falta seguirlo, toca una tabla
--      de eventos, no una columna más.
--   2. QUIÉN CONFIRMA LA LLEGADA. Hoy `en_curso` lo marca el maestro a mano.
--      Si algún día lo marca el estudiante, hace falta una función distinta y
--      una política para `authenticated` acotada a su propia reserva.
--   3. EL COBRO. No hay pasarela. Cuando la haya, el evento «pago confirmado»
--      pasará a `confirmada` en lugar de que lo haga una persona.
--   4. EL HISTORIAL DE CAMBIOS. Esta tabla guarda el estado actual; si se quiere
--      saber quién cambió qué y cuándo, hace falta una tabla de eventos. Hoy
--      `creada_por` y las fechas cubren lo mínimo auditable; no lo cubren todo.
--   5. EL PANEL. No hay pantalla que llame a estas funciones. Hasta que exista,
--      las reservas se registran desde el editor SQL.
