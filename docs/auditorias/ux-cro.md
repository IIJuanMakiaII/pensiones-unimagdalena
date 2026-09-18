# Auditoría UX/CRO y Accesibilidad — Marketplace Pensiones Unimagdalena

**Agente 1 · Product Architect & UX/UI (UX/UI Senior)**
**Modalidad:** solo lectura y verificación. No se modificó código ni se ejecutó `npm run build` / `npm start` (`.next` compartido entre agentes).
**Fecha:** 2026-09-17 · **Alcance:** flujo completo catálogo → ficha → reserva por WhatsApp → publicación del anfitrión.
**Archivos auditados:** 21 componentes, 8 páginas, `lib/filtros.ts`, `lib/pension.ts`, `lib/formato.ts`, `hooks/useFavoritos.ts`, `globals.css`, `tailwind.config.ts`.

---

## 1. Resumen ejecutivo

La base es sólida: sistema de diseño consistente (verde bosque `#325334` / naranja `#E16118`), landing con Server Components, filtros en URL, favoritos sin cuenta, skeletons, PWA offline y sellos de confianza reales. **La accesibilidad de base está por encima del promedio de un proyecto académico**: skip-link, `aria-pressed` en todos los chips, `aria-live` en el contador, `role="alert"` en errores de formulario, foco visible global y contraste auditado con script propio.

El riesgo no está en lo construido, sino en **la coherencia entre lo que el sistema promete y lo que el usuario recibe**. Encontré **20 hallazgos**, de los cuales **5 son de prioridad crítica/alta** y afectan directamente a la conversión:

| Prioridad | Nº | Los más importantes |
|---|---|---|
| 🔴 Crítica | 2 | El **precio mostrado en la tarjeta no coincide con el precio que se envía por WhatsApp** cuando hay filtros activos (rompe confianza en el paso de mayor intención). Enlace de reserva **anidado dentro de un `<label>`** (riesgo de reservar la habitación equivocada). |
| 🟠 Alta | 6 | Sin **ordenamiento** (precio/puntaje); el formulario de anfitrión **no captura habitaciones**, así que las publicaciones nuevas desaparecen al filtrar por género o alimentación. |
| 🟡 Media | 7 | Slider de precio sin rango ni valor accesible; puntos del carrusel de 8 px; `prefers-reduced-motion` ignorado; filtros desincronizados con el botón Atrás; footer que se contradice a sí mismo. |
| 🟢 Baja | 5 | Ruido de "Puntaje del equipo" duplicado; `bg-neutral-200` fuera de paleta; esqueletos sin anuncio de carga; botón de favorito de 40 px; conteo en pensiones y no en habitaciones. |

**Veredicto:** el producto es presentable y funcional, pero **no debe lanzarse con tráfico real** sin resolver los dos hallazgos críticos: la inconsistencia de precio y el enlace dentro del label. Ambos son de esfuerzo **S/M** (uno o dos archivos) y son exactamente los que producen abandono y desconfianza en el momento de reservar.

---

## 2. Hallazgos priorizados

> Escala de esfuerzo: **S** = < 1 h · **M** = 1 día · **L** = varios días.

### 🔴 H1 — El precio de la tarjeta no coincide con el precio que se reserva

**Evidencia:**
- `lib/pension.ts:34-38` — `precioDesde()` devuelve el mínimo de **todas** las habitaciones disponibles, **sin considerar los filtros activos**.
- `components/CardPension.tsx:28` — `const desde = precioDesde(pension)` → es el número que se pinta en "Desde $X".
- `components/CardPension.tsx:29` — `const destacada = habitacionDestacada(pension, filtros)` → es la habitación que se envía.
- `components/CardPension.tsx:102` — `href={enlaceWhatsApp(pension, destacada)}` → el mensaje lleva el precio de `destacada`.

**Escenario real:** el estudiante filtra "Femenino · Hasta $500.000". La pensión tiene una habitación masculina de $380.000 y una femenina de $470.000. La tarjeta muestra **"Desde $380.000"** y el botón abre WhatsApp con **"$470.000"**. El mismo desajuste aplica al filtro de alimentación.

**Impacto en conversión:** es el peor lugar posible para una discrepancia de precio. El estudiante ya decidió, hace clic y descubre que cuesta 24 % más → abandono y desconfianza en el sello "Precios mensuales claros" (`SellosConfianza.tsx:49-54`). Además contradice el propio manifiesto del proyecto: "un diseño que no convierte es solo ruido".

**Propuesta concreta:** en `CardPension.tsx`, cuando `destacada` exista y haya filtros activos, mostrar el precio de `destacada`:
```tsx
const precioMostrado = destacada ? destacada.precio_mensual_cop : desde;
```
y ajustar la etiqueta con microcopy honesto: `Desde (según tus filtros)` cuando el precio difiera de `desde`. Mantener el mismo criterio en el conteo de `components/CardPension.tsx:55` (`contarDisponibles`) para que "N hab. disponibles" también refleje los filtros aplicados.

**Esfuerzo:** S (1 archivo) · **Prioridad:** 🔴 Crítica

---

### 🔴 H2 — El CTA de reserva está anidado dentro del `<label>` de la habitación

