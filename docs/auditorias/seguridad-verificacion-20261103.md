# Verificación de las correcciones de seguridad — rama `seguridad-17`

- **Fecha:** 3 de noviembre de 2026
- **Rama verificada:** `seguridad-17` @ `284b783` (5 commits sobre `main@d924068`)
- **Método:** medición contra el adaptador real de `@supabase/ssr`, pruebas de mutación, servidor de producción local (`next build` + `next start` con la clave pública) y revisión del diff completo.
- **Autor:** QA y Seguridad N
- **Sin mergear, sin desplegar.** Producción sigue en `main@d924068`.

---

## 1. Veredicto

# PASS — la rama puede mergearse

| ID | Corrección | 1.ª pasada (`ef81179`) | 2.ª pasada (`284b783`) |
|---|---|---|---|
| **SEC-02** | Vida de la cookie de sesión | FAIL — `maxAge` se sobrescribía | **PASS** — 43200 s medidos |
| **SEC-01** | Límite de 64 kB en Server Actions | PARCIAL | **PARCIAL** (sin cambios, sigue abierto) |
| **SEC-03** | Redirección abierta | PASS | **PASS** (+ residual de `/login` cerrado) |
| **SEC-04** | `/maestro` sin sesión → 307 | PASS | **PASS** |
| **SEC-05** | Sin datos personales en los registros | PASS | **PASS** |
| Regresión | tipos · pruebas · build · rutas | PASS | **PASS** — 654/654 |
| Alcance del diff | sin cambios ajenos ni controles debilitados | PASS | **PASS** |

El único hallazgo que bloqueaba el merge está cerrado y lo está **de verdad**: medido, no declarado. La prueba además se pone roja cuando se deshace el arreglo, que es lo que faltaba la primera vez.

SEC-01 sigue en PARCIAL por razones ajenas a esta rama (exige Next 16) y ya estaba declarado así. No es un bloqueo nuevo.

---

## 2. SEC-02 · PASS · la cookie sale con 12 h

### 2.1 Qué cambió

`lib/supabase/cookies.ts` (nuevo) reescribe la opción en el último punto antes de entregar la cookie:

```ts
export function opcionesDeCookieDeSesion(opciones: CookieOptions): CookieOptions {
  return { ...opciones, maxAge: SESION_MAXAGE_SEGUNDOS };
}
```

Se aplica en los dos escritores de servidor: `utils/supabase/server.ts:34` (vía `escribirCookieDeSesion`) y `utils/supabase/middleware.ts:34-38` (vía `opcionesDeCookieDeSesion`). Es el punto correcto: la librería ya decidió y solo queda escribir.

### 2.2 Medición

Ejecuté el adaptador real de `@supabase/ssr@0.12.7` con el callback `set` de la propia rama, no una reimplementación:

```text
SESION_MAXAGE_SEGUNDOS = 43200
lo que llega al almacén: [{"name":"sb-x-auth-token","maxAge":43200,"httpOnly":false,"sameSite":"lax"}]
maxAge efectivo = 43200 s = 12 h
sin nuestro forzado la librería habría puesto: 34560000
```

Y la salida literal de la batería, en el mismo punto:

```text
adaptador: cookies.set("sb-x-auth-token", …, { maxAge: 43200, httpOnly: false })
```

**43200 segundos, 12 horas.** Es la cifra que pedía el encargo y coincide con la medición independiente.

### 2.3 Prueba de mutación (lo que faltaba la primera vez)

En una copia aparte (`git worktree` sobre `284b783`), sin tocar la rama:

**Mutación 1 — desactivar el forzado** (`opcionesDeCookieDeSesion` devuelve `opciones` sin tocar):

```text
not ok 2 - el almacén recibe 43200 aunque la librería pase 400 días
    + actual - expected
    + 34560000
    - 43200
not ok 3 - sin opciones también caduca a las 12 h
```

**Mutación 2 — desconectar `server.ts` del punto único** (volver a `almacen.set(...)` directo):

```text
not ok 6 - los escritores de servidor pasan por el punto único de control
    The input did not match the regular expression /escribirCookieDeSesion\(/
# pass 19
# fail 1
```

Las dos mutaciones se detectan. La prueba mide comportamiento y además vigila el cableado; ya no es un `grep` sobre el texto.

### 2.4 Residual declarado por el Ingeniero: evaluado

