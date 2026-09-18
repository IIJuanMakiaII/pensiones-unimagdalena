# Auditoría técnica, rendimiento y hoja de ruta — Tarea #7

**Proyecto:** Pensiones Unimagdalena (`pensiones-unimagdalena/`)
**Autor:** Ingeniero de Software (Agente 2)
**Fecha:** 2026-09-17
**Alcance:** calidad técnica, rendimiento, mantenibilidad, plan de migración a Next 16, pruebas automatizadas y deuda técnica.
**Modo:** solo lectura y verificación. **No se modificó código** ni se ejecutó `npm run build` / `npm start` (otra disciplina: la carpeta `.next` la comparten varios agentes).

---

## 1. Resumen ejecutivo

### Veredicto

El código está **bien estructurado y por encima de la media** para su etapa: separación limpia entre lógica pura y presentación, Server Components donde corresponde, degradación segura sin credenciales, accesibilidad real y decisiones de caché documentadas con su porqué. **No encontré hallazgos de calidad que exijan reescribir nada.**

Lo que impide llamarlo "listo para producción" es de otra naturaleza: **hay una vulnerabilidad crítica del framework que este proyecto activa de forma directa**, la integración con Supabase **no puede compilar en Next 16 tal como está** (una línea de `cookies()` síncrono), el **build de producción no existe** en el repo (solo caché de desarrollo), y **no hay nada de automatización de calidad** (0 pruebas, 0 linting ejecutable, 0 CI).

### Prioridades (ordenadas por riesgo real, no por dificultad)

| # | Hallazgo | Gravedad | Esfuerzo | Bloquea lanzar |
|---|---|---|---|---|
| H-01 | AVIF + optimizador abierto → **RCE no autenticado** (advisory crítico activo) | 🔴 Crítica | 🟡 Medio | **Sí** |
| H-02 | `cookies()` síncrono → **rompe la compilación en Next 16** | 🔴 Crítica (deuda con fecha) | 🟢 Bajo | No hoy, sí en la migración |
| H-03 | `revalidateTag(tag)` de un argumento → deprecado en Next 16 (error de tipos) | 🔴 Alta | 🟢 Bajo | **Sí** (bloquea la migración) |
| H-04 | No existe build de producción válido (`.next` incompleto + residuos de dev) | 🔴 Alta | 🟢 Bajo | **Sí** |
| H-05 | `npm run lint` no ejecutable y `next lint` desaparece en Next 16 | 🟠 Alta | 🟢 Bajo | No (sí antes de crecer) |
| H-06 | Una petición RSC por cada paso del slider de precio | 🟠 Media-alta | 🟢 Bajo | No |
| H-07 | N+1 consultas en build/ISR (todas + una por ficha, sin límite) | 🟠 Media-alta | 🟢 Bajo | No |
| H-08 | `combinar()` con complejidad O(P×H) en memoria | 🟠 Media | 🟢 Bajo | No |
| H-09 | `onScroll` sin `requestAnimationFrame` en el carrusel | 🟠 Media | 🟢 Bajo | No |
| H-10 | `SITIO_URL` hardcodeado → canónicas y JSON-LD a un dominio ajeno | 🟠 Media | 🟢 Bajo | **Sí** (al cambiar de dominio) |
| H-11 | Fallo silencioso del WhatsApp en producción (número demo por defecto) | 🟠 Media (negocio) | 🟢 Bajo | **Sí** |
| H-12 | Sin pruebas, sin CI, sin verificación de tipos en pipeline | 🟠 Media | 🟡 Medio | No |
| H-13 | Sin `engines`/`.nvmrc`: Next 16 exige Node ≥ 20.9 | 🟡 Media | 🟢 Bajo | No |
| H-14 | Tiles de OpenStreetMap en producción + chunk de Leaflet en cada ficha | 🟡 Media | 🟡 Medio | No |
| H-15 | 10 SVG por tarjeta para pintar 5 estrellas | 🟡 Baja | 🟢 Bajo | No |
| H-16 | Higiene: paquetes `extraneous`, 205 MB de caché, sin `AGENTS.md` | 🟡 Baja | 🟢 Bajo | No |
| H-17 | `prueba-humo.mjs` atado a datos concretos de la semilla | 🟡 Baja | 🟢 Bajo | No |
| H-18 | El listado vive en `/`, pero existía la convención `app/pensiones/page.tsx` | 🟢 Muy baja | 🟢 Bajo | No |

### Lo que está bien y **no hay que tocar** (verificado, no asumido)

- **`lib/filtros.ts` es puro de verdad:** no importa datos ni `window`; el catálogo y los favoritos llegan por argumento. Es directamente testeable sin mocks (ver §5).
- **Contrato de tipos tipado en la frontera:** `lib/supabase/mapeo.ts` convierte filas → dominio en un único punto; `types/index.ts` documenta por qué `calificacion` no es `aggregateRating`.
- **Caché con criterio:** cliente anónimo sin cookies (`utils/supabase/publico.ts:19-31`) para que el catálogo siga siendo estático, con etiqueta `pensiones` + `revalidateTag` al publicar. Decisión correcta y poco habitual.
- **Complejidad de código sana:** 21 componentes, el mayor de 178 líneas; sin dependencias redundantes; `leaflet`/`react-leaflet` entran por `dynamic(..., { ssr: false })` (`components/MapaUbicacion.tsx:10-13`), no en el bundle inicial.
- **Accesibilidad verificable:** `role="radiogroup"`, `aria-pressed`, `aria-live`, skip-link, `tabIndex={-1}` en el destino del skip, alt descriptivo, focus visible. `node scripts/verificar-contraste.mjs` → **16/16 combinaciones cumplen WCAG AA** (ejecutado en esta auditoría).
- **Buenas prácticas de Next ya aplicadas:** `params`/`searchParams` tipados como `Promise` y con `await` (`app/pensiones/[id]/page.tsx:16-23`, `app/publicar/page.tsx:20-26`) — el cambio de Next 15 que más rompe proyectos ya está hecho.
- **`next/font` con variables CSS** (`app/layout.tsx:15-27`): fuentes autoalojadas, sin peticiones a Google, sin CLS y cacheables por el service worker.
- **`images.minimumCacheTTL` = 7 días** (`next.config.mjs:18`): sigue siendo válido tras el cambio de Next 16 (nuevo default 4 h).

---

## 2. Método y límites de la verificación

### Qué se hizo (todo reproducible)

| Acción | Resultado |
|---|---|
| Lectura completa de `app/`, `components/`, `lib/`, `hooks/`, `utils/supabase/`, `middleware.ts`, `public/sw.js`, `next.config.mjs`, `tsconfig.json`, `package.json`, `scripts/` | 30+ archivos leídos |
| `npm audit` | **2 vulnerabilidades (1 crítico, 1 alto)**; el `fix` propone `next@16.3.5` (cambio mayor) |
| `npm ls --depth=0` | 2 paquetes **extraneous**; versiones reales confirmadas (`next@14.2.35`, `react@18.3.1`, `react-leaflet@4.2.1`, `@supabase/ssr@0.12.7`, `sharp@0.35.4`) |
| `node scripts/verificar-contraste.mjs` | **16/16 PASA** (WCAG AA) |
| `node scripts/verificar-seo.mjs` | **FALLA**: `No se pudo leer .next/server/app/index.html (¿ejecutaste npm run build?)` |
| Inspección de `.next/` | Sin `BUILD_ID`, sin `prerender-manifest.json`, sin `routes-manifest.json`, sin HTML prerenderizado; contiene `webpack.*.hot-update.js` (residuos de dev) |
| Medición de tamaños reales | `.next/static` 10,4 MB · `.next/server` 6,4 MB · `.next/cache` 205 MB · `node_modules` 298,6 MB · `leaflet.js` 144,1 KB (dist, sin comprimir) · `react-leaflet` 48,4 KB |
| `npm view` de peers/engines | `next@16.3.5` exige **Node ≥ 20.9**; `react-leaflet@4.2.1` exige **React ^18** y `@5.0.0` exige **React ^19**; `@supabase/ssr@0.12.7` no declara peer de React |
| Consulta de la guía oficial de Next 16 | `nextjs.org/docs/app/guides/upgrading/version-16` + `nextjs.org/blog/next-16` (actualizada 2026-08-25) |

### Límites honestos (lo que NO pude verificar)

1. **No hay cifras de build de producción.** El árbol `.next` está incompleto: faltan `BUILD_ID`, `prerender-manifest.json`, `routes-manifest.json` y los HTML prerenderizados. Por eso **no cito "First Load JS" ni el tamaño por ruta en este informe**: cualquier número así sería inventado o correspondería a una caché de desarrollo. Lo documentado en `docs/mejoras-rendimiento-experiencia.md` (110 kB) provino de un build anterior que ya no existe en disco y **no es reproducible hoy** — ver H-04.
2. **No ejecuté `npm run build`** (restricción de la tarea: varios agentes comparten `.next`). Las conclusiones sobre la compilación en Next 16 se basan en el código fuente y en la documentación oficial, no en una prueba empírica.
3. **No medí Core Web Vitals en navegador** (requiere servidor levantado y build de producción). Las propuestas de rendimiento se apoyan en el código (patrones que generan trabajo evitable) y en los tamaños reales medidos.
4. **Los hallazgos de otros dominios están fuera de este informe por diseño.** Cuando un tema ya está tratado por otro agente, lo **referencio** en lugar de duplicarlo: `docs/auditorias/datos-backend.md` (H-07 consultas sin paginar y JOIN en memoria, H-10 optimizador abierto a cualquier origen) y `docs/auditorias/ux-cro.md` (H-02 CTA anidado en `<label>`, H-03 botones del carrusel dentro del `<Link>`, H-07 slider sin rango accesible, H-08 desincronización con el botón Atrás).

