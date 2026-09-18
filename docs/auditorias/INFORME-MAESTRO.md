# INFORME MAESTRO — Auditoría integral del proyecto

**Pensiones Unimagdalena** · Marketplace de pensiones para estudiantes de la Universidad del Magdalena
Fecha: 2026-09-17 · Coordinación: Especialista en QA, SEO (Team Lead)

Cinco auditorías independientes, 84 hallazgos, 0 líneas de código modificadas.
Informes de origen: [seguridad-devops.md](seguridad-devops.md) · [datos-backend.md](datos-backend.md) · [ux-cro.md](ux-cro.md) · [tecnica-rendimiento.md](tecnica-rendimiento.md) · [seo-geo-qa.md](seo-geo-qa.md)

---

## 1. Resumen ejecutivo

**Veredicto: NO listo para producción con tráfico real.** La calidad del código es alta y está por encima de la media para su etapa — el problema no es cómo está construido, sino **cinco condiciones objetivas** que en un despliegue público se convierten en incidentes. Las cinco se cierran en **1–2 días de trabajo**.

| # | Bloqueante | Por qué impide lanzar | Fuente |
|---|---|---|---|
| 1 | **XSS almacenado vía JSON-LD** | Un anfitrión publica un título con `</script><script>…` y se ejecuta en el dominio de la marca para todos los visitantes. Sin CSP que lo contenga | [S-01](seguridad-devops.md) |
| 2 | **Optimizador de imágenes abierto + AVIF** | `remotePatterns: "**"` + AVIF + `next@14.2.35` activa la superficie exacta del advisory crítico (RCE no autenticado en la API de optimización). Mitigación: 15 minutos | [S-02](seguridad-devops.md) · [T-H01](tecnica-rendimiento.md) · [H-10](datos-backend.md) |
| 3 | **Sin control de abuso ni moderación** | Cualquiera se registra y publica directo al catálogo público e indexado. Con el punto 1, el catálogo es vector de distribución | [S-06](seguridad-devops.md) · [H-04](datos-backend.md) |
| 4 | **Datos ficticios en producción y IDs incompatibles** | Si Supabase falla, el estudiante ve 6 pensiones inventadas con WhatsApp real; y las URLs de la semilla (slugs) no existen en la base (UUID), así que cada enlace compartido cae al catálogo demo | [H-05](datos-backend.md) · [H-01](datos-backend.md) |
| 5 | **La publicación no crea habitaciones y el precio no cuadra** | Una pensión publicada desaparece del catálogo al filtrar por género o alimentación; y con filtros activos, el precio de la tarjeta no es el que se envía por WhatsApp | [H-06](datos-backend.md) · [H1](ux-cro.md) |

**Lo que no bloquea pero duele:** sin git ni CI ni una sola prueba automatizada; dominio canónico escrito en el código (canónicas a un dominio ajeno si cambia el despliegue); sin `robots.txt` ni `sitemap.xml`; sin cabeceras de seguridad.

**Verificado y en buen estado (no tocar):** motor de filtros realmente puro y testeable; contrato de tipos con traducción en un único punto; Server Components donde corresponde; caché ISR con cliente anónimo sin cookies y etiquetas; accesibilidad de base sólida; integridad de datos estructurados (sin reseñas inventadas); degradación segura sin credenciales.

```
✓ npm run build                    16 rutas, sin errores de tipos ni lint
✓ node scripts/verificar-seo.mjs   19/19 comprobaciones
✓ node scripts/verificar-contraste.mjs   16/16 combinaciones WCAG AA
```

---

## 2. Tabla única de hallazgos (deduplicada)

Consolidación de los 84 hallazgos de origen. Donde varios informes reportaron el mismo problema, se indica el origen múltiple.

