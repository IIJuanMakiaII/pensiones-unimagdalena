# Pensiones Unimagdalena

Marketplace de pensiones y habitaciones para estudiantes de la **Universidad del Magdalena** (Santa Marta, Colombia). Mobile-First, Next.js App Router + TypeScript + Tailwind CSS.

## Requisitos

- Node.js ≥ 18.17

## Puesta en marcha

```bash
npm install
npm run dev        # desarrollo → http://localhost:3000
npm run build      # build de producción
npm start          # servir el build de producción
```

> 💡 **Windows sin terminal:** haz doble clic en **`Iniciar-App.bat`**. Compila, arranca el
> servidor y abre el navegador automáticamente (no importa desde dónde se ejecute: el script
> se ubica solo en la carpeta del proyecto).

## Configuración

Copia `.env.example` a `.env.local` y ajusta el número de WhatsApp:

```env
NEXT_PUBLIC_WHATSAPP_NUMBER=573001234567
```

## Estructura

```
app/
  page.tsx                  # Landing: hero + filtros + catálogo (tiempo real)
  pensiones/[id]/page.tsx   # Detalle de pensión (SSG)
  layout.tsx / globals.css  # Raíz, fuentes, metadata, estilos
components/                 # Card, carrusel, filtros, sello, hero, footer…
lib/
  datos.ts                  # Mock data: 6 pensiones + 16 habitaciones
  filtros.ts                # Motor de filtrado (precio, género, distancia, alimentación)
  formato.ts                # COP, mensaje/enlace WhatsApp
types/index.ts              # Contrato de datos Pension / Habitacion (Agente 1)
```

## Funcionalidades

- Filtros en tiempo real: precio COP (slider), género, distancia a pie (<5 / 5–10 / 10–15 min) y alimentación incluida; extra "solo verificadas".
- Catálogo responsive (1/2/3 columnas) con carrusel de imágenes, badges de servicios, sello de verificación y precios formateados en COP.
- Reserva por WhatsApp con mensaje prellenado (pensión, tipo, género, precio, alimentación).
- Detalle de pensión con galería, servicios, normas, selección de habitación y sticky bottom CTA en móvil.
- Accesibilidad: touch targets ≥ 44 px, `aria-pressed`/`role="group"` en filtros, `aria-live` en resultados, alt text descriptivo, WCAG AA.

## Paleta de marca

Definida en `tailwind.config.ts` con la identidad del cliente (verde bosque + naranja quemado):

| Rol | Token | Hex |
|---|---|---|
| Primario | `primary-600` | `#325334` |
| Superficie oscura (footer/hero) | `secondary-700` | `#2B3529` |
| Acento de marca | `accent-500` | `#E16118` |
| Acento accesible (texto blanco y textos pequeños) | `accent-700` | `#A4440D` |
| WhatsApp (relleno de botones) | `whatsapp-deep` | `#075E54` |

```bash
node scripts/verificar-contraste.mjs   # 16 combinaciones WCAG AA verificadas
```