**Evidencia:** `components/DetallePension.tsx:42-84` — el `<label>` que envuelve el `<input type="radio">` (líneas 50-57) contiene además un `<a href={enlaceWhatsApp(...)}>` (líneas 74-83).

**Problema:** contenido interactivo (un enlace) dentro de un `<label>`. Al tocar "Reservar", el navegador propaga el clic al control asociado y **puede seleccionar la habitación equivocada justo antes de enviar el mensaje** — el estudiante reserva A y el WhatsApp dice B. Para lectores de pantalla, el nombre accesible del radio incorpora el texto del enlace, y la etiqueta del enlace compite con la del radio.

**Propuesta concreta:** separar responsabilidades y hacer que el enlace sea hermano del label:
```tsx
<div className="flex items-center gap-3 rounded-2xl border-2 ...">
  <input id={`hab-${h.id}`} type="radio" name="habitacion" ... />
  <label htmlFor={`hab-${h.id}`} className="flex-1 cursor-pointer">…</label>
  <a href={enlaceWhatsApp(pension, h)} …>Reservar</a>
</div>
```
El `role="radiogroup"` de la línea 38 se conserva. Se mantiene el `aria-label` ya existente (línea 78), que está bien redactado.

**Esfuerzo:** M · **Prioridad:** 🔴 Crítica

---

### 🟠 H3 — Botones del carrusel anidados dentro del `<Link>` de la tarjeta

**Evidencia:**
- `components/CardPension.tsx:34-47` — `<Link href={/pensiones/…}>` envuelve a `<Carrusel>`.
- `components/Carrusel.tsx:99-116` — flechas `<button>` (desktop) y `:121-135` — indicador de puntos `<button>`.

**Problema:** HTML inválido (interactivos anidados en un ancla). En móvil, intentar deslizar o tocar un punto navega a la ficha, y el gesto de swipe compite con el enlace. Es el patrón de fricción táctil más común en catálogos móviles.

**Propuesta concreta:** mover los controles fuera del ancla y dejar el `<Link>` solo sobre la imagen:
```tsx
<article className="relative …">
  <div className="relative aspect-[16/10]">
    <Link href={`/pensiones/${pension.id}`} className="block h-full" aria-label={…}>
      <Carrusel imagenes={…} soloImagen />
    </Link>
    <CarruselControles … />   {/* hermano del Link, no hijo */}
  </div>
</article>
```
Alternativa de mínimo cambio: `diferirImagenes` + `pointer-events-none` en el contenedor de controles de las cards del grid (los controles sirven en la ficha, no en el listado).

**Esfuerzo:** M · **Prioridad:** 🟠 Alta

---

### 🟠 H4 — No existe control de ordenamiento

**Evidencia:** `lib/filtros.ts:116-120` — el orden es fijo: `.sort((a, b) => a.distancia_a_pie_minutos - b.distancia_a_pie_minutos)`. No hay parámetro de orden en `filtrosAParametros` (`:123-136`) ni en `parametrosAFiltros` (`:139-161`).

**Impacto en conversión:** el criterio nº 1 del estudiante foráneo con presupuesto ajustado es el **precio**, y el nº 1 del padre es la **seguridad/puntaje**. Hoy ninguno de los dos puede ordenar. Con 6 propiedades se tolera; con 60 (el escenario de escalado) obliga a recorrer toda la cuadrícula — la causa más frecuente de abandono en catálogos.

**Propuesta concreta:** chips de orden junto al contador, en `components/CatalogoInteractivo.tsx:90-107`, con el estado en la URL (reutilizando el mecanismo que ya funciona):
```
Ordenar:  [ Más cercanas ]  [ Menor precio ]  [ Mejor puntaje ]  [ Más recientes ]
```
Añadir `orden: "distancia" | "precio" | "puntaje" | "recientes"` a `FiltrosUI` (`lib/filtros.ts:11-19`), serializar como `orden=precio` (`:123-136`) y conmutar el `.sort()` en `aplicarFiltros`. Para `precio` usar el mismo criterio que H1 (`habitacionDestacada`) y no `precioMensual`.

**Esfuerzo:** M · **Prioridad:** 🟠 Alta

---

### 🟠 H5 — El formulario de anfitrión no captura habitaciones: las publicaciones nuevas quedan invisibles a los filtros

**Evidencia:**
- `components/FormularioPension.tsx:62-201` — captura título, precio, distancia, dirección, barrio, descripción, servicios, normas y fotos. **Ningún campo de habitación** (tipo, género, precio por habitación, alimentación).
- `lib/filtros.ts:81-85` — si una pensión no tiene habitaciones y hay filtro de género o de alimentación: `if (f.soloConAlimentacion || f.genero !== "todos") return false;` → desaparece del catálogo.
- `components/CardPension.tsx:110-114` — su tarjeta siempre mostrará el bloque inerte "Sin habitaciones con estos filtros".

**Impacto:** la promesa del marketplace ("filtra por género, distancia y alimentación") **no se cumple para ninguna pensión publicada por un anfitrión real**. Los filtros de género y alimentación solo funcionan con las 6 propiedades de demostración. Es un bloqueo de producto, no un detalle de UI.