| ID | Hallazgo consolidado | Sev. | Orígenes | Esf. | Oleada | ¿Bloquea? |
|---|---|---|---|---|---|---|
| **M-01** | XSS almacenado por JSON-LD sin escapar (`JSON.stringify` no escapa `<`) | 🔴 | S-01 | 1–2 h | 0 | **Sí** |
| **M-02** | Optimizador de imágenes: AVIF + `remotePatterns: "**"` + Next 14.2.35 | 🔴 | S-02, T-H01, H-10 | 15 min / 1–3 d | 0 | **Sí** |
| **M-03** | Cero cabeceras de seguridad (CSP, HSTS, frame-ancestors, nosniff) | 🟠 | S-04 | 2–4 h | 0 | **Sí** |
| **M-04** | WhatsApp con número por defecto silencioso si falta la variable | 🟠 | S-05, T-H11 | 30 min | 0 | **Sí** |
| **M-05** | Sin rate limiting, sin verificación de correo y sin moderación previa | 🟠 | S-06, H-04, S-11 | 4 h (mínimo) / 1–2 d | 0 | **Sí** |
| **M-06** | `SITIO_URL` hardcodeado → canónicas, JSON-LD y enlaces a dominio ajeno | 🟠 | S-12, T-H10, SEO-01 | 30 min | 0 | **Sí** (al desplegar) |
| **M-07** | Espacio de IDs incompatible: semilla (slug) vs base (UUID) | 🔴 | H-01 | 4–6 h | 1 | **Sí** |
| **M-08** | Catálogo demo servido en producción: enmascara fallos y muestra datos ficticios | 🔴 | H-05, S-13 | 2–3 h | 1 | **Sí** |
| **M-09** | El formulario no crea habitaciones → publicación invisible a los filtros | 🔴 | H-06, UX-H5 | 1 d | 1 | **Sí** |
| **M-10** | Precio de tarjeta ≠ precio del mensaje de WhatsApp con filtros activos | 🔴 | UX-H1 | 2 h | 1 | **Sí** |
| **M-11** | CTA de reserva anidado dentro del `<label>` de la habitación | 🔴 | UX-H2 | 1 h | 1 | **Sí** |
| **M-12** | Botones del carrusel dentro del `<Link>` de la tarjeta | 🟠 | UX-H3 | 1 h | 1 | No |
| **M-13** | Integridad solo en el formulario; la base no impone ninguna restricción | 🟠 | H-03, S-10 | 4 h | 1 | No |
| **M-14** | Política UPDATE de `habitaciones` sin `WITH CHECK` (mover habitación a otro anuncio) | 🟠 | H-02 | 1 h | 1 | Sí (con habitaciones) |
| **M-15** | Sin ciclo de publicación: no hay editar, retirar ni borrar desde la app | 🟠 | H-04, H-13 | 1–2 d | 1–2 | Recomendado |
| **M-16** | Sin git, sin CI/CD y **0 pruebas automatizadas** | 🟠 | S-07, T-H12, SEO-12 | 4–8 h + 1 d | 1 | Recomendado |
| **M-17** | Service Worker cachea HTML autenticado y respuestas no-OK | 🟡 | S-08 | 1–2 h | 1 | No |
| **M-18** | Redirección abierta en `?destino=` (`//evil.com` pasa el filtro) | 🟡 | S-09 | 30 min | 1 | No |
| **M-19** | Sin `robots.txt`, sin `sitemap.xml`, sin Search Console ni analítica | 🟠 | SEO-02, SEO-03, SEO-11 | 2 h | 1 | No (crítico al desplegar) |
| **M-20** | Escalabilidad de datos: `select('*')`, sin paginación, N+1 en ISR, índices desalineados, `combinar()` O(P×H) | 🟠 | H-07, H-08, T-H07, T-H08, SEO-10 | 1–2 d | 2 | No |
| **M-21** | `cookies()` síncrono: **bloquea la compilación en Next 16** | 🔴 | T-H02 | 1 h | 2 | No hoy |
| **M-22** | `revalidateTag` de un argumento: deprecado en Next 16 y semántica incorrecta al publicar | 🔴 | T-H03 | 1 h | 2 | No hoy |
| **M-23** | Una petición RSC por cada paso del slider de precio (~25 al arrastrar) | 🟠 | T-H06 | 2 h | 2 | No |
| **M-24** | Accesibilidad y CRO pendientes: slider sin `aria-valuetext`, puntos de 8 px, `prefers-reduced-motion` ignorado, sin ordenamiento, filtros desincronizados con Atrás, sin recuperación de contraseña, footer contradictorio, estados vacíos sin guía | 🟡 | UX H4–H15, A1–A10 | 3–4 d | 2 | No |
| **M-25** | Sin capa de contenido ni breadcrumbs: imposible posicionar consultas informacionales ni ser citado por IA | 🟠 | SEO-04, SEO-05, SEO-06 | 3–5 d | 2 | No |
| **M-26** | Imágenes de terceros; sin Supabase Storage ni imagen OG por pensión | 🟡 | H-10, SEO-08 | 1 d | 2–3 | No |
| **M-27** | Operación: sin migraciones versionadas, sin entornos separados, sin observabilidad, sin aviso de privacidad | 🟡 | H-11, H-19, S-13, S-14 | 2–3 d | 2–3 | Según asesoría legal |
| **M-28** | Deuda menor asumida: sin `engines`/`.nvmrc`, dependencias con `^`, `bg-neutral-200` fuera de paleta, `taskkill` indiscriminado en los `.bat`, tiles de OSM sin proveedor propio | 🟢 | T-H13–H18, UX-H16–H20, S-16, S-17 | 1 d | 3 | No |

