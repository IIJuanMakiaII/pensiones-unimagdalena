# Mejoras de infraestructura, rendimiento y experiencia

**Pensiones Unimagdalena** · implementación del plan de escalado en 3 niveles
Fecha: 2026-09-13 · Responsable: Especialista en QA, SEO (Agente 3)

---

## 1. Resumen del plan solicitado

| # | Punto del plan | Estado | Dónde está |
|---|---|---|---|
| 1 | Migración a Supabase (backend y auth) | ✅ Ya implementado antes de este turno | `utils/supabase/*`, `middleware.ts`, `lib/datos.ts`, `supabase/esquema.sql` |
| 2 | Optimización multimedia (`<Image>`, dominios, `priority`) | ✅ Completado + ampliado | `next.config.mjs`, `components/Carrusel.tsx`, `app/pensiones/[id]/page.tsx` |
| 3 | Skeleton loaders | ✅ Completado | `app/loading.tsx`, `app/pensiones/[id]/loading.tsx`, `components/Esqueletos.tsx` |
| 4 | Persistencia de filtros en la URL | ✅ Completado | `components/Catalogo.tsx`, `lib/filtros.ts` |
| 5 | Sistema de favoritos local | ✅ Completado | `lib/favoritos.ts`, `hooks/useFavoritos.ts`, `components/BotonFavorito.tsx` |
| 6 | Caché inteligente (ISR) | ✅ Completado **de verdad** | `utils/supabase/publico.ts`, `lib/datos.ts`, `app/actions/pensiones.ts` |
| 7 | Mapa interactivo (Leaflet) | ✅ Completado | `components/MapaLeaflet.tsx`, `components/MapaUbicacion.tsx` |
| 8 | Soporte offline (Service Worker) | ✅ Ya implementado (SW propio, sin `next-pwa`) | `public/sw.js`, `app/offline/page.tsx`, `components/AvisoOffline.tsx` |

---

## 2. Decisiones por punto

### 2 — Optimización multimedia
El código ya usaba `<Image>` en todas las tarjetas (no quedaba ningún `<img>`), y `priority` solo
en la primera tarjeta y en la portada de la ficha. Se amplió con:
- `formats: ["image/avif", "image/webp"]` → AVIF pesa ~50 % menos que JPEG.
- `remotePatterns` para los anfitriones: al publicar se pegan URLs de fotos desde cualquier
  hosting; sin ese permiso Next **rechazaría la imagen en tiempo de ejecución**. Se mantienen
  las protecciones (`dangerouslyAllowSVG: false` y descarga como adjunto).
- `minimumCacheTTL` de 7 días: las fotos del catálogo cambian poco.

### 3 — Skeleton loaders
`app/loading.tsx` (catálogo: hero + barra de filtros + 6 tarjetas) y
`app/pensiones/[id]/loading.tsx` (ficha). Los esqueletos imitan la estructura real para evitar
saltos de maquetación.

### 4 — Filtros en la URL · **decisión clave**
Se añadieron `filtrosAParametros()` y `parametrosAFiltros()` al motor (funciones puras) para
serializar y reconstruir los filtros. La búsqueda se escribe con `router.replace(..., { scroll: false })`,
así que no recarga ni pierde la posición.

**Lo que cambié respecto al plan:** el plan proponía `useSearchParams`. Ese hook obliga a Next a
prerenderizar el **esqueleto** en lugar del catálogo (porque los parámetros no se conocen en el
build), y eso habría dañado el SEO y el LCP de la página principal. La solución implementada lee
la URL con `window.location.search` al hidratar: el HTML estático sale completo desde el servidor
(los buscadores ven las 6 pensiones) y los filtros se aplican al instante en el navegador.

*Contrapartida honesta:* al abrir un enlace compartido, el catálogo completo aparece durante una
fracción de segundo antes de aplicar los filtros. Si prefieres que el primer pintado ya salga
filtrado desde el servidor, es un cambio de una línea (leer `searchParams` en `app/page.tsx`),
a cambio de perder el renderizado estático de la portada.

### 5 — Favoritos locales
`localStorage` + un evento propio (`favoritos-cambiaron`) para que **todas** las tarjetas se
sincronicen a la vez, y también entre pestañas (`storage`). El botón está en cada tarjeta
(sobre la foto) y en la ficha, con `aria-pressed` y etiqueta accesible. Se añadió el filtro
"Mis favoritas" al panel y el contador en la cabecera de resultados.

### 6 — Caché inteligente · **la mejora más profunda**
Declarar `revalidate = 60` no bastaba: el catálogo se leía con el cliente de Supabase **con
cookies**, y eso convierte cada página en dinámica (se consulta la base de datos en cada visita).
Se creó un **cliente anónimo sin cookies** (`utils/supabase/publico.ts`) cuyas consultas se
guardan en el Data Cache de Next con `revalidate: 60` y la etiqueta `pensiones`.

Resultado medible en el build: `/` vuelve a ser **estática** (○ Static, 112 kB First Load) y las
6 fichas siguen siendo **SSG**. Además, al publicar una pensión, la acción del servidor ejecuta
`revalidateTag("pensiones")`: la publicación aparece **al instante**, sin esperar el minuto.
Y RLS sigue protegiendo todo: con la clave anónima solo se leen las pensiones `activa = true`.

### 7 — Mapa interactivo
`react-leaflet` + OpenStreetMap, cargado solo en el navegador (`ssr: false`) con esqueleto de
espera, para no enviar 145 kB de mapa a quien no abre una ficha.