**Propuesta concreta:** en `FormularioPension.tsx`, añadir una sección repetible "Habitaciones que ofreces" con al menos una fila obligatoria:
- Tipo (select: Individual / Compartida / Matrimonial)
- Género (select: Mixto / Femenino / Masculino)
- Precio mensual COP (`type="number"`, `inputMode="numeric"`, `min={1000}`, `step={1000}`)
- ¿Incluye alimentación? (checkbox)
- Botón "Añadir otra habitación" (patrón `useFieldArray` o estado local con array)

Microcopy obligatorio bajo el `legend`: *"Añade al menos una habitación: así los estudiantes pueden filtrar por género, precio y alimentación, y reservar la que les sirve."*

**Esfuerzo:** L (requiere Server Action + esquema SQL, ya coordinado con el Arquitecto de Datos) · **Prioridad:** 🟠 Alta

---

### 🟠 H6 — Puntos del carrusel de 8 px: objetivo táctil insuficiente

**Evidencia:** `components/Carrusel.tsx:131-133` — `className="h-2 w-2 rounded-full"` → área táctil de **8 × 8 px**, sin padding.

**Impacto:** incumple WCAG 2.5.8 (mínimo 24 × 24 px) y el estándar propio del contrato Mobile-First (≥ 44 px, `docs/agent1-diseno-arquitectura.md` §5.2). En un celular, acertar es azar; fallar navega a la ficha (por H3).

**Propuesta concreta:** mantener el punto visual de 8 px dentro de un botón de 44 px:
```tsx
<button className="flex h-11 w-11 items-center justify-center" aria-label={`Ir a la foto ${i + 1}`}>
  <span className={`h-2 w-2 rounded-full ${i === indice ? "bg-white shadow" : "bg-white/50"}`} />
</button>
```
Con `gap-0` el indicador conserva la misma apariencia y gana área de toque.

**Esfuerzo:** S · **Prioridad:** 🟠 Alta

---

### 🟠 H7 — El slider de precio no comunica rango ni valor accesible

**Evidencia:** `components/Filtros.tsx:44-57` — el `input[type=range]` tiene `aria-label="Precio máximo mensual en pesos colombianos"` pero **sin `aria-valuetext`**. El `<output>` (líneas 55-57) muestra "Hasta $1.200.000" solo de forma visual.

**Impacto:**
1. Un lector de pantalla anuncia el número crudo ("1200000"), no "$1.200.000".
2. Nadie sabe cuál es el rango del catálogo ni cuánto queda por explorar: el estudiante arrastra a ciegas. Es la fricción nº 1 de un slider de precio.

**Propuesta concreta:** en `Filtros.tsx`:
```tsx
aria-valuetext={`Hasta ${formatearCOP(filtros.precioMaximoCop)}`}
aria-describedby="ayuda-precio"
```
y añadir bajo el slider: `Mostrando hasta $X de un rango de $300.000 a $1.500.000` (con `limitesPrecio.min`/`max`, que ya llegan como prop) + `id="ayuda-precio"` con *"Desliza para ver opciones más económicas. Paso de $50.000."*

**Esfuerzo:** S · **Prioridad:** 🟠 Alta

---

### 🟡 H8 — Los filtros y la URL se desincronizan con el botón Atrás

**Evidencia:** `components/CatalogoInteractivo.tsx:47-63` — la restauración desde la URL ocurre **una sola vez** (`yaRestaurado.current = true`) y no hay listener de `popstate`; `:69` — `router.replace(..., { scroll: false })` no crea entradas de historial.

**Impacto:** tras navegar atrás/adelante, la URL y el catálogo muestran cosas distintas. Un estudiante que comparte su búsqueda y vuelve atrás ve resultados que no corresponden a lo que dice la barra de direcciones: confusión y pérdida de la búsqueda (justo lo que el punto 4 del plan de escalado quería evitar).

**Propuesta concreta:** añadir al efecto de `CatalogoInteractivo.tsx`:
```tsx
const alNavegar = () => {
  const consulta = new URLSearchParams(window.location.search);
  setFiltros(parametrosAFiltros(consulta, limitesPrecio.max));
};
window.addEventListener("popstate", alNavegar);
return () => window.removeEventListener("popstate", alNavegar);
```

**Esfuerzo:** S · **Prioridad:** 🟡 Media

---

### 🟡 H9 — `prefers-reduced-motion` ignorado

**Evidencia:** `app/globals.css:9-11` (`html { scroll-behavior: smooth }`) y `:39-51` (`.animar-aparecer`, `animation: aparecer 0.15s`). No hay ninguna media query de movimiento.

**Impacto:** usuarios con sensibilidad vestibular (WCAG 2.3.3) reciben desplazamiento animado y animación de entrada sin poder desactivarlos; en Android/iOS muchos usuarios tienen "Reducir movimiento" activado a nivel de sistema y el sitio lo ignora.

**Propuesta concreta:** añadir al final de `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .animar-aparecer { animation: none; }
}
```

**Esfuerzo:** S · **Prioridad:** 🟡 Media

---

### 🟡 H10 — El footer se contradice con los sellos de confianza

**Evidencia:** `components/Footer.tsx:13-17` ("Verificamos cada propiedad antes de publicarla") y `:24-37` (4 sellos) frente a `:60-63` ("Datos de demostración para el proyecto académico").

