# Auditoría SEO local, GEO y calidad QA

**Pensiones Unimagdalena** · Tarea #8 · 2026-09-17
Responsable: Especialista en QA, SEO (Team Lead)

---

## 1. Resumen ejecutivo

**Veredicto: la base técnica de SEO está por encima de la media, pero falta la capa que produce tráfico: dominio configurable, señales de rastreo y contenido.**

Lo que ya está bien y conviene no tocar: canonical propio por ficha, Open Graph por pensión, `lang="es"`, títulos y descripciones dinámicos, JSON-LD correcto y honesto (`WebSite` + `Organization` en el sitio, `ItemList` en el catálogo, `LodgingBusiness` + `priceRange` por alojamiento), fuentes autoalojadas sin peticiones a Google, HTML del catálogo renderizado en el servidor, ISR con caché por etiquetas y una PWA con soporte offline.

Lo que impide que eso se convierta en tráfico, en orden de impacto:

1. **El dominio canónico está escrito en el código** (`lib/sitio.ts:6`). Si el sitio se despliega en un dominio distinto, **todas las canónicas y el JSON-LD apuntan a un dominio que no es el tuyo** — es el escenario clásico de desindexación silenciosa.
2. **No hay `sitemap.xml` ni `robots.txt`.** En un marketplace cuyo valor es que cada pensión nueva se indexe, hoy no existe ningún mecanismo que le diga a los buscadores que esa página apareció.
3. **No existe capa de contenido.** Solo hay páginas de listado y de ficha: no hay ninguna página que pueda posicionar consultas informacionales ("precios de pensión en Santa Marta", "cómo verificar una pensión", "qué barrios están cerca de Unimagdalena") ni que le dé a un motor de IA algo citable.
4. **No hay señales externas ni datos propios**: imágenes de terceros (Unsplash) y contenido de demostración. Sin datos propios (precios promedio por barrio, tiempos reales de caminata) no hay nada que un motor de IA prefiera citar de este sitio antes que de otro.

**No invento métricas.** No hay datos verificables de volumen de búsqueda ni de tráfico en este repositorio, y este informe **no incluye cifras de volumen inventadas**. La sección 6 explica cómo obtenerlas con fuentes reales.

---

## 2. Verificación ejecutada (evidencia reproducible)

| Comprobación | Comando | Resultado |
|---|---|---|
| Build de producción | `npm run build` | ✅ 16 rutas, sin errores de tipos ni lint; middleware 87.1 kB |
| Integridad SEO y datos estructurados | `node scripts/verificar-seo.mjs` | ✅ **19/19** comprobaciones |
| Contraste WCAG AA | `node scripts/verificar-contraste.mjs` | ✅ **16/16** combinaciones |
| Rutas SEO técnicas | inspección de `app/` y del listado de rutas del build | ❌ sin `robots.txt`, sin `sitemap.xml` |
| H1 por página | grep de `<h1>` en `app/` | ❌ ausente en `/login` y `/registro` |

El build estaba inválido antes de esta verificación (`.next` sin artefactos tras compilaciones interrumpidas). Se regeneró en serie, como único escritor, y sobre ese artefacto corren las dos verificaciones anteriores.

---

## 3. Hallazgos

### 🔴 SEO-01 — Dominio canónico escrito en el código
- **Evidencia:** `lib/sitio.ts:6` (`SITIO_URL = "https://pensiones-unimagdalena.vercel.app"`); consumido en `app/layout.tsx` (JSON-LD del sitio), `app/page.tsx:41` (`ItemList`) y `app/pensiones/[id]/page.tsx` (canonical y Open Graph por ficha).
- **Impacto:** con otro dominio de despliegue, cada página se declara canónica hacia un dominio ajeno. Los buscadores pueden dejar de indexar el sitio real. Afecta también a los enlaces compartidos por WhatsApp.
- **Propuesta:** `NEXT_PUBLIC_SITE_URL` como fuente única, con respaldo automático a `VERCEL_URL` en el servidor. Sin variables configuradas, usar el dominio de producción declarado.
- **Esfuerzo:** 🟢 30 min · **Prioridad:** alta · **Bloquea lanzar:** sí (al cambiar de dominio).

