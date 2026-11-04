# Auditoría de seguridad de la base — Nido

**Fecha:** 2026-11-03 · **Proyecto Supabase:** `ayznnqkacpdvvufclhon` · **Repositorio:** `main` en `d924068`
**Autor:** Arquitecto de Datos/Backend · **Alcance:** autorización real en la base — RLS, funciones `security definer`, permisos por columna, escrituras anónimas, almacenamiento y abuso de RPC públicas.

---

## 0. Veredicto

**Nadie sin sesión puede leer ni escribir un dato que no sea público.** Las sondas de esta auditoría no consiguieron una sola fila privada ni una sola escritura sostenida. Los permisos por columna siguen exactos: el catálogo se lee con las 20 columnas del contrato y el WhatsApp del anfitrión responde `42501` incluso mezclado con una columna permitida.

Debajo de eso hay **dos hallazgos que sí hay que cerrar antes de cargar las 20 habitaciones**, ninguno explotable hoy:

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| F1 | `anon` conserva `INSERT`/`DELETE` de tabla en `usuarios`, `pensiones` y `habitaciones`; RLS es la única barrera | 🟠 Media | `oleada-21` §1 |
| F2 | La RPC pública del formulario no tiene límite de frecuencia | 🟠 Media | `oleada-21` §3 |
| F3 | Las oleadas 17, 18, 19 y 20 están aplicadas pero **no están en el repositorio** | 🟠 Media | Sin migración: commitear |
| F4 | Un visitante puede **listar** los objetos del bucket de fotos | 🟡 Baja | Informativo |
| F5 | `pensiones.whatsapp` y `autorizacion_contacto_en` siguen existiendo | 🟡 Baja | Ya cerradas por columna |
| F6 | Registro abierto, con confirmación por correo obligatoria | 🟢 Informativo | Por diseño |
| F7 | La escalada a maestro se apoya en un permiso por columna | 🟢 Informativo | Verificable en A.7 |

| Área que pidió Juan | Resultado |
|---|---|
| Autenticación | Registro con confirmación por correo; usuarios anónimos desactivados |
| Autorización | RLS activa con políticas por operación; ninguna política abierta |
| Validación de entradas | Límites en la base, no solo en el formulario; sin SQL dinámico |
| Datos sensibles | WhatsApp del anfitrión, contactos y reservas: cerrados (`42501`) |
| Sesiones | Las gestiona Supabase Auth; el rol maestro no se puede escribir desde el cliente |
| Registros | No se registran datos personales; ver §6 |
| Dependencias | Fuera de esta auditoría (la cubre el frente de aplicación) |

---

## 1. Método y límites

Sondas HTTP contra PostgREST con **la clave anónima** del proyecto —la que viaja en el navegador de cualquier visitante—. Solo lectura, más escrituras que **debían** fallar. Nada se aplicó y no se dejó ninguna fila.

**Calibración del método**, con dos casos de control para no confundir «no existe» con «no puedo»:

| Respuesta | Significa |
|---|---|
| `401 · 42501` | El objeto **existe** y el rol no tiene privilegio |
| `400 · 42703` | La **columna no existe** |
| `404 · PGRST205` | La **tabla no existe** |
| `404 · PGRST202` | La **función no existe con esa firma** |
| `200 · []` | Existe y se consultó, pero RLS no devolvió filas |

**Lo que esta auditoría no puede ver** y por tanto no afirma: los indicadores `relrowsecurity`, el contenido de `pg_policies`, los `grant` por columna ni los privilegios de función. Ninguno es legible con la clave anónima, y `service_role` **no se pidió ni se usó**. El §5 trae el SQL de solo lectura para que Juan cierre esa parte en el editor.

---

## 2. Evidencia

### 2.1 Lectura: qué ve un visitante

| Petición anónima | HTTP | Código | Lectura |
|---|---|---|---|
| `pensiones?select=*` | 401 | `42501` | Ninguna columna de tabla: cerrado |
| `pensiones?select=<las 20 del contrato>` | 200 | — | El catálogo se lee completo |
| `pensiones?select=whatsapp` | 401 | `42501` | El número del dueño, cerrado |
| `pensiones?select=precio_mensual,whatsapp` | 401 | `42501` | **No se cuela mezclándola** con una permitida |
| `usuarios?select=*` | 200 | — | `[]`: la política no devuelve nada |
| `contacto_anfitrion?select=*` | 401 | `42501` | El WhatsApp del anfitrión, cerrado |
| `contactos_respaldo?select=*` | 401 | `42501` | Contactos y teléfonos de estudiantes, cerrado |
| `reservas?select=id` | 401 | `42501` | Dinero, cerrado |
| `habitaciones?select=*` | 401 | `42501` | `reservada_en` no está concedida |
| `habitaciones?select=<las 7 del contrato>` | 200 | — | Las habitaciones se leen |