El Ingeniero dijo que la cookie del `createBrowserClient` «nace con 400 días hasta que pasa por el middleware y se reescribe en la primera navegación». **La segunda mitad no es exacta**, y lo medí:

```text
A) mismo token (sin renovar): escrituras = 0 → la cookie conserva la caducidad del navegador
B) token renovado:           [{"maxAge":43200}] → 12 h
```

`applyServerStorage` solo escribe cuando el valor cambia (`cookies.js:460`). Por tanto la cookie del navegador **no se corrige en la siguiente navegación**, sino en la **primera renovación del token de acceso**, que ocurre cuando este caduca. La ventana es la vida restante del token emitido al iniciar sesión, no una petición.

**¿Bloquea el merge? No.** Razones:

1. Es una ventana acotada por la caducidad del token, no indefinida.
2. El refresh token rota en cada renovación, así que una cookie robada en esa ventana deja de servir en cuanto el usuario legítimo renueva.
3. Cerrarla del todo exige mover `signInWithPassword` a una Server Action — el mismo cambio que hace posible `httpOnly`. Es la fase 2 ya documentada, y merece su propia ventana con una cuenta de prueba.

Lo que sí hay que corregir es **la frase**, no el código: quien lea «se reescribe en la primera navegación» va a creer que la ventana es de segundos. Es de hasta una renovación de token.

---

## 3. SEC-03 · PASS · incluido el residual de `/login`

`lib/destino-seguro.ts` resuelve la URL y compara el origen. Verificado contra el módulo real con once variantes:

| `?next=` / `?destino=` | Resultado | ¿Sale del origen? |
|---|---|---|
| `/\evil.com` | `/publicar` | no |
| `//evil.com` | `/publicar` | no |
| `https://evil.com` | `/publicar` | no |
| `%2f%2fevil.com` | `/%2f%2fevil.com` | no (ruta interna) |
| `\\evil.com` | `/publicar` | no |
| `/\ /evil.com` | `/publicar` | no |
| `javascript:alert(1)` | `/publicar` | no |
| `data:text/html,x` | `/publicar` | no |
| `/publicar` | `/publicar` | interno, correcto |
| `/restablecer?aviso=1#fin` | `/restablecer?aviso=1#fin` | conserva query y ancla |
| `https://pensiones-unimagdalena.vercel.app/publicar` | `/publicar` | mismo origen, normalizado |

**El residual de `app/login/page.tsx` está cerrado** (`284b783`): usa `destinoInterno(destinoSolicitado, "https://nido.invalid")` y desapareció el `/^\/(?!\/)/`. Confirmado también en el servidor local, leyendo la prop que recibe el formulario:

| Petición | `destino` que llega al formulario |
|---|---|
| `/login?destino=/maestro` | `"/maestro"` — el legítimo funciona |
| `/login?destino=%2F%5Cevil.com` | `"/publicar"` — el ataque cae al destino por defecto |

El origen ficticio (`nido.invalid`) es correcto para este uso: solo sirve de base para resolver rutas relativas y hace que cualquier URL absoluta se rechace.

---

## 4. SEC-04 · PASS · `/maestro` ya no responde 200

Medido hoy en el servidor de producción local de la rama, sin sesión:

| Ruta | `main` | `seguridad-17` |
|---|---|---|
| `/maestro` | 200 | **307** → `/login?destino=%2Fmaestro` |
| `/maestro/1/editar` | 200 | **307** → `/login?destino=%2Fmaestro%2F1%2Feditar` |
| `/publicar` | 307 | 307 → `/login?destino=%2Fpublicar` (sin cambios) |

**Sin bloqueos colaterales:** `/`, `/barrios`, `/pensiones/residencia-makia`, `/contacto`, `/quienes-somos`, los tres legales, `/login`, `/registro` y `/offline` siguen en **200**.

---

## 5. SEC-05 · PASS · sin datos personales en los registros

`app/actions/contacto.ts:111-114` registra solo `error.code` y `error.message`. Ya no se pasa el objeto `PostgrestError`, así que `details` y `hint` no llegan al log.

---

## 6. SEC-01 · PARCIAL · sin cambios en esta rama