---

## 3. Hallazgos

### 3.1 Crítico — arreglar antes de lanzar

#### 🔴 H-01 — El proyecto activa la superficie exacta del advisory crítico: RCE no autenticado en el optimizador de imágenes

**Evidencia**

- `next.config.mjs:5-6` — `formats: ["image/avif", "image/webp"]`.
- `next.config.mjs:10-14` — `remotePatterns` incluye `{ protocol: "https", hostname: "**" }` (cualquier origen).
- `npm audit` (ejecutado en esta auditoría), sobre `next@14.2.35` → **1 crítico + 1 alto**, con estas dos entradas relevantes:
  - `Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used` — GHSA-2xp9-vwfh-vxw4
  - `Next.js: Unauthenticated Remote Code Execution on windows-hosted servers` — GHSA-p293-qw3h-jr36
- Uso real de `next/image`: `components/Carrusel.tsx:79-87`, `app/pensiones/[id]/page.tsx:122-129`, `components/InstalarApp.tsx:101-107`.

**Por qué es peor de lo que parece:** el advisory crítico se explota **a través del endpoint de optimización (`/_next/image`) cuando se sirven AVIF**, y este proyecto (a) habilita AVIF explícitamente, (b) acepta imágenes de **cualquier** origen https, y (c) se desarrolla y se prueba en **Windows**, que es la otra superficie afectada. No es una vulnerabilidad teórica "porque usamos Next": es la combinación exacta de configuración que el advisory describe, y hay `next/image` en el camino del usuario en todas las tarjetas.

**Propuesta**

1. **Migrar a Next 16** (es el arreglo definitivo; cierra las 2 vulnerabilidades — ver §4).
2. **Mitigación inmediata si la migración se aplaza:** quitar `"image/avif"` de `formats` (dejar solo `image/webp`, que ya aporta ~30 % de ahorro) y sustituir el comodín `hostname: "**"` por una allowlist explícita. Coordinado con `datos-backend.md` H-10, que ya propone restringir el optimizador; aquí añado la razón de framework que eleva su urgencia.
3. No exponer `next start` a Internet con AVIF activo hasta migrar.

**Esfuerzo:** 🟢 mitigación 15 min · 🟡 migración, ver §4. **Prioridad:** 🔴 bloquea lanzar.

---

#### 🔴 H-02 — `cookies()` se usa de forma síncrona: rompe la compilación en Next 16

**Evidencia**

```ts
// utils/supabase/server.ts:1,10-11
import { cookies } from "next/headers";
export function crearClienteServidor() {
  const almacen = cookies();   // ← acceso SÍNCRONO
```

Guía oficial de Next 16 (`Upgrading: Version 16` → *Async Request APIs (Breaking change)*): «Starting with **Next.js 16**, synchronous access is fully removed. These APIs can only be accessed asynchronously: `cookies`, `headers`, `draftMode`, `params`…». Exige además que `crearClienteServidor` pase a `async` y que todos sus llamadores hagan `await` (`app/actions/pensiones.ts:44`, `app/publicar/page.tsx:30`, `utils/supabase/server.ts`).

**Impacto:** hoy funciona (Next 14 tolera el acceso síncrono). En Next 15 ya emite aviso; en Next 16 **es un error de compilación**. Es la deuda con fecha de caducidad más clara del proyecto: bloquea cualquier migración futura, incluida la que cierra H-01.

**Propuesta:** `const almacen = await cookies();`, marcar `crearClienteServidor` como `async` y añadir `await` en las 3 llamadas. Es un cambio mecánico de ~6 líneas, ideal para hacer **junto** con la migración (el codemod de APIs asíncronas de Next lo cubre: `npx @next/codemod@canary next-async-request-api .`).

**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🔴 alta (bloquea la migración a Next 16).

---

#### 🔴 H-03 — `revalidateTag` con un solo argumento queda deprecado y da error de tipos en Next 16

**Evidencia**

```ts
// app/actions/pensiones.ts:129
revalidateTag(ETIQUETA_PENSIONES);
```

Guía oficial de Next 16: «`revalidateTag` now requires a second argument specifying a `cacheLife` profile. **The single-argument form is deprecated and will produce a TypeScript error.**» Además indica que, cuando se espera *read-your-writes*, lo correcto es `updateTag` en Server Actions.

**Impacto:** doble. (a) Bloquea la compilación con `strict: true` tras migrar. (b) **Funcional**: hoy el anfitrión publica y el mensaje dice "Ya aparece en el catálogo" (`app/publicar/page.tsx:60-67`), pero con `revalidateTag` la semántica es *stale-while-revalidate*: el usuario puede seguir viendo datos viejos. Es exactamente el caso de uso de `updateTag` (expira y refresca en la misma petición).

**Propuesta:** migrar a `updateTag(ETIQUETA_PENSIONES)` en la Server Action (semántica correcta para "publico y quiero verlo ya"), o `revalidateTag(ETIQUETA_PENSIONES, "max")` si se prefiere el comportamiento con retardo. Decidir explícitamente cuál, porque cambia la experiencia del anfitrión.

**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🔴 alta (parte del plan de migración).

---

#### 🔴 H-04 — No existe un build de producción válido (y por eso no hay métricas fiables)

**Evidencia**

```
node scripts/verificar-seo.mjs
→ ERROR  No se pudo leer .next/server/app/index.html (¿ejecutaste npm run build?)
→ 2 verificación(es) con problemas.

.next/ raíz:  cache  server  static  types
              app-build-manifest.json  build-manifest.json  package.json
              react-loadable-manifest.json  trace
Faltan: BUILD_ID · prerender-manifest.json · routes-manifest.json · HTML en server/app/
Presentes: webpack.e8d0b5b2b1a3f9c7.hot-update.js  (residuo de desarrollo)
```

Un build completo de Next 14 escribe `BUILD_ID`, `prerender-manifest.json`, `routes-manifest.json` y los HTML de las rutas estáticas. Aquí no están, y hay artefactos `hot-update` de desarrollo mezclados: **la carpeta contiene una caché de dev parcial, no un artefacto desplegable.** Es la secuela del incidente de "chunks corruptos" que ya vivió el usuario (dev y build compartieron `.next`).

**Impacto:** (a) no se puede desplegar desde este estado ni verificar el prerenderizado; (b) `verificar-seo.mjs` —la herramienta de verificación del propio equipo— **no sirve hoy**, y eso deja sin red de seguridad a los informes de SEO; (c) genera confusión real: el informe anterior cita "First Load JS 110 kB" de un build que ya no existe.

**Propuesta**
1. **Protocolo único de build:** detener dev → `Remove-Item -Recurse -Force .next` → `npm run build`, y solo entonces `npm start`. Nunca en paralelo con dev (ya lo advierte `Iniciar-Dev.bat`).
2. Añadir scripts explícitos: `"build:limpio": "rimraf .next && next build"` (o el equivalente PowerShell) y `"verificar": "tsc --noEmit && node scripts/verificar-seo.mjs && node scripts/verificar-contraste.mjs"`.
3. **Buena noticia para el futuro:** Next 16 resuelve esta clase de incidente por diseño — «`next dev` and `next build` now use separate output directories… Additionally, a lockfile mechanism prevents multiple `next dev` or `next build` instances on the same project» (`next dev` pasa a escribir en `.next/dev`).
4. Aviso para el equipo: Next 16 **elimina** `size` y `First Load JS` del output de `next build` («We found these to be inaccurate in server-driven architectures»). Las métricas deberán salir de Lighthouse/Vercel Analytics; conviene dejar de citar esas cifras en los documentos internos.

**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🔴 bloquea lanzar (y bloquea la verificación de todo lo demás).

---

### 3.2 Importante — antes de escalar

#### 🟠 H-05 — `npm run lint` no se puede ejecutar (y `next lint` desaparece en Next 16)

**Evidencia**

- `package.json:10` → `"lint": "next lint"`.
- **No existe** `.eslintrc*` ni `eslint.config.*` en la raíz; **no están instalados** `eslint` ni `eslint-config-next` (verificado en `node_modules`).
- Guía oficial de Next 16 → *Removals*: «The `next lint` command has been removed. Use Biome or ESLint directly. `next build` no longer runs linting.» Y `@next/eslint-plugin-next` pasa a **flat config** por defecto.

**Impacto:** el proyecto tiene **0 linting real** y nadie lo notó porque el script solo falla cuando se ejecuta. Peor: hasta ahora `next build` lintaba implícitamente; en Next 16 deja de hacerlo, así que sin configurar ESLint explícitamente **se pierde la última red de calidad sin que nada avise**. Con `strict: true` en TypeScript el tipado está cubierto, pero lint detecta otra clase de problemas (hooks mal usados, `<a>` internos en vez de `Link`, `key` faltantes, imports muertos).