### 🔴 SEO-02 — No existe `sitemap.xml`
- **Evidencia:** no hay `app/sitemap.ts` ni `public/sitemap.xml`; el listado de rutas del build no incluye `/sitemap.xml`.
- **Impacto:** cada pensión nueva depende del descubrimiento por enlaces. Con ISR el sitemap puede generar `lastModified` real, que es justamente lo que acelera la indexación de contenido nuevo.
- **Propuesta:** `app/sitemap.ts` que lea `obtenerPensiones()` (ya cacheado) e incluya: home, cada `/pensiones/[id]`, futuras páginas de barrio y guías, con `changeFrequency` y `priority` coherentes. Excluir `/login`, `/registro` y `/publicar` (ya llevan `noindex`).
- **Esfuerzo:** 🟢 1 h · **Prioridad:** alta · **Bloquea lanzar:** no, pero es lo primero después.

### 🔴 SEO-03 — No existe `robots.txt`
- **Evidencia:** no hay `app/robots.ts` ni `public/robots.txt`.
- **Impacto:** sin directrices ni referencia al sitemap. Además, en el escenario GEO actual conviene **no bloquear** a los rastreadores de IA (GPTBot, PerplexityBot, ClaudeBot, Google-Extended) si el objetivo es aparecer citado en respuestas de IA.
- **Propuesta:** `app/robots.ts` con `allow: "/"`, exclusión explícita de `/api/`, `/auth/`, `/publicar`, y referencia al sitemap. Documentar la decisión sobre rastreadores de IA en el propio archivo.
- **Esfuerzo:** 🟢 20 min · **Prioridad:** alta · **Bloquea lanzar:** no.

### 🟠 SEO-04 — Sin datos estructurados de oferta
- **Evidencia:** `app/pensiones/[id]/page.tsx` emite `LodgingBusiness` con `priceRange` derivado de `precioDesde()` y `amenityFeature` con los servicios, pero nada por habitación.
- **Impacto:** se pierde la posibilidad de que los buscadores entiendan disponibilidad y precio por tipo de habitación, justo el dato que un estudiante busca.
- **Propuesta:** cuando existan habitaciones reales (hoy el formulario no las crea, ver `datos-backend.md` H-06), añadir `makesOffer` con un `Offer` por habitación: `price`, `priceCurrency: "COP"`, `availability` (`InStock` / `SoldOut`) y `eligibleQuantity` con la ocupación. **Sin inventar datos**: solo para habitaciones publicadas por el anfitrión.
- **Esfuerzo:** 🟡 3 h (después de H-06) · **Prioridad:** media.

### 🟠 SEO-05 — Sin breadcrumbs ni `BreadcrumbList`
- **Evidencia:** grep de `BreadcrumbList` / `breadcrumb` / `itemprop` en `app/` y `components/`: sin resultados. La ficha de pensión solo tiene el enlace "Volver al catálogo".
- **Impacto:** se pierden los breadcrumbs en los resultados de Google y una vía de enlazado interno jerárquico (necesaria cuando existan páginas de barrio).
- **Propuesta:** componente `Migas` + JSON-LD `BreadcrumbList` con la jerarquía `Inicio › Pensiones en Santa Marta › [Barrio] › [Pensión]`. Encaja con la propuesta de páginas por barrio (§4).
- **Esfuerzo:** 🟢 2 h · **Prioridad:** media.

### 🟠 SEO-06 — No existe capa de contenido (el mayor límite de crecimiento)
- **Evidencia:** las únicas rutas públicas son `/` (catálogo), `/pensiones/[id]`, `/offline`. Ninguna página informativa.
- **Impacto:** el sitio solo puede competir por consultas transaccionales de marca o de categoría muy directa. Sin páginas informativas no hay superficie para tráfico orgánico estable ni material que un motor de IA cite como fuente.
- **Propuesta:** ver el plan de contenidos de §4 (6 páginas iniciales, todas con contenido real y verificable).
- **Esfuerzo:** 🟡 3–5 días · **Prioridad:** alta (después de lanzar con datos reales).

### 🟠 SEO-07 — `/login` y `/registro` sin `<h1>`
- **Evidencia:** grep de `<h1>`: presente en home (Hero), ficha, `/publicar`, `/offline`, 404 y error; **ausente** en `app/login/page.tsx` y `app/registro/page.tsx` (los títulos son `h2` dentro de los formularios).
- **Impacto:** estructura semántica y accesibilidad. Aunque llevan `robots: noindex`, un documento sin `h1` es una deficiencia objetiva.
- **Propuesta:** un `h1` por página (puede ser visualmente el mismo texto que hoy usa el `h2`) y degradar el `h2` interno.
- **Esfuerzo:** 🟢 20 min · **Prioridad:** media-baja.

