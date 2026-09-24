# Integración continua — que ningún cambio entre sin pasar las comprobaciones

Tarea #28 · la mitad que faltaba de **M-16**.
Configuración: [`.github/workflows/integracion-continua.yml`](../.github/workflows/integracion-continua.yml)

Cada vez que se sube un cambio (a cualquier rama, y en cada propuesta de cambio), GitHub ejecuta las comprobaciones descritas aquí. No hay que lanzarlas a mano ni recordar nada: **el flujo es el que decide**, y el resumen final deja por escrito qué se ejecutó y qué no.

---

## 1. Qué se ejecuta en cada subida

| Bloque | Qué comprueba | ¿Necesita base de datos? |
|---|---|---|
| **1 · Sin base de datos** | tipos (`tsc`), lint, **115 pruebas unitarias**, compilación, guardián de credenciales, contraste WCAG, SEO sobre el build y clasificación de rutas del Service Worker | No |
| **2 · Con servidor** | levanta el build del bloque 1 y comprueba humo de rutas y estructura HTML | No |
| **3 · Con base de datos** | humo y estructura con datos reales, códigos de estado (404 de ficha retirada), RLS de Supabase | **Sí** — se activa cuando existen los secretos |
| **4 · Resumen** | deja en una pantalla qué bloque se ejecutó y con qué resultado; **falla si el bloque 1 no se superó** | No |

**El bloque 1 es el esencial.** Si falla, la subida no debe considerarse buena. El bloque 3 es el que acredita el comportamiento con datos reales, y por eso se dice en voz alta cuándo no se ejecuta.

### Comandos (los mismos que se pueden ejecutar a mano)

| Comando | Qué hace | ¿Necesita `.env.local`? |
|---|---|---|
| `npm run tipos` | comprobación de tipos de todo el proyecto | No |
| `npm run verificar:lint` | lint de ESLint, o **SALTADO con motivo** si no está instalado | No |
| `npm run probar` | 115 pruebas unitarias de la lógica pura, el motor de filtrado, las regresiones de seguridad y el Service Worker | No |
| `npm run build` | compilación de producción | Solo las variables públicas |
| `npm run verificar:secretos` | que no haya credenciales versionadas | No |
| `npm run verificar:contraste` | 16 combinaciones WCAG AA del sistema de diseño | No |
| `npm run verificar:seo` | datos estructurados, metadatos, `robots`, `sitemap` sobre el build | No |
| `npm run verificar:sw` | que ninguna ruta con sesión sea cacheable y que **ninguna ruta quede sin clasificar** (recorre las rutas reales del build) | Solo el build |
| `npm run verificar:humo` | respuesta de las rutas (necesita el servidor levantado) | Opcional |
| `npm run verificar:estructura` | HTML válido y sin contenido interactivo anidado | Opcional |
| `npm run verificar:estados` | 404 real de ficha inexistente o retirada | **Sí** |
| `npm run verificar:supabase` | RLS: catálogo público y perfiles **no** legibles por anónimos (solo lectura) | **Sí** |

---

## 2. Qué significa un verde (y qué no)

- **Verde** = esas comprobaciones se ejecutaron y pasaron.
- **Bloque saltado** = **no se ejecutó**. Se marca con un aviso (`⚠️`) en la cabecera de la ejecución y con una explicación en el resumen, con el motivo concreto. **Un bloque saltado no acredita nada.**
- El paso de **lint se salta mientras no haya ESLint instalado**, y lo dice. No se disfraza de superado: una luz verde que no comprobó nada da confianza sin respaldo, que es peor que no tener la comprobación.

Para ver el estado real de un run: mira el **resumen** del bloque 4 y las anotaciones amarillas de la cabecera.

---

## 3. Lo que hay que configurar (una sola vez, y solo tú puedes hacerlo)

El flujo **no contiene ninguna credencial**. Los valores se guardan como *secretos del repositorio*, y estos son los nombres exactos que espera la configuración.

**Ruta:** repositorio → *Settings* → *Secrets and variables* → *Actions* → **New repository secret**.

