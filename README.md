# Nido

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
  datos.ts                  # Lectura real desde Supabase (y respaldo, ver abajo)
  catalogo-respaldo.ts      # Catálogo de ejemplo: qué se sirve y con qué bandera
  datos.semilla.ts          # Semilla local de desarrollo (pensiones y habitaciones de ejemplo)
  filtros.ts                # Motor de filtrado (precio, género, distancia, alimentación)
  formato.ts                # COP, mensaje/enlace WhatsApp
types/index.ts              # Contrato de datos Pension / Habitacion (Agente 1)
```

## Funcionalidades

- Filtros en tiempo real: precio COP (slider), género, distancia a pie en cuatro tramos (≤5 / 6–10 / 11–15 / más de 15 min), alimentación incluida, «solo verificadas», favoritas y orden (cercanía, precio o puntaje).
- Catálogo responsive (1/2/3 columnas) con carrusel de imágenes, badges de servicios, sello de verificación y precios formateados en COP.
- Reserva por WhatsApp con mensaje prellenado (pensión, tipo, género, precio, alimentación).
- Detalle de pensión con galería, servicios, normas, selección de habitación y sticky bottom CTA en móvil.
- Accesibilidad: touch targets ≥ 44 px, `aria-pressed`/`role="group"` en filtros, `aria-live` en resultados, alt text descriptivo, WCAG AA.

## Paleta de marca

Definida en `tailwind.config.ts` (paleta «Rausch»). **Ese archivo manda:** si esta tabla y el
config difieren, el config es lo que se pinta.

| Rol | Token | Hex |
|---|---|---|
| Primario (botones, marca) | `primary-600` | `#E00B41` |
| Enlaces, hover y texto pequeño sobre rosa | `primary-700` | `#C30036` |
| Coral de marca — **solo elementos gráficos** | `accent-500` / `airbnb-rausch` | `#FF385C` |
| Rosa claro (avisos y chips) | `primary-50` / `airbnb-pink-badge` | `#FFF0F3` |
| Texto principal | `secondary-800` | `#222222` |
| Texto secundario | `secondary-500` | `#717171` |
| Bordes | `secondary-200` | `#DDDDDD` |
| Fondo de sección | `secondary-100` / `airbnb-light-gray` | `#F7F7F7` |

```bash
node scripts/verificar-contraste.mjs   # 18 pares WCAG AA verificados (medido el 2026-10-21)
```

> Regla: el coral `#FF385C` no se usa en texto pequeño — da 3,52:1 y solo cumple el mínimo de
> 3:1 para gráficos. Sobre el rosa claro `#FFF0F3` el texto va en `primary-700` (`#C30036`),
> que da 5,63:1; con `#E00B41` no llega. Los botones con texto blanco usan `primary-600`
> (4,89:1) y su hover `primary-700` (6,22:1).
>
> Ojo con `accent-700`: en el config vale `#E00B41`, no `#C30036`. Para texto sobre el rosa
> hay que usar `primary-700`.

## PWA (aplicación instalable)

La web es instalable desde el navegador: ícono propio, pantalla completa
(`display: standalone`) y funcionamiento sin conexión tras la primera visita.

| Archivo | Función |
|---|---|
| `app/manifest.ts` | Manifest generado en `/manifest.webmanifest` (nombre, colores, íconos, atajos) |
| `public/sw.js` | Service worker: red→caché en navegaciones, caché primero en estáticos, stale-while-revalidate en imágenes |
| `app/offline/page.tsx` | Página de respaldo cuando no hay conexión |
| `components/InstalarApp.tsx` | Registro del service worker + aviso de instalación (prompt nativo en Android, instrucciones en iOS) |
| `scripts/generar-iconos.mjs` | Regenera los íconos de Nido desde `nido.png` |

```bash
node scripts/generar-iconos.mjs   # solo si cambia el logo
```

> ⚠️ El service worker solo se registra en contexto seguro (HTTPS o `localhost`).
> `http://localhost:3000` funciona; `http://192.168.x.x:3000` desde el celular **no**.
> Para probar en el teléfono, despliega en HTTPS (Vercel) o usa un túnel HTTPS.
> Guía paso a paso: [`docs/pwa-guia-instalacion.md`](docs/pwa-guia-instalacion.md).

## Despliegue

**Necesita servidor.** El destino es Vercel (la analítica integrada y las comprobaciones
automáticas ya lo asumen).

No es un sitio estático y no puede servirse como tal: el middleware, el inicio de sesión,
las cabeceras de seguridad de `next.config.mjs` y la optimización de imágenes de
`next/image` dejan de funcionar en un alojamiento estático. En GitHub Pages, además,
verías el `README.md` como portada — Pages publica el `README.md` cuando la raíz del
repositorio no tiene `index.html` — y el resultado sería una vitrina en la que **nadie
puede registrarse ni publicar**.

Guía paso a paso, con las variables de entorno y la comprobación posterior:
[`docs/despliegue.md`](docs/despliegue.md).

## Modo dinámico (Supabase): autenticación y publicación

El proyecto funciona en dos modos. **La demostración no se sirve en silencio**: o está
encendida de forma explícita y el sitio lo avisa, o el catálogo enseña solo anuncios
reales —y si la lectura falla, lo dice en vez de inventar inventario (`lib/catalogo-respaldo.ts`,
tarea #42).

| Modo | Requisito | Comportamiento |
|---|---|---|
| **Demo** | desarrollo, o `NEXT_PUBLIC_MOSTRAR_DEMO=1` en producción | Catálogo de ejemplo (`lib/datos.semilla.ts`) con aviso visible |
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
de red adicional. En la ficha, la galería es además un poco más alta (`h-72` en móvil, `h-96` en
escritorio) para dar más espacio a las fotos verticales.

La ficha tiene **una sola superficie de fotos**: un único carrusel en la parte superior. Antes había
además una portada suelta alimentada por `imagenPrincipal()`, que devuelve la primera foto —la misma
que la primera diapositiva del carrusel—, así que esa foto salía dos veces en cualquier anuncio con al
menos una foto. El carrusel conserva la altura y el ancho que tenía la portada, y con ellos su papel de
imagen principal (de ahí que reciba `priority` y declare sus propios `sizes`).

Verificación incluida en `scripts/verificar-seo.mjs` (comprueba que el marco, la altura, el respeto a
los saltos de línea de la descripción y la ausencia de la portada duplicada estén presentes en el HTML
compilado) y en `pruebas/galeria-unica.prueba.ts` (la disposición, sobre el código sin compilar).
