# Rama `legales-formato-125` — Informe de lo hecho

Tarea #125. Repara el formato de los dos textos legales, retira el aviso de documento
provisional, normaliza el domicilio y publica el WhatsApp de la plataforma en «Quién está
detrás». Rama sin fusionar: `main` sigue en `3972f9e`.

Worktree: `...\nido-wt-125`.

## 1. La causa no estaba en los documentos

Los `.md` están bien escritos y con salto de línea manual (~80 caracteres), que es como se
leen y como los revisa quien los escribe. El defecto estaba en el conversor que los publica,
`lib/markdown-legal.ts`, y tenía dos formas:

1. **Cerraba cada línea no vacía como su propio `<p>`.** En Markdown un párrafo dura hasta la
   línea en blanco: un salto de línea del archivo no es un salto de párrafo. De ahí el «eso no
   puede estar así separado» y el «la procesará la pasarela / de pagos» partido.
2. **Aplicaba la negrita línea a línea.** Un `**` que abría en una línea y cerraba en la
   siguiente no encontraba su pareja y se publicaba literal.

Las dos cosas se arreglan una vez, en el conversor. No se reescribieron los `.md` para
esquivarlo.

### Medición, antes y después

| Documento | `<p>` antes | `<p>` después | `**` literales antes | `**` después | Listas |
|---|---|---|---|---|---|
| `aviso-de-privacidad.md` | 99 | **24** | 18 | **0** | 21 ítems → 21 ítems |
| `condiciones-de-uso.md` | 162 | **37** | 32 | **0** | 34 ítems → 34 ítems |

Medido ejecutando el conversor anterior (`git show HEAD:lib/markdown-legal.ts`) y el de esta
rama sobre los mismos archivos.

`**` desemparejados en el origen: **ninguno**. Los dos documentos tienen un número par de
pares (130 y 218) y cada par cierra dentro de su propio párrafo. Las «50 negritas rotas» eran
pares correctos **partidos por el salto de línea**, no documentos mal escritos. No hubo que
tocar ni un `**` del texto legal.

## 2. Qué cambió

### a) El conversor (`lib/markdown-legal.ts`)

Pasa a dos fases: primero arma la lista de bloques uniendo las líneas que pertenecen al mismo
bloque; después aplica el marcado en línea sobre el bloque ya unido. Reglas:

- Un párrafo dura hasta la línea en blanco o hasta una línea que abre otro bloque
  (encabezado, ítem, tabla, cita, separador).
- Una línea suelta dentro de una lista **continúa su ítem**, no abre un párrafo ni un ítem.
- La negrita y la cursiva se resuelven cuando el par cruza el salto, porque para entonces el
  salto ya no existe.
- Una tabla dentro de una cita ahora se dibuja como tabla. Antes se publicaba como texto con
  barras verticales: el reparto del 90 % de las condiciones se leía `|---|---|`.

`escapar()` sigue aplicándose antes de cualquier etiqueta. Sin `dangerouslySetInnerHTML` nuevo
y sin librería nueva.

### b) Domicilio canónico: `Santa Marta - Magdalena - Colombia`

Clasificación de cada aparición encontrada en el repositorio:

| Sitio | Qué es | Decisión |
|---|---|---|
| `docs/legales/aviso-de-privacidad.md:11-12` | Declaración de domicilio del responsable | **Normalizada** |
| `docs/legales/condiciones-de-uso.md:17` | Declaración de domicilio («Domicilio:») | **Normalizada** |
| `components/Footer.tsx:110` | Domicilio de la página, en el pie de todas las páginas | **Normalizada** |
| `docs/legales/aviso-de-privacidad.md:16-17` | Prosa: «su área de influencia en …» | **Sin tocar**: es cobertura, no domicilio |
| `components/Footer.tsx:27` | Prosa: «…estudiantes de la Universidad del Magdalena, en Santa Marta» | **Sin tocar**: zona del mercado |
| `app/layout.tsx:109` | `areaServed` de los datos estructurados | **Sin tocar**: zona servida |
| `app/layout.tsx:122` | Descripción para buscadores | **Sin tocar**: prosa |
| `scripts/generar-imagen-compartir.mjs:79` | Leyenda de la imagen de compartir | **Sin tocar**: pie de imagen, no domicilio |
| `pruebas/barrios.prueba.ts:59` | Nombre del barrio «Ciénaga» en una prueba de slug | **Sin tocar**: es un barrio real |

Antes las dos declaraciones decían `Santa Marta / Ciénaga, Magdalena` y el pie decía
`Santa Marta, Magdalena, Colombia`. Ahora los tres dicen lo mismo.

### c) Fuera el aviso de documento provisional

- `app/legal/privacidad/page.tsx` y `app/legal/condiciones/page.tsx`: se retira el bloque
  `role="note"` que anunciaba revisión pendiente y datos PENDIENTE.
- Los comentarios de cabecera se reescriben para que digan la verdad: **no** hay datos sin
  rellenar (nombre, C.C. 1004364753 y correo ya estaban), y la razón de seguir fuera del
  índice es una decisión pendiente, no un hueco.