| Nombre exacto del secreto | De dónde sale el valor | ¿Obligatorio? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Panel de Supabase → tu proyecto → *Project Settings* → *API* → **Project URL** | Sí, para el bloque 3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Misma pantalla → **`anon` `public`** (la clave que ya va al navegador) | Sí, para el bloque 3 |
| `NEXT_PUBLIC_SITE_URL` | Tu dominio real, tal como quedó en `lib/sitio.ts` (por ejemplo `https://roomieya.com`). Sin barra final | No, pero recomendable |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | El número de la plataforma, **solo dígitos** con el 57 delante (por ejemplo `573001234567`) | No |

> **Nunca añadas `SUPABASE_SERVICE_ROLE_KEY` al repositorio.** Es la clave que salta todas las políticas de la base: en un sistema de integración continua no hace falta para nada de lo que se comprueba aquí (todo se verifica con la clave pública, que es la que ya viaja al navegador) y su filtración sería el peor escenario posible. Si alguna vez ves que una comprobación la pide, la comprobación es la que está mal.

**Mientras no existan los dos primeros secretos**, el bloque 3 se salta con su motivo y el resto sigue funcionando. Es decir: **puedes empezar con dos secretos y activar el bloque 3 después**, sin tocar el archivo de configuración.

### Protección de rama (recomendado)

En *Settings* → *Branches* → regla para `main`, marca como estado requerido:

- **`4 · Resumen`** — es el único que hace falta exigir: falla si el bloque 1 no se superó, y deja escrito el estado de los tres.

Así una subida no puede llegar a `main` sin pasar por las comprobaciones, sin tener que ir marcando cada bloque.

---

## 4. Lo que **no** se ejecuta en la integración continua (y por qué)

Estos verificadores son valiosos, pero **no pueden correr en GitHub** por cómo están construidos. Se ejecutan a mano en la máquina de desarrollo, y aquí queda dicho para que nadie los dé por cubiertos:

| Verificador | Por qué no puede correr en GitHub | Cómo se usa |
|---|---|---|
| `npm run verificar:disponibilidad` | Necesita el CLI `accio-mcp-cli` (solo existe en el entorno de desarrollo) y **escribe** filas de prueba en la base real | A mano, con el servidor levantado |
| `npm run verificar:storage` | Crea una cuenta de prueba y necesita la confirmación de correo desactivada | A mano, con el administrador de la base |
| `scripts/mcp-sql.mjs` | Depende del mismo CLI | A mano |

**Riesgo que conviene tener presente:** el arnés de disponibilidad crea y borra una publicación temporal en la base **de producción**. Si se interrumpe a mitad, quedan datos de prueba en el catálogo del anfitrión (la fila se crea activa). Es anterior a esta tarea y está en el informe maestro; lo correcto a medio plazo es un proyecto de Supabase aparte para pruebas.

---

## 5. El lint: por qué se salta y cómo activarlo

El `package.json` declara `"lint": "next lint"`, pero **ESLint no está instalado** (ni `eslint` ni `eslint-config-next` figuran en las dependencias). Ejecutarlo así no analiza nada y abre un asistente interactivo que en integración continua dejaría el paso colgado.

El paso se salta de forma **visible y explicada**, y **se activa solo** en cuanto ESLint exista: no hay que tocar el flujo. Para activarlo, una vez y con red:

```bash
npm install --save-dev eslint@^8 eslint-config-next@^14.2.35
```

Y añadir al `package.json`:

```json
"eslintConfig": { "extends": "next/core-web-vitals" }
```

Después, comprometer el `package-lock.json` actualizado. La siguiente subida ya lo ejecutará de verdad.

---

## 6. Las pruebas unitarias: qué cubren y por qué

Antes, las reglas críticas del negocio solo se comprobaban con pruebas extremo a extremo contra la base de datos: si no había credenciales, no se comprobaban. Ahora viven como pruebas unitarias, que **corren siempre y gratis**, sin base de datos y en menos de un segundo.

