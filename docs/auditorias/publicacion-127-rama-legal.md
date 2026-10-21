# Publicación de la rama legal (#127)

**Fecha:** 21 de octubre de 2026
**Qué se publicó:** `legales-formato-125` fusionada en `main` y desplegada en producción.
**Autorización:** Juan la dio explícitamente, tras el veredicto PASS de QA y Seguridad (#126).

---

## 1. Qué se fusionó

| | |
|---|---|
| `main` antes | `3972f9e` |
| Rama fusionada | `legales-formato-125` → `4cce6ac` |
| Tipo de fusión | **avance limpio** (`--ff-only`), sin conflictos |
| Árbol resultante | `2ca7a25` — idéntico al de la rama verificada por QA |
| `main` después | `4cce6ac` |

Antes de fusionar se publicó el veredicto de QA (`docs/auditorias/rama-125-veredicto-126.md`) en
un commit **de solo documentación** (`4cce6ac`): el archivo estaba escrito en el disco del
worktree y sin rastrear, y QA no hace commits. Ese commit no cambia ni un archivo de código,
así que lo que QA verificó en `6fe6ef0` es exactamente lo que se fusionó.

`npm run tipos` sobre el `main` ya fusionado: **exit 0**.

## 2. Archivos que toca esta publicación

```
M  app/legal/condiciones/page.tsx
M  app/legal/privacidad/page.tsx
M  app/quienes-somos/page.tsx
M  components/Footer.tsx
A  docs/auditorias/rama-125-formato-legales.md
A  docs/auditorias/rama-125-veredicto-126.md
M  docs/legales/aviso-de-privacidad.md
M  docs/legales/condiciones-de-uso.md
M  lib/formato.ts
M  lib/markdown-legal.ts
M  pruebas/textos-legales.prueba.ts
```

**Ningún** archivo de `supabase/`, ni `app/actions/pensiones.ts`, ni
`components/PanelPublicacion.tsx`, ni `components/PanelMaestro.tsx`. Las correcciones de
permisos de la oleada 17 no viajan en esta publicación y no se tocaron: siguen como estaban
desde `e651705`. En esta publicación **no se aplicó ninguna migración**.

## 3. Despliegue

| | |
|---|---|
| Proyecto | `pensiones-1st-try` (`prj_Maw4reIUsf8QAYytF9GnKosjkUuu`) |
| Despliegue | `dpl_BYsKX46RccYCcfWRa5nvidef9Pd8` |
| Commit | `4cce6ac` (`main`) |
| Estado | **READY** (creado 21:01:23, listo 21:01:59) |
| Alias | `pensiones-unimagdalena.vercel.app` · `pensiones-1st-try-makia-team.vercel.app` · `pensiones-1st-try-git-main-makia-team.vercel.app` |

Esta vez Vercel procesó el push de `main` sin intervención: no hizo falta ningún commit vacío.

## 4. Verificación sobre el HTML servido

Medido con peticiones directas a `https://pensiones-unimagdalena.vercel.app`, con
`Cache-Control: no-cache` y un parámetro distinto en cada petición. No se usó la compilación
local.

| Ruta | Código | `**` | «pendiente de revisi» | `PENDIENTE` | domicilio | `3000000000` | `573001234567` | `573026429730` |
|---|---|---|---|---|---|---|---|---|
| `/legal/privacidad` | 200 | 0 | 0 | 0 | 4 | 0 | 0 | 4 |
| `/legal/condiciones` | 200 | 0 | 0 | 0 | 4 | 0 | 0 | 4 |
| `/quienes-somos` | 200 | 0 | 0 | 0 | 2 | 0 | 0 | 12 |
| `/` | 200 | 0 | 0 | 0 | 2 | 0 | 0 | 5 |
| `/pensiones/residencia-makia` | 200 | 0 | 0 | 0 | 2 | 0 | 0 | 6 |

Cero asteriscos en total (ni `**` ni sueltos) en las dos páginas legales. El domicilio aparece
cuatro veces por página legal porque Next publica el HTML y su payload RSC.

### Las frases que salían partidas, en producción

```html
<li class="list-disc"><strong>No guardamos datos de tarjeta ni credenciales de pago.</strong>
Los procesará la <strong>pasarela de pagos</strong> —un tercero con sus propias condiciones,
todavía sin contratar—; la plataforma recibe el resultado de la operación (si se pagó, cuánto y
con qué referencia), no el número de la tarjeta.</li>
```

```html
<strong>Los datos de una reserva y de su pago se conservan el tiempo que exija la ley contable
y tributaria</strong>, aunque la reserva se cancele o la cuenta se elimine: son el soporte de un
movimiento de dinero. Agotado ese plazo, se eliminan.
```

```html
El sitio mide su uso con una herramienta que <strong>no usa cookies</strong> y que
<strong>no identifica a personas</strong>: registra de forma agregada…
```

Los tres eran los defectos de las capturas de Juan. Ahora son un solo bloque cada uno, con la
negrita entera.

### Domicilio

```html
con domicilio en <strong>Santa Marta - Magdalena - Colombia</strong> y correo para asuntos de
datos personales <strong>oterojuan15@gmail.com</strong>          <!-- aviso, §1 -->

<li class="list-disc"><strong>Domicilio:</strong> Santa Marta - Magdalena - Colombia.</li>
                                                                  <!-- condiciones, cabecera -->

© 2026 Nido · Santa Marta - Magdalena - Colombia.                  <!-- pie, en todas las páginas -->
```

No se tocó donde «Santa Marta» describe la zona o la cobertura: «su área de influencia en Santa
Marta, Magdalena (Colombia)», el `areaServed` de los datos estructurados y la prosa del pie
siguen como estaban.

### Datos del responsable

Completos en las dos páginas: nombre, **C.C. 1004364753** y **oterojuan15@gmail.com**.

### WhatsApp en «Quién está detrás»

```html
<p class="mt-2 text-sm"><a href="https://wa.me/573026429730?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20una%20pensi%C3%B3n…"
   target="_blank" rel="noopener noreferrer">WhatsApp +57 302 642 9730</a></p>
```

Debajo de «Mi perfil en LinkedIn», como se pidió. El número sale de la variable de entorno: no
hay ningún número escrito a mano y `3000000000` aparece **0** veces en todo el sitio.

### Lo que no se movió

- `robots` de las dos páginas legales sigue siendo **`noindex, follow`**.
- El `sitemap.xml` **no** incluye `legal/`: las páginas siguen fuera del índice, como estaban.
- El catálogo (`/`) y una ficha real (`/pensiones/residencia-makia`) responden **200**, y el CTA
  de reserva de la ficha apunta a `wa.me/573026429730`.
- Listas y tablas intactas: 2 tablas por documento; los ítems del artículo siguen siendo 21 en
  el aviso y 34 en las condiciones, los mismos que en el `.md`.

## 5. Una cosa que Juan escribió dos veces y no se cambió

En su mensaje de aprobación pidió la ubicación como «Santa Marta - Magdalena (Colombia)», con
paréntesis. El sitio publica **«Santa Marta - Magdalena - Colombia»**, con guiones, que es la
forma que él mismo fijó antes dos veces y la que quedó en los tres sitios.

No se cambió al publicar porque esta tarea era de publicación y su instrucción fue «sin realizar
cambios adicionales». Si la quiere con paréntesis, es una línea en cada uno de los dos `.md` y
otra en `components/Footer.tsx`, en una rama aparte.

## 6. Lo que sigue pendiente y no es de esta publicación

- **Revisión jurídica** del texto: no se ha hecho. Publicarlo con el responsable real y sin el
  cartel de «pendiente» es una decisión de riesgo del responsable, no del código.
- **Indexación** de las páginas legales: sigue en `noindex` hasta que Juan lo decida.
- **N-1 y N-2** del panel (`PanelMaestro.tsx` deduce «reservada» de `!disponible`, y el mensaje
  de liberación promete volver al catálogo cuando la función restaura el valor anterior): rama
  aparte.
- `verificar:lint` sigue sin ESLint instalado: **no es una compuerta** y no se cuenta como verde.

## 7. Cómo se comprobó que no se rompió nada más

- `main` fusionado por avance limpio: el árbol es idéntico al que QA verificó
  (`633/633` pruebas en `148` suites, `build` 24/24 páginas, `tsc` exit 0).
- `tsc` reejecutado sobre el `main` fusionado: exit 0.
- Cinco rutas de producción en **200**, incluidas portada y ficha real.
- El diff no toca permisos, políticas, acciones del panel ni migraciones.
