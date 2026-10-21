# Rama 125 · Veredicto de QA y Seguridad antes de fusionar a `main`

**Fecha:** 21 de octubre de 2026
**Objeto:** `legales-formato-125` en `6fe6ef0` (local = `origin`), seis commits sobre `origin/main` = `3972f9e`.
**Método:** solo lectura sobre el código, más ejecución de las compuertas y del build en local, y comparación palabra por palabra entre el `.md` publicado y el HTML compilado.
**Petición de origen:** el aviso de privacidad, el WhatsApp en «Quién está detrás», el domicilio `Santa Marta - Magdalena - Colombia`, las negritas rotas, los párrafos partidos y el cartel de «pendiente».

---

## Veredicto: **PASS**

La rama está lista para `main`. El conversor ya no publica marcado roto ni párrafos partidos, el contenido de los dos documentos es **idéntico palabra por palabra** al del archivo fuente, el domicilio dice lo que Juan pidió donde corresponde y el cartel de «pendiente» no está.

Un archivo quedó fuera del alcance declarado (§B-1), de forma aditiva y sin tocar nada existente. No bloquea.

---

## 1. Lo que se midió, no lo que se declaró

```
npx tsc --noEmit                 → exit 0, sin salida
npm run probar                   → 633 tests · 148 suites · 633 pass · 0 fail · 0 skipped
npm run build                    → ✓ Compiled successfully · ✓ Generating static pages (24/24)
                                   /legal/privacidad 190 B / 96.7 kB · /legal/condiciones 190 B / 96.7 kB
```

Las tres cifras del Ingeniero (`633/633`, `24/24`, `148 suites`) coinciden con mi ejecución.

`verificar:lint` **no es una compuerta**: no hay ESLint instalado. No la cuento como verde.

---

## 2. El contenido no cambió: comparación palabra por palabra

Esta es la prueba que decide el criterio «ningún texto se acortó ni perdió una sección». No comparé tamaños ni conté párrafos a ojo: extraje las palabras del `.md` descontando **solo la sintaxis** (el `##` del encabezado, la viñeta, el número del ítem ordenado, el `>` de la cita, los separadores de tabla) y las comparé, en orden, con las palabras del texto publicado dentro del `<article>`.

| Documento | Palabras en el `.md` | Palabras publicadas | Secuencias |
|---|---|---|---|
| Aviso de privacidad | 1877 | 1877 | **idénticas** |
| Condiciones de uso | 2486 | 2486 | **idénticas** |

Cero texto perdido, cero texto añadido, en el mismo orden. El reformateo no tocó una palabra.

Y la causa de que sea así está en el diff de los documentos: **solo cambian dos líneas**, las del domicilio.

```
docs/legales/aviso-de-privacidad.md  | 2 +-
docs/legales/condiciones-de-uso.md   | 2 +-
```

El arreglo se hizo en el conversor, no reescribiendo los textos. Era la corrección correcta: los `.md` son la fuente que revisará el abogado, y reformatearlos a mano habría producido dos versiones del mismo contrato.

---

## 3. Los párrafos partidos y las negritas rotas

**Párrafos**, contados dentro del `<article>` del HTML compilado:

| Documento | Párrafos ahora | Declarado |
|---|---|---|
| Aviso | **24** | 24 |
| Condiciones | **37** | 37 |

**Negritas:** `**` literales en el `<article>` → **0 y 0**. Las líneas con `**` impar eran 18 en el aviso y 32 en las condiciones —las que se publicaban literales—, y ese número deja de importar porque ahora las líneas se unen **antes** de aplicar el marcado.

Los dos casos concretos de las imágenes de Juan, verificados en el HTML:

```
<em>Ejemplo sobre un canon pactado de $500.000 mensuales: … y el saldo al 80 % restante.</em>
```
Una cursiva que **cruza el salto de línea** y se resuelve sola. Igual que la negrita del domicilio, que en el `.md` abre en `**Santa` y cierra en `Colombia**`.

**Estructura, sin pérdidas:** privacidad 21 ítems de lista, 2 tablas, 1 cita, 2 separadores, 10 `<h2>` y 5 `<h3>`; condiciones 34 ítems (22 con viñeta + 12 ordenados en 3 `<ol>`), 2 tablas —una **dentro** de la cita, la del reparto del 90 %—, 2 citas, 3 separadores, 16 `<h2>` y 7 `<h3>`. Los encabezados del `.md` son 16 y 24, y cuadran: el que falta en cada cuenta es el `<h1>`, que lo pone la página.

---

## 4. El domicilio

`Santa Marta - Magdalena - Colombia` en las **tres** declaraciones:

```
docs/legales/aviso-de-privacidad.md:11-12   con domicilio en **Santa Marta - Magdalena - Colombia** y correo…
docs/legales/condiciones-de-uso.md:17       - **Domicilio:** Santa Marta - Magdalena - Colombia.
components/Footer.tsx:110                   © … Nido · Santa Marta - Magdalena - Colombia.
```