### 🟡 SEO-08 — Imágenes de terceros y sin imágenes propias para compartir
- **Evidencia:** `lib/datos.semilla.ts` usa URLs de `images.unsplash.com` para las 6 pensiones; `LIB/formato`'s Open Graph reutiliza la foto de la pensión o una genérica (`lib/sitio.ts:9`).
- **Impacto:** el contenido visual no es propio (riesgo de hotlinking y de que un asset cambie), y no hay imágenes 1200×630 diseñadas para resultados sociales, donde el CTR sube notablemente.
- **Propuesta:** migrar fotos a Supabase Storage (ver `datos-backend.md` §7 `0006_storage_fotos.sql`) y, más adelante, generar la imagen OG por pensión con `next/og` (foto + título + precio + distancia).
- **Esfuerzo:** 🟡 1 día · **Prioridad:** media.

### 🟡 SEO-09 — Descripción de ficha dependiente de un campo que puede venir vacío
- **Evidencia:** la meta descripción de la ficha se compone con `pension.descripcion`, `barrio`, distancia y puntaje. El formulario de publicación exige ≥30 caracteres (`app/actions/pensiones.ts`), pero las filas creadas por SQL directo pueden quedar con descripción vacía.
- **Impacto:** meta descripciones pobres o repetidas entre fichas → menor CTR y riesgo de contenido duplicado percibido.
- **Propuesta:** generar la descripción con los datos verificables siempre presentes (título, barrio, precio desde, minutos a pie, servicios), usando `descripcion` solo como enriquecimiento.
- **Esfuerzo:** 🟢 1 h · **Prioridad:** media.

### 🟡 SEO-10 — Sin señales de frescura ni preparación para catálogo grande
- **Evidencia:** `creada_en` existe en el modelo y en el mapper (`lib/supabase/mapeo.ts`) pero no se usa en ninguna parte visible ni en datos estructurados; el catálogo trae todas las filas sin paginar (`lib/datos.ts`).
- **Impacto:** los buscadores no tienen señal de actualización, y cuando haya 100+ pensiones la indexación y el rastreo se vuelven ineficientes.
- **Propuesta:** `datePublished`/`dateModified` en el JSON-LD de la ficha y paginación con canonical propio (`/pensiones?pagina=2`) cuando el catálogo supere ~30 elementos (coordinado con `datos-backend.md` H-07).
- **Esfuerzo:** 🟢 2 h · **Prioridad:** baja.

### 🟡 SEO-11 — Sin verificación de propiedad ni analítica
- **Evidencia:** no hay meta de verificación de Google Search Console, ni analítica, ni etiqueta de medición en `app/layout.tsx`.
- **Impacto:** imposible medir, imposible detectar problemas de indexación ni saber qué busca la gente que llega. **Sin esto, cualquier decisión de SEO es a ciegas.**
- **Propuesta:** verificar el dominio en Search Console tras el despliegue (con el sitemap), e instrumentar analítica respetuosa con la privacidad. Es el paso que convierte los demás hallazgos en medibles.
- **Esfuerzo:** 🟢 1 h · **Prioridad:** alta (justo después de desplegar).

### 🟢 SEO-12 — QA: sin pruebas automatizadas del motor de filtros
- **Evidencia:** 0 archivos de prueba en el repositorio; la verificación vive en scripts manuales (`scripts/prueba-humo.mjs`, `verificar-seo.mjs`, `verificar-contraste.mjs`) y `prueba-humo.mjs` depende de datos concretos de la semilla.
- **Impacto:** cualquier cambio en el motor de filtros o en el orden de resultados puede romper la experiencia sin que nadie se entere.
- **Propuesta:** lo detalla `tecnica-rendimiento.md` §5 (Vitest sobre `lib/filtros.ts`, Playwright sobre el flujo de reserva). Añado: un caso por cada filtro y por la combinación filtros + favoritos + URL.
- **Esfuerzo:** 🟡 1 día · **Prioridad:** media-alta.

---

## 4. Plan de contenidos SEO local

**Regla:** solo se publica una página si tiene contenido real y verificable. Nada de páginas clonadas por barrio con el mismo texto.

