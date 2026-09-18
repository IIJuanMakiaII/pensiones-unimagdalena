-- ============================================================================
-- Esquema de Supabase — Marketplace de pensiones (Santa Marta)
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- Es idempotente: se puede ejecutar más de una vez sin romper nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) usuarios: perfil vinculado 1:1 con auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nombre text not null,
  rol text not null default 'anfitrion' check (rol in ('estudiante', 'anfitrion')),
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) pensiones: esquema solicitado + campos de experiencia de la interfaz
--    (barrio, distancia, normas, calificación y verificación ya se usan en el
--     catálogo, los filtros y los sellos de confianza).
-- ---------------------------------------------------------------------------
create table if not exists public.pensiones (
  id uuid primary key default gen_random_uuid(),
  anfitrion_id uuid not null references public.usuarios(id) on delete cascade,
  titulo text not null,
  descripcion text not null default '',
  -- Columna en snake_case (PostgreSQL no admite camelCase sin comillas);
  -- la interfaz la expone como `precioMensual`.
  precio_mensual integer not null default 0 check (precio_mensual >= 0),
  direccion text not null default '',
  barrio text not null default '',
  distancia_a_pie_minutos smallint not null default 10
    check (distancia_a_pie_minutos between 0 and 120),
  servicios text[] not null default '{}',
  normas text[] not null default '{}',
  imagenes text[] not null default '{}',
  -- Puntaje interno del equipo (0–5). No son reseñas de usuarios: no se declara
  -- como aggregateRating en el JSON-LD para no infringir las guías de Google.
  calificacion numeric(2, 1) not null default 0 check (calificacion between 0 and 5),
  verificado boolean not null default false,
  -- Ubicación exacta (opcional): si está, el mapa del detalle muestra el pin real
  latitud double precision,
  longitud double precision,
  activa boolean not null default true,
  creada_en timestamptz not null default now()
);

create index if not exists pensiones_anfitrion_idx on public.pensiones (anfitrion_id);
create index if not exists pensiones_catalogo_idx on public.pensiones (activa, creada_en desc);

-- ---------------------------------------------------------------------------
-- 3) habitaciones: relación 1-N con pensiones
-- ---------------------------------------------------------------------------
create table if not exists public.habitaciones (
  id uuid primary key default gen_random_uuid(),
  pension_id uuid not null references public.pensiones(id) on delete cascade,
  tipo text not null default 'individual'
    check (tipo in ('individual', 'compartida', 'matrimonial')),
  genero text not null default 'mixto'
    check (genero in ('mixto', 'femenino', 'masculino')),
  precio_mensual_cop integer not null default 0 check (precio_mensual_cop >= 0),
  alimentacion_incluida boolean not null default false,
  disponible boolean not null default true,
  creada_en timestamptz not null default now()
);

create index if not exists habitaciones_pension_idx on public.habitaciones (pension_id, disponible);

-- ---------------------------------------------------------------------------
-- 4) Perfil automático al registrarse (auth.users → public.usuarios)
-- ---------------------------------------------------------------------------
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data ->> 'rol' in ('estudiante', 'anfitrion')
        then new.raw_user_meta_data ->> 'rol'
      else 'anfitrion'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- La función existe solo para el trigger. El asesor de seguridad de Supabase
-- advierte que, si no se revoca, cualquier visitante podría invocarla por RPC
-- (`/rest/v1/rpc/crear_perfil_usuario`) al ser SECURITY DEFINER. El trigger
-- sigue funcionando porque se ejecuta con los permisos del dueño de la tabla.
revoke execute on function public.crear_perfil_usuario() from public;
revoke execute on function public.crear_perfil_usuario() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Row Level Security: lectura pública del catálogo activo, escritura propia
--
-- Nota de rendimiento: las políticas usan `(select auth.uid())` en lugar de
-- `auth.uid()` para que Postgres lo evalúe UNA vez por consulta y no una vez
-- por fila (aviso `auth_rls_initplan` del asesor de Supabase).
-- ---------------------------------------------------------------------------
alter table public.usuarios enable row level security;
alter table public.pensiones enable row level security;
alter table public.habitaciones enable row level security;

-- usuarios
drop policy if exists "usuarios: leer el propio" on public.usuarios;
create policy "usuarios: leer el propio" on public.usuarios
  for select using ((select auth.uid()) = id);

drop policy if exists "usuarios: actualizar el propio" on public.usuarios;
create policy "usuarios: actualizar el propio" on public.usuarios
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- pensiones
drop policy if exists "pensiones: lectura publica de activas" on public.pensiones;
create policy "pensiones: lectura publica de activas" on public.pensiones
  for select using (activa or (select auth.uid()) = anfitrion_id);

drop policy if exists "pensiones: crear las propias" on public.pensiones;
create policy "pensiones: crear las propias" on public.pensiones
  for insert with check ((select auth.uid()) = anfitrion_id);

drop policy if exists "pensiones: editar las propias" on public.pensiones;
create policy "pensiones: editar las propias" on public.pensiones
  for update using ((select auth.uid()) = anfitrion_id) with check ((select auth.uid()) = anfitrion_id);

drop policy if exists "pensiones: borrar las propias" on public.pensiones;
create policy "pensiones: borrar las propias" on public.pensiones
  for delete using ((select auth.uid()) = anfitrion_id);

-- habitaciones (el dueño se resuelve a través de la pensión)
drop policy if exists "habitaciones: lectura publica" on public.habitaciones;
create policy "habitaciones: lectura publica" on public.habitaciones
  for select using (
    exists (
      select 1 from public.pensiones p
      where p.id = habitaciones.pension_id
        and (p.activa or p.anfitrion_id = (select auth.uid()))
    )
  );

drop policy if exists "habitaciones: crear las propias" on public.habitaciones;
create policy "habitaciones: crear las propias" on public.habitaciones
  for insert with check (
    exists (
      select 1 from public.pensiones p
      where p.id = habitaciones.pension_id and p.anfitrion_id = (select auth.uid())
    )
  );

drop policy if exists "habitaciones: editar las propias" on public.habitaciones;
create policy "habitaciones: editar las propias" on public.habitaciones
  for update using (
    exists (
      select 1 from public.pensiones p
      where p.id = habitaciones.pension_id and p.anfitrion_id = (select auth.uid())
    )
  );

drop policy if exists "habitaciones: borrar las propias" on public.habitaciones;
create policy "habitaciones: borrar las propias" on public.habitaciones
  for delete using (
    exists (
      select 1 from public.pensiones p
      where p.id = habitaciones.pension_id and p.anfitrion_id = (select auth.uid())
    )
  );

-- ============================================================================
-- Listo. Verificación rápida:
--   select count(*) from public.pensiones;      -- debe funcionar (0 al inicio)
--   select * from public.pensiones;             -- lectura anónima permitida si activa = true
-- ============================================================================