**Y no se metió donde describía cobertura**, que era el riesgo del criterio 8. Las dos que quedan con el formato viejo son área, no domicilio, y están bien así:

- `docs/legales/aviso-de-privacidad.md:17` — «El sitio es un servicio de la Universidad del Magdalena y su **área de influencia** en Santa Marta, Magdalena (Colombia).»
- `app/layout.tsx:109` — `areaServed: "Santa Marta, Magdalena, Colombia"` (datos estructurados de cobertura; el archivo ni se tocó).

No queda ninguna **declaración de domicilio** con el formato viejo. La única aparición de `Ciénaga` en el árbol es una prueba de slug de un barrio real, y el propio informe del Ingeniero lo justifica.

---

## 5. El cartel de «pendiente» y el WhatsApp

**El cartel está fuera.** El texto literal que citó Juan —«Este texto está pendiente de revisión jurídica y sus datos del responsable figuran como PENDIENTE»— **ya no está** en ninguna de las dos páginas: el diff retira el bloque `role="note"` completo. En el HTML compilado: `PENDIENTE` = **0** y `pendiente de revisión jurídica` = **0** en las dos. Los datos del responsable siguen completos (nombre, C.C. 1004364753, correo), y hay una prueba que lo verifica.

**El WhatsApp**, en `app/quienes-somos/page.tsx`:

```
+  {WHATSAPP_DISPONIBLE ? (
+    <a href={enlaceWhatsAppPlataforma(MENSAJE_WHATSAPP)} …>
+      {WHATSAPP_VISIBLE ? `WhatsApp ${WHATSAPP_VISIBLE}` : "Escríbeme por WhatsApp"}
+  ) : (
+    <Link href={RUTA_CONTACTO}>Escríbeme por el formulario de contacto</Link>
```

- Se **suma** al enlace de LinkedIn, no lo reemplaza.
- El número **no está escrito en el código**: sale de `enlaceWhatsAppPlataforma()` y de `numeroWhatsAppVisible()`, las dos de la variable de entorno. `3000000000` aparece **0** veces en el HTML compilado.
- Sin canal configurado no hay enlace muerto: cae al formulario de contacto.
- En el HTML compilado: `+57 302 642 9730` **2** veces y `wa.me/573026429730` **10**, que es el número de Juan.

---

## 6. El escapado y lo que el conversor NO se come

El escapado se mantiene: `escapar()` corre **antes** de añadir cualquier etiqueta (`.replace(/&/…)`, `/</…`, `/>/…`), y hay una prueba que lo intenta y falla si se rompe:

```
pruebas/textos-legales.prueba.ts:253-258
  const html = markdownAHtml("un <script> y un & suelto");
  assert.match(html, /&lt;script&gt;/);      assert.match(html, /&amp; suelto/);
  assert.doesNotMatch(html, /<script>/);
```

**Aviso de honestidad:** los dos documentos no traen ni un `<` ni un `&` de texto, así que el escapado **no se ejercita con el contenido real**; está cubierto por la prueba unitaria y no por el HTML publicado. Los 20 `>` del `.md` son, todos, aperturas de cita legítimas, y se consumen como tales.

Casos borde que busqué y **no** se materializan: no hay listas anidadas (que el conversor aplana), no hay palabras cortadas con guion al final de línea (que se unirían mal), no hay `####` (el conversor solo llega a `h3`). Los 4 asteriscos «sueltos» de las condiciones son dos cursivas correctas: el ejemplo del canon, que cruza el salto, y `*check-in*`.

---

## 7. Ni `dangerouslySetInnerHTML` nuevo, ni dependencias nuevas

**Dependencias:** `package.json` y `package-lock.json` **no cambian** en la rama. `git diff origin/main..HEAD -- package.json package-lock.json` devuelve vacío.

**`dangerouslySetInnerHTML`:** el único del camino legal es `components/DocumentoLegal.tsx:26`, y **ese archivo no está en el diff** — el mecanismo es el de antes. La rama no añade ninguno: el diff de `app/quienes-somos/page.tsx` solo añade un enlace y un comentario, y los `dangerouslySetInnerHTML` de esa página (`:356`, `:360`) son el JSON-LD que ya existía. Los demás del repositorio (`app/layout.tsx`, `app/page.tsx`, `app/pensiones/[id]`, las guías y los barrios) no se tocaron.

Es decir: el HTML legal se sigue inyectando por el mismo único punto de siempre, y lo que cambió es lo que ese punto genera — ahora escapado y agrupado correctamente.

---

## Hallazgos

### B-1 · **bajo** · `lib/formato.ts` se tocó fuera del alcance declarado

El alcance de la ficha era `lib/markdown-legal.ts`, `docs/legales/*`, `app/legal/*`, `app/quienes-somos/page.tsx`, `components/Footer.tsx` y la prueba. El diff incluye además **`lib/formato.ts`** (+17 líneas, 0 borrados):