**Propuesta**
1. `npm i -D eslint eslint-config-next` y crear `eslint.config.mjs` (flat config) con `next/core-web-vitals` + `next/typescript`.
2. Scripts: `"lint": "eslint ."`, `"typecheck": "tsc --noEmit"`, `"verificar": "npm run typecheck && npm run lint"`.
3. Alternativa a considerar: **Biome** (más rápido, una sola herramienta para lint + formato). La recomiendo solo si el equipo adopta también formato automático; si no, ESLint es el camino de menor fricción porque `eslint-config-next` ya conoce las reglas del App Router.

**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🟠 alta.

---

#### 🟠 H-06 — Cada paso del slider de precio dispara una navegación RSC (ráfaga de peticiones)

**Evidencia**

```ts
// components/Filtros.tsx:44-54
<input type="range" min={limitesPrecio.min} max={limitesPrecio.max}
       step={PASO_PRECIO}         // 50.000 (lib/filtros.ts:30)
       onChange={(e) => actualizar({ precioMaximoCop: Number(e.target.value) })} />

// components/CatalogoInteractivo.tsx:66-70
const cambiarFiltros = (nuevos: FiltrosUI) => {
  setFiltros(nuevos);
  router.replace(consulta ? `${rutaActual}?${consulta}` : rutaActual, { scroll: false });
};
```

Con un rango de 300.000 a 1.500.000 y paso 50.000 hay **25 posiciones**; arrastrar el pulgar de un extremo al otro emite ~25 `onChange`, y **cada uno** llama a `router.replace`, que en App Router dispara una navegación con petición al servidor (RSC payload) además del re-render local. En un móvil de gama media eso se percibe como tirón al arrastrar, y del lado del servidor genera ráfagas de peticiones innecesarias (justo sobre el catálogo que estamos protegiendo con ISR).

**Impacto:** jank en la interacción más usada del catálogo (el filtro de precio) y carga evitable en cada revalidación. Complementa —no duplica— `ux-cro.md` H-07 (accesibilidad del slider) y H-08 (desincronización con Atrás).

**Propuesta**
1. **Separar estado de URL:** `window.history.replaceState(null, "", url)` para escribir la URL **sin** navegación (el `useEffect` de restauración ya lee `window.location.search`, `CatalogoInteractivo.tsx:55-63`, así que sigue siendo coherente), y reservar `router.replace` para cambios discretos (chips, toggles).
2. Añadir **debounce de 200–300 ms** específicamente al slider (o `useDeferredValue` de React para el filtrado visual).
3. Verificar el resultado con una prueba e2e que cuente peticiones al arrastrar (ver §5).

**Esfuerzo:** 🟢 Bajo (≈15 líneas). **Prioridad:** 🟠 media-alta.

---

#### 🟠 H-07 — N+1 de consultas en el build/ISR y sin límite de páginas prerenderizadas

**Evidencia**

```ts
// app/pensiones/[id]/page.tsx:28-31  → trae TODO el catálogo
export async function generateStaticParams() {
  const pensiones = await obtenerPensiones();
  return pensiones.map((pension) => ({ id: pension.id }));
}
// :64-66 → y luego una consulta por cada ficha
const pension = await obtenerPensionPorId(id);
```

`obtenerPensiones()` (`lib/datos.ts:41-62`) hace **2 consultas** (pensiones + **todas** las habitaciones), y después cada página de detalle repite una consulta propia. Resultado: **1 + 2N consultas** por ciclo de build/revalidación, y **N páginas prerenderizadas** sin techo.

**Impacto:** con 6 pensiones es irrelevante; con el catálogo que este marketplace pretende (cientos de pensiones), el build se alarga y cada revalidación golpea la base de datos de más. `generateMetadata` ejecuta además otra llamada a `obtenerPensionPorId` por ficha (Next no comparte el resultado entre `generateMetadata` y la página salvo memoización explícita), lo que puede duplicar la cuenta.

**Propuesta**
1. Envolver `obtenerPensionPorId` y `obtenerPensiones` con `cache()` de React (deduplica la llamada dentro de la misma petición/render) y/o `unstable_cache` con `cacheTag(ETIQUETA_PENSIONES)`.
2. **Una sola consulta con recurso anidado:** `supabase.from("pensiones").select("*, habitaciones(*)")` elimina el JOIN en memoria y el segundo viaje de red.
3. Acotar `generateStaticParams` a las **N más recientes** (p. ej. 50) dejando el resto a demanda (`dynamicParams` ya es `true` por defecto), para que el build no crezca linealmente con el catálogo.
4. Coordinar con `datos-backend.md` H-07 (paginación e índices), que aborda la misma consulta desde la base de datos.

**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🟠 media-alta.

---

#### 🟠 H-08 — `combinar()` recorre todo el catálogo por cada pensión: O(P×H)

**Evidencia**

```ts
// lib/datos.ts:20-29
function combinar(pensiones: PensionFila[], habitaciones: HabitacionFila[]) {
  return pensiones.map((fila) =>
    filaAPension(fila, habitaciones.filter((h) => h.pension_id === fila.id).map(filaAHabitacion))
  );
}
```

El `filter` dentro del `map` recorre **todas** las habitaciones por cada pensión. Con P pensiones y H habitaciones totales: **P×H** comparaciones. Se ejecuta en cada revalidación de 60 s y en cada llamada a `obtenerPensiones` (incluido el `generateStaticParams` del build).

**Impacto:** con 500 pensiones y 2.000 habitaciones son ~1.000.000 de comparaciones y 500 arrays temporales por render; hoy es despreciable, pero es deuda que crece al cuadrado con el catálogo y está en la ruta crítica del render.

**Propuesta:** indexar una vez y hacer una sola pasada:

```ts
const porPension = new Map<string, HabitacionFila[]>();
for (const h of habitaciones) {
  const lista = porPension.get(h.pension_id);
  if (lista) lista.push(h); else porPension.set(h.pension_id, [h]);
}
// luego: filaAPension(fila, (porPension.get(fila.id) ?? []).map(filaAHabitacion))
```

Complejidad O(P+H). **Esfuerzo:** 🟢 Bajo (~8 líneas). **Prioridad:** 🟠 media (se vuelve alta al superar ~100 pensiones).

---

#### 🟠 H-09 — `onScroll` del carrusel actualiza estado en cada evento, sin `requestAnimationFrame`

**Evidencia**

```ts
// components/Carrusel.tsx:36-40
const manejarScroll = useCallback(() => {
  const el = contenedorRef.current;
  if (!el) return;
  setIndice(Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)));
}, [total]);
// :73  onScroll={manejarScroll}
```

Cada evento de scroll llama a `setIndice` **sin comprobar si el valor cambió**: React descarta el re-render si el valor es idéntico, pero se ejecutan cálculo, comparación y una entrada de actualización por evento. Durante un deslizamiento táctil esto ocurre decenas de veces por segundo, y `CatalogoInteractivo` renderiza hasta **6 carruseles a la vez** (`components/CatalogoInteractivo.tsx:128-133`), además de que el `setIndice` re-renderiza cada carrusel de forma independiente.

**Propuesta:** (a) guardar el índice en un `useRef` y llamar a `setIndice` **solo si cambió**; (b) envolver el cálculo en `requestAnimationFrame` para limitarlo a un frame; (c) considerar `scrollend`/`IntersectionObserver` como disparador del indicador de puntos en lugar de `scroll`. Ganancias: menos re-renders en la interacción más usada en móvil.

**Esfuerzo:** 🟢 Bajo (~10 líneas). **Prioridad:** 🟠 media.

---

#### 🟠 H-10 — `SITIO_URL` está hardcodeado: canónicas, Open Graph y JSON-LD pueden apuntar a un dominio ajeno

**Evidencia**

```ts
// lib/sitio.ts:6
export const SITIO_URL = "https://pensiones-unimagdalena.vercel.app";
```

Consumido en: `app/layout.tsx:41,56,68,117` (`metadataBase`, JSON-LD del sitio, Open Graph), `app/page.tsx:39` (`url` de cada `ListItem`), `app/pensiones/[id]/page.tsx:45,49,80` (canonical, `og:url`, JSON-LD), y en el texto de "Compartir por WhatsApp" (`[id]/page.tsx:174`).

**Impacto:** si el despliegue final usa otro dominio (propio, otro subdominio de Vercel, Netlify), el sitio declarará **canónicas y datos estructurados de un dominio que no es el suyo**. Para SEO es de los errores más caros: Google puede consolidar señales en el dominio equivocado, y los enlaces compartidos por WhatsApp llevarán a los usuarios a la URL antigua. Es un error **silencioso** (nada falla en el build).

**Propuesta**
1. Leer de entorno: `const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")`.
2. **Validación explícita en el build:** un pequeño script que falle si en producción `NEXT_PUBLIC_SITE_URL` no está definida (o hacerlo en `next.config.mjs` durante la fase `PHASE_PRODUCTION_BUILD`).
3. Añadir la variable a `.env.example` (hoy solo contiene `NEXT_PUBLIC_WHATSAPP_NUMBER`) y a la lista de "3 pasos antes de publicar" del README.

