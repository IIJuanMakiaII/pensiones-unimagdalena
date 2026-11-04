# Correcciones de seguridad — rama `seguridad-17`

**Autor:** Ingeniero de Software N
**Fecha:** 3-nov-2026
**Base:** `main@d924068` (la desplegada)
**Estado:** rama empujada a `origin`. **Sin merge, sin despliegue**: lo aprueba Juan tras la verificación de QA.

---

## 1. Qué se corrigió

| ID | Severidad | Cambio | Archivo:línea |
|---|---|---|---|
| SEC-02 | Alta | La cookie de sesión caduca a las 12 h en vez de 400 días. **La primera versión no funcionaba** (ver §5): ahora se fuerza en el callback `set` | `lib/supabase/cookies.ts`, `utils/supabase/server.ts`, `utils/supabase/middleware.ts` |
| SEC-03 | Media | El destino de `/auth/confirmar` se valida resolviendo la URL y comparando el origen | `lib/destino-seguro.ts:24`, `app/auth/confirmar/route.ts:23` |
| SEC-04 | Media | `/maestro` entra en las rutas que exigen sesión | `utils/supabase/middleware.ts:17` |
| SEC-05 | Media | El fallo del formulario registra `code` y `message`, no el objeto con datos de la fila | `app/actions/contacto.ts:114` |
| SEC-01 | Crítica | Mitigación parcial: cuerpo máximo de 64 kB en Server Actions | `next.config.mjs:12` |

### SEC-02 · sesión de 400 días

Doce horas es el punto medio del rango que recomendaba la auditoría (8–24 h): mientras la
pestaña está en uso, el middleware refresca la cookie en cada petición, así que el usuario
activo no nota nada; una sesión abandonada deja de valer al día siguiente.

**La primera versión de esta corrección no servía.** Pasaba `cookieOptions.maxAge` al
constructor y la librería lo pisaba. El detalle y la corrección real están en §5.

**No se activó `httpOnly`.** La auditoría explica por qué no es un cambio de una línea:
`createBrowserClient` necesita leer la cookie para refrescar la sesión, y activarlo sin
mover la autenticación al servidor dejaría al usuario con «sesión expirada» cada hora. Va
como riesgo pendiente, con su camino de arreglo.

### SEC-03 · redirección abierta

El filtro anterior miraba el texto (`startsWith("/")` y `!startsWith("//")`). `/\evil.com`
pasa ese filtro y el parser WHATWG lo resuelve a `https://evil.com/`. Ahora se resuelve la
URL con `new URL(candidato, origen)` y se compara `origin`; todo lo que salga del sitio
—incluidos `javascript:` y `data:`— cae a `/publicar`.

### SEC-04 · `/maestro` sin sesión

`RUTAS_PROTEGIDAS` solo tenía `/publicar`. La página comprobaba el rol contra la base, pero
sin sesión devolvía 200 con un panel vacío: el control dependía de cuándo se vaciaba el
búfer de streaming. Ahora el middleware redirige antes de renderizar.

El `matcher` del middleware ya cubría `/maestro` y `/maestro/:path*`, así que no hubo que
tocarlo; se comprobó leyendo su configuración y con una prueba. Medido en el servidor: sin
sesión, `/maestro` y `/maestro/1/editar` responden **307** a `/login?destino=…`, igual que
`/publicar`.

### SEC-05 · datos personales en los registros

`console.error(..., error)` imprimía el objeto de PostgREST completo; en una violación de
restricción ese objeto cita el valor de la fila, y la fila lleva nombre y teléfono del
estudiante. Ahora se registran solo `error.code` y `error.message`, como ya hacían los otros
veinte puntos del proyecto.

### SEC-01 · dependencias

**No se actualiza Next en esta rama.** El salto 14 → 16 es un cambio mayor (React 19, API
de cookies asíncrona, cambios de tipos) y mezclarlo con cuatro correcciones puntuales
imposibilita saber qué rompió qué. Queda documentado abajo con su plan.

Lo que sí se aplicó es una mitigación compatible: `experimental.serverActions.bodySizeLimit`
a 64 kB. No cierra el DoS —el vector es también la frecuencia, no solo el tamaño— pero
recorta el coste por petición y no afecta a ningún formulario real: el más largo son unos
pocos kilobytes y las fotos van directas a Storage desde el navegador.