`next.config.mjs` añade `experimental.serverActions.bodySizeLimit: "64kb"`. Lo medido en la pasada anterior sigue vigente: un envío de 2 MB por el formulario devuelve `303 → ?error=validacion` — la acción se ejecuta y el cuerpo se lee entero. En el registro del servidor nunca aparece un rechazo por tamaño.

La opción está declarada, pero **no pude demostrar que actúe** sobre la vía que usaría un atacante. No cuenta como defensa. El cierre real es Next 16, y el freno por volumen de la `oleada-21` en la base.

---

## 7. Regresión funcional · PASS

| Comprobación | Resultado |
|---|---|
| `npm run tipos` | limpio, sin salida de error |
| `npm run build` | `Compiled successfully` · 23/23 páginas generadas · middleware compilado |
| `npm run probar` | **654 pruebas, 654 pasan, 0 fallan** (634 + 20 nuevas) |
| Rutas en servidor local | 11 rutas probadas: privadas 307, públicas 200 |
| Cabeceras | CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` y `Permissions-Policy` presentes en la respuesta |
| Formulario de contacto | cuerpo normal → `303 ?error=validacion`: la acción se ejecuta |

Ejecuté el build antes de las pruebas, como advirtió el Ingeniero: la batería exige un `.next` de producción.

---

## 8. Alcance del diff · PASS

`git diff --stat main..HEAD`: 19 archivos, 3.434 líneas añadidas, 20 borradas.

| Grupo | Archivos | ¿Dentro del alcance? |
|---|---|---|
| Correcciones | `app/actions/contacto.ts`, `app/auth/confirmar/route.ts`, `app/login/page.tsx`, `lib/destino-seguro.ts`, `lib/supabase/config.ts`, `lib/supabase/cookies.ts`, `next.config.mjs`, `utils/supabase/{client,server,middleware}.ts` | Sí |
| Pruebas | `pruebas/seguridad-endurecimiento.prueba.ts` (+181) | Sí |
| Documentos | los tres informes de auditoría | Sí |
| Migraciones | `supabase/oleada-17` a `oleada-21` | Declarado: 17–20 ya aplicadas, 21 propuesta y **no aplicada** |

**Controles existentes, intactos.** El diff de `next.config.mjs` **solo añade** el bloque `experimental`; no toca `headers()`. `middleware.ts` no cambia (0 líneas de diff): el matcher sigue igual. No hay cambios en componentes, estilos, lógica de negocio ni textos legales. La única página tocada es `app/login/page.tsx`, que estaba declarada.

---

## 9. Riesgos pendientes tras el merge

| Riesgo | Estado | Quién |
|---|---|---|
| DoS por volumen en Server Actions | Abierto — necesita Next 16 | Ventana propia |
| `httpOnly` en la cookie de sesión | Abierto — exige mover el login a Server Action y una cuenta de prueba | Fase 2 |
| Cookie del navegador con 400 días hasta la primera renovación | Abierto y acotado (§2.4) | Fase 2, mismo cambio |
| `anon` conserva permiso de borrado | Abierto — lo cierra la `oleada-21` | Juan aplica el SQL |
| Formulario público sin freno | Abierto — lo cierra la `oleada-21` | Juan aplica el SQL |

---

## 10. Lo que no pude verificar

| Qué | Por qué |
|---|---|
| Un inicio de sesión completo de punta a punta | Requiere credenciales de una cuenta. La medición de `maxAge` no depende de eso: sale del adaptador real con la configuración de la rama. |
| El límite de 64 kB por la vía RSC legítima | Haría falta un navegador que genere el payload exacto. |
| `/maestro` con sesión de maestro y de anfitrión | Mismo motivo. Verifiqué el camino sin sesión, que era el que fallaba. |

---

## 11. Conclusión

**La rama `seguridad-17` puede mergearse.**

Los cinco hallazgos de aplicación tienen respuesta verificada —cuatro cerrados por completo y uno, el DoS, declarado parcial con su causa y su plan—, la regresión funcional está limpia con 654 pruebas, y el diff no toca nada fuera de lo declarado ni debilita un control existente.

Las condiciones que quedan no son de esta rama: la `oleada-21` la aplica Juan en Supabase, y Next 16 y `httpOnly` necesitan su propia ventana.

Una corrección de forma, no de fondo: en la documentación de la corrección conviene cambiar «se reescribe en la primera navegación» por «se reescribe en la primera renovación del token». La ventana es la misma; la frase induce a error.