**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🟠 media-alta (bloquea un lanzamiento con dominio propio).

---

#### 🟠 H-11 — El WhatsApp falla en silencio en producción: número demo por defecto

**Evidencia**

```ts
// lib/formato.ts:11
const NUMERO_CRUDO = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "573001234567";
// :24-30
if (process.env.NODE_ENV !== "production" && !numeroWhatsAppValido()) { console.warn(...); }
```

El `?? "573001234567"` es un número de ejemplo, y la única validación con aviso está **desactivada en producción** (`NODE_ENV !== "production"`). En un despliegue sin la variable, todos los botones "Reservar por WhatsApp" apuntarían a un número que no existe, sin ningún síntoma visible: el usuario cree que reservó y **el lead se pierde**.

**Impacto:** es el peor tipo de fallo — silencioso y justo en el paso de conversión del negocio. Ya hay 4 CTAs apuntando a `enlaceWhatsApp`: `components/CardPension.tsx:101-109`, `components/DetallePension.tsx` (botón por habitación y barra fija), y el mensaje general del footer.

**Propuesta**
1. **Eliminar el fallback silencioso:** si la variable falta o es inválida, usar un valor centinela y **mostrar un aviso visible** (banner de configuración) o deshabilitar el CTA con un texto explícito en vez de generar un enlace roto.
2. Registrar el problema también en producción (`console.error` + opcionalmente `reportError`), no solo en desarrollo.
3. Añadir comprobación en el build (mismo script de H-10: falla el build si falta `NEXT_PUBLIC_WHATSAPP_NUMBER`).
4. Considerar un test e2e que afirme que el dominio del enlace es `wa.me` y que el número tiene 10–15 dígitos (§5).

**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🟠 media-alta (impacto directo en conversión).

---

#### 🟠 H-12 — Sin pruebas automatizadas ni integración continua

**Evidencia**

- `package.json:6-11`: scripts solo `dev`, `build`, `start`, `lint` (roto, ver H-05). No hay `test`.
- No existen `vitest.config.*`, `jest.config.*`, `playwright.config.*` ni carpetas `tests/`, `__tests__/`, `e2e/` (búsqueda recursiva).
- No existe `.github/` (0 workflows de CI).
- Lo único automatizado son dos verificadores de propósito específico (`scripts/verificar-seo.mjs`, `scripts/verificar-contraste.mjs`) y una prueba de humo con `fetch` (`scripts/prueba-humo.mjs`), que **requiere el servidor levantado** y comprueba texto de rutas.

**Impacto:** cada cambio en el motor de filtrado, en el mapeo de datos o en las plantillas se valida hoy solo leyendo código y levantando el sitio a mano. Es el motivo por el que el equipo ya sufrió dos incidentes que un pipeline habría detenido (el build incompleto de H-04 y una regresión de tipos por `tsconfig`). El proyecto tiene una ventaja enorme para arreglarlo: **la lógica de negocio ya es pura**, así que las pruebas son baratas de escribir (§5).

**Propuesta:** adoptar **Vitest** (unitarias, sin DOM) y **Playwright** (e2e de reserva), y un workflow de CI con `tsc --noEmit` + lint + build + pruebas. Detalle y catálogo de casos concretos en §5.

**Esfuerzo:** 🟡 Medio (1–2 días para dejar unitarias + e2e del flujo crítico y CI verde). **Prioridad:** 🟠 media-alta (habilita todo lo demás).

---

### 3.3 Menores — deuda a pagar con calma

#### 🟡 H-13 — No hay `engines` ni `.nvmrc`: Next 16 exige Node ≥ 20.9

**Evidencia:** `package.json` no declara `engines`; no existe `.nvmrc` ni `.node-version` (listado con `-Force` de la raíz).
`npm view next@16.3.5 engines` → `{ node: '>=20.9.0' }`. Y la guía oficial lo confirma: «Minimum version now `20.9.0` (LTS); Node.js 18 no longer supported». El entorno de este equipo usa Node 22.23.2, así que hoy no hay problema, pero otro colaborador (o un runner de CI por defecto) con Node 18 obtendría un fallo confuso.

**Propuesta:** `"engines": { "node": ">=20.9.0" }` en `package.json` + `.nvmrc` con `22` + nota en el README. Barato y evita un fallo desagradable tras la migración.
**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🟡 media (sube a alta en cuanto se planifique Next 16).

---

#### 🟡 H-14 — Tiles de OpenStreetMap en producción y chunk de Leaflet en cada ficha

**Evidencia**

```tsx
// components/MapaLeaflet.tsx:56-59
<TileLayer attribution='&copy; colaboradores de <a href="...">OpenStreetMap</a>'
           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
```

Tamaños medidos: `leaflet.js` (dist) **144,1 KB** + `react-leaflet` **48,4 KB** sin comprimir. La carga es diferida y con `ssr: false` (`components/MapaUbicacion.tsx:10-13`), lo cual está bien hecho, pero **el mapa se descarga al abrir cualquier ficha**, aunque el usuario no lo mire.

Dos riesgos distintos: (a) **rendimiento**: ~190 KB de JS (menos comprimido, pero relevante en 3G/4G pobre) en la ruta de detalle, justo donde está el CTA de reserva; (b) **operación/legal**: los tiles públicos de OSM tienen política de uso que descarta el uso intensivo o comercial sin proveedor propio; para un marketplace en producción conviene un proveedor con clave (MapTiler, Mapbox, Geoapify) o instancia propia de tiles.

**Propuesta:** (a) cargar el mapa **bajo demanda** (`IntersectionObserver` o botón "Ver ubicación aproximada") para no penalizar la primera pantalla de la ficha; (b) elegir proveedor de tiles con clave vía variable de entorno antes de escalar; (c) mantener la atribución (ya está correcta).
**Esfuerzo:** 🟡 Medio (proveedor) / 🟢 Bajo (diferir por intersección). **Prioridad:** 🟡 media.

---

#### 🟡 H-15 — 10 elementos `<svg>` por tarjeta para pintar 5 estrellas

**Evidencia:** `components/Estrellas.tsx:16-29` renderiza dos capas de 5 estrellas (fondo gris + relleno recortado por ancho). Con 6 tarjetas en pantalla son **60 SVG**, cada uno con su `<path>` largos, en el DOM inicial.

**Propuesta:** usar **un solo SVG** con el relleno proporcional (por ejemplo, `linearGradient` con `stop` en el porcentaje, o `mask`/`clipPath`), o un `<span>` con la estrella como texto/`background-image` repetida y `width` recortado. Impacto real: menos nodos y menos HTML en el payload. Es micro-optimización, no urgencia.
**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🟡 baja.

---

#### 🟡 H-16 — Higiene del proyecto: paquetes `extraneous`, 205 MB de caché y sin `AGENTS.md`

**Evidencia**

- `npm ls --depth=0` reporta **2 paquetes extraneous**: `@emnapi/runtime@1.11.3`, `@img/sharp-wasm32@0.35.4`.
- `.next/cache` = **205 MB**; `node_modules` = **298,6 MB**; `node-compile-cache/` (1,3 MB) en la raíz del proyecto; `.next` contiene residuos de dev (H-04).
- **No existe `AGENTS.md`** en el proyecto (la guía de Next 16 lo pide explícitamente para que los agentes de IA lean documentación de la versión correcta; en 16.2+ las docs vienen en `node_modules/next/dist/docs/`).

**Propuesta:** reconstruir `node_modules` con `npm ci` (elimina extraneous), borrar `.next/cache` cuando se haga el build limpio de H-04, añadir `node-compile-cache/` a `.gitignore` si algún script lo regenera, y crear `AGENTS.md` con las convenciones (español, Server Components por defecto, lógica pura en `lib/`, verificación obligatoria antes de marcar completado).
**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🟡 baja (higiene, pero reduce confusión).

---

#### 🟡 H-17 — La prueba de humo está acoplada a datos concretos de la semilla

**Evidencia**

```js
// scripts/prueba-humo.mjs:14-22
["/", "Pensiones verificadas a minutos de Unimagdalena"],
["/pensiones/pension-costa-verde", "Sobre este alojamiento"],
["/publicar", "Modo dinámico pendiente"],
```

Las aserciones dependen de (a) textos exactos de la interfaz —que cambian con cualquier ajuste de copy, como ya pasó con "Puntaje del equipo"— y (b) que exista `pension-costa-verde`, que es un id **de la semilla demo**: en cuanto Supabase esté activo y ese id no exista allí, la prueba fallará por una razón que no es un defecto. Además `"/publicar"` espera el aviso de modo demo, que por definición desaparece al configurar Supabase.

**Propuesta:** separar la prueba en dos modos: **modo demo** (aserciones de contenido) y **modo dinámico** (aserciones solo de estado HTTP + presencia de `<h1>`, tomando el id de una llamada previa al catálogo). Convertirla en el e2e de Playwright de §5 en lugar de mantener dos mecanismos.
**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🟡 baja.

---

#### 🟢 H-18 — El catálogo vive en `/`, pero el proyecto nació con la convención `app/pensiones/page.tsx`

**Evidencia:** `app/pensiones/` solo contiene `[id]/page.tsx` y `[id]/loading.tsx`; el listado con filtros está en `app/page.tsx` + `components/CatalogoInteractivo.tsx`. La documentación de las tareas previas describía el listado como `app/pensiones/page.tsx`.

