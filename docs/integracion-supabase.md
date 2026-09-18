# Integración con Supabase — del catálogo estático al sistema dinámico

**Pensiones Unimagdalena** · Next.js 14 (App Router) + TypeScript + Tailwind + Supabase

---

## 1. Qué cambió

| Antes | Ahora |
|---|---|
| Catálogo estático en `lib/datos.ts` | Consultas a Supabase (`lib/datos.ts` → `obtenerPensiones()`) |
| Sin usuarios | Modelo `Usuario` + `auth.users` de Supabase |
| Sin autenticación | Middleware que protege `/publicar`, login y registro |
| Sin publicación | Formulario + Server Action `crearPension` con validación estricta |
| Rutas estáticas prerenderizadas | Catálogo y detalle revalidados cada 60 s (ISR) |

**Dos modos de funcionamiento, sin romper nada:**

| Modo | Cuándo | Qué muestra |
|---|---|---|
| **Demo** | Sin credenciales en `.env.local` | Catálogo semilla de 6 pensiones (`lib/datos.semilla.ts`) |
| **Dinámico** | Credenciales válidas | Datos reales de Supabase + publicación de anfitriones |

> Si Supabase falla o no está configurado, la app **cae automáticamente al catálogo semilla**. El sitio nunca queda vacío ni con error.

---

## 2. Puesta en marcha (10 minutos)

### Paso 1 — Crear el proyecto en Supabase
1. Entra a **supabase.com** → *New project* (plan gratuito).
2. Espera a que termine de aprovisionar.
3. Ve a **Project Settings → API** y copia:
   - `Project URL` (ej. `https://abcd1234.supabase.co`)
   - `anon public` key

### Paso 2 — Pegar las credenciales
Edita `.env.local` en la raíz del proyecto y descomenta:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### Paso 3 — Crear las tablas
En Supabase: **SQL Editor → New query** → pega el contenido de
[`supabase/esquema.sql`](../supabase/esquema.sql) → **Run**.

Esto crea:
- `usuarios` (perfil vinculado a `auth.users`)
- `pensiones` (con `anfitrion_id` como clave foránea)
- `habitaciones` (relación 1-N con `pension_id`)
- Índices, políticas **RLS** y el trigger que crea el perfil al registrarse

### Paso 4 — (Opcional) Cargar el catálogo de ejemplo
Regístrate primero en `/registro` y luego ejecuta
[`supabase/datos-ejemplo.sql`](../supabase/datos-ejemplo.sql): inserta las 6 pensiones y
sus 16 habitaciones reales del catálogo demo, asignadas a tu primer anfitrión.

### Paso 5 — Reiniciar y probar
```bash
npm run dev
```
1. Abre `/registro` → crea tu cuenta de anfitrión.
2. Ve a `/publicar` → llena el formulario → **Publicar pensión**.
3. Vuelve al catálogo (`/`) → tu pensión aparece en la lista y en su ficha.

Si tu proyecto exige confirmación por correo, revisa el email antes de iniciar sesión
(se puede desactivar en Supabase → Authentication → Providers → Email).

---

## 3. Archivos de la integración

| Archivo | Responsabilidad |
|---|---|
| `middleware.ts` | Protege `/publicar`; redirige a `/login?destino=…` sin sesión |
| `utils/supabase/middleware.ts` | Refresca la sesión en cada petición (patrón oficial `@supabase/ssr`) |
| `utils/supabase/server.ts` | Cliente para Server Components y Server Actions |
| `utils/supabase/client.ts` | Cliente para el navegador (login y registro) |
| `lib/supabase/config.ts` | Detecta si Supabase está configurado (evita fallos silenciosos) |
| `lib/supabase/mapeo.ts` | Convierte filas SQL (snake_case) al modelo de dominio |
| `lib/datos.ts` | Consultas: `obtenerPensiones`, `obtenerPensionPorId`, `obtenerPensionesDelAnfitrion` |
| `lib/datos.semilla.ts` | Catálogo semilla del modo demo |
| `lib/pension.ts` | Reglas de negocio (imagen principal, precio "desde", disponibilidad) |
| `app/actions/pensiones.ts` | Server Action `crearPension` con validación |
| `components/FormularioPension.tsx` | Formulario de publicación (`useFormState` + `useFormStatus`) |
| `app/publicar/page.tsx` | Panel del anfitrión (ruta protegida) |
| `app/login` · `app/registro` · `app/auth/signout` | Autenticación |
| `supabase/esquema.sql` · `supabase/datos-ejemplo.sql` | Esquema y datos de ejemplo |

---

## 4. Decisiones de diseño (y por qué)