### 2.2 Escritura: qué consiguió un visitante

| Petición anónima | HTTP | Código | Lectura |
|---|---|---|---|
| `PATCH pensiones` (`titulo`) | 401 | `42501` | Denegado por privilegio |
| `PATCH pensiones` (`verificado`) | 401 | `42501` | El campo del maestro, denegado |
| `POST pensiones` | 401 | `42501` | Denegado |
| `POST habitaciones` | 401 | `42501` | Denegado |
| `DELETE pensiones?id=eq.<uuid real>` | **200** | — | **Cero filas** → F1 |
| `DELETE habitaciones?id=eq.<uuid real>` | **200** | — | **Cero filas** → F1 |
| `DELETE usuarios?id=neq.<uuid nulo>` | **200** | — | **Cero filas** → F1 |
| `POST usuarios` con `rol: maestro` | 401 | `42501` | «new row violates row-level security policy» → F1 (el privilegio existe) |
| `PATCH usuarios` | 401 | `42501` | Denegado |
| `POST contacto_anfitrion` | 401 | `42501` | Denegado |
| `POST`/`PATCH`/`DELETE` `contactos_respaldo` | 401 | `42501` | Denegado |
| `POST`/`DELETE` `reservas` | 401 | `42501` | Denegado |

### 2.3 Funciones expuestas

| RPC anónima | HTTP | Código | Lectura |
|---|---|---|---|
| `es_maestro` | 401 | `42501` | Ni siquiera invocable: el rol se pregunta desde dentro de las políticas |
| `listar_reservas` | 401 | `42501` | Las reservas no se listan sin sesión |
| `marcar_habitacion_reservada` / `liberar_habitacion_reservada` | 401 | `42501` | — |
| `borrar_pension` | 401 | `42501` | — |
| `maestro_actualizar_campos_pension` | 401 | `42501` | — |
| `crear_pension_con_habitaciones` | 401 | `42501` | — |
| `registrar_reserva`, `cambiar_estado_reserva`, `liberar_deposito`, `cancelar_reserva` | 401 | `42501` | — |
| `registrar_contacto_respaldo` con datos fuera de rango | 400 | `22023` | **Pública a propósito**; valida dentro y no escribe |

### 2.4 Almacenamiento, registro y superficie restante

| Petición | HTTP | Lectura |
|---|---|---|
| `POST /storage/v1/object/fotos-pensiones/...` (image/png) | 400 `AccessDenied` | Subida anónima rechazada por política |
| `POST /storage/v1/object/list/fotos-pensiones` | 200 | Devuelve un objeto → F4 |
| `POST /graphql/v1` (introspección) | 200 | «pg_graphql extension is not enabled» |
| `GET /auth/v1/settings` | 200 | `disable_signup: false` · `mailer_autoconfirm: false` · `anonymous_users: false` |
| `pagos`, `users` | 404 `PGRST205` | No existen |

---

## 3. Hallazgos

### F1 · 🟠 `anon` conserva privilegios de tabla que RLS estaba tapando

**Evidencia medida.** `DELETE` sobre `pensiones`, `habitaciones` y `usuarios` responde `200` con cero filas; `POST` sobre `usuarios` **llega hasta RLS** («new row violates row-level security policy»). Es decir: los privilegios de tabla están concedidos y lo único que impidió el daño fue que no existe política que los permita.

**Por qué importa.** Hoy la barrera es la **ausencia** de una política. El día que alguien añada una política de borrado con `using (true)` —o una de inserción para «facilitar las pruebas»— esas tres tablas quedan abiertas a cualquiera que tenga la clave pública, que es todo el mundo. La defensa correcta es que el privilegio no exista.

**Lo que no es.** No es una vulnerabilidad explotable hoy: medí cero filas borradas y cero filas creadas.

**Corrección.** `oleada-21` §1: `revoke insert, update, delete … from anon` en las tres tablas, y `revoke select` en `usuarios`. **No se toca ningún permiso por columna**, que es lo que el sitio necesita para leer el catálogo.