**Propuesta:** decidir y documentar una convención (el listado en `/` es correcto para este producto y mejor para SEO local). Si se quiere `/pensiones` como URL canónica del catálogo, añadir una ruta que reexporte el componente con su `canonical`, en vez de duplicar vistas.
**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🟢 muy baja (coherencia de documentación).

---

#### 🔵 Nota cruzada — pensión inactiva accesible por URL directa

`lib/datos.ts:65-87` (`obtenerPensionPorId`) consulta por `id` **sin filtrar `activa`**, así que una pensión retirada del catálogo sigue siendo accesible si alguien conserva la URL (y sigue siendo indexable si ya estaba en Google). Lo dejo señalado porque toca a dos dominios ya auditados: `datos-backend.md` (H-05, H-13 ciclo de publicación y borrado lógico) y el SEO de `#8`. **Propuesta:** añadir `.eq("activa", true)` en la lectura pública y devolver `notFound()` cuando no haya coincidencia.
**Esfuerzo:** 🟢 Bajo. **Prioridad:** 🟡 media (integridad + SEO).

---

## 4. Plan de migración a Next 16

### 4.0 Por qué migrar (y por qué ahora)

Tres razones concretas, en orden de peso:

1. **Cierra las 2 vulnerabilidades de `npm audit`** (`fix` propuesto: `next@16.3.5`). Una de ellas es la RCE no autenticada por AVIF que este proyecto activa (H-01). Es la única vía de arreglo definitivo.
2. **Elimina la clase de incidente que ya sufrió este equipo.** En 16, `next dev` escribe en `.next/dev` con directorios separados y hay un *lockfile* que impide dos `next dev`/`next build` simultáneos: se acaba el bug de "chunks corruptos" por mezclar modos (H-04).
3. **Evita que la deuda se vuelva urgente bajo presión.** Hoy `cookies()` síncrono y `revalidateTag(tag)` funcionan; el día que haya que migrar por seguridad, obligarán a tocar Supabase y caché al mismo tiempo que el framework. Migrar con el catálogo en modo demo y 0 usuarios reales es infinitamente más barato.

**Contra honesto:** es un salto de versión mayor (nuevo motor de build, React 19, cambio de directorio de salida) y **no se puede hacer a ciegas en una sola tanda sin verificación**, porque `react-leaflet@4` es incompatible con React 19 y el formulario usa una API que React 19 renombra. Coste estimado: **1 día de trabajo + 1 de verificación**, mejor en una rama con el servidor parado.

### 4.1 Requisitos previos (en este orden, sin saltarse el primero)

1. **Dejar un build reproducible y verde ANTES de migrar.** Hoy no existe (H-04). Sin línea base no se puede distinguir "lo rompió la migración" de "ya estaba roto". Protocolo: detener cualquier `next dev` → `Remove-Item -Recurse -Force .next` → `npm run build` → `npm start` + `node scripts/prueba-humo.mjs`. Guardar la salida.
2. **Rama dedicada + copia de seguridad** (el equipo ya tiene el patrón en `backups/`): `git checkout -b migracion-next-16` y copia del árbol fuera del proyecto. No tocar `main` hasta que la verificación pase.
3. **Fijar Node ≥ 20.9** (H-13): `.nvmrc` con `22` + `engines` en `package.json`. Comprobar con `node -v` antes de instalar.
4. **Crear `AGENTS.md`** apuntando a la documentación de la versión instalada. La propia guía de Next 16 lo pide: en 16.2+ las docs vienen en `node_modules/next/dist/docs/`. Esto hace que futuras migraciones las haga un agente con la documentación correcta, no con memoria.
5. **Congelar cambios funcionales** durante la migración (nada de features nuevas en paralelo).

### 4.2 Paso a paso

#### Paso 1 — Codemods (mecánico, antes de tocar código a mano)

```bash
# Codemod oficial de la versión 16
npx @next/codemod@canary upgrade latest

# APIs asíncronas (cubre cookies()/headers()/params — ver H-02)
npx @next/codemod@canary next-async-request-api .
```

El codemod de `upgrade` (según la guía oficial) puede: actualizar `next.config` al nuevo bloque `turbopack`, migrar de `next lint` al CLI de ESLint, **migrar `middleware` → `proxy`**, quitar prefijos `unstable_` y retirar `experimental_ppr`. Revisar el diff antes de aceptarlo: los codemods aciertan en lo mecánico, pero aquí hay código propio con decisiones documentadas (por ejemplo el `fetch` con `next: { revalidate, tags }` en `utils/supabase/publico.ts:22-28`).

#### Paso 2 — Dependencias

```bash
npm i next@16.3.5 react@19 react-dom@19
npm i -D @types/react@19 @types/react-dom@19
npm i react-leaflet@5        # obligatorio con React 19 (ver riesgos)
npm i -D eslint eslint-config-next@16.3.5
npm ci                        # limpia los paquetes extraneous (H-16)
```

Notas verificadas en esta auditoría:

| Paquete | Estado actual | Acción en Next 16 | Evidencia |
|---|---|---|---|
| `next` | 14.2.35 | → 16.3.5 (exige Node ≥ 20.9) | `npm view next@16.3.5 engines` |
| `react` / `react-dom` | 18.3.1 | → 19 (Next 16 usa React 19.2) | guía oficial, *React 19.2* |
| `react-leaflet` | 4.2.1 (peer **React ^18**) | → **5.0.0** (peer **React ^19**, `leaflet ^1.9.0`) | `npm view react-leaflet@4.2.1 peerDependencies` / `@5 peerDependencies` |
| `leaflet` | 1.9.4 | Se mantiene (`^1.9.0` cubre 1.9.4) | idem |
| `@supabase/ssr` | 0.12.7 | Se mantiene: su único peer es `@supabase/supabase-js ^2.114.0` (satisfecho con 2.116.0) y **no declara peer de React**, así que React 19 no lo bloquea | `npm view @supabase/ssr peerDependencies` |
| `sharp` | 0.35.4 | Se mantiene: es la versión que Next usa para el optimizador en producción | `npm ls --depth=0` / `npm view sharp version` |
| `@types/react` | 18.3.31 | → 19.x (obligatorio para que `useActionState` y los tipos de Server Actions sean correctos) | — |

#### Paso 3 — Cambios de código obligatorios (los 3 con evidencia)

1. **`cookies()` asíncrono** (H-02) — `utils/supabase/server.ts:11`:

```ts
export async function crearClienteServidor() {
  const almacen = await cookies();
  ...
}
```

Y añadir `await` en sus 3 llamadas: `app/actions/pensiones.ts:44` (`const supabase = await crearClienteServidor();`), `app/publicar/page.tsx:30`, más cualquier uso futuro. `typescript` lo detectará: al devolver `Promise`, cualquier uso sin `await` es error de tipos (esto es una ventaja — la migración no puede quedar a medias en silencio).

2. **`revalidateTag` de un argumento** (H-03) — `app/actions/pensiones.ts:129`. Decisión de producto: para el anfitrión que acaba de publicar, lo correcto es *read-your-writes*:

```ts
import { revalidatePath, updateTag } from "next/cache";
...
updateTag(ETIQUETA_PENSIONES);   // expira y refresca en la misma petición
revalidatePath("/");
revalidatePath("/publicar");
```

Alternativa conservadora si se prefiere el comportamiento con retardo: `revalidateTag(ETIQUETA_PENSIONES, "max")`. **Elegir una y documentarla**, porque cambia lo que ve el anfitrión justo después de publicar.

