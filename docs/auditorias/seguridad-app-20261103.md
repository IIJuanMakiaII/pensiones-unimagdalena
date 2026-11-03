# Auditoría de seguridad de la aplicación — Nido

- **Fecha:** 3 de noviembre de 2026
- **Alcance:** aplicación Next.js (`main` @ `d924068`), rutas, sesiones, entradas, datos sensibles, registros y dependencias
- **Repositorio auditado:** `.auditoria-tmp/repo-github-20261031` (clon completo, `node_modules` instalado)
- **Producción medida:** https://pensiones-unimagdalena.vercel.app
- **Modo:** solo lectura. Sin modificar código, sin ramas, sin commits, sin despliegues, sin fuerza bruta, sin escrituras en base de datos.
- **Autor:** QA y Seguridad N

> **Nota de alcance.** Esta tarea es de auditoría. Las correcciones corresponden a la tarea **#17** (Ingeniero) y el endurecimiento de base de datos a la **#16** (Arquitecto). Cada hallazgo de aquí abajo trae la recomendación concreta para que #17 la aplique tal cual.

---

## 1. Resumen

| Severidad | Nº |
|---|---|
| Crítico | 1 |
| Alto | 1 |
| Medio | 4 |
| Bajo | 5 |

**Lo que está bien y no hay que reabrir:** la autorización de las acciones de servidor está bien hecha (identidad siempre desde la sesión, nunca desde el formulario; predicado de propiedad en cada escritura; rol maestro preguntado a la base y no a `user_metadata`); no hay XSS confirmado; no hay inyección PostgREST; no hay secretos versionados; el IDOR de las rutas de edición está cerrado.

**Lo que hay que corregir antes de cargar pensiones reales:** la versión de Next (una CVE crítica de paquete, con las tres RCE mitigadas por configuración pero con vectores de DoS vivos), la duración y accesibilidad de la cookie de sesión, un open redirect trivialmente evadible, dos rutas privadas que responden 200, y un `console.error` que puede volcar datos personales al registro.

---

## 2. Hallazgos