| Archivo | Qué protege |
|---|---|
| `pruebas/precio.prueba.ts` | `precioReservable` (un anuncio con todo ocupado no anuncia precio) y el precio «desde» |
| `pruebas/filtros.prueba.ts` | El motor de filtrado: precio, género, alimentación, distancia, favoritos, y el paso a la URL |
| `pruebas/whatsapp.prueba.ts` | Normalización del número (`+57 300 123 4567` → `3001234567`), los 10 dígitos y el respaldo a la plataforma |
| `pruebas/identificador.prueba.ts` | Por qué columna se busca un anuncio (uuid o dirección legible) — el error de tipos que hacía caer la app a la semilla |
| `pruebas/seguridad.prueba.ts` | Regresiones de seguridad: el XSS del JSON-LD y la lista blanca de imágenes |
| `pruebas/service-worker.prueba.ts` | Que el Service Worker **no guarde en el dispositivo** ninguna página con sesión (ejecuta el `sw.js` real con cachés falsas) |

**Requiere Node 22 o superior** (no es una preferencia): las pruebas ejecutan archivos `.ts` directamente aprovechando el «type stripping» de Node. Por eso el flujo fija esa versión.

### Por qué hay además un verificador del Service Worker (y no es redundante)

Son dos garantías distintas, y las dos hacen falta:

| | Qué garantiza | Qué **no** puede ver |
|---|---|---|
| `pruebas/service-worker.prueba.ts` (batería unitaria) | Que la **lógica** es correcta: se ejecuta el `sw.js` real y se comprueba, ruta por ruta, que no se guarda nada con sesión | No conoce rutas que aún no existen: si mañana alguien añade `/mi-cuenta`, la prueba no se enterará |
| `npm run verificar:sw` | Que el **inventario está completo**: recorre las rutas reales del build y exige que cada una esté clasificada en `public/sw.js` | Depende del build: sin compilación no puede ejecutarse (y lo dice, en vez de aprobar en falso) |

La segunda es la que cubre el modo de fallo que ocurrió de verdad: la lista de rutas privadas se quedó atrás **dos veces** porque nada obligaba a revisarla. Un verificador que recorre el build convierte «acuérdate de clasificarla» en «la subida falla hasta que la clasifiques».

Su control negativo está comprobado: sin build → falla indicando que hay que compilar; con una ruta ficticia sin clasificar → falla nombrando exactamente la ruta.

---

## 7. Cómo verificar la propia integración continua

Un flujo que nunca se ha ejecutado es una promesa, no una comprobación. Esto es lo que se verificó **antes** de entregarlo, ejecutando los mismos comandos del flujo:

| Comprobación | Resultado |
|---|---|
| `npm run tipos` | limpio |
| `npm run verificar:lint` | se salta con motivo, código de salida 0, sin colgarse |
| `npm run probar` | **115 pruebas en menos de un segundo** (con ESLint ausente y sin base de datos) |
| `npm run verificar:secretos` | sin hallazgos — **y con control negativo**: al plantar una credencial falsa la detectó (2 patrones) y el repositorio volvió a verde tras retirarla |
| `npm run verificar:contraste` | 16/16 WCAG AA |
| `npm run build` **sin credenciales**, en una copia aislada | compila y prerrenderiza el catálogo de demostración |
| `npm run verificar:seo` sobre ese build **sin credenciales** | **23/23**, incluido `sitemap.xml` sin URLs de demostración |
| `npm run verificar:sw` | 16 rutas del build, **todas clasificadas** y ninguna con sesión cacheable — y **con dos controles negativos**: sin build falla pidiendo compilar, y con una ruta ficticia sin clasificar falla nombrándola |
| `npm ci` (dependencias frente al `package-lock.json`) | sincronizadas: la instalación del flujo no fallará |

### Límites declarados

- **El flujo en sí no se ha ejecutado en GitHub todavía.** No había credencial de GitHub disponible en este entorno para subir el cambio; el commit queda hecho y la primera ejecución la verá quien lo suba. Todo lo verificable por adelantado (los comandos, las condiciones de CI sin credenciales, el control negativo del guardián) está verificado.
- **No se validó el YAML con un analizador formal** (no había ninguno disponible sin red). Se revisó la estructura a mano y, sobre todo, se ejecutó cada comando que contiene.
