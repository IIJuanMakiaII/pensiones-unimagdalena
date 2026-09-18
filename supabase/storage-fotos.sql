-- ============================================================================
-- Almacenamiento de fotos de las pensiones (Supabase Storage)
-- Ejecutar DESPUÉS de esquema.sql. Es idempotente: se puede repetir sin riesgo.
--
-- Convención de ruta dentro del bucket:
--   fotos-pensiones/<uid del anfitrión>/<archivo>.jpg
-- Así cada anfitrión solo puede escribir (y borrar) en su propia carpeta.
-- ============================================================================

-- 1) Bucket de lectura pública, con límites de tamaño y de tipo de archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-pensiones',
  'fotos-pensiones',
  true,
  5242880, -- 5 MB por archivo (el navegador comprime antes de subir)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) Políticas de acceso a los objetos.
--    Las fotos de un anuncio son públicas (el catálogo lo es),
--    pero solo su dueño puede subirlas, reemplazarlas o borrarlas.

drop policy if exists "fotos: lectura publica" on storage.objects;
create policy "fotos: lectura publica"
  on storage.objects for select
  using (bucket_id = 'fotos-pensiones');

drop policy if exists "fotos: subir en carpeta propia" on storage.objects;
create policy "fotos: subir en carpeta propia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos-pensiones'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "fotos: actualizar las propias" on storage.objects;
create policy "fotos: actualizar las propias"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'fotos-pensiones'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "fotos: borrar las propias" on storage.objects;
create policy "fotos: borrar las propias"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fotos-pensiones'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