---

## 2. Pruebas

Archivo nuevo: `pruebas/seguridad-endurecimiento.prueba.ts` (15 pruebas). Cada bloque lleva
el ID del hallazgo y falla si alguien deshace la corrección.

| Comando | Resultado |
|---|---|
| `npm run tipos` | sin errores (exit 0) |
| `npm run probar` | **654 pruebas, 654 pasan, 0 fallan** (634 previas + 20 nuevas) |
| `npm run build` | correcto, exit 0 |

**Orden importante:** `payload-publico.prueba.ts` exige un `.next` de producción. Si antes se
levantó `next dev` —como hice para medir SEC-04— el `.next` queda en modo desarrollo, sin
páginas prerenderizadas, y esa prueba falla con «no se encontró ninguna página
prerenderizada». No es una regresión: se comprobó compilando en producción y repitiendo la
batería (649/649). Es la misma fragilidad de orden que ya quedó anotada en la auditoría del
código del 31-oct.

Pruebas por hallazgo:

- **SEC-03**: ocho casos —ruta interna, `/\evil.com`, `/\\evil.com`, `/\//`, `//evil.com`,
  dominio absoluto, `javascript:`, `data:`, cadena vacía, solo espacios y query/ancla— más
  una que comprueba que la ruta ya no usa el filtro viejo.
- **SEC-02**: medida sobre el adaptador, no sobre el texto (ver §5). Comprueba que el
  almacén recibe `maxAge: 43200` aunque la librería pase 400 días, que las demás opciones de
  la cookie no se tocan y que nadie activa `httpOnly` sin mover la autenticación.
- **SEC-04**: `/maestro` está en la lista y el `matcher` la cubre.
- **SEC-05**: la línea de registro usa `code` y `message` y no el objeto completo.
- **SEC-01**: el límite de cuerpo sigue declarado.

### Comprobación de comportamiento de SEC-04

Con un Supabase inalcanzable a propósito (para forzar «sin sesión») y el servidor de
desarrollo en el puerto 3002:

```text
/maestro                 307 -> /login?destino=%2Fmaestro
/maestro/1/editar        307 -> /login?destino=%2Fmaestro%2F1%2Feditar
/publicar                307 -> /login?destino=%2Fpublicar
```

En local sin credenciales el middleware no valida sesión (modo demo), así que esa medición
se hizo con variables de Supabase falsas.

---

## 3. Higiene del repositorio

`main` se detenía en la oleada 16 mientras producción tenía aplicadas la 17, 18, 19 y 20.
Se incorporan:

| Archivo | Estado real |
|---|---|
| `supabase/oleada-17-habitacion-reservada.sql` | aplicada en producción |
| `supabase/oleada-18-lectura-reservas.sql` | aplicada en producción |
| `supabase/oleada-19-autorizacion-contacto.sql` | aplicada en producción |
| `supabase/oleada-20-reservas-deposito.sql` | aplicada en producción |
| `supabase/oleada-21-endurecimiento.sql` | **propuesta, NO aplicada** — la pega Juan |
| `docs/auditorias/seguridad-app-20261103.md` | informe de QA |
| `docs/auditorias/seguridad-datos-20261103.md` | informe del Arquitecto |

La cabecera de la 21 dice explícitamente que no está aplicada. Sin esto, quien reconstruya
la base se queda sin tabla `reservas` y sin la columna de autorización.

---

## 4. Riesgos pendientes