**Impacto:** el pie de página desmonta la confianza que construyen el hero y los sellos. En producción, un aviso de "datos de demostración" visible en un marketplace de alojamiento destruye la credibilidad ante padres que están a punto de transferir dinero.

**Propuesta concreta:** condicionar el aviso al modo demo, reutilizando el helper que ya existe (`lib/supabase/config.ts`, usado en `app/publicar/page.tsx:28`):
```tsx
{esSupabaseConfigurado()
  ? "Los precios y la disponibilidad los publica cada anfitrión y pueden cambiar. Confirma siempre antes de pagar."
  : "Datos de demostración para el proyecto académico."}
```

**Esfuerzo:** S · **Prioridad:** 🟡 Media-alta

---

### 🟡 H11 — "Sin habitaciones con estos filtros" es un callejón sin salida

**Evidencia:** `components/CardPension.tsx:100-114` — cuando no hay habitación destacada, se renderiza un `<p>` inerte con ese texto.

**Impacto:** es una tarjeta que el usuario ya está mirando (le interesó el barrio o el precio) y no puede hacer nada. Se pierde una visita a la ficha y una oportunidad de conversión.

**Propuesta concreta:** convertir el bloque en acción:
```tsx
<Link href={`/pensiones/${pension.id}`} className="… h-12 w-full …">
  Ver todas las habitaciones
</Link>
```
Y en la ficha, un aviso cuando los filtros del listado ocultaron habitaciones: *"Tus filtros ocultaron 2 habitaciones de esta pensión. Ver todas."*

**Esfuerzo:** S · **Prioridad:** 🟡 Media

---

### 🟡 H12 — El estado vacío no dice qué filtro está bloqueando

**Evidencia:** `components/EstadoVacio.tsx:13-18` — copy genérico "Prueba subiendo el precio máximo o quitando algunos filtros", sin `role="status"`.

**Impacto:** si el bloqueo real es el género o la alimentación, el consejo sobre el precio no sirve: el estudiante prueba al azar y abandona. Es una de las causas más medibles de rebote en marketplaces filtrados.

**Propuesta concreta:** en `CatalogoInteractivo.tsx:125-126`, calcular el filtro con mayor poder de reducción y nombrarlo:
> "Con **🍽️ Con alimentación** no hay coincidencias ahora mismo. Sin ese filtro verías 4 pensiones."
> `[ Quitar solo ese filtro ]  [ Limpiar todos los filtros ]`

Añadir `role="status"` al contenedor para que el cambio se anuncie.

**Esfuerzo:** M · **Prioridad:** 🟡 Media

---

### 🟡 H13 — Los esqueletos no se anuncian como estado de carga

**Evidencia:** `components/Esqueletos.tsx:11` y `:50` — `aria-hidden="true"` en las tarjetas esqueleto, sin `role="status"` ni texto alternativo en `app/loading.tsx` / `app/pensiones/[id]/loading.tsx`.

**Impacto:** un usuario de lector de pantalla no recibe señal alguna de que el contenido está cargando; percibe una página vacía o rota.

**Propuesta concreta:** envolver en `app/loading.tsx`:
```tsx
<div role="status" aria-live="polite">
  <span className="sr-only">Cargando pensiones cerca de Unimagdalena…</span>
  <EsqueletoCatalogo />
</div>
```
(y el equivalente "Cargando información de la pensión…" en el detalle).

**Esfuerzo:** S · **Prioridad:** 🟡 Media

---

### 🟡 H14 — Sin recuperación de contraseña en el acceso de anfitriones

**Evidencia:** `components/FormularioLogin.tsx:100-105` — solo hay enlace a `/registro`; no existe ruta de restablecimiento.

**Impacto en el marketplace:** sin oferta no hay marketplace. Un anfitrión que olvida su contraseña queda fuera del canal de publicación sin salida, y probablemente no vuelve.

**Propuesta concreta:** enlace bajo el botón: *"¿Olvidaste tu contraseña? Te enviamos un enlace para crear una nueva."* → nueva página `app/recuperar/page.tsx` con `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/nueva-contrasena` })`, y el mensaje de confirmación (ya existe el patrón de aviso en `FormularioRegistro.tsx:75-79`): *"Si el correo está registrado, recibirás un enlace en unos minutos. Revisa también la carpeta de spam."*

**Esfuerzo:** M · **Prioridad:** 🟡 Media-alta

---

### 🟡 H15 — Conteo en pensiones y no en habitaciones

**Evidencia:** `components/CatalogoInteractivo.tsx:91-94` — `"N pensiones cerca de Unimagdalena"`.

**Impacto:** el estudiante no busca "pensiones", busca **una habitación**. "6 pensiones" es menos concreto y menos accionable que "6 pensiones · 16 habitaciones disponibles".

**Propuesta concreta:**
> `{n} pensiones · {m} habitaciones disponibles cerca de Unimagdalena`

calculado con `contarDisponibles` (`lib/filtros.ts:102-104`) sobre los resultados filtrados, coherente con H1.

**Esfuerzo:** S · **Prioridad:** 🟡 Media

---

### 🟢 H16 — El botón de favorito en tarjeta mide 40 px

**Evidencia:** `components/BotonFavorito.tsx:77` — `className="flex h-10 w-10 …"`.

**Impacto:** 4 px por debajo del estándar de 44 px del propio contrato; es el control más pequeño de la tarjeta y está superpuesto a la imagen, donde el error de toque es más probable.

**Propuesta:** `h-11 w-11` (44 px), manteniendo el icono de `h-5 w-5` y la posición `absolute left-3 top-3` (`CardPension.tsx:49-51`).

**Esfuerzo:** S · **Prioridad:** 🟢 Baja

---

### 🟢 H17 — "Puntaje del equipo" aparece 3 veces por tarjeta y se lee duplicado

**Evidencia:** `components/Estrellas.tsx:11-14` (`role="img"` con `aria-label="Calificación 4.7 de 5"`) + `components/CardPension.tsx:67-71` (número `4.7` + texto "Puntaje del equipo") + `app/pensiones/[id]/page.tsx:149-153` (misma tripleta).

**Impacto:** verbosidad para lectores de pantalla ("Calificación 4.7 de 5 · 4.7 · Puntaje del equipo") y ruido visual. Además, "Puntaje del equipo" no explica qué mide: el usuario no puede interpretarlo ni comparar.

**Propuesta concreta:** un solo texto con nombre accesible único:
```tsx
<p className="text-sm font-semibold text-neutro-700">
  <Estrellas calificacion={p.calificacion} />
  <span>{p.calificacion.toFixed(1)}/5 · Puntaje del equipo</span>