| ID | Severidad | Componente | Evidencia | Impacto | Recomendación |
|---|---|---|---|---|---|
| **SEC-01** | **Crítico** | Dependencias — `next` | `package.json:36` fija `next@14.2.35`. `npm audit`: **25 asesorías sobre el paquete** (3 críticas, 9 altas, 11 moderadas, 2 bajas). | Tres RCE sin autenticar (GHSA Windows, AVIF y SVG) más 9 altas: DoS en Server Actions y en RSC, SSRF y poison de caché. | **Ver §2.1**: las tres RCE están mitigadas por configuración; los DoS **no**. Migrar a `next@16.4.5` en una tarea propia (cambio mayor, no es «parche compatible»). Mientras tanto, limitar el tamaño de payload en el borde. |
| **SEC-02** | **Alto** | Sesión — cookie de Supabase | `node_modules/@supabase/ssr/dist/main/utils/constants.js:7` → `httpOnly: false`; `:10` → `maxAge: 400 días`. Ni `utils/supabase/server.ts:21` ni `utils/supabase/middleware.ts:15` pasan `cookieOptions`, así que se usan esos valores por defecto. | La cookie de sesión —token de acceso **y** de refresco— es legible por JavaScript y dura 400 días. Cualquier ejecución de script en el origen se lleva la sesión del anfitrión o del maestro, y sobrevive a un cierre de navegador. | Acortar `maxAge` (8–24 h; el refresco es automático y el usuario no lo nota) y valorar `httpOnly` moviendo el cliente de navegador a acciones de servidor. Ver §4 sobre por qué `httpOnly` no es un cambio de una línea. |
| **SEC-03** | **Medio** | Autenticación — redirección de retorno | `app/auth/confirmar/route.ts:23`: `destino.startsWith("/") && !destino.startsWith("//")`. `app/login/page.tsx:22-23`: `/^\/(?!\/)/`. | Bypass con barra invertida: `?next=/\evil.com` pasa las dos comprobaciones y `new URL()` lo resuelve a `https://evil.com/`. **Verificado con Node** (ver §3). Open redirect en el dominio de confianza = amplificador de phishing. | Comparar contra una lista blanca de destinos internos (`/publicar`, `/restablecer`, `/maestro`) o validar con `new URL(destino, origen).origin === origen`. Una línea por archivo. |
| **SEC-04** | **Medio** | Autorización — `/maestro` y `/maestro/[id]/editar` | `utils/supabase/middleware.ts:6` → `RUTAS_PROTEGIDAS = ["/publicar"]`. Medido en producción: `GET /maestro` → **200**; `GET /maestro/1/editar` → **200**. En cambio `GET /publicar` → **307** y `GET /publicar/1/editar` → **307**. | Una ruta privada responde 200 a un visitante anónimo. **Hoy no filtra datos** (el HTML son 32 KB de armazón con «Inicia sesión», sin pensiones, correos ni teléfonos), pero el 200 se produce porque el `redirect()` ocurre después de que el límite de streaming de `app/loading.tsx` ya envió la cabecera. Es un control de acceso que depende de un detalle de streaming. | Añadir `"/maestro"` a `RUTAS_PROTEGIDAS` en `utils/supabase/middleware.ts:6` (el `matcher` ya lo cubre, `middleware.ts:352-360`). La página conserva su `notFound()` como segunda capa. |
| **SEC-05** | **Medio** | Registros — PII | `app/actions/contacto.ts:111`: `console.error("No se pudo guardar un contacto de respaldo:", error)` pasa el objeto `PostgrestError` completo. | `PostgrestError` incluye `details` y `hint`, que en violaciones de restricción citan los valores de la fila. El correo o el teléfono de un estudiante puede acabar en los logs de Vercel, que son texto plano y con retención. | Registrar `error.code` y `error.message` como ya hace el resto del proyecto (`app/actions/pensiones.ts:379`, `:517`, etc.). Un cambio de una línea. |
| **SEC-06** | **Medio** | Abuso — formularios públicos | `app/actions/contacto.ts:49-51`: la única defensa anti-abuso es la trampa `empresa`. No existe límite de frecuencia en `app/`, `lib/` ni `middleware.ts` (búsqueda sin resultados). Medido: 5 envíos seguidos, ninguno rechazado. | Cualquiera puede inflar `contactos_respaldo` con filas basura o usar el formulario como canal de spam hacia el correo del equipo. Coste de almacenamiento y ruido en el canal que más importa. | Límite por IP y por ventana en la acción de servidor (o en el borde de Vercel) con respuesta 429. La trampa se queda: cubre robots, no cubre un `curl`. |
| **SEC-07** | **Medio** | Autenticación — enumeración de usuarios | `lib/auth-mensajes.ts:14-16` traduce `user already registered` a «Ese correo ya tiene una cuenta. Inicia sesión en lugar de registrarte.», que `components/FormularioRegistro.tsx` muestra al visitante. | Permite comprobar si un correo concreto tiene cuenta, sin límite de intentos. Con una lista de correos de un curso se sabe quién es usuario de Nido. | Mensaje genérico («Si el correo puede registrarse, te enviamos un enlace») o dejar que Supabase oculte la existencia con confirmación por correo. **Antes de cambiarlo, confirmar el ajuste del proyecto**: si Supabase ya devuelve un usuario falso sin error, este mensaje no llega a mostrarse nunca y el hallazgo baja a informativo. |
| **SEC-08** | **Bajo** | Dependencias transitivas | `sharp@0.35.4` (`package.json:40`) — CVE-2026-96889 (librsvg, alta). `postcss@8.4.31` (vía `next`) — XSS al serializar CSS (alta). `source-map-js@1.2.1` — DoS (alta). | `sharp` solo procesa SVG con `dangerouslyAllowSVG`, que está en `false` (`next.config.mjs`), así que la vía no es alcanzable. `postcss` y `source-map-js` se ejecutan en compilación, no en el servidor de producción. | Actualizar `sharp` y `postcss` con parches menores (no cambian la API). Los dos restantes se resuelven al migrar de Next. |
| **SEC-09** | **Bajo** | Legal — generación de HTML | `lib/markdown-legal.ts:88-92`: la URL del enlace se interpola en `href="${destino}"` **después** del escape de `&<>`, y sin escapar comillas. El filtro `/^(\/|#|https?:\/\/)/` no impide un `"` posterior. | Hoy el contenido viene de `docs/legales/`, que es código del repositorio, así que no es explotable por un visitante. Sería un fallo el día que un legal incluya texto generado o traducido por IA. | Escapar `"` a `&quot;` en el valor del `href`. Defensa en profundidad, dos líneas. |
| **SEC-10** | **Bajo** | Cabeceras | Producción devuelve `x-powered-by: Next.js`. `next.config.mjs` no lo desactiva. | Revela el framework y facilita seleccionar exploits. Información ya deducible, pero gratuita de quitar. | `poweredByHeader: false` en `next.config.mjs`. |
| **SEC-11** | **Bajo** | Configuración de producción | `lib/sitio.ts:24`: `DEMO_HABILITADA` es verdadero con `NEXT_PUBLIC_MOSTRAR_DEMO=1`, que es el valor de producción según el informe de datos. | No es una vulnerabilidad. Es un riesgo de integridad y de confianza: el sitio público puede servir seis pensiones inventadas con botones de reserva. | Decidir explícitamente si la demo debe estar encendida en producción. Si no, quitarla de Vercel. Ya está señalado por el Arquitecto; lo dejo aquí por ser un riesgo de exposición pública. |