**Comprobado que no rompe nada:** toda escritura de la aplicación pasa por funciones `security definer` —`crear_pension_con_habitaciones`, `borrar_pension`, `maestro_actualizar_campos_pension`, `marcar_habitacion_reservada`, `liberar_habitacion_reservada`, `registrar_contacto_respaldo`— y ninguna escribe la tabla directamente. Y nada del sitio lee `usuarios` con la clave pública (no hay `from("usuarios")` ni incrustaciones `usuarios(...)` en `app/`, `lib/` ni `components/`).

### F2 · 🟠 La RPC pública del formulario no tiene límite de frecuencia

**Evidencia.** `registrar_contacto_respaldo` responde a un visitante anónimo (es su función: recoger contactos). No hay límite de frecuencia ni en el formulario ni en la base, y lo dejé escrito en su momento en `oleada-12` §5 como decisión abierta.

**Por qué importa.** Un bucle de cien líneas llena `contactos_respaldo` de datos personales falsos y, de paso, ocupa disco. No hay IP disponible dentro de la función, así que un límite por origen no se puede hacer aquí.

**Corrección.** `oleada-21` §3, en un disparador `before insert`: rechaza más de 20 contactos en un minuto, o el cuarto del mismo contacto en una hora, con `54000`. Va en un disparador —y no dentro de la función— para no reemplazar `registrar_contacto_respaldo` y volver a arriesgar la firma de cuatro argumentos que el formulario usa en producción.

### F3 · 🟠 Cuatro oleadas aplicadas que no están en el repositorio

`main` (`d924068`) contiene `esquema.sql` y las oleadas 1–16. **No contiene las oleadas 17, 18, 19 ni 20**, que sí están aplicadas en producción.

Consecuencia: quien reconstruya la base desde el repositorio obtiene un esquema sin `habitaciones.reservada_en`, sin los permisos por columna de la oleada 17, sin el contacto privado del anfitrión, sin `contactos_respaldo.autorizacion_en` y **sin la tabla `reservas`**. Además, esta auditoría y `oleada-21` se apoyan en un esquema que el repositorio no describe: el endurecimiento no se puede revisar en un diff.

**Corrección:** commitear los cuatro archivos, que viven en `nido-wt-125/supabase/`. No es una migración; es lo que hace auditable todo lo demás.

### F4 · 🟡 Un visitante puede listar el bucket de fotos

`POST /storage/v1/object/list/fotos-pensiones` devuelve los objetos. La política es `using (bucket_id = 'fotos-pensiones')` para toda operación de lectura, y el bucket es público a propósito: las fotos de las pensiones son material de catálogo.

**Riesgo real:** bajo. Los nombres son UUID y la imagen ya es pública por URL. Lo que revela es cuántas fotos hay y cuándo se subieron, no qué pensión es cada una.

**No lo corrijo** porque la lectura pública es el requisito del producto y cerrar la política de `select` no impediría el acceso por URL pública: solo rompería la galería del panel. Queda anotado.

### F5 · 🟡 Columnas retiradas que siguen existiendo

`pensiones.whatsapp` y `pensiones.autorizacion_contacto_en` siguen en la tabla. Están **cerradas por privilegio de columna** (medido: `42501` incluso mezcladas con una columna permitida), así que no son una fuga; son deuda que confunde al siguiente que lea el esquema. Se retiran cuando se confirme que ningún dato histórico depende de ellas.

### F6 · 🟢 Registro abierto, con confirmación obligatoria

`disable_signup: false` —cualquiera puede crear cuenta, que es cómo se registra un anfitrión—, pero `mailer_autoconfirm: false`: sin clic en el correo no hay sesión. `anonymous_users: false`: no existe el inicio de sesión anónimo. Un registro nuevo entra con `rol` `anfitrion` o `estudiante`; el valor `maestro` no está en el vocabulario que el disparador de alta acepta.

### F7 · 🟢 La escalada a maestro se apoya en un permiso por columna

El rol maestro se concede solo por SQL. Un usuario con sesión no puede ascenderse porque:

1. `usuarios.rol` tiene `check (rol in ('estudiante','anfitrion','maestro'))` y **no está en el `grant update`**, que es `(nombre, email)`.
2. La política de `UPDATE` sobre `usuarios` limita a la fila propia y no hay política de `INSERT`.
3. `POST usuarios` con `rol: maestro` desde fuera ya lo rechaza RLS (medido).

**Esto es argumentado, no medido:** `has_column_privilege` exige privilegios que la clave anónima no tiene. La consulta A.7 del §5 lo convierte en medida en cuanto Juan la ejecute. Mientras no se ejecute, la afirmación descansa en el texto de `oleada-11:166-167`.

---

## 4. Lo que está bien, y por qué se puede afirmar