---

## 3. Hoja de ruta en 3 oleadas

### Oleada 0 — Antes de lanzar (≈1–2 días)

> **Estado (2026-09-17): IMPLEMENTADA** — M-01 a M-06 y M-18 aplicados y verificados.
> Único aplazamiento deliberado: la moderación previa de M-05, que necesita interfaz de aprobación.
> Detalle, evidencias y prueba de aceptación del XSS: [oleada-0-implementada.md](oleada-0-implementada.md).

| Ítem | Criterio de aceptación |
|---|---|
| M-01 Escapar el JSON-LD | Publicar un título con `</script><script>alert(1)</script>` y comprobar que **no se ejecuta** ningún script y que el JSON-LD sigue siendo válido |
| M-02 Endurecer imágenes | Sin `image/avif`; `remotePatterns` limitado a los hosts realmente necesarios; documentado cómo reabrir AVIF tras el parche |
| M-03 Cabeceras de seguridad | CSP por hashes (**no nonces** en 14.2.35), HSTS, `X-Content-Type-Options`, `frame-ancestors`, `Referrer-Policy` activas y verificadas con `curl -I` |
| M-04 WhatsApp | Sin variable configurada, el arranque **falla visiblemente**: sin botón de reserva silenciosamente roto |
| M-05 Abuso y moderación | Verificación de correo activa + límite de publicaciones por cuenta/hora + estado de publicación con ruta de aprobación |
| M-06 Dominio | `NEXT_PUBLIC_SITE_URL` como fuente única; canónicas y JSON-LD apuntan al dominio desplegado |

### Oleada 1 — Primeras dos semanas

> **Estado (2026-09-17): EN CURSO** — implementados y verificados **M-09, M-10,
> M-11, M-12, M-13 y M-14** (el circuito anfitrión publica → estudiante filtra →
> reserva). Pendientes: M-07, M-08, M-15, M-16 y M-19.
> Detalle y evidencias: [../oleada-1-implementada.md](../oleada-1-implementada.md).

M-07 · M-08 (bandera `PERMITIR_CATALOGO_DEMO=false` en producción y error visible) · M-09 + M-14 (RPC transaccional que crea pensión y habitaciones, con `WITH CHECK`) · M-10 + M-11 (coherencia de precio y desanidar el CTA) · M-12 · M-13 · M-16 (git + CI con `typecheck → lint → test → build`) · M-17 · M-18 · M-19.

**Criterio de aceptación global:** el flujo completo funciona con datos reales — un anfitrión se registra, publica con habitaciones, la pensión aparece en el catálogo con sus filtros y el precio mostrado coincide con el del mensaje de WhatsApp.

### Oleada 2 — Con tracción

M-20 · M-21 + M-22 + migración a Next 16 · M-23 · M-24 · M-25 (páginas por barrio y guías) · M-26 · M-27.

### Oleada 3 — Sostenimiento

M-28 y pulido continuo; el catálogo de servicios (H-17) y la búsqueda de texto, cuando el volumen lo justifique.