### 2.1 · SEC-01 en detalle: qué es explotable hoy y qué no

`npm audit` marca el paquete como **crítico**, y la regla 6 de `AGENTS.md` dice que una CVE crítica es bloqueo. Verifiqué una por una las tres críticas contra la configuración real, porque marcarlas sin más sería tan inexacto como ignorarlas:

| Asesoría crítica | ¿Alcanzable hoy? | Por qué |
|---|---|---|
| RCE sin autenticar en servidores Windows | **No** | El destino es Vercel (Linux). |
| RCE en la Image Optimization API con **AVIF** | **No** | `next.config.mjs` fija `formats: ["image/webp"]` a propósito, con el comentario de esta misma asesoría. |
| RCE en la Image Optimization API con **SVG** | **No** | `dangerouslyAllowSVG: false` y `contentDispositionType: "attachment"`. |

Las que **sí** quedan vivas, y son la razón de fondo para migrar:

| Asesoría alta | Alcanzable | Consecuencia |
|---|---|---|
| DoS en App Router usando Server Actions (`<=15.5.27`) | **Sí** | Cualquier visitante anónimo puede enviar payloads a los endpoints de acción y consumir CPU/ memoria de función. No requiere sesión. |
| DoS en Server Components (`<15.5.16`) | **Sí** | Igual, por la vía de RSC. |
| SSRF en rewrites / Server Actions en servidor propio | No | No hay `rewrites` ni servidor propio. |
| Bypass de middleware con i18n (Pages Router) | No | La app es App Router y no usa i18n. |

**Conclusión honesta:** hoy las tres RCE críticas no son alcanzables y no hay que apagar nada. El riesgo real y vivo es de **denegación de servicio** por Server Actions, y se cierra migrando. No recomiendo un salto de 14 a 16 dentro de la tarea #17 —es un cambio mayor que puede romper tipos y pruebas— sino una tarea propia con su rama y su verificación.

---

## 3. Prueba del open redirect (SEC-03)

Ejecutado con Node contra el mismo parser WHATWG que usa `new URL()` en el servidor:

```text
"/\\evil.com"     | confirmar: true | login: true | resuelve a: https://evil.com/
"//evil.com"      | confirmar: false | login: false | resuelve a: https://evil.com/
"/\\/evil.com"    | confirmar: true | login: true | resuelve a: https://evil.com/
```

La comprobación de `//` funciona; la de `\` no. El parseador de URL trata la barra invertida como barra en esquemas especiales, así que `/\evil.com` es `//evil.com` para el navegador y no para el filtro.

**Alcance real de la explotación:** `app/auth/confirmar` exige un `code` válido para llegar a la redirección, y el `code` es de un solo uso y llega por correo. Sin `code`, la ruta responde 307 a `/login?aviso=enlace` (medido). Por eso lo califico **medio** y no alto: es phishing con un paso previo, no una redirección abierta anónima. En `/login`, el `destino` va a `router.push`, que no sale del origen, así que ahí es un fallo latente, no explotable.