- **`robots: { index: false }` se mantiene**, como se pidió. Quitar el cartel no es lo mismo
  que indexar un contrato antes de que lo lea un abogado; eso lo decide Juan en un cambio
  aparte.
- Datos del responsable en los dos documentos: completos. Lo comprueba una prueba.

### d) WhatsApp en «Quién está detrás»

- `app/quienes-somos/page.tsx`: la tarjeta mostraba solo «Mi perfil en LinkedIn». Ahora añade
  el WhatsApp de la plataforma, con el mismo patrón que «Hablemos»: `enlaceWhatsAppPlataforma`,
  `target="_blank"` y `rel="noopener noreferrer"`.
- `lib/formato.ts`: `numeroWhatsAppVisible()` devuelve el número legible («+57 302 642 9730»)
  o `null` si el canal no sirve. Sale de `NEXT_PUBLIC_WHATSAPP_NUMBER`; no hay ningún número
  escrito a mano.
- Con la variable ausente, inválida o con el número de ejemplo, el enlace lleva al formulario
  de respaldo y no se publica un número al que no contesta nadie.

## 3. Comprobaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` (`npm run tipos`) | exit 0 |
| `npm run build` | ✓ 24/24 páginas · shared 87.8 kB |
| `npm run probar` | **633/633**, 0 fail, 148 suites (antes: 617 en 145) |
| `npm run verificar:seo` | todas pasan |
| `npm run verificar:contraste` | 18 pares WCAG AA |
| `npm run verificar:secretos` | 276 archivos, 7 patrones, OK |
| `npm run verificar:estructura` | correcta en todas las rutas (con servidor local) |

`verificar:lint` sigue sin ESLint instalado: **no es una compuerta** y no se presenta como
verde. `verificar:disponibilidad` no aplica a esta rama (no toca permisos ni la base).

Sobre el HTML compilado, medido en `.next/server/app/`:

| Página | bytes | `**` | `PENDIENTE` | «pendiente de revisi» | domicilio canónico |
|---|---|---|---|---|---|
| `/legal/privacidad` | 92.741 | 0 | 0 | 0 | 4 |
| `/legal/condiciones` | 99.727 | 0 | 0 | 0 | 4 |
| `/quienes-somos` | 54.965 | 0 | 0 | 0 | 2 |

(El domicilio aparece dos veces por página porque Next publica el HTML y su payload RSC.)

En `/quienes-somos` el enlace queda así:

```html
<a href="https://wa.me/573026429730?text=…" target="_blank" rel="noopener noreferrer"
   class="font-bold text-primary-800 …">WhatsApp +57 302 642 9730</a>
```

## 4. Pruebas añadidas (`pruebas/textos-legales.prueba.ts`)

De 6 a 22 pruebas. Las nuevas:

- Ningún documento publicado deja un `**` ni un asterisco suelto.
- Las dos frases que salían rotas en pantalla (secciones 5 y 6 del aviso) se publican con su
  negrita entera.
- **Invariante general**: ningún `<p>` ni `<li>` termina a mitad de frase. Es la comprobación
  que no depende de recordar una frase concreta: si una línea de continuación vuelve a abrir
  un bloque, ese bloque acaba en minúscula y sin puntuación.
- El ítem de «Lo que NO guardamos» sigue siendo un solo `<li>` con la frase completa.
- La cita del reparto de las condiciones conserva su tabla dentro de la cita.
- Los documentos no usan dos espacios finales y el conversor no publica ningún `<br>`.
- Casos mínimos del conversor: párrafo unido, negrita que cruza el salto, continuación dentro
  de la lista, encabezado que no se pega al párrafo, tabla única, y el escapado de HTML.
- El domicilio se lee igual en los dos documentos y no queda el anterior.
- Las dos páginas legales no anuncian revisión pendiente ni nombran datos PENDIENTE.
- La tarjeta «Quién está detrás» ofrece el WhatsApp con `target` y `rel`, y no lleva ningún
  número escrito a mano.

## 5. Lo que quedó fuera, a propósito

- **Indexación de `/legal/*`**: sigue en `index: false`. Es decisión de Juan.
- **Revisión jurídica**: el texto no la ha tenido. El aviso de la página se retiró porque lo
  pidió el responsable de los datos; el dictamen de un abogado sigue pendiente y es él quien
  asume ese paso antes del lanzamiento.
- **`docs/legales/aviso-de-privacidad.md:16-17`**: dice que el sitio es «un servicio de la
  Universidad del Magdalena». No es una declaración de domicilio y no se toca en esta tarea,
  pero conviene revisarlo: Nido es un proyecto independiente, no un servicio de la universidad.
- Las deudas N-1 y N-2 del panel (`PanelMaestro.tsx`, mensaje de liberación) siguen abiertas:
  son otra rama.

## 6. Un efecto que conviene conocer

En los dos documentos, las dos últimas líneas del pie (`**Última actualización:** …` y
`**Versión:** …`) no están separadas por una línea en blanco, así que ahora se publican como
**un solo párrafo**. Es lo que dice Markdown y se lee bien, pero si se prefiere que sigan
siendo dos líneas, basta con añadir una línea en blanco entre ellas en el `.md`. No se hizo
para no reescribir los documentos sin necesidad.