| # | Ruta propuesta | Intención | Contenido mínimo real | Datos estructurados |
|---|---|---|---|---|
| 1 | `/pensiones-en-santa-marta` | Transaccional amplia | Catálogo completo + introducción con precios reales (mín./máx. del catálogo) y tiempo medio a pie | `ItemList` |
| 2 | `/barrios/[barrio]` (6 páginas) | Transaccional local | Pensiones del barrio, distancia real a pie al campus, servicios más frecuentes, rango de precios calculado de las publicaciones | `ItemList` + `BreadcrumbList` |
| 3 | `/guias/como-elegir-pension-unimagdalena` | Informacional | Checklist real (visita presencial, servicios, normas, distancia, quién responde el contrato) | `FAQPage` + `BreadcrumbList` |
| 4 | `/guias/precios-pension-santa-marta` | Informacional | Tabla de precios promedio por barrio **calculada de los datos reales** del catálogo (no estimada) | `Dataset` o `FAQPage` |
| 5 | `/padres` | Confianza (audiencia secundaria) | Qué verificar antes de pagar, cómo funciona la reserva por WhatsApp, qué significa "verificada" | `FAQPage` |
| 6 | `/como-verificamos` | Confianza / E-E-A-T | Criterios de verificación, quién inspecciona, con qué frecuencia | `Organization` + `FAQPage` |

**Estructura de enlazado interno:** inicio → página de barrio → ficha de pensión; guías → enlazan a barrios y a fichas concretas; `/padres` → `/como-verificamos`. Los breadcrumbs (§SEO-05) materializan esta jerarquía.

**Orden de implementación:** 2 y 4 primero (son las de mayor intención y se calculan con datos que ya existen), luego 3 y 5, y por último 6.

---

## 5. Recomendaciones GEO (aparecer citado en ChatGPT, Gemini y Perplexity)

Los motores de IA citan lo que pueden leer y verificar. Sobre el estado actual:

1. **Mantener los datos estructurados exactos.** Ya se corrigió lo que habría sido el mayor riesgo (reseñas inventadas). La regla queda documentada en el README y verificada con `verificar-seo.mjs`.
2. **No bloquear rastreadores de IA** en `robots.txt` (GPTBot, PerplexityBot, ClaudeBot, Google-Extended). Es una decisión de producto, y conviene dejarla escrita en el archivo.
3. **Publicar datos propios y citables**: precio promedio por barrio, tabla de distancias a pie al campus, servicios más comunes. Un dato original y verificable es lo que hace que una IA prefiera citar este sitio en lugar de repetir un listado genérico.
4. **Contenido en formato respuesta**: párrafos cortos, encabezados que son preguntas, listas y tablas. Es el formato que los motores extraen mejor.
5. **Señales externas**: menciones en prensa local, grupos de estudiantes de la universidad y foros. Sin menciones externas, la visibilidad en IA se queda en cero por muy bueno que sea el JSON-LD.
6. **Experimento opcional:** publicar `llms.txt` con la estructura del sitio. Es una propuesta emergente, no un estándar; conviene tratarla como experimento medible, no como requisito.
7. **Medición:** cuando existan credenciales y catálogo real, el kit SEO·GEO del equipo puede medir tasa de mención y de citación por motor y comparar contra competidores. Requiere definir marca, dominio, competidores y país, y consume créditos de recolección.

---

## 6. Cómo obtener los datos que hoy no existen (sin inventarlos)

| Dato que falta | Fuente real | Cuándo |
|---|---|---|
| Volumen de búsqueda, dificultad y CPC por palabra clave | Google Keyword Planner o Semrush (requiere autorización de acceso) | Antes de ampliar contenido |
| Consultas reales que ya traen impresiones | Google Search Console | Al desplegar (§SEO-11) |
| Rendimiento real en campo (Core Web Vitals) | CrUX / PageSpeed Insights sobre el dominio desplegado | Al desplegar |
| Visibilidad en respuestas de IA | Kit SEO·GEO del equipo (recolección por motor) | Con catálogo real |
| Precio promedio por barrio | Cálculo propio sobre las publicaciones reales | Tras la Fase 1 de datos |

---

## 7. Límites declarados de esta auditoría

- No se ejecutó ningún servidor ni se midió rendimiento en dispositivo real: el análisis es sobre código y sobre el HTML del build.
- No hay datos de búsqueda ni de tráfico: **todas las recomendaciones de contenido son estructurales**, no están priorizadas por volumen (la §6 indica cómo obtenerlo).
- El modo dinámico con Supabase no está activo (faltan credenciales), así que las páginas por barrio y el sitemap basado en datos se proponen sobre el modelo, no sobre datos productivos.
- Reutilizo deliberadamente hallazgos de otros informes cuando el tema es el mismo (dominio canónico, imágenes, paginación, pruebas) y lo indico, en lugar de duplicarlos.