---

## 4. Por qué `httpOnly` no es un cambio de una línea (SEC-02)

`@supabase/ssr` necesita que el navegador lea la cookie para mantener la sesión en el cliente (`components/FormularioLogin.tsx`, `FormularioRegistro.tsx`, `SubidorFotos.tsx` usan `crearClienteNavegador`). Poner `httpOnly: true` sin más rompe el refresco de sesión en el navegador: el usuario vería «sesión expirada» al cabo de una hora.

Tres caminos, de menor a mayor esfuerzo:

1. **Bajar `maxAge`** a 8–24 h pasando `cookieOptions` en los dos constructores. Es compatible, no rompe nada y reduce de 400 días a un día la ventana de una cookie robada. **Recomendado ahora.**
2. **Mantener `httpOnly: false` pero endurecer la CSP** quitando `'unsafe-inline'` cuando se migre a Next 16 (con nonces). Ataca la causa —la ejecución de script— en lugar del síntoma.
3. **Mover la autenticación a acciones de servidor** para poder marcar `httpOnly`. Es el arreglo de fondo y el que menos encaja con la fecha de carga de las 20 habitaciones.

No propongo el 3 ahora: es un refactor de autenticación con riesgo de regresión alto y beneficio decreciente mientras no exista un XSS confirmado.

---

## 5. Verificaciones descartadas

Probado y **no** es vulnerabilidad. Se deja escrito para que nadie lo reabra:

| Qué se probó | Resultado | Por qué no es hallazgo |
|---|---|---|
| **XSS reflejado** en `/login?aviso=` y `/contacto?error=` | Sin ejecución | `aviso` solo se compara con `"enlace"` (`components/FormularioLogin.tsx:23`) y `error` se resuelve contra el mapa `TEXTO_DE_ERROR` con `?? guardado` (`app/contacto/page.tsx:51`). El `<script>` aparece en el payload RSC escapado como `\u003cscript\u003e`: medido en el HTML servido, no ejecutable. |
| **XSS en JSON-LD** (`dangerouslySetInnerHTML`, 10 usos) | Sin riesgo | `lib/json-ld.ts:11-18` escapa `<`, `>`, `&`, U+2028 y U+2029. No hay fuga de `</script>`. Es el único uso de `dangerouslySetInnerHTML` y todos pasan por esa función. |
| **Inyección en filtros PostgREST** | Sin riesgo | Los identificadores se validan antes (`FORMATO_UUID` y `FORMATO_SLUG`, `lib/identificador.ts:23,30`, aplicados en `identificadorPlausible`, `:70`), y `postgrest-js` serializa los valores con `URLSearchParams`, que codifica `&`, `,` y `)`. El middleware además usa `encodeURIComponent` en la consulta cruda (`middleware.ts:108`). |
| **XSS almacenado** en título, descripción, normas o servicios | Sin riesgo | Se renderizan como texto de React. No hay `innerHTML` con contenido de usuario. |
| **IDOR en `/publicar/[id]/editar`** | Cerrado | `app/publicar/[id]/editar/page.tsx:76` exige `pension.anfitrion_id === user.id` y responde `notFound()` (404, no 403) para no confirmar existencia. |
| **IDOR en `/maestro/[id]/editar`** | Cerrado | `app/maestro/[id]/editar/page.tsx:73` exige `es_maestro()` contra la base antes de leer. |
| **Escalada por `user_metadata`** | Cerrado | `lib/maestro.ts:19-33` pregunta a la RPC `es_maestro`; falla cerrado (devuelve `false` si hay error o excepción). |
| **Acciones de servidor que confían en el cliente** | Cerrado | Las 12 acciones exportadas toman la identidad de `supabase.auth.getUser()`. Las escrituras de `pensiones.ts` llevan `.eq("anfitrion_id", user.id)` (`:173`, `:346`, `:493`, `:648`, `:735`, `:805`) y comprueban la fila devuelta. |
| **CSRF en acciones de servidor** | Mitigado | Cookie `SameSite=Lax` + validación de `Origin` de Next. |
| **CSRF en logout** (`/auth/signout`) | Mitigado | Solo `POST` (`route.ts:6`); con `SameSite=Lax` la cookie no viaja en un POST de otro origen. Medido: `GET` → 405. |
| **Fijación de sesión** | Sin riesgo | El token lo emite Supabase al autenticar; no hay identificador de sesión propio que un atacante pueda fijar. |
| **`/restablecer` sin sesión** | Cerrado | `app/restablecer/page.tsx:22-27` comprueba `getUser()` y muestra el aviso de enlace inválido si no hay sesión; el formulario no se habilita. |
| **`eval` / `new Function`** | Ausente | Búsqueda sin resultados en `app/`, `components/`, `lib/`, `utils/`. |
| **Secretos versionados** | Ninguno | `npm run verificar:secretos` → 282 archivos, 7 patrones, «sin credenciales versionadas ni archivos de entorno». |
| **Claves en el bundle del cliente** | Ninguna | Solo `NEXT_PUBLIC_*` inocuas. Medido en producción: 0 JWT, 0 `service_role`, ningún host de administración. |
| **CORS** | Cerrado | Sin `Access-Control-Allow-*` ante `Origin` ajeno. |
| **Fuga del WhatsApp del anfitrión** | Sin fuga | Ya medido en la auditoría de producción y reconfirmado: el único número público es el de la plataforma. |
| **Cabeceras** | Correctas | CSP, HSTS con preload, `nosniff`, `Referrer-Policy`, `frame-ancestors` + `X-Frame-Options`, `COOP`, `Permissions-Policy`. Se dan por buenas. |