| # | Riesgo | Estado | Plan |
|---|---|---|---|
| 1 | **SEC-01 · DoS en Server Actions y RSC** con `next@14.2.35` (25 avisos, 3 RCE no alcanzables hoy) | Mitigado parcialmente con el límite de 64 kB | Tarea propia de migración a Next 16 antes de la campaña: React 19, `cookies()` asíncrona ya preparada, CSP con nonces, reactivar AVIF tras comprobar el advisory |
| 2 | **Cookie sin `httpOnly`**, y la que escribe el `createBrowserClient` al iniciar sesión nace con 400 días hasta el primer refresco del middleware | Documentado | Fase 2: mover `signInWithPassword` a una Server Action, marcar `httpOnly` y emitir la cookie desde el servidor. Requiere una cuenta de prueba para verificar el login completo |
| 3 | **F1 · `anon` conserva `DELETE`** en `pensiones`, `habitaciones`, `usuarios` | Fuera de código: lo cierra la oleada 21 | Aplicar la 21 y comprobar A.1 y A.2 |
| 4 | **F2 · formulario sin freno** | Fuera de código: límite de 20/min en la oleada 21 | Igual que el anterior. El límite en la app exigiría estado compartido que hoy no existe |
| 5 | **CSP con `'unsafe-inline'`** | Sin XSS confirmado hoy | Se resuelve con la migración a Next 16 (nonces) |
| 6 | **SEC-06 y SEC-10** (endurecimientos menores del informe de QA) | No incluidos: fuera del alcance que fijó el Líder para esta rama | Se valoran con la migración |

---

## 5. Segunda vuelta: SEC-02 con efecto real (verificación de QA)

QA reabrió SEC-02 con razón: la cookie seguía saliendo con 400 días.

**Por qué la primera corrección no hacía nada.** `@supabase/ssr@0.12.7` mezcla
`cookieOptions` y después **sobrescribe** `maxAge` con su valor por defecto
(`dist/main/cookies.js:470` → `dist/main/utils/constants.js:10`, `400 * 24 * 60 * 60`).
Pasar la opción al constructor es decorativo.

**Por qué las pruebas no lo vieron.** Las dos pruebas de SEC-02 hacían `assert.match` sobre
el texto de los archivos: comprobaban que la palabra `maxAge` estaba escrita, no que la
cookie la recibiera. Un `grep` no es una prueba.

**Qué se cambió ahora.**

- `lib/supabase/cookies.ts`: `opcionesDeCookieDeSesion()` y `escribirCookieDeSesion()`
  reescriben `maxAge` en el último momento, cuando la librería ya decidió y solo queda
  entregar la cookie al almacén.
- `utils/supabase/server.ts` y `utils/supabase/middleware.ts` escriben por ahí. El
  middleware además propaga las mismas opciones a la petición y a la respuesta.
- Las pruebas de SEC-02 se reescribieron para medir el `maxAge` que llega a `cookies.set`,
  alimentándolas con las opciones reales que pasa la librería (400 días).

**Medición (salida literal de la prueba, con las opciones que emite la librería):**

```text
adaptador: cookies.set("sb-x-auth-token", …, { maxAge: 43200, httpOnly: false })
```

43 200 s = 12 h. Si alguien vuelve a confiar en `cookieOptions`, la prueba falla con
`34560000 !== 43200`.

**Residual honesto:** el `createBrowserClient` escribe la cookie del login él mismo y no
expone callback, así que **la primera cookie del navegador nace con 400 días** hasta que una
petición pasa por el middleware y la reescribe con 12 h. En la práctica la ventana se
reduce a la primera navegación, pero no es cero. Cerrarlo exige mover `signInWithPassword` a
una Server Action, que es la fase 2: sin cuenta de prueba no se puede verificar un login
completo y cambiar la autenticación a ciegas es peor que el riesgo que elimina.

**Residual de login cerrado:** `app/login/page.tsx` usaba su propia expresión regular
(`^\/(?!\/)`), que bloquea `//evil.com` pero no `/\evil.com`. Ahora usa la misma
`destinoInterno()` que `/auth/confirmar`, con un origen ficticio como base. No era
explotable —el valor termina en `router.push`, que no sale del origen— pero era la misma
validación equivocada en otro punto.

## 6. Cómo verificarlo

```bash
cd .auditoria-tmp/repo-github-20261031
git checkout seguridad-17
npm ci
npm run tipos && npm run probar && npm run build
node --test --import ./pruebas/registrar.mjs pruebas/seguridad-endurecimiento.prueba.ts
```

Para la parte de red que estas pruebas no cubren —cookie real en producción, redirección
con un `code` válido— la comprobación corresponde a QA sobre el sitio desplegado, después
del merge.