3. **`middleware.ts` → `proxy.ts`** (el codemod lo hace, pero conviene entender el efecto): renombrar el archivo, exportar `proxy` en vez de `middleware`, y saber que **el runtime de `proxy` es `nodejs` y no es configurable**; si algún día se necesitara `edge`, habría que quedarse con `middleware` (guía oficial). El matcher actual (`middleware.ts:22-24`) y la salvaguarda por ausencia de credenciales (`middleware.ts:16-18`) se conservan tal cual. Ojo también con los flags renombrados (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`); este proyecto no los usa.

#### Paso 4 — React 19: revisar el formulario y las APIs renombradas

**Evidencia:** `components/FormularioPension.tsx:3` → `import { useFormState, useFormStatus } from "react-dom";` y `:44` → `useFormState(crearPension, ESTADO_INICIAL)`.

En React 19 `useFormState` se sustituye por **`useActionState`** (importado de `react`); `useFormStatus` sigue existiendo en `react-dom`. Acción: migrar a `useActionState` al subir a React 19 y comprobar que el estado del formulario y el botón "Publicando…" (`FormularioPension.tsx:209`) siguen funcionando. Es el único punto de React 19 detectado en el código, además de `react-leaflet`.

Oportunidad opcional (no bloqueante): React 19.2 trae `View Transitions`, `useEffectEvent` y `Activity`; el **React Compiler** ya es estable en Next 16 (`reactCompiler`), pero **no está activado por defecto** y la propia guía advierte de compilaciones más lentas al activarlo. Recomendación: **no activarlo en esta migración**; dejarlo como experimento medido después.

#### Paso 5 — Revisar `next/image` (defaults nuevos)

Aplican a este proyecto porque el catálogo es intensivo en imágenes remotas:

| Cambio en Next 16 | Efecto aquí |
|---|---|
| `images.qualities` por defecto pasa a `[75]` | Hoy no se usa el prop `quality` en ningún `<Image>` (verificado), así que **no rompe nada**. Si en el futuro se añade `quality={80}`, será coercido a 75. Documentarlo. |
| `images.minimumCacheTTL` por defecto pasa de 60 s a **4 h** | El proyecto ya fija `604800` (7 días) en `next.config.mjs:18`: sigue válido y es mejor. |
| Bloqueo de IP local por defecto (`dangerouslyAllowLocalIP`) | Mejora de seguridad a favor; no afecta (no se optimizan imágenes locales por IP). |
| Máximo **3 redirecciones** por imagen | **Verificar con las fotos reales de los anfitriones**: si una URL acorta con más de 3 saltos, el optimizador devolverá error y la imagen no cargará. Probar con 3–4 URLs reales. |
| `images.domains` deprecado | No se usa (se usa `remotePatterns`). |
| `next/legacy/image` deprecado | No se usa. |
| `localPatterns.search` para imágenes locales con query string | No se usa (todas las imágenes son remotas o `/iconos/...`). |

**Además:** sigue vigente el hallazgo H-01. Tras migrar, el comodín `hostname: "**"` deja de ser una puerta a RCE por AVIF, pero **sigue siendo un optimizador abierto a cualquier origen** (coste y abuso). Aprovechar la migración para sustituirlo por allowlist — coordinado con `datos-backend.md` H-10.

#### Paso 6 — Turbopack (nuevo motor por defecto)

En Next 16, `next dev` **y** `next build` usan Turbopack por defecto. Riesgos concretos para este proyecto:

- **Config webpack personalizada → el build falla.** Aquí no hay ninguna (`next.config.mjs` solo tiene `reactStrictMode` e `images`), así que no debería dispararse. Si algún plugin la inyectara, la guía ofrece salida (`next build --webpack`).
- **Sass con `~`**: no se usa Sass (Tailwind + CSS plano), sin riesgo.
- **CSS de una dependencia importada desde JS:** `components/MapaLeaflet.tsx:5` hace `import "leaflet/dist/leaflet.css";`. Es un patrón estándar y Turbopack lo soporta, pero **hay que verificar visualmente el mapa** (tiles, controles, marcadores) tras migrar: es el punto más probable de regresión visual.
- **Rendimiento esperado:** el equipo debería notar compilaciones más rápidas; no es un requisito, pero es el beneficio que financia la migración.

#### Paso 7 — ESLint en flat config (sustituye a `next lint`)

`next lint` desaparece y `next build` deja de lintar (H-05). Crear `eslint.config.mjs` (flat config, formato por defecto de `@next/eslint-plugin-next` en 16) y ajustar scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "verificar": "npm run typecheck && npm run lint && node scripts/verificar-contraste.mjs"
  }
}
```

#### Paso 8 — Cosas que **no** hay que tocar (y por qué)

- **`params`/`searchParams` ya son `Promise` con `await`** (`app/pensiones/[id]/page.tsx:22`, `app/publicar/page.tsx:22`): el breaking change de Next 15 ya está absorbido; en 16 solo se elimina la compatibilidad síncrona, que no se usa. Sin trabajo.
- **PPR / `experimental_ppr`**: no se usa. En 16 el flag desaparece y el equivalente es `cacheComponents`, que **no** hay que activar ahora: la guía advierte de que «no es un cambio de nombre» y puede provocar errores de build por datos sin cachear fuera de `<Suspense>`.
- **`serverRuntimeConfig` / `publicRuntimeConfig`**: no se usan (se usan variables de entorno). Sin trabajo.
- **`export const revalidate` / `dynamic = "force-dynamic"`** (`app/page.tsx:20`, `app/pensiones/[id]/page.tsx:26`, `app/publicar/page.tsx:18`): siguen vigentes en 16. Sin trabajo.
- **`unstable_rootParams`, AMP, `devIndicators` obsoletos**: no se usan. Sin trabajo.

#### Paso 9 — Verificación obligatoria (no marcar la migración como hecha sin esto)

1. `npm run typecheck` → 0 errores (el `cookies()` async y `useActionState` lo delatan rápido).
2. `npm run build` **limpio** (borrar `.next` antes) → sin errores; comprobar que **existen** `BUILD_ID` y `prerender-manifest.json` (la prueba objetiva de que hay artefacto real, H-04).
3. `npm start` + `node scripts/prueba-humo.mjs` → todas las rutas responden.
4. `node scripts/verificar-seo.mjs` → esta vez **debe** poder leer `.next/server/app/index.html`.
5. **Revisión visual de la ficha con mapa** (Leaflet + Turbopack, riesgo del Paso 6) en móvil y escritorio.
6. **Publicación de extremo a extremo** en modo dinámico: registro → publicar → la pensión aparece sin esperar 60 s (verifica `updateTag`).
7. **Lighthouse** en `/` y en una ficha: LCP, CLS e INP. Nota: a partir de 16, `next build` **ya no imprime** `size` ni `First Load JS`, así que Lighthouse/Vercel Analytics pasa a ser la única fuente de métricas.
8. `npm audit` → 0 vulnerabilidades.

#### Paso 10 — Rollback

Volver a la rama anterior (`git checkout main`, `npm ci`) restaura el estado exacto, porque `node_modules` se reconstruye desde el lockfile. **No hace falta conservar `.next`**: se regenera con `npm run build`. Este es el motivo de exigir el Paso 1 (build verde previo): si algo se tuerce, hay un estado bueno conocido al que volver.

### 4.3 Matriz de riesgos de la migración

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| `react-leaflet@4` incompatible con React 19 → build roto | **Alta** (peer declarado `react ^18`) | Alto | Subir a `react-leaflet@5` en el mismo paso; revisar API de `MapContainer`/`Popup`/`Circle` tras el salto |
| `useFormState` deprecado en React 19 | Alta | Medio | Migrar a `useActionState` (Paso 4) |
| `cookies()` síncrono | **Cierta** (es breaking change) | Alto | Codemod + `await`; los tipos lo garantizan |
| `revalidateTag` de 1 argumento | **Cierta** (error de tipos) | Medio | `updateTag` (o `revalidateTag(tag, profile)`) |
| `next build` falla por config webpack inyectada | Baja (no hay config propia) | Alto | `--webpack` como salida; revisar el error |
| Imágenes remotas que redirigen > 3 veces dejan de optimizarse | Baja-media | Medio | Probar con URLs reales de anfitriones |
| Mapa sin estilos por Turbopack + `leaflet.css` | Baja | Medio | Revisión visual del Paso 9.5 |
| Cambio de comportamiento de `scroll-behavior: smooth` | Media | Bajo | El proyecto define `scroll-behavior: smooth` en `app/globals.css:6`; Next 16 **ya no lo sobrescribe** en navegaciones. Si se percibe el scroll "pegajoso" al navegar, añadir `data-scroll-behavior="smooth"` al `<html>` |
| Métricas de build desaparecidas | Cierta | Bajo | Usar Lighthouse; no citar `First Load JS` |
| Confusión por `.next/dev` nuevo | Baja | Bajo | Actualizar `Iniciar-App.bat` / `Iniciar-Dev.bat` si asumen rutas de `.next` |

---

## 5. Propuesta de pruebas automatizadas e integración continua

### 5.1 Por qué aquí es inusualmente barato

El proyecto ya tiene la propiedad que hace caro testear en otros: **la lógica de negocio es pura y está separada de la presentación**. `lib/filtros.ts` recibe el catálogo y los favoritos como argumentos y no importa datos ni `window` (verificado); `lib/pension.ts`, `lib/formato.ts` y `lib/favoritos.ts` son funciones puras con `try/catch` defensivo. Consecuencia práctica: las pruebas unitarias de las reglas de negocio del marketplace se escriben **sin DOM, sin mocks y sin red**, en milisegundos. Solo el flujo de reserva necesita navegador real (§5.3).

**Herramientas propuestas:** **Vitest** (rápido, configuración mínima, ESM nativo — encaja con `"type"` de Next y con `moduleResolution: bundler`) y **Playwright** (e2e; su `webServer` levanta `npm start` solo). Alternativa si se quiere una sola herramienta: Vitest + `@vitest/browser`; no lo recomiendo, porque el flujo de WhatsApp y el service worker necesitan un navegador completo.

### 5.2 Pruebas unitarias del motor (Vitest) — casos concretos

Estos casos están derivados del código real, no de una plantilla. Los que marco con ⚠️ **fijan decisiones que hoy solo están en comentarios** y que un refactor futuro podría romper sin que nadie lo note.

**`lib/filtros.ts` — `coincideRangoDistancia` (fronteras)**

| Entrada | Esperado | Por qué importa |
|---|---|---|
| 4.9 / 5 con rango `<5` | `true` / `false` | Frontera del filtro más usado |
| 5 y 10 con rango `5-10` | ambos `true` | ⚠️ Hoy `10` pertenece a `5-10` (condición `>= 5 && <= 10`) |
| 10 con rango `10-15` | `false` | ⚠️ Confirma que no hay solape entre rangos (10 es de `5-10`) |
| 15 con rango `10-15` | `true` | Techo de la caminata |
| 16 con rango `10-15` | `false` | Fuera de catálogo |
| cualquiera | `true` | Sin filtro |

**`lib/filtros.ts` — filtrado por habitación y pensión**

- `habitacionCumpleFiltros` con `precioMaximoCop: 0` → **no** filtra por precio (el `0` significa "sin tope", `lib/filtros.ts:65`). Regresión clásica si alguien cambia `>` por `>=`.
- `habitacionCumpleFiltros` debe devolver `false` para `disponible: false` aunque cumpla todo lo demás.
- ⚠️ `pensionCumpleFiltros` con una pensión **sin habitaciones**: `true` si `precioMensual <= tope` y no hay filtro de género ni alimentación; `false` si se pide género o alimentación (`lib/filtros.ts:81-85`). Es un comportamiento deliberado para no ocultar publicaciones nuevas.
- `habitacionDestacada` → la **más barata** que cumple filtros; `null` cuando ninguna cumple (y entonces la tarjeta muestra "Sin habitaciones con estos filtros", `components/CardPension.tsx:100-114`).
- `limitesDePrecio([])` → `{ min: 300000, max: 1500000 }`; con `max === min` → `min + PASO_PRECIO` (`lib/filtros.ts:42-46`); pensión sin habitaciones → usa `precioMensual` (`:39`).
- `aplicarFiltros` → ordena por `distancia_a_pie_minutos` ascendente; con `soloFavoritas: true` y favoritos vacíos → `[]`; con `soloFavoritas: false` ignora la lista de favoritos.

**`lib/filtros.ts` — URL compartible (ida y vuelta)**

- Round-trip: `parametrosAFiltros(filtrosAParametros(f, max), max)` devuelve `f` para casos válidos.
- Robustez con basura (importante, porque la URL la escribe el usuario): `?precio=abc` → cae al máximo real; `?precio=99999999` → se recorta al máximo (`:152`); `?genero=alien` → `"todos"`; `?dist=99` → `"cualquiera"`; `?comida=1` → `true`; `?precio=` → máximo (no `0`).
- `filtrosAParametros` **no** escribe `precio` cuando es igual al máximo real (evita URLs con ruido, `:126-128`).

**`lib/formato.ts`**

- `formatearCOP(1200000) === "$1.200.000"` (separador de miles es-CO con punto). Es el formato que promete el enunciado.
- `normalizarNumeroWhatsApp("+57 300 123 4567") === "573001234567"` y `numeroWhatsAppValido("573001234567") === true`, `numeroWhatsAppValido("123") === false`.
- `mensajeWhatsApp(pension)` **sin** habitación → rama general con precio de referencia (`:65-71`); con habitación → contiene tipo, género, precio y "con/sin alimentación".
- `enlaceWhatsApp` → empieza por `https://wa.me/`; y esta aserción clave: `new URL(enlace).searchParams.get("text") === mensajeWhatsApp(...)` con un título que contenga `&`, `?` y `#`. Verifica que `encodeURIComponent` (`:87`) hace bien su trabajo y que el mensaje no se corrompe.
- ⚠️ Con `NEXT_PUBLIC_WHATSAPP_NUMBER` ausente, el número es el demo `573001234567`: la prueba debe dejar constancia explícita de ese comportamiento para que H-11 no se arregle "a medias".

**`lib/pension.ts`**

- `precioDesde` → mínimo de disponibles; sin disponibles → `precioMensual` (`:34-38`).
- `galeriaDe` **nunca** devuelve `[]` (usa `IMAGEN_RESPALDO`, `:21-24`); `imagenesDe` descarta cadenas vacías.
- `resumenHabitaciones` singular/plural/cero (`:51-56`).
- `generosDisponibles` no repite géneros (usa `Set`, `:46-48`).

**`lib/favoritos.ts`** (con `happy-dom` o un stub de `window.localStorage`)

- `JSON.parse` inválido o un objeto que no es array → `[]`.
- Array mixto `["a", 2, null]` → solo strings (`:24`).
- `alternarFavorito("x")` añade; repetir elimina; `guardarFavoritos` emite `favoritos-cambiaron`.
- Escritura bloqueada (modo privado): `localStorage.setItem` que lanza → no propaga el error y la app sigue (`:33-37`).

**`lib/supabase/mapeo.ts`** (mapeo de frontera)

- Fila completa → objeto de dominio con los tipos correctos (`creada_en` a `Date`).
- Campos opcionales ausentes/`null` → valores por defecto sin lanzar (protege el "modo mixto" entre semilla y base de datos).
- Este archivo es la frontera del contrato: **una prueba aquí evita que un cambio de esquema rompa el catálogo en silencio**.

**Cobertura objetivo:** no perseguir un número; con estas suites `lib/` queda prácticamente cubierto y es donde vive el riesgo real. Sugiero **umbral de cobertura del 80 % limitado a `lib/**`** (no global), para que la métrica no presione a testear presentación.

### 5.3 Pruebas de extremo a extremo (Playwright) — flujo de reserva

**E1 — Flujo de reserva por WhatsApp (el test más importante del proyecto)**
Cargar `/` → esperar las tarjetas → clic en "Reservar por WhatsApp" de la primera tarjeta → capturar la nueva página con `context.waitForEvent("page")` (o interceptar la navegación) → aserciones:
1. La URL empieza por `https://wa.me/`.
2. `new URL(url).searchParams.get("text")` **contiene el título de la pensión** de esa tarjeta y la cadena `/mes`.
3. El número de teléfono del path tiene entre 10 y 15 dígitos (cubre H-11 en un punto de fallo real).
*Nota de implementación:* validar la URL **de la petición** (no la página final), porque `wa.me` puede redirigir a `api.whatsapp.com` o mostrar una página intersticial. Sin esta precisión el test será inestable.

**E2 — Filtros en tiempo real y persistencia en URL**
Mover el slider de precio a un valor intermedio → la URL contiene `?precio=` → recargar la página → el catálogo aparece ya filtrado y el contador coincide con el de antes de recargar. Después, hacer clic en "Limpiar filtros" (estado vacío) y comprobar que el contador vuelve al total.

**E3 — Frontera de distancia**
Seleccionar el chip `< 5 min` → solo quedan las pensiones con `distancia_a_pie_minutos < 5` (con la semilla actual, exactamente **1**: `residencia-el-pando`, 4 min). Aserción sobre el contador, no sobre el nombre, para no acoplarse al copy.

**E4 — Favoritos sin cuenta**
Marcar una tarjeta → recargar → sigue marcada; el contador muestra "1 guardada"; activar `♥ Mis favoritas` → solo esa tarjeta. Verifica también la sincronización entre pestañas si se abre un segundo contexto.

**E5 — PWA offline**
Cargar `/` (deja el service worker registrado) → `context.setOffline(true)` → recargar → debe aparecer el aviso "Sin conexión" (`components/AvisoOffline.tsx:41`) y/o la página `/offline`, nunca la pantalla de error del navegador. Es la prueba que respalda la promesa offline del producto.

**E6 — Publicación (requiere Supabase de pruebas)** — dejar como suite opcional marcada `@dinamico`: registro → login → publicar → comprobar que aparece en el catálogo sin esperar los 60 s. Es el test que cubre `updateTag` (H-03) y el ciclo de publicación completo; sin credenciales no debe ejecutarse (hoy `/publicar` muestra el aviso de modo demo).

**Regla anti-fragilidad:** ningún test debe afirmar textos de marketing. En esta auditoría vi lo fácil que se rompe eso: la prueba de humo espera "Modo dinámico pendiente" (`scripts/prueba-humo.mjs:18`), texto que desaparece por diseño al configurar Supabase.

### 5.4 Integración continua (GitHub Actions)

No existe `.github/` (0 workflows). Propuesta mínima y suficiente:

```yaml
name: calidad
on: [push, pull_request]
jobs:
  verificar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22          # Next 16 exige >= 20.9
          cache: npm
      - run: npm ci                  # limpia extraneous (H-16)
      - run: npm run typecheck       # tsc --noEmit
      - run: npm run lint            # eslint . (flat config, H-05)
      - run: npx vitest run          # unitarias de lib/
      - run: npm run build           # debe generar BUILD_ID (H-04)
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test     # e2e; su webServer levanta `npm start`
```

Tres detalles que evitan fallos conocidos:
1. **Orden:** primero `typecheck` (segundos, corta errores de tipos antes de compilar), luego lint, luego unitarias, y **al final** build y e2e (los caros).
2. **`webServer` de Playwright** (`command: npm start`, `url: http://localhost:3000`, `reuseExistingServer: !process.env.CI`): evita escribir un paso manual de "levantar servidor y esperar".
3. **Aviso de Windows para los scripts locales:** en PowerShell, rutas con corchetes como `app/pensiones/[id]/page.tsx` se interpretan como patrones de caracteres y no coinciden (me ocurrió durante esta auditoría). Los scripts de verificación que recorran esa ruta deben usar `-LiteralPath`.

**Definition of Done propuesta para el equipo:** un cambio no está terminado hasta que `npm run verificar` (tipos + lint + contraste) y `npm run build` pasan **y** el pipeline está verde. Eso convierte en automático lo que hoy depende de que alguien recuerde ejecutar scripts a mano.

### 5.5 Qué NO conviene automatizar

- **Textos de copy y microcopy:** cambian por decisiones de CRO; congelarlos en tests obliga a actualizarlos constantemente y genera ruido. Probar estructura (`h1` existe, contador es numérico), no frases.
- **Snapshots de HTML completo:** cualquier ajuste de estilos los rompe; aportan muy poco frente al coste de mantenimiento.
- **Estilos visuales exactos:** mejor una revisión visual (móvil + escritorio) antes de publicar, como ya se hace.
- **Rendimiento como umbral duro en CI:** Lighthouse en CI es frágil por la varianza del runner. Medirlo en Vercel Analytics/Lighthouse local y revisarlo por release.

---

## 6. Deuda técnica ordenada por relación impacto / esfuerzo

La columna **Prioridad** combina riesgo (seguridad, correctitud, pérdida de negocio) y coste de arreglo. Todo lo de la Oleada 1 es esfuerzo bajo: la mayor parte es de **minutos**, no de días.

### 6.1 Oleada 1 — antes de lanzar (horas, no días)

| Orden | Acción | Hallazgo | Esfuerzo | Por qué primero |
|---|---|---|---|---|
| 1 | **Build limpio reproducible** + scripts `build:limpio` y `verificar` | H-04 | 🟢 15 min | Sin esto, ninguna verificación posterior es fiable; desbloquea el trabajo de todos |
| 2 | **Quitar `image/avif` y restringir `remotePatterns`** (mitigación inmediata) | H-01 | 🟢 15 min | Cierra la superficie crítica mientras se planifica la migración |
| 3 | **`SITIO_URL` por variable de entorno** + fallo de build si falta en producción | H-10 | 🟢 30 min | Evita canónicas y JSON-LD apuntando a un dominio ajeno |
| 4 | **WhatsApp fail-loud** (sin fallback silencioso al número demo) | H-11 | 🟢 30 min | Es el paso de conversión: un fallo aquí pierde leads |
| 5 | **`engines` + `.nvmrc`** (Node ≥ 20.9) | H-13 | 🟢 10 min | Requisito duro de Next 16 |
| 6 | **ESLint en flat config** + scripts `lint`/`typecheck` | H-05 | 🟢 1 h | Recupera la red de calidad que `next build` deja de dar en 16 |
| 7 | **`.eq("activa", true)`** en la lectura pública por id | Nota cruzada §3.3 | 🟢 10 min | Integridad + SEO (contenido retirado no debe seguir accesible/indexable) |
| 8 | **Higiene**: `npm ci`, borrar `.next/cache`, `AGENTS.md`, `node-compile-cache/` en `.gitignore` | H-16 | 🟢 30 min | Reduce confusión y falsos diagnósticos |

### 6.2 Oleada 2 — primeras semanas (1–2 días de trabajo, alto retorno)

| Orden | Acción | Hallazgo | Esfuerzo | Por qué ahora |
|---|---|---|---|---|
| 1 | **Migración a Next 16** completa (§4), incluida la subida a `react-leaflet@5`, `useActionState` y `cookies()` async | H-01, H-02, H-03 | 🟡 2 días | Cierra vulnerabilidades, adopta el arreglo de raíz y evita migrar con datos en producción |
| 2 | **Vitest + Playwright + CI** (§5) | H-12 | 🟡 1 día | Convierte la verificación manual en automática; habilita refactors seguros |
| 3 | **Caché y consultas**: `cache()`/`cacheTag` + `select("*, habitaciones(*)")` + límite en `generateStaticParams` | H-07 | 🟢 2 h | Menos consultas por render y build acotado al crecer |
| 4 | **Indexar habitaciones con `Map`** en `combinar()` (O(P+H)) | H-08 | 🟢 30 min | Quita un algoritmo cuadrático de la ruta crítica del render |
| 5 | **Slider sin navegación RSC** (`history.replaceState` + debounce) | H-06 | 🟢 1 h | La interacción más usada del catálogo deja de generar ráfagas de peticiones |
| 6 | **`requestAnimationFrame` + guarda de cambio** en el `onScroll` del carrusel | H-09 | 🟢 30 min | Menos re-renders en móvil |
| 7 | **Reescribir `prueba-humo.mjs`** como e2e con modos demo/dinámico | H-17 | 🟢 1 h | Deja de fallar por copy o por datos que ya no existen |

### 6.3 Oleada 3 — con tracción (cuando haya usuarios reales)

| Acción | Hallazgo | Esfuerzo | Cuándo |
|---|---|---|---|
| **Proveedor de tiles con clave** (MapTiler/Mapbox/Geoapify) y mapa bajo demanda con `IntersectionObserver` | H-14 | 🟡 1 día | Antes de campañas de tráfico: la política de tiles públicos de OSM no cubre uso comercial/intensivo |
| **Un solo SVG para las estrellas** | H-15 | 🟢 1 h | Con el catálogo creciendo (menos nodos por tarjeta) |
| **Convención de rutas documentada** (`/` como canónica del catálogo) | H-18 | 🟢 30 min | Al incorporar más gente al proyecto |
| **Evaluar `cacheComponents` (PPR)** con la app ya en 16 | §4 Paso 8 | 🟡 2–3 días | Solo si se necesita render parcial por ficha; la guía advierte de que no es un cambio de nombre |
| **Experimentar con React Compiler** (`reactCompiler`) midiendo tiempos de compilación | §4 Paso 4 | 🟡 1 día | Después de estabilizar la migración; nunca en la misma tanda |
| **`next typegen`** para `PageProps`/`LayoutProps` en lugar de tipos escritos a mano | §4 Paso 1 | 🟢 1 h | Al tocar rutas nuevas |

### 6.4 Resumen del estado de madurez

| Dimensión | Estado | Comentario |
|---|---|---|
| Arquitectura y separación de responsabilidades | 🟢 Muy bueno | Lógica pura, frontera de mapeo única, Server Components donde toca |
| Tipado | 🟢 Muy bueno | `strict: true`, cero `any` detectados, contrato documentado |
| Rendimiento de render | 🟡 Aceptable | Falta mover trabajo fuera del render (H-06 a H-09) |
| Escalabilidad de datos | 🟡 Aceptable | Correcto para demo; requiere join, caché y paginación para crecer |
| Seguridad de dependencias | 🔴 Crítico | 2 advisories activos, uno explotable con la configuración actual |
| Automatización de calidad | 🔴 Ausente | 0 tests, 0 linting ejecutable, 0 CI |
| Reproducibilidad del build | 🔴 Roto hoy | No hay artefacto de producción válido en disco |
| Accesibilidad | 🟢 Buena | 16/16 contrastes AA verificados; brechas ya listadas en `ux-cro.md` |

---

## Anexo A — Cómo reproducir esta auditoría

```powershell
cd C:\Users\DELL\AccioWork\2026-08-29-04-59-08-655-0b455861\pensiones-unimagdalena

# Estado del build (debe fallar hoy: no hay HTML prerenderizado → H-04)
node scripts/verificar-seo.mjs

# Contraste WCAG (debe pasar 16/16)
node scripts/verificar-contraste.mjs

# Vulnerabilidades (esperado hoy: 1 crítica + 1 alta)
npm audit

# Dependencias reales y paquetes extraneous
npm ls --depth=0

# Comprobar que hay artefacto de build válido (tras un build limpio)
Test-Path .next\BUILD_ID ; Test-Path .next\prerender-manifest.json

# Requisitos de la migración
npm view next@16.3.5 engines
npm view react-leaflet@4.2.1 peerDependencies
npm view react-leaflet@5 peerDependencies
npm view @supabase/ssr peerDependencies
```

**Nunca** ejecutar `npm run build` con `next dev` abierto en la misma carpeta (`.next` compartido). Con Next 16 el riesgo desaparece (`dev` escribe en `.next/dev`), pero mientras se use Next 14 sigue vigente.

## Anexo B — Límites declarados de esta auditoría

1. No se ejecutó `npm run build` ni `npm start` (restricción de la tarea). Las afirmaciones sobre el build provienen de **inspeccionar el estado real de `.next`** y de ejecutar `verificar-seo.mjs`, que falló por ausencia de HTML prerenderizado.
2. **No hay cifras de rendimiento por ruta en este informe** y no se reutilizan las del informe anterior (110 kB de First Load JS): provenían de un build que ya no existe en disco y no son reproducibles. Cualquier número así hoy sería inventado.
3. No se midió Core Web Vitals en navegador (requiere servidor y build de producción). Las propuestas de rendimiento se justifican por patrón de código y por los tamaños reales medidos (`leaflet.js` 144,1 KB, `react-leaflet` 48,4 KB, `.next/cache` 205 MB, `node_modules` 298,6 MB).
4. Las compatibilidades de Next 16 se verificaron contra la **documentación oficial** (actualizada 2026-08-25) y contra los **peers reales del registro npm**, no contra una migración ejecutada.
5. Los temas de seguridad de configuración (allowlist del optimizador, cabeceras, RLS) y de UX/accesibilidad se tratan en sus informes respectivos (`datos-backend.md`, `ux-cro.md`); aquí solo se referencian para no duplicar.