**Modelo híbrido en `pensiones`.** El esquema que pediste (`titulo`, `descripcion`,
`precioMensual`, `direccion`, `servicios`, `imagenes`, `activa`, `creada_en`) está completo,
y se conservaron cinco campos que la interfaz ya usaba: `barrio`,
`distancia_a_pie_minutos`, `normas`, `calificacion` y `verificado`. Sin ellos se habrían
roto los filtros por distancia, los sellos de verificación, las calificaciones y la
página de detalle. Los nuevos campos permiten además mostrar `descripcion` y la dirección real.

**`precio_mensual` en la base, `precioMensual` en TypeScript.** PostgreSQL no admite
camelCase sin comillas dobles; `lib/supabase/mapeo.ts` hace la traducción en un único punto.

**Identidad desde la sesión, nunca desde el formulario.** `crearPension` obtiene el usuario
con `supabase.auth.getUser()` en el servidor: nadie puede publicar a nombre de otro anfitrión.

**RLS activo.** Lectura pública solo de pensiones `activa = true`; cada anfitrión solo puede
crear, editar y borrar lo suyo. Las habitaciones heredan el permiso de su pensión.

**Cierre de sesión por POST.** Solo `POST /auth/signout` cierra la sesión, para que un enlace
externo no pueda hacerlo.

**Degradación segura.** Si Supabase no está configurado o falla, la web sigue funcionando
con el catálogo semilla y `/publicar` explica cómo activar el modo dinámico.

---

## 5. Copia de seguridad y reversión

Antes de esta integración se creó un respaldo completo del proyecto:

```
backups/pensiones-unimagdalena_2026-09-13_2152/       (605+ archivos, fuente completa)
backups/pensiones-unimagdalena_2026-09-13_2152.zip    (1,15 MB)
```

Para volver al estado anterior (catálogo estático, sin Supabase):

```powershell
# 1. Copia el backup sobre el proyecto (sin node_modules ni .next: se regeneran)
robocopy "..\backups\pensiones-unimagdalena_2026-09-13_2152" . /E /XD node_modules .next
# Alternativa: descomprimir el .zip y reemplazar la carpeta
npm install
npm run build
```

> La forma más simple de "volver atrás" sin tocar archivos: **comenta** las dos variables de
> Supabase en `.env.local`. La app entra en modo demo y se comporta como antes.

---

## 6. Solución de problemas

| Síntoma | Causa y solución |
|---|---|
| `/publicar` muestra "Modo dinámico pendiente" | Faltan las credenciales en `.env.local` o el servidor no se reinició |
| El registro dice "Confirma tu correo" | Tu proyecto exige confirmación: revisa el email, o desactívala en Authentication → Providers → Email |
| Error al publicar: "Verifica las tablas y políticas" | No ejecutaste `supabase/esquema.sql`, o el usuario no tiene fila en `usuarios` |
| El catálogo sigue mostrando los datos demo | `NEXT_PUBLIC_SUPABASE_URL` mal copiada (debe empezar por `https://`) |
| La pensión publicada no aparece | `activa` debe ser `true`; revisa también los filtros del catálogo |

---

## 7. Rendimiento y SEO

- El catálogo y las fichas se **revalidan cada 60 s** (`export const revalidate = 60`):
  una publicación nueva aparece sin reconstruir el sitio.
- Los datos estructurados (`ItemList` + `LodgingBusiness`) siguen generándose, ahora con la
  lista real de pensiones.
- `/login`, `/registro` y `/publicar` van con `robots: noindex` para no competir en buscadores.

---

# Anexo — Estado del proyecto Supabase (2026-09-17)

El backend **ya está creado y verificado**. No hay que repetir ningún paso manual.

| Dato | Valor |
|---|---|
| Proyecto | `pensiones-unimagdalena` |
| Referencia | `ayznnqkacpdvvufclhon` |
| Región | `us-east-1` (menor latencia desde Colombia) |
| Plan | Gratuito ($0/mes) |
| URL de API | `https://ayznnqkacpdvvufclhon.supabase.co` |
| Credenciales | Ya escritas en `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |

## Esquema aplicado

Migraciones ejecutadas: `esquema_inicial` y `endurecimiento_rls`.

| Objeto | Estado verificado |
|---|---|
| `public.usuarios` | creada · RLS activo · 2 políticas |
| `public.pensiones` | creada · RLS activo · 4 políticas |
| `public.habitaciones` | creada · RLS activo · 4 políticas |
| Trigger `al_crear_usuario` | crea el perfil al registrarse |
| Avisos de seguridad de Supabase | **0** (se revocó `EXECUTE` de la función de trigger) |
| Avisos de rendimiento | solo 2 índices aún sin uso (normal con la base vacía) |

Las políticas usan `(select auth.uid())` para que Postgres lo evalúe una vez por
consulta y no una vez por fila (aviso `auth_rls_initplan`).

## Verificación reproducible

```bash
node scripts/verificar-supabase.mjs   # auditoría de exposición REST con la clave pública
```

Resultado esperado (y obtenido):

```
OK    pensiones      HTTP 200 · filas: 0     catálogo público (solo anuncios activos)
OK    habitaciones   HTTP 200 · filas: 0     habitaciones de anuncios activos
OK    usuarios       HTTP 200 · filas: 0     perfiles: un anónimo no ve NINGUNA fila
```

Esto confirma que la clave pública **no** permite leer perfiles: RLS está haciendo
su trabajo.

## Pasos que solo puede hacer el dueño del proyecto (en el panel de Supabase)

Enlaces directos del proyecto `ayznnqkacpdvvufclhon`:

| Ajuste | Enlace | Recomendación |
|---|---|---|
| Confirmación de correo | `https://supabase.com/dashboard/project/ayznnqkacpdvvufclhon/auth/providers` | **Activar** "Confirm email": es lo que hace efectiva la protección anti-abuso del código |
| URLs de autenticación | `https://supabase.com/dashboard/project/ayznnqkacpdvvufclhon/auth/url-configuration` | Site URL `http://localhost:3000` y añadir el dominio de producción |
| Usuarios | `https://supabase.com/dashboard/project/ayznnqkacpdvvufclhon/auth/users` | Aquí se puede confirmar un correo a mano si el email no llega (el SMTP integrado tiene límite de envíos) |