</p>
```
y en el detalle añadir el criterio: *"Lo asigna nuestro equipo tras la visita presencial: limpieza, seguridad, servicios y trato del anfitrión."*

**Esfuerzo:** S · **Prioridad:** 🟢 Baja

---

### 🟢 H18 — `bg-neutral-200` está fuera de la paleta de marca

**Evidencia:** `components/Esqueletos.tsx:24` — `bg-neutral-200` (gris frío por defecto de Tailwind) en lugar del `neutro-*` cálido definido en `tailwind.config.ts:66-77`.

**Impacto:** inconsistencia de color en el botón del esqueleto; al pasar de esqueleto a contenido real se percibe un salto de tono.

**Propuesta:** cambiar a `bg-neutro-200` (una palabra). Conviene añadir una verificación al script `scripts/verificar-contraste.mjs` o un grep de CI que detecte clases `neutral-*`/`gray-*` fuera de la paleta.

**Esfuerzo:** S · **Prioridad:** 🟢 Baja

---

### 🟢 H19 — El pin del mapa usa texto blanco sobre `#E16118` a 13 px

**Evidencia:** `components/MapaLeaflet.tsx:30` — el estilo del pin aplica `background:${color}` con `color:#fff; font-size:13px`, y en `:67` el color es `#E16118`.

**Impacto:** blanco sobre `#E16118` = **3.54:1**, válido para texto grande (≥ 20 px negrita) pero **insuficiente para texto de 13 px** (requiere 4.5:1). Es el mismo criterio que ya aplicó correctamente el equipo en botones con `accent-700`.

**Propuesta:** usar `#A4440D` (`accent-700`) para el relleno del pin, conservando el naranja `#E16118` en el círculo de zona y en los precios, donde sí cumple.

**Esfuerzo:** S · **Prioridad:** 🟢 Baja

---

### 🟢 H20 — El aviso de instalación puede tapar el final del catálogo

**Evidencia:** `components/InstalarApp.tsx:97-98` — `fixed inset-x-3 bottom-3 z-50`; se muestra solo en `/` (`:92`). El `<main>` del catálogo (`CatalogoInteractivo.tsx:89`) no tiene padding inferior de compensación.

**Impacto:** en móvil, al llegar al final de la lista (justo cuando el estudiante decide), el aviso cubre la última fila de tarjetas.

**Propuesta:** añadir `pb-32` al `<main id="resultados">` cuando el aviso esté visible. Como el aviso vive en el layout y el padding en la página, la vía simple es reservar el espacio siempre en `/` (`pb-32 md:pb-8`): es invisible cuando no hay aviso.

**Esfuerzo:** S · **Prioridad:** 🟢 Baja

---

## 3. Accesibilidad WCAG 2.1 AA — verificaciones y mejoras

### 3.1 Lo que ya cumple (verificado en código)