---

## 6. Lo que no pude verificar (y por qué)

| Qué | Motivo | A quién corresponde |
|---|---|---|
| **RLS por tabla y por operación; `security definer` con `search_path`; permisos por columna; políticas de Storage** | Requiere consultar el catálogo de Postgres y probar escrituras que deben fallar. Necesita credenciales y es territorio de base de datos. | **Arquitecto** (tarea #16) |
| **Flags reales de la cookie en producción** (`Secure`, `HttpOnly`, `SameSite` efectivos) | Requiere una sesión iniciada; no inicié sesión con credenciales ajenas. Verifiqué el valor por defecto de la librería y que el proyecto no lo sobreescribe, que es la causa. | Confirmar con una sesión de prueba en #18 |
| **Límites de frecuencia de Supabase Auth** (login, recuperación) | Son ajustes del proyecto en el panel; no hay acceso de lectura a esa configuración. El código no añade límite propio. | Juan / Arquitecto |
| **Logs reales de Vercel con PII** | No hay acceso de lectura a los logs. Verifiqué el código que los escribe, no su contenido histórico. | Juan |
| **Si Supabase devuelve «user already registered»** | Depende del ajuste de confirmación por correo del proyecto. El código lo maneja, pero puede no alcanzarse nunca. | Confirmar en #18 |
| **`reservas` y las RPC nuevas** (`cambiar_estado_reserva`, `liberar_deposito`) | Se aplicaron el 31-oct; su autorización vive en SQL. | **Arquitecto** (tarea #16) |

---

## 7. Orden recomendado para #17

Por relación beneficio/riesgo, no por severidad:

1. **SEC-05** (una línea, cero riesgo, quita PII de los logs).
2. **SEC-04** (una línea en `RUTAS_PROTEGIDAS`; exige prueba del `matcher` antes y después, según la regla de #17).
3. **SEC-03** (validar con `new URL().origin`; añadir prueba con `/\evil.com`, `//evil.com` y `https://evil.com`).
4. **SEC-02** (bajar `maxAge`; comprobar que la sesión sigue refrescando).
5. **SEC-06** (límite de frecuencia; es el único que añade lógica nueva y merece su propia prueba).
6. **SEC-09, SEC-10** (dos líneas de endurecimiento).
7. **SEC-07** solo si se confirma que el mensaje llega a mostrarse.
8. **SEC-01 y SEC-08** en la tarea de migración, no en #17.

**Criterio de aceptación que propongo para #17:** cada corrección con su prueba de regresión, `tipos` limpio, las 634 pruebas actuales en verde más las nuevas, y `build` correcto. Sin tocar `middleware.ts` sin medir el `matcher` antes y después.