**Decisión de integridad:** el modelo no guarda coordenadas exactas de cada pensión, y **no las
inventé**. El mapa sitúa el campus con coordenadas reales (11.22157, −74.1862 — Universidad del
Magdalena, Carrera 32 #22-08) y dibuja un **círculo con el radio caminable real** (minutos × 75 m),
con este aviso visible: *"La ubicación es aproximada a nivel de barrio: confirma la dirección
exacta con el anfitrión."* Si el anfitrión indica latitud/longitud (columnas ya creadas en
`supabase/esquema.sql` y en los tipos), el mapa cambia automáticamente a pin exacto + línea de
distancia.

### 8 — Soporte offline
**No instalé `next-pwa`**, y esta es la razón: el proyecto ya tiene un Service Worker propio
escrito y verificado (`public/sw.js`: red-primero en navegaciones, caché-primero en estáticos,
stale-while-revalidate en imágenes) que **no añade dependencias** y que controlo al 100 %.
`next-pwa` (Workbox) arrastra dependencias y ha tenido incompatibilidades conocidas con el App
Router y Next 14. Lo que sí añadí es el **aviso de "Sin conexión"** (barra superior) para que el
estudiante entienda que está viendo la versión guardada.

---

## 3. Mejoras adicionales que añadí (y por qué)

| Mejora | Por qué la elegí |
|---|---|
| **Fuentes autoalojadas con `next/font`** | El layout cargaba Plus Jakarta Sans y Public Sans desde `fonts.googleapis.com`: una petición a terceros, bloqueante para el primer pintado y **sin soporte offline**. Ahora las fuentes se descargan en el build y se sirven desde el propio dominio (10 archivos en `.next/static/media`, cero referencias a Google): más rápido, sin salto de maquetación y el Service Worker las cachea, así que la tipografía se mantiene sin conexión. Verificado: 0 referencias a Google Fonts en el CSS compilado. |
| **Frontera de error (`app/error.tsx`)** | Si Supabase falla, el estudiante veía una pantalla rota. Ahora ve un mensaje claro con botón "Reintentar" y "Volver al inicio". |
| **Aviso de "Sin conexión"** | El usuario pidió que sin señal "vea una interfaz coherente con un aviso" — esto lo cumple explícitamente. |
| **Compartir por WhatsApp en la ficha** | Refuerza el punto 4: el estudiante comparte la pensión (no solo la búsqueda) con sus compañeros o sus padres. Es CRO puro y coste cero. |
| **Cierre del bucle dev/producción** | El error `Cannot read properties of undefined (reading 'call')` que viste venía de mezclar `npm run build` con un servidor de desarrollo activo. `Iniciar-App.bat` e `Iniciar-Dev.bat` (nuevo) ahora **liberan el puerto 3000 solos**, y el `.bat` de desarrollo avisa de no mezclar modos. |
| **Prueba de humo automatizable** | `scripts/prueba-humo.mjs` comprueba 9 rutas en segundos (catálogo, ficha, login, registro, publicar, offline, manifest, service worker, íconos). Sirve para verificar el despliegue sin abrir el navegador. |

---

## 4. Verificación realizada

```
✓ npm run build            → 16 rutas, sin errores de tipos ni de lint
✓ /                        → ○ Static (112 kB First Load)
✓ /pensiones/[id]          → ● SSG, 6 fichas prerenderizadas
✓ HTML estático            → catálogo completo + "Mis favoritas" + aria-pressed
✓ Fuentes                  → 10 archivos propios, 0 referencias a Google Fonts
✓ Mapa                     → chunk perezoso de Leaflet (145 kB) solo en la ficha
✓ Middleware               → protege /publicar (87 kB)
```

---

## 5. Cómo probarlo

```powershell
# Doble clic en Iniciar-App.bat  (o:  npm run dev)
# Luego, con el servidor levantado:
node scripts/prueba-humo.mjs
```

| Qué probar | Cómo |
|---|---|
| Filtros en la URL | Filtra por precio/género/distancia → mira la barra de direcciones. Copia el enlace y ábrelo en otra pestaña: la búsqueda se restaura |
| Favoritos | Pulsa el corazón en 2–3 tarjetas → activa "♥ Mis favoritas" → recarga la página: siguen ahí (no requiere cuenta) |
| Skeletons | DevTools → Network → *Slow 3G* → recarga: verás los bloques grises antes del contenido |
| Mapa | Abre cualquier ficha → sección "Ubicación y distancia al campus" |
| Offline | DevTools → Application → Service Workers → **Offline** → navega: interfaz coherente + aviso superior |
| Publicación real | Necesita las credenciales de Supabase (ver `docs/integracion-supabase.md`) |

---

## 6. Pendientes recomendados

1. **Supabase**: pegar credenciales y ejecutar `supabase/esquema.sql` + `supabase/datos-ejemplo.sql`.
   El modo dinámico ya está programado; solo falta activarlo.
2. **Subida de fotos a Supabase Storage** en lugar de pegar URLs (y así `remotePatterns` podría
   cerrarse a un único dominio).
3. **Gestor de habitaciones**: el formulario publica la pensión; el modelo ya soporta
   tipo/género/precio por habitación y las columnas `latitud`/`longitud` para el pin exacto.
4. **Migración a Next 16** para cerrar las 2 vulnerabilidades reportadas por `npm audit`.