| Criterio | Evidencia |
|---|---|
| 1.3.1 Información y relaciones | `role="radiogroup"` + radios nativos con `name` (`DetallePension.tsx:38-57`); `fieldset`/`legend` en servicios y normas (`FormularioPension.tsx:156-184`); `label htmlFor` en todos los campos de formulario. |
| 1.4.3 Contraste (texto) | Paleta documentada en `tailwind.config.ts:7-14`; CTA con texto blanco usa `accent-700` (6.16:1) y WhatsApp usa `whatsapp-deep` (7.67:1) en lugar del verde oficial (1.98:1). Existe `scripts/verificar-contraste.mjs` con 16/16 combinaciones. |
| 1.4.4 / 1.4.10 Reflow | Grid de 1 columna en móvil (`CatalogoInteractivo.tsx:128`), `max-w-6xl` con padding lateral `px-4` en todo el sitio. |
| 1.4.5 Imágenes de texto | El carrusel usa `<Image>` con `alt` descriptivo por foto (`Carrusel.tsx:81`). |
| 2.4.1 Evitar bloques | Skip-link "Saltar al contenido" (`app/layout.tsx:145-150`) con patrón `sr-only focus:not-sr-only` correcto. |
| 2.4.7 Foco visible | Regla global `:focus-visible { outline: 3px solid #325334; outline-offset: 2px }` (`globals.css:54-58`), más overrides explícitos en `InstalarApp.tsx:141,162,170`. |
| 3.3.1 / 3.3.3 Errores | `role="alert"` en los tres formularios (`FormularioPension.tsx:55`, `FormularioLogin.tsx:52`, `FormularioRegistro.tsx:71`) y mensajes traducidos (`lib/auth-mensajes.ts`). |
| 4.1.2 Nombre, rol, valor | `aria-pressed` en los 7 chips de filtro (`Filtros.tsx:69,90,111,123,135`); `aria-pressed` en favoritos (`BotonFavorito.tsx:57,75`); `aria-live="polite"` en el contador (`CatalogoInteractivo.tsx:91`). |
| 4.1.3 Mensajes de estado | `role="status"` en publicación creada (`app/publicar/page.tsx:62`), en aviso de registro (`FormularioRegistro.tsx:76`) y en el aviso offline (`AvisoOffline.tsx:30`). |
| 3.3.8 Autenticación accesible | Sin CAPTCHA cognitivo; `autoComplete="email"` / `"current-password"` / `"new-password"` correctos. |

### 3.2 Brechas verificables y su corrección

| # | Criterio | Brecha (evidencia) | Corrección propuesta |
|---|---|---|---|
| A1 | **2.4.1** | El skip-link apunta a `#resultados`, pero `/login`, `/registro` y `/publicar` no tienen ningún elemento con ese `id` (`app/login/page.tsx:24`, `app/registro/page.tsx:16`, `app/publicar/page.tsx:42`) → el enlace no salta a ninguna parte en esas rutas. | Usar `#contenido` y añadir `id="contenido"` (+ `tabIndex={-1}`) al `<main>` de cada página; mantener `id="resultados"` solo como ancla del hero. |
| A2 | **1.4.11** | El borde de los chips inactivos es `border-neutro-300` (`#D6D3D1`), ≈ **1.5:1** sobre blanco → por debajo del 3:1 exigido para identificar un control por su límite visual (`Filtros.tsx:74,97,116,127,139`). | Subir a `border-neutro-500` (`#78716C`, ≈ 4.6:1) o mantener el borde y añadir `bg-neutro-50` + `ring-1 ring-neutro-400`; re-verificar con `scripts/verificar-contraste.mjs`. |
| A3 | **2.5.8** | Puntos del carrusel de 8 × 8 px (`Carrusel.tsx:131`); botón de favorito de 40 × 40 px (`BotonFavorito.tsx:77`); cierre del aviso de instalación de 36 × 36 px (`InstalarApp.tsx:141`). | Ver H6 y H16; el cierre del aviso pasa a `h-11 w-11` (el botón "Ahora no" ya cumple 44 px). |
| A4 | **1.3.1 / 4.1.2** | El nombre accesible del radio de habitación absorbe el texto del enlace "Reservar" por estar dentro del `<label>` (`DetallePension.tsx:42-84`). | Ver H2 (separar `<label>` y `<a>`). |
| A5 | **1.1.1 / 4.1.2** | El sello de verificación pone `aria-label` en un `<span>` sin `role` (`SelloVerificado.tsx:11-14`): el nombre puede no anunciarse. | Añadir `role="img"`; en la ficha ya existe el texto visible equivalente (`app/pensiones/[id]/page.tsx:164-168`), que es la mejor solución. |
| A6 | **3.3.1 / 3.3.2** | Los errores de formulario son globales: no hay `aria-invalid` ni `aria-describedby` por campo, ni foco automático al campo inválido (`FormularioPension.tsx:53-60`). | Marcar el campo con `aria-invalid={Boolean(errorCampo)}` y `aria-describedby="error-titulo"`, y llevar el foco al primer campo con error desde la Server Action devolviendo el `campo` afectado en `ESTADO_INICIAL`. |
| A7 | **2.3.3** | Animación de aparición y scroll suave sin respetar `prefers-reduced-motion` (`globals.css:9-11,39-51`). | Ver H9. |
| A8 | **1.4.3** | Texto blanco de 13 px sobre `#E16118` en el pin del mapa (3.54:1) (`MapaLeaflet.tsx:30,67`). | Ver H19. |
| A9 | **4.1.3** | Los esqueletos están `aria-hidden` sin alternativa que anuncie la carga (`Esqueletos.tsx:11,50`). | Ver H13. |
| A10 | **2.4.3** | Orden de tabulación dentro de las tarjetas: favorito (absoluto, primero en el DOM) → enlace de imagen/carrusel (con botones dentro) → título → CTA. El orden visual coincide, pero H3 introduce saltos de foco impredecibles. | Resolver H3 deja el orden natural: imagen → título → CTA → favorito. |

### 3.3 Verificación recomendada (script reproducible)

Ampliar `scripts/prueba-humo.mjs` con aserciones de accesibilidad automática (sin navegador): comprobar en el HTML prerenderizado que (a) existe un `<h1>` por página, (b) ningún `<label>` contiene `<a>` ni `<button>`, (c) ningún `<a>` contiene `<button>`, (d) todo `input[type=range]` tiene `aria-valuetext`, (e) existe `id="contenido"` en cada `<main>`. Son cinco reglas que cubren A1, A4 y parte de H2/H3/H7 y que detectan regresiones futuras.