```
lib/formato.ts:100-113   export function numeroWhatsAppVisible(): string | null
```

Es **aditivo**: una función nueva, sin modificar ninguna de las existentes, y el archivo lo importan 30 sitios (catálogo, fichas, panel, acciones). Los riesgos que me preocupaban no se materializan: `tsc` en verde, las 633 pruebas en verde, el build en 24/24, y la función devuelve `null` en vez de caer al número de ejemplo cuando el canal no sirve. El único número literal del archivo está **en un comentario**, no en el código.

Se reporta porque el alcance estaba escrito, no porque el cambio haga daño.

### B-2 · **bajo** · El pie de los dos documentos se publica como un solo párrafo

```
<p>…Última actualización:</strong> 21 de octubre de 2026. <strong>Versión:</strong> 1.1 — la 1.0 incluía…</p>
```

«Última actualización» y «Versión» salen corridos, en la misma frase. **Es el comportamiento correcto de Markdown** —dos líneas sin línea en blanco entre ellas son un solo párrafo— y por tanto no es un defecto del conversor: es cómo está escrito el `.md`. Se lee, no pierde información y no afecta a ninguna obligación legal.

**Mi juicio, que la ficha me pide:** aceptable tal cual. Si se quiere en dos líneas, el arreglo es **una línea en blanco en cada `.md`**, no tocar el código. Va con el texto, no con el formateador, y conviene hacerlo cuando el abogado toque los documentos.

### I-1 · **informativo** · El `href` de los enlaces no escapa comillas

`enLinea()` escapa `&`, `<` y `>`, pero no `"`, y la URL del enlace se interpola tal cual en `href="…"`. Una URL con una comilla podría cerrar el atributo. **No es una regresión** —el patrón es idéntico al de `main`— y **hoy es inalcanzable**: los dos documentos no contienen ni un solo enlace markdown (`](` aparece 0 veces). Se anota por si algún día un `.md` trae enlaces.

### I-2 · **informativo** · Nota de método sobre las cifras de «antes»

Reproduzco los **24 y 37** párrafos, que es el dato que importa, y los 21/34 ítems. **No reproduzco** el «99 → 24» y «162 → 37» del informe del Ingeniero: mi cuenta de líneas no vacías da 162 (aviso) y 247 (condiciones). La diferencia está en qué descuenta cada método (encabezados, ítems, filas de tabla) al contar el «antes». No es un hallazgo: es que esas dos cifras no son comparables entre métodos, y las que sí lo son coinciden.

### I-3 · **decisión de Juan, no defecto** · Las páginas legales siguen con `index: false`

`robots: { index: false, follow: true }` se mantiene en las dos, con el comentario actualizado. Quitar el cartel no las mete en Google, y el Ingeniero lo dejó explícito. Es coherente con no publicar un contrato en el índice antes de que lo revise un abogado. **Cuando Juan decida, es una línea por página.**

---

## Integridad de la rama

```
origin/main                     3972f9e   intacto
rama local = origin             6fe6ef0   iguales
commits sobre main              6
archivos borrados que existan en main   ninguno
árbol de trabajo                limpio
ninguno de los 10 archivos toca supabase/, robots ni las acciones del panel
```

Seis commits con mensajes que dicen qué hacen, separados por tema: unir párrafos, domicilio, cartel, WhatsApp, pruebas, informe. Se puede revertir uno sin deshacer los demás.

---

## Lo que no verifiqué

1. **No abrí las páginas en un navegador.** No hace falta: son estáticas y el HTML compilado es exactamente lo que se sirve; medí sobre él, no sobre el `.md`.
2. **No ejecuté `verificar:seo`, `verificar:contraste` ni `verificar:secretos`** en esta rama; la ficha no las pide y las tres ya estaban verdes en `main`. No las presento como verdes aquí.
3. **No verifiqué el render con la variable de entorno ausente.** Leí el camino de respaldo en el código (`WHATSAPP_DISPONIBLE` falso → `Link` al formulario) y está probado a nivel de componente, pero no compilé sin `.env.local` para verlo pintado.

---

## Sobre el empujón de este informe

La ficha pide el informe «empujado a origin». **Yo no hago commits ni push** —es mi límite, no un olvido—, así que este archivo queda escrito en el árbol de `nido-wt-125`, sin confirmar:

```
git status --porcelain →  ?? docs/auditorias/rama-125-veredicto-126.md
```

Lo tiene que empujar el Ingeniero o el Líder, como en las ramas anteriores. Si se fusiona antes de publicarlo, el veredicto que autoriza la fusión viaja dentro del mismo commit que el código y no queda como documento propio.

---

## Veredicto final

**PASS.** Con B-1 y B-2 anotados y sin bloquear. La fusión y el despliegue los decide Juan.
