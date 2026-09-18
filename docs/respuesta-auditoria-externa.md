# Respuesta a la auditoría externa

**Pensiones Unimagdalena** · verificación e implementación de 6 sugerencias
Fecha: 2026-09-17 · Responsable: Especialista en QA, SEO (Agente 3)

---

## Resultado: 3 implementadas · 2 implementadas con matices · 1 ya estaba resuelta

| # | Sugerencia | Veredicto tras verificar | Acción |
|---|---|---|---|
| 1 | JSON-LD con datos inventados | 🔴 **Confirmada, y peor de lo reportado** | Corregida |
| 2 | Páginas convertidas en Client Components | 🟡 Parcialmente cierta | Corregida (con matiz) |
| 3 | Carga de imágenes ineficiente en el grid | 🟡 Parcialmente cierta | Implementada |
| 4 | `params` sin tipar contra Next 15 | 🟡 Deuda técnica real | Implementada (compatibilidad) |
| 5 | Sin validación del número de WhatsApp | 🟢 Confirmada | Implementada |
| 6 | No se usa `next/font` | ⚪ **Ya estaba resuelto** | Sin cambios (con evidencia) |

---

## 1. JSON-LD con datos inventados — 🔴 CRÍTICO, corregido

**Confirmado, y el problema era mayor de lo reportado.** El conteo fabricado
(`Math.round(calificacion * 18)`) aparecía en **tres** lugares, no uno:

| Ubicación | Qué declaraba |
|---|---|
| `app/pensiones/[id]/page.tsx` (línea 89) | `reviewCount` dentro de `aggregateRating` del JSON-LD |
| `app/pensiones/[id]/page.tsx` (línea 134) | **En la interfaz visible**: "(N reseñas)" junto a las estrellas |
| `components/CardPension.tsx` (línea 70) | **En cada tarjeta del catálogo**: "(N reseñas)" |

El tercero era el más grave para la confianza del usuario: mostraba un número de
reseñas que no existía.

**Correcciones aplicadas**
- `aggregateRating` y `reviewCount` **eliminados** del JSON-LD, con un comentario
  que explica por qué no deben volver hasta tener reseñas reales.
- Las dos apariciones visibles ahora dicen **"Puntaje del equipo"** (puntaje
  interno verificable de la inspección presencial), que es lo que realmente mide
  `calificacion`.
- El campo `calificacion` quedó documentado en `types/index.ts` y en
  `supabase/esquema.sql` como *puntaje interno del equipo, no reseñas de usuarios*.
- La meta description pasó de "Calificación 4.8" a "Puntaje del equipo: 4.8/5".

**Dos mejoras de integridad que encontré al revisar el mismo bloque**
- `geo` en el JSON-LD de la pensión enviaba **coordenadas fijas del centro de
  Santa Marta** aunque la pensión esté en otro barrio. Ahora solo se emite si el
  anfitrión aporta latitud/longitud reales.
- `addressLocality` recibía el **barrio**, que no es una localidad. Ahora
  `addressLocality: "Santa Marta"`, `addressRegion: "Magdalena"` y el barrio va en
  `streetAddress`.
- Se añadió `priceRange` (el precio más bajo real de sus habitaciones), dato
  verificable que sí aporta.

---

## 2. Client Components innecesarios — 🟡 parcial, corregido

**Matiz importante:** `app/page.tsx` **ya era un Server Component** desde la
integración con Supabase (la sugerencia describía el estado anterior). Sin
embargo, la crítica de fondo era válida en otro punto: **Hero, SellosConfianza y
Footer se renderizaban dentro del componente cliente**, así que viajaban en el
bundle del navegador sin necesitarlo.

**Corrección aplicada**
- Nuevo `components/CatalogoInteractivo.tsx`: **solo** panel de filtros + rejilla
  de resultados + estados vacíos (lo único interactivo).
- `app/page.tsx` (servidor) ahora compone: `<Hero />` + `<SellosConfianza />` +
  `<CatalogoInteractivo />` + `<Footer />`.
- Se eliminó el antiguo `components/Catalogo.tsx`.

**Medición real del build**

| Métrica | Antes | Después |
|---|---|---|
| Tamaño de la página `/` | 4.56 kB | **2.44 kB** |
| First Load JS de `/` | 112 kB | **110 kB** |

---

## 3. Carga de imágenes en el grid — 🟡 parcial, implementada

**Matiz:** la premisa "pide ~18 imágenes al cargar" no era exacta: el carrusel ya
aplicaba `loading="lazy"` (salvo la primera imagen, que usa `priority`) desde el
rediseño inicial del Agente 2. Aun así, el punto de fondo es correcto: las
diapositivas fuera de pantalla dentro de un contenedor con scroll horizontal
pueden ser precargadas por el navegador según su heurística.