> Regla: `accent-500` (#E16118) se reserva para uso decorativo, precios grandes (≥ 20 px negrita),
> slider y bordes; para textos pequeños o botones con texto blanco se usa `accent-700` (4.5:1 garantizado).

## PWA (aplicación instalable)

La web es instalable desde el navegador: ícono propio, pantalla completa
(`display: standalone`) y funcionamiento sin conexión tras la primera visita.

| Archivo | Función |
|---|---|
| `app/manifest.ts` | Manifest generado en `/manifest.webmanifest` (nombre, colores, íconos, atajos) |
| `public/sw.js` | Service worker: red→caché en navegaciones, caché primero en estáticos, stale-while-revalidate en imágenes |
| `app/offline/page.tsx` | Página de respaldo cuando no hay conexión |
| `components/InstalarApp.tsx` | Registro del service worker + aviso de instalación (prompt nativo en Android, instrucciones en iOS) |
| `scripts/generar-iconos.mjs` | Regenera los íconos (`icon-192`, `icon-512`, `icon-maskable-512`, `apple-touch-icon`, `favicon-32/48`) desde el logo de marca `public/marca/roomieya-logo.jpg` |

```bash
node scripts/generar-iconos.mjs   # solo si cambia el logo
```

> ⚠️ El service worker solo se registra en contexto seguro (HTTPS o `localhost`).
> `http://localhost:3000` funciona; `http://192.168.x.x:3000` desde el celular **no**.
> Para probar en el teléfono, despliega en HTTPS (Vercel) o usa un túnel HTTPS.
> Guía paso a paso: [`docs/pwa-guia-instalacion.md`](docs/pwa-guia-instalacion.md).

## Despliegue

Build estático compatible con Vercel/Netlify (`npm run build`). Las imágenes se sirven desde Unsplash vía `next/image` (dominio configurado en `next.config.mjs`).

## Modo dinámico (Supabase): autenticación y publicación

El proyecto funciona en dos modos y **nunca se rompe**:

| Modo | Requisito | Comportamiento |
|---|---|---|
| **Demo** | nada | Catálogo semilla de 6 pensiones (`lib/datos.semilla.ts`) |
| **Dinámico** | credenciales en `.env.local` | Datos reales en Supabase + registro de anfitriones y publicación |

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Pasos completos:
1. Crear el proyecto en Supabase y copiar URL + anon key → `.env.local`.
2. Ejecutar `supabase/esquema.sql` en el SQL Editor (tablas, índices, RLS y trigger de perfil).
3. (Opcional) Ejecutar `supabase/datos-ejemplo.sql` para cargar el catálogo de ejemplo.
4. `npm run dev` → registrarse en `/registro` → publicar en `/publicar`.

**Rutas nuevas:** `/registro` · `/login` · `/publicar` (protegida por middleware) · `POST /auth/signout`

**Guía completa:** [docs/integracion-supabase.md](docs/integracion-supabase.md)
**Copia de seguridad previa a esta integración:** `../backups/pensiones-unimagdalena_2026-09-13_2152.zip`

## Rendimiento, estado y experiencia

Detalle completo con decisiones y justificaciones: [docs/mejoras-rendimiento-experiencia.md](docs/mejoras-rendimiento-experiencia.md)

| Capacidad | Dónde |
|---|---|
| **ISR real con etiquetas**: catálogo estático + `revalidateTag("pensiones")` al publicar | `utils/supabase/publico.ts`, `app/actions/pensiones.ts` |
| **Filtros en la URL** (enlaces compartibles por WhatsApp) | `lib/filtros.ts` (`filtrosAParametros` / `parametrosAFiltros`), `components/Catalogo.tsx` |
| **Favoritos en localStorage** (sin cuenta) con filtro "Mis favoritas" | `lib/favoritos.ts`, `hooks/useFavoritos.ts`, `components/BotonFavorito.tsx` |
| **Skeleton loaders** (`animate-pulse`) | `app/loading.tsx`, `app/pensiones/[id]/loading.tsx`, `components/Esqueletos.tsx` |
| **Mapa interactivo** campus ↔ pensión (Leaflet + OpenStreetMap) | `components/MapaLeaflet.tsx`, `components/MapaUbicacion.tsx` |
| **Aviso sin conexión** + frontera de error | `components/AvisoOffline.tsx`, `app/error.tsx` |
| **Fuentes autoalojadas** (`next/font`, funcionan offline) | `app/layout.tsx`, `tailwind.config.ts` |

### Lanzadores (Windows)

| Archivo | Para qué |
|---|---|
| `Iniciar-App.bat` | Versión de producción: libera el puerto 3000, compila y abre el navegador |
| `Iniciar-Dev.bat` | Desarrollo con recarga automática (no mezclar con `npm run build`) |

### Prueba de humo

```bash
node scripts/prueba-humo.mjs          # con el servidor levantado
```

Comprueba 9 rutas: catálogo, ficha, login, registro, publicar, offline, manifest, service worker e íconos.

### Otros scripts de verificación

```bash
node scripts/verificar-contraste.mjs   # contraste WCAG de la paleta
node scripts/generar-iconos.mjs        # regenera los íconos de la PWA desde el logo
node scripts/prueba-humo.mjs           # rutas del sitio en vivo
```

## Integridad de datos estructurados (SEO)

Reglas que el proyecto respeta y conviene no romper:

1. **Nunca declarar reseñas inexistentes.** `calificacion` es el *puntaje interno
   del equipo* (inspección presencial), no reseñas de usuarios. Por eso **no se
   emite `aggregateRating`** en el JSON-LD. Cuando existan reseñas reales, se
   añadirá un campo aparte y solo entonces se emitirá.
2. **`geo` solo con coordenadas reales** del alojamiento (columnas `latitud` /
   `longitud`); nunca coordenadas fijas de la ciudad.
3. **El sitio se declara `WebSite` + `Organization`**; `LodgingBusiness` se emite
   únicamente en cada ficha de pensión, que sí es un alojamiento.

### Verificación automática

```bash
npm run build
node scripts/verificar-seo.mjs    # 19 comprobaciones sobre el HTML compilado
```

Comprueba que no haya `aggregateRating`/`reviewCount`/«reseñas» inventados, que el
sitio no se declare alojamiento, que el catálogo salga en el HTML del servidor y
que no queden peticiones a Google Fonts.

## Subida de fotos desde el dispositivo (Supabase Storage)

Los anfitriones **suben las fotos desde su computador o celular**: ya no dependen de pegar enlaces.

| Regla | Detalle |
|---|---|
| Bucket | `fotos-pensiones` · lectura pública · 5 MB por archivo · JPG, PNG o WebP |
| Ruta | `fotos-pensiones/<uid del anfitrión>/<archivo>.jpg` |
| Políticas RLS | el dueño puede **subir, actualizar y borrar solo en su carpeta**; cualquiera puede leer |
| Optimización | el navegador reduce a 1600 px y reconvierte a JPEG (una foto de móvil de 5–8 MB queda en ~300–600 KB). También convierte HEIC del iPhone |
| Límites | máximo 8 fotos por anuncio; la primera es la principal |
| Enlaces | sigue disponible la opción de pegar un enlace, restringido a hosts permitidos (`lib/imagenes.ts`) |

Esquema del bucket y las políticas: `supabase/storage-fotos.sql` (idempotente).

```bash
node scripts/verificar-storage.mjs   # comprueba subida propia, bloqueo de carpeta ajena y lectura pública
```

> La verificación de subida necesita crear una cuenta temporal, así que se **omite sola** cuando la
> confirmación de correo está activa (lo recomendado en producción). Para ejecutarla, desactiva
> temporalmente «Confirm email» en Supabase → Authentication → Providers → Email.

## Fotos verticales (comportamiento del marco)

Las fotos de celular suelen ser **verticales** (por ejemplo 600×900). Antes se forzaban en un marco
apaisado con `object-cover`, y el recorte era tan agresivo que la habitación parecía un primer plano
sin contexto.

`components/FotoMarco.tsx` decide al cargar la imagen:

| Orientación | Comportamiento |
|---|---|
| **Vertical** (`alto > ancho`) | Se muestra **completa** (`object-contain`) sobre un fondo difuminado de la propia foto |
| **Horizontal** | Se recorta de forma elegante (`object-cover`), que es lo correcto |

El fondo difuminado reutiliza **el mismo archivo ya optimizado**, así que no genera ninguna petición
de red adicional. La portada de la ficha es además un poco más alta (`h-72` en móvil, `h-96` en
escritorio) para dar más espacio a las fotos verticales.

Verificación incluida en `scripts/verificar-seo.mjs` (comprueba que el marco, la altura y el respeto
a los saltos de línea de la descripción estén presentes en el HTML compilado).