| Control | Evidencia |
|---|---|
| Permisos por columna exactos | Las 20 columnas del contrato dan `200`; `select=*` da `42501`; `whatsapp` da `42501` sola y acompañada |
| El WhatsApp del anfitrión no se filtra | `contacto_anfitrion` responde `42501` a `anon` en lectura y en escritura |
| Los contactos de estudiantes no se leen | `contactos_respaldo` responde `42501` en las cuatro operaciones |
| El dinero no se lee ni se escribe | `reservas` responde `42501` en lectura, alta y borrado |
| Ninguna función de escritura es invocable sin sesión | Las diez RPC de escritura dan `42501` a `anon` |
| Toda función `security definer` fija `search_path` | Las 21 del esquema lo declaran; 0 sin fijar (A.6) |
| Sin SQL dinámico con datos del usuario | La única sentencia `execute` del esquema es un literal de `oleada-11` en su bloque de prueba |
| Sin GraphQL paralelo | `pg_graphql` no está habilitado |
| Subida anónima rechazada | `AccessDenied` con `image/png`, el tipo que el bucket sí acepta |
| La comprobación de rol falla cerrada | `lib/maestro.ts` devuelve «no es maestro» cuando la RPC da error |
| `es_maestro` no es invocable por `anon` | `42501`; sí por `authenticated`, que es lo que necesitan las políticas |

---

## 5. Lo que no pude medir, y cómo se cierra

Cinco consultas de solo lectura en el editor SQL (bloque A de `oleada-21`, ampliado):

| Consulta | Qué convierte en medida | Esperado |
|---|---|---|
| A.1 | Que F1 quedó cerrado tras aplicar | `f f f f f f` |
| A.2 | Que el contrato de columnas sigue intacto | `t t f t f` |
| A.3 | Que el disparador existe y está activo | 1 fila · `O` |
| A.4 | Que RLS está activa en las seis tablas | 6 filas · `t` |
| A.5 | Que ninguna política es `using (true)` | 0 filas |
| A.6 | Que ninguna función `definer` quedó sin `search_path` | 0 filas |
| A.7 | La escalada a maestro (F7) | `f t t f` |
| A.8 | Que `anon`/`authenticated` no pueden crear objetos en `public` | `f f` |

Si A.8 diera `t`, el `set search_path = public` de las funciones antiguas pasaría de «aceptable» a «riesgo real» y habría que pasarlas a `pg_catalog` con referencias cualificadas, como ya hacen las de reservas.

---

## 6. Registros y datos personales

Lo que se escribe hoy: `contactos_respaldo` guarda nombre, contacto y mensaje —datos personales— con `autorizacion_en` desde la oleada 19. `reservas` guarda nombre y contacto del estudiante. **Ninguna de las dos es legible con la clave pública** (medido).

Lo que no existe: registro de auditoría de accesos. La base no guarda quién leyó qué, y en Supabase eso no se resuelve con una tabla: se resuelve con los *logs* del proyecto o con `pgaudit`. **No entra en esta migración** porque cambia el coste y el proveedor, no el esquema. Si Juan lo quiere, es una decisión aparte y se documenta antes de tocarla.

Nada de esto registra la clave ni datos de sesión: las sondas se hicieron con la clave anónima leída de `.env.local` y este informe no la reproduce.

---

## 7. Riesgos que quedan abiertos después de la oleada 21

1. **El límite del formulario cuenta volumen, no direcciones.** Un límite por IP va en el borde (Vercel/WAF) o con captcha. Decisión de producto.
2. **Los permisos por columna solo se comprueban en el editor.** No son legibles con la clave pública; por eso cada oleada trae su bloque de verificación.
3. **Las oleadas 17–20 siguen fuera del repositorio** hasta que se commiteen (F3).
4. **Sin registro de auditoría de accesos.** Ver §6.
5. **Las dependencias y el código de la aplicación** no son de esta auditoría: los cubre el frente de QA y Seguridad.

---

## 8. Qué se entrega

- `supabase/oleada-21-endurecimiento.sql` — 15 sentencias, transaccional, idempotente, con guardas, verificación A.1–A.9 y reversión. **No aplicada.** Pasa el analizador real de PostgreSQL (`exit=0`).
- Este informe.
- Las sondas quedaron fuera del repositorio, en `.auditoria-datos-20261031/sonda-seguridad*.mjs`, por si hay que repetirlas después de aplicar.

**Ningún archivo de la aplicación cambió**, así que las 634 pruebas del Ingeniero siguen diciendo lo mismo: no hay regresión que medir en código. La regresión que importa aquí es la del contrato de datos, y se mide con A.2.