## Después de registrar la primera cuenta de anfitrión

```sql
-- Carga las 6 pensiones de ejemplo en la base REAL (toma el primer anfitrión)
-- Ejecutar en: Supabase → SQL Editor → New query
-- Contenido: supabase/datos-ejemplo.sql
```

El archivo `supabase/datos-ejemplo.sql` es idempotente: si ya existen anuncios con
esos títulos, no los duplica.

---

# Anexo — Fotos en Supabase Storage (2026-09-17)

Antes, publicar exigía **pegar enlaces** de fotos y solo se aceptaban hosts de confianza. Eso era
fricción real para el usuario final (muchos solo tienen las fotos en la galería del celular) y
generaba rechazos como *"Estos enlaces de foto no están permitidos"*.

Ahora la vía principal es **subir la foto desde el dispositivo**.

## Configuración aplicada

Migración `storage_fotos` (archivo reproducible: `supabase/storage-fotos.sql`):

| Objeto | Configuración |
|---|---|
| Bucket `fotos-pensiones` | `public = true`, `file_size_limit = 5242880` (5 MB), `allowed_mime_types = image/jpeg, image/png, image/webp` |
| Política `fotos: lectura publica` | SELECT para cualquiera (el catálogo es público) |
| Política `fotos: subir en carpeta propia` | INSERT solo para `authenticated` y solo si `(storage.foldername(name))[1] = auth.uid()` |
| Política `fotos: actualizar las propias` | UPDATE con la misma regla de carpeta |
| Política `fotos: borrar las propias` | DELETE con la misma regla de carpeta |

La regla de carpeta es la clave: **un anfitrión no puede escribir en la carpeta de otro**, aunque
tenga una sesión válida y la clave pública.

## Cómo funciona en la app

1. `components/SubidorFotos.tsx` (cliente): el usuario pulsa «Elegir fotos» y selecciona desde la
   galería o la cámara (`<input type="file" accept="image/*" multiple>`).
2. Cada foto se **reduce a 1600 px y se reconvierte a JPEG** en el navegador con `canvas`
   (`createImageBitmap` + `toBlob`): 5–8 MB de una foto de móvil quedan en ~300–600 KB. Esto también
   resuelve las fotos **HEIC de iPhone**, que Next no podría optimizar.
3. Se sube directo a Storage con la sesión del anfitrión (`supabase.storage.upload`), no a través del
   servidor: evita el límite de 1 MB de los Server Actions y ahorra ancho de banda.
4. La URL pública se agrega a la lista; el formulario la envía al servidor en un campo oculto
   (`name="imagenes"`), así que la Server Action y su validación siguen funcionando sin cambios.
5. El servidor valida de nuevo con `hostImagenPermitido()`: las URLs de Storage entran por
   `**.supabase.co`, ya permitido.

## Verificación

```bash
node scripts/verificar-storage.mjs
```

Comprueba tres cosas con la clave pública: subida a la carpeta propia (permitida), intento de subida
a la carpeta de otro (bloqueada) y lectura pública de la foto. Crea una cuenta temporal para hacerlo,
por lo que **se omite automáticamente cuando la confirmación de correo está activa** (para no enviar
correos a direcciones de terceros). En ese caso, la prueba real es subir una foto desde `/publicar`.

## Pendientes relacionados

- **Borrado de huérfanas**: si el anfitrión quita una foto de la lista antes de publicar, el archivo
  queda en Storage sin referencia. Se puede limpiar con una tarea programada.
- **Edición de anuncios**: hoy solo se crean publicaciones; editar y borrar anuncios (y sus fotos) es
  parte de la Oleada 1 del informe maestro.