**Corrección aplicada** (`components/Carrusel.tsx`)
- Nueva prop `diferirImagenes` (activa en las tarjetas del grid, desactivada en la
  galería de la ficha, donde el usuario espera ver todo).
- Cada diapositiva mantiene su contenedor (no se rompe el deslizamiento ni la
  maquetación), pero la `<Image>` solo se monta cuando la foto es la actual o la
  siguiente. Las no alcanzadas muestran un marcador neutro y **no se descargan**.
- Al deslizar, se activa la siguiente foto, así el gesto sigue siendo fluido.

---

## 4. `params` frente a Next 15 — 🟡 deuda real, implementada

En Next 14 `params` es un objeto y en Next 15 pasa a ser una `Promise`. En lugar
de solo anotarlo como deuda, se implementó la forma **compatible con ambas
versiones**: `await params` funciona igual si el valor es un objeto o una Promise.

```ts
interface Props {
  params: Promise<{ id: string }>;   // válido en Next 14 y 15
}
const { id } = await params;
```

Aplicado en `app/pensiones/[id]/page.tsx` (página y `generateMetadata`),
`app/login/page.tsx` y `app/publicar/page.tsx` (sus `searchParams`). **Build
verificado**: compila y genera las 16 rutas sin errores.

---

## 5. Validación del número de WhatsApp — 🟢 implementada

`lib/formato.ts` ahora **normaliza** el número a solo dígitos y valida el formato.
Se fue un paso más allá de lo sugerido (que era solo avisar): normalizar hace que
los formatos habituales de un `.env.local` funcionen directamente.

| Valor en `.env.local` | Antes | Ahora |
|---|---|---|
| `+57 300 123 4567` | ❌ enlace roto | ✅ `573001234567` |
| `57-300-1234567` | ❌ enlace roto | ✅ `573001234567` |
| `300` | ❌ enlace roto silencioso | ⚠️ `console.warn` en desarrollo |

También se exportó `numeroWhatsAppValido()` para poder reutilizarlo.

---

## 6. `next/font` — ⚪ ya estaba resuelto

Esta sugerencia describía el estado anterior del proyecto. La migración se hizo
en la fase de rendimiento (2026-09-13). Evidencia en el código y en el build:

- `app/layout.tsx`: `import { Plus_Jakarta_Sans, Public_Sans } from "next/font/google"`.
- `tailwind.config.ts`: las familias apuntan a las variables `--fuente-display` /
  `--fuente-cuerpo` que genera `next/font`.
- El `<head>` con `<link>` a Google se **eliminó**.
- Verificación del build: **10 archivos de fuente** en `.next/static/media` y
  **0 referencias** a `fonts.googleapis.com` en el CSS compilado.

---

## Hallazgo propio adicional (misma categoría que el punto 1)

El JSON-LD **global** declaraba el marketplace como `LodgingBusiness` con
**coordenadas fijas** de Santa Marta. El marketplace es un directorio, no un
alojamiento, y no tiene una sede física en esas coordenadas: era información
inexacta en datos estructurados.

**Corregido:** el sitio ahora declara `WebSite` + `Organization` (con `areaServed`
en Santa Marta y `publisher`), y `LodgingBusiness` se emite **solo en cada ficha
de pensión**, que sí es un alojamiento real.

---

## Verificación final

```bash
npm run build                    # 16 rutas, sin errores de tipos ni lint
node scripts/verificar-seo.mjs   # 19 comprobaciones de datos estructurados y SEO
```

```
Home    : WebSite OK · Organization OK · sin LodgingBusiness OK · sin coordenadas fijas OK
          sin "reseñas" OK · "Puntaje del equipo" OK · catálogo en servidor OK
          sellos OK · favoritos OK · sin Google Fonts OK
Detalle : LodgingBusiness OK · priceRange OK · sin aggregateRating OK
          sin reviewCount OK · sin "reseñas" OK · puntaje honesto OK
19/19 verificaciones correctas
```

---

## Lo que la auditoría elogió y confirmamos

- **Separación entre lógica pura y presentación**: correcta y ahora reforzada
  (`lib/filtros.ts` recibe los datos como argumento; las funciones de URL también
  son puras).
- **`generateStaticParams` + `generateMetadata`**: correcto, 6 fichas SSG.
- **Accesibilidad real**: `role="radiogroup"`, `aria-pressed`, `aria-live`,
  foco visible y skip-link, todo verificado.
- **Service worker con estrategias por tipo de recurso** y **`encodeURIComponent`**
  en el enlace de WhatsApp: correctos.

---

## Pendientes recomendados

1. **Reseñas reales**: cuando existan, añadir un campo aparte (p. ej. `resenas`) y
   recién entonces emitir `aggregateRating` con datos verificables.
2. **Migrar a Next 16** para cerrar las 2 vulnerabilidades de `npm audit`.
3. **Subida de fotos a Supabase Storage** (permitiría cerrar `remotePatterns` a un
   único dominio en `next.config.mjs`).