---

## 4. Microcopy y momentos de confianza

### 4.1 Principio rector

El comprador real no es solo el estudiante: **es el estudiante que necesita convencer a sus padres**. Toda la copy debe hablarle a dos audiencias a la vez: al joven (velocidad, precio, cercanía, WhatsApp) y al padre que paga (verificación, sin intermediarios, visita antes de pagar, respaldo).

### 4.2 Copy propuesto por punto de contacto

| Ubicación | Copy actual | Copy propuesto |
|---|---|---|
| **H1 (hero)** | "Pensiones verificadas a minutos de Unimagdalena, en Santa Marta" | **Se mantiene** (contiene la keyword local y la promesa). Alternativa A/B a medir: "Tu cuarto a minutos del campus, verificado antes de que llegues a Santa Marta". |
| **Subtítulo (hero)** | "Vive a minutos caminando del campus con precios mensuales claros y reserva directa por WhatsApp. Elegimos y verificamos cada hogar…" | Añadir cifra real al inicio: *"**16 habitaciones verificadas** a menos de 15 minutos a pie del campus. Precios mensuales claros y reserva directa por WhatsApp: tú y tus padres deciden con tranquilidad."* (usar datos reales del catálogo, nunca inventados). |
| **Contador del catálogo** | "6 pensiones cerca de Unimagdalena" | *"6 pensiones · 16 habitaciones disponibles cerca de Unimagdalena"* (H15). |
| **Tarjeta (precio)** | "Desde $380.000 /mes" | *"Desde $470.000 /mes · según tus filtros"* cuando el filtro cambie el precio (H1). |
| **Tarjeta (sin coincidencia)** | "Sin habitaciones con estos filtros" | *"Esta pensión no tiene habitaciones que cumplan tus filtros"* + botón **"Ver todas las habitaciones de esta pensión"** (H11). |
| **Estado vacío** | "Ninguna pensión coincide con tus filtros. Prueba subiendo el precio máximo o quitando algunos filtros." | *"Con **{nombre del filtro}** no encontramos ninguna pensión. Sin ese filtro verías {n} opciones."* + botones **"Quitar ese filtro"** / **"Limpiar todos los filtros"** (H12). |
| **Antes del CTA de reserva (ficha)** | *(no existe)* | Bloque **"Cómo reservar"** en 3 pasos: *"1. Elige tu habitación · 2. Escríbele al anfitrión por WhatsApp · 3. Visita la pensión y firma el acuerdo."* |
| **Ficha — aviso de seguridad** | *(no existe)* | *"Consejo: visita la pensión y confirma todo antes de pagar. Nunca consignes dinero sin conocer el lugar."* — es el momento de confianza que protege a la familia y la credibilidad de la plataforma. |
| **Mensaje prellenado de WhatsApp** | "Hola 👋, vi en el Marketplace… y me interesa la habitación Individual · Femenino a $470.000/mes con alimentación incluida. ¿Está disponible?" | Añadir origen y cierre de disponibilidad: *"…¿Sigue disponible? Puedo visitarla esta semana."* (aumenta la tasa de respuesta del anfitrión, que es el cuello de botella real del embudo). |
| **Ficha — junto al sello** | "Verificada por el equipo (inspección presencial)" | Añadir **fecha**: *"Verificada por el equipo el 12 de agosto de 2026 · inspección presencial."* Un sello sin fecha pierde vigencia; con fecha, es un dato comprobable. |
| **Formulario — habitaciones** | *(no existe)* | *"Añade al menos una habitación: así los estudiantes pueden filtrar por género, precio y alimentación, y reservar la que les sirve."* (H5). |
| **Login — recuperación** | *(no existe)* | *"¿Olvidaste tu contraseña? Te enviamos un enlace para crear una nueva."* (H14). |
| **Footer — legal** | "Datos de demostración para el proyecto académico." | En producción: *"Los precios y la disponibilidad los publica cada anfitrión y pueden cambiar. Confirma siempre antes de pagar."* (H10). |

### 4.3 Momentos de confianza faltantes (4 propuestas concretas)

1. **Bloque "Para padres" en la landing** (nuevo, tras `SellosConfianza`) — hoy los sellos hablan de la plataforma, no de la ansiedad concreta de quien paga. Contenido verificable, sin promesas infladas:
   > **Para mamás y papás:** visitamos la pensión antes de publicarla · hablas directo con el anfitrión, sin intermediarios ni comisiones ocultas · te acompañamos hasta la mudanza · si algo no coincide con lo publicado, escríbenos y lo revisamos.
2. **Vigencia del sello de verificación** (fecha real de inspección, ver §4.2). Convierte un badge decorativo en un dato.
3. **Tiempo de respuesta del anfitrión** ("Suele responder en ~2 horas") — medible desde Supabase. Es el dato que más reduce la incertidumbre tras enviar el WhatsApp, que hoy es el punto ciego del embudo: el estudiante escribe y no sabe si le responderán.
4. **Cierre posterior a la reserva**: página de confirmación con checklist *"Antes de pagar: visita la pensión, confirma qué incluye el precio, firma un acuerdo, guarda el comprobante."* Hoy el flujo termina en WhatsApp y se pierde todo el control de la experiencia.