---

## 4. Lo que NO conviene hacer todavía (y por qué)

| No hacer | Motivo |
|---|---|
| **CSP con nonces** sobre Next 14.2.35 | Se heredaría un advisory de la propia versión; usar hashes hasta migrar |
| **Reactivar AVIF** antes del parche | Es la superficie del advisory crítico |
| **Migrar a Next 16 antes** de arreglar `cookies()` síncrono y `revalidateTag`, subir `react-leaflet` a v5 y cambiar `useFormState` por `useActionState` | La migración no compila; y sin git no hay marcha atrás |
| **Activar el estado "en revisión"** de moderación sin interfaz de aprobación | Ocultaría todas las publicaciones nuevas sin forma de aprobarlas |
| **Eliminar `precioMensual`** o cambiar el contrato de tipos ahora | La propuesta correcta es mantenerlo con trigger de sincronización y eliminar solo tras validar la vista con `min()` en producción |
| **Construir la UI de habitaciones** antes de la RPC transaccional | Se crearían anuncios incompletos (el problema actual, pero peor) |
| **Comprar investigación de palabras clave** antes de desplegar | Search Console da las consultas reales gratis al publicar |
| **Paginación y micro-optimizaciones de caché** con 6 filas | Ruido: el problema real es el modelo de datos, no el volumen |
| **Cambiar la semilla a slugs o a UUID** antes de decidir la identidad pública | La decisión propuesta (slug en URL + UUID como PK) resuelve M-07 sin reescribir la base |

---

## 5. Fortalezas verificadas que no hay que romper

1. `lib/filtros.ts` es puro de verdad: sin datos ni `window`; testeable sin mocks.
2. Contrato de tipos con la traducción snake_case ↔ dominio en un único archivo (`lib/supabase/mapeo.ts`).
3. Cliente anónimo sin cookies (`utils/supabase/publico.ts`) que permite ISR sin romper RLS.
4. Identidad tomada de la sesión y nunca del formulario (`app/actions/pensiones.ts`).
5. RLS activo en las tres tablas y lectura pública limitada a pensiones activas.
6. Accesibilidad: `role="radiogroup"`, `aria-pressed`, `aria-live`, skip-link con `tabIndex={-1}`, foco visible, contraste 16/16.
7. Integridad de datos estructurados: sin reseñas inventadas, sin coordenadas ficticias, `LodgingBusiness` solo donde corresponde.
8. `params`/`searchParams` ya tipados como `Promise`: el cambio de Next 15 que más rompe proyectos, hecho.
9. Fuentes autoalojadas con `next/font`, sin peticiones a Google y cacheables por el service worker.
10. Degradación segura: el sitio arranca y se ve completo sin credenciales externas.

---

## 6. Cómo verificar que un cambio no rompió nada

```bash
npx tsc --noEmit                       # tipos, sin compilar
npm run build                          # rutas, tipos y lint en una pasada
node scripts/verificar-seo.mjs         # 22 comprobaciones de datos estructurados y SEO
node scripts/verificar-contraste.mjs   # 16 combinaciones WCAG AA
node scripts/verificar-estructura.mjs  # sin contenido interactivo anidado (requiere servidor)
npm audit                              # estado de dependencias
node scripts/prueba-humo.mjs           # rutas en vivo (requiere servidor levantado)
```

---

## 7. Límites declarados de esta auditoría conjunta

- **Ninguna auditoría modificó código.** Los 84 hallazgos son de lectura y verificación.
- El **modo dinámico con Supabase no se probó en vivo**: no hay credenciales configuradas. Varios hallazgos de datos (comportamiento de PostgREST ante filtros no-UUID, RLS en operación real) están deducidos del esquema y del código, y se confirman en la Fase 1 del informe de datos.
- **No es un pentest** ni una prueba de carga; es una auditoría de código y configuración.
- **No hay métricas de tráfico ni de búsqueda**: las recomendaciones de contenido son estructurales, no priorizadas por volumen.
- Los 4 informes de especialistas conservan su detalle completo y su propio apartado de límites; este documento prioriza y deduplica, no reemplaza.