### 4.4 Tono y aplicación visual (sin romper la identidad)

- **Verde bosque `#325334`**: estructura, verificación, superficies de confianza (headings, sellos, footer). Es el color de "esto es serio".
- **Naranja `#E16118`**: decisión y acción (precios, chips activos, CTA del hero). Reservado para lo que queremos que se toque, nunca para texto pequeño con fondo claro.
- **Verde WhatsApp profundo `#075E54`**: solo reserva. Un solo significado por color es lo que hace que el estudiante aprenda la interfaz en dos pantallas.
- **Tipografía**: Plus Jakarta Sans para jerarquía (títulos, precios, botones) y Public Sans para lectura. Los precios siempre con `tabular-nums` (`globals.css:25-27`) — decisión correcta que evita el salto al mover el slider.

---

## 5. Fortalezas a preservar (no tocar)

1. **Separación lógica pura / presentación**: `lib/filtros.ts` y `lib/pension.ts` son funciones puras sin DOM — testables y reutilizables por catálogo, ficha y validaciones. Es la decisión arquitectónica que más facilita el escalado.
2. **Server Components con isla de cliente mínima**: `app/page.tsx` compone Hero, Sellos y Footer en el servidor; solo `CatalogoInteractivo` es cliente (`app/page.tsx:43-53`).
3. **Accesibilidad base poco común**: skip-link, `aria-pressed` en todos los chips, `aria-live` en el contador, `role="alert"` en errores, foco visible de marca. Está por encima de la media del sector.
4. **Precios con cifras tabulares** y formato COP centralizado en `lib/formato.ts` (una sola fuente de verdad).
5. **Degradación segura**: modo demo sin Supabase y `/publicar` con instrucciones claras en lugar de error (`app/publicar/page.tsx:123-174`).
6. **`InstalarApp` solo en la portada** para no competir con el CTA de reserva (`InstalarApp.tsx:92`) — decisión correcta de CRO que conviene mantener al añadir cualquier banner futuro.
7. **Mapa honesto**: el círculo de zona aproximada con nota explícita (`app/pensiones/[id]/page.tsx:244-248`) en lugar de un pin falso. Es integridad de datos aplicada a la UI.

---

## 6. Plan sugerido en 3 oleadas

### Oleada 1 — Antes de abrir al público (≈ 1 día de trabajo)
| Hallazgo | Esfuerzo | Por qué primero |
|---|---|---|
| **H1** Precio coherente con filtros | S | Rompe la confianza en el clic decisivo |
| **H2** Enlace fuera del `<label>` | M | Riesgo de reservar la habitación equivocada |
| **H3** Controles del carrusel fuera del `<Link>` | M | Fricción táctil constante en móvil |
| **H6** Puntos del carrusel a 44 px | S | Cumple 2.5.8 y evita navegación accidental |
| **H10** Footer sin contradicción | S | La confianza se pierde en el pie |

### Oleada 2 — Primeras semanas (≈ 3–4 días)
H4 ordenamiento · H11 CTA "Ver todas las habitaciones" · H12 estado vacío que nombra el filtro · H14 recuperación de contraseña · H7 slider con rango y `aria-valuetext` · H9 `prefers-reduced-motion` · A1 `#contenido` · A6 `aria-invalid`/foco.

### Oleada 3 — Al escalar el catálogo (≈ 1 semana, coordinado con Datos/Backend)
H5 habitaciones en el formulario (bloqueante para que los filtros funcionen con oferta real) · subida real de fotos a Supabase Storage (H5 anexo) · H13 esqueletos accesibles · H15 conteo en habitaciones · H16–H20 (pulido) · §4.3 momentos de confianza (bloque "Para padres", vigencia del sello, tiempo de respuesta, checklist post-reserva).

---

## 7. Anexo — Verificaciones realizadas y límites

**Verificado por lectura de código (20 hallazgos con `archivo:línea`):** todos los hallazgos de este informe citan código existente en el repositorio, sin inferencias de comportamiento no comprobables.

**No verificado (limitación declarada):** no se ejecutó `npm run build` ni `npm start` por la restricción de concurrencia sobre `.next` (varios agentes comparten la carpeta). Por tanto:
- Las afirmaciones de comportamiento visual en navegador (por ejemplo que el aviso de instalación tape realmente la última tarjeta en un dispositivo concreto, H20) se derivan del análisis de `z-index` y posicionamiento `fixed`, no de una captura en vivo.
- Las mediciones de contraste citadas provienen de la documentación del propio proyecto (`tailwind.config.ts:7-14` y `scripts/verificar-contraste.mjs`); las dos nuevas que aporto (borde de chips ≈1.5:1 en A2 y pin del mapa 3.54:1 en H19) deben confirmarse con ese script antes de aplicar el cambio.

**Recomendación de cierre:** aplicar la Oleada 1 y volver a ejecutar `node scripts/verificar-contraste.mjs` + `node scripts/verificar-seo.mjs` + el script de humo ampliado (§3.3) para confirmar que no hay regresiones de contraste, SEO ni accesibilidad estructural.
