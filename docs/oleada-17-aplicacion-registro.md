# Oleada 17 — registro de aplicación en producción

**Estado:** aplicada en el proyecto `ayznnqkacpdvvufclhon` el **2026-10-21**, 14:07 UTC.
**Nada se fusionó a `main`.** `origin/main` sigue en `8fdf160`.

Este documento no describe lo que *debería* pasar: pega la salida real de cada
comprobación, antes y después. Si algo aquí no coincide con lo que devuelve la base
hoy, manda la base.

---

## 1. Qué se aplicó

| Dato | Valor |
|---|---|
| Archivo | `supabase/oleada-17-habitacion-reservada.sql` |
| `sha256` del archivo aplicado | `9CE9C5D43F4D59B1C66EA7F8A55C27A2EC4DD78ED09E50A21134EE58CBF16171` |
| Tamaño | 22.960 bytes |
| Secciones ejecutadas | §0 guardas, §1 columnas, §2 restricciones, §3 funciones, §4 privilegios |
| Secciones **no** ejecutadas | §5 verificación (se corrió aparte), §6 reversión, §7 decisión abierta |
| Envoltura | `begin; … commit;` en una sola petición |
| Respuesta | `HTTP 201 · 447 ms · 0 filas` |

La salvaguarda del encabezado del `.sql` se cumplió antes de aplicarlo: el `sha256`
declarado en las líneas 4 y 377 del documento coincide con el del archivo en disco,
así que lo aplicado es exactamente lo que revisó QA.

---

## 2. Respaldo, verificado antes de tocar nada

```sql
create schema if not exists respaldo;
revoke all on schema respaldo from public, anon, authenticated;
create table respaldo.habitaciones_20261021 as
select id, pension_id, tipo, genero, precio_mensual_cop,
       alimentacion_incluida, disponible, creada_en
  from public.habitaciones;
revoke all on table respaldo.habitaciones_20261021 from public, anon, authenticated;
create table respaldo.pensiones_20261021 as
select id, anfitrion_id, slug, activa, verificado
  from public.pensiones;
revoke all on table respaldo.pensiones_20261021 from public, anon, authenticated;
```

Resultado del conteo **y** de la diferencia simétrica en los dos sentidos:

```json
{ "origen_hab": 2, "copia_hab": 2,
  "origen_pen": 1, "copia_pen": 1,
  "diferencias_hab": 0, "diferencias_pen": 0 }
```

Un conteo igual no demuestra nada: dos tablas con 2 filas pueden tener filas
distintas. Por eso la comprobación hace `except` en ambos sentidos. Cero.

Antes de escribir el respaldo se consultó `information_schema.columns` sobre
`pensiones` para no descubrir un `42703` a mitad de la transacción: `verificado` es
**boolean**, así que las cinco columnas entran tal cual.

---

## 3. Huella estructural, antes y después

Ocho dimensiones medidas por separado, para que un cambio de más se vea en un
`diff` y no se diluya en un recuento global.

| # | Dimensión | Antes | Después | Lectura |
|---|---|---|---|---|
| H.1 | Columnas de `habitaciones` | 8 | **11** | +`reservada_en`, +`reservada_por`, +`disponible_antes_de_reservar` |
| H.2 | Restricciones | 5 | **10** | +4 checks y +1 clave ajena |
| H.3 | Índices | 2 | **2** | sin cambios |
| H.4 | Privilegios de tabla | 26 | **24** | `anon` y `authenticated` pierden el SELECT de tabla |
| H.5 | Privilegios de columna | 117 | **153** | +36, todos por las tres columnas nuevas |
| H.6 | RLS y políticas | activo, 8 | activo, **8** | sin cambios |
| H.7 | Disparadores propios | 1 | **1** | `al_cambiar_habitacion` intacto |
| H.8 | Funciones de la oleada 17 | 0 | **2** | ambas `security definer` |

### H.1 · las tres columnas nuevas, todas anulables

```json
[ { "column_name": "disponible_antes_de_reservar", "data_type": "boolean",                 "is_nullable": "YES" },
  { "column_name": "reservada_en",                "data_type": "timestamp with time zone", "is_nullable": "YES" },
  { "column_name": "reservada_por",               "data_type": "uuid",                     "is_nullable": "YES" } ]
```

### H.2 · las cinco restricciones añadidas

```json
[ { "conname": "habitaciones_autor_con_fecha",
    "definicion": "CHECK (((reservada_por IS NULL) OR (reservada_en IS NOT NULL)))" },
  { "conname": "habitaciones_reserva_con_valor_previo",
    "definicion": "CHECK (((reservada_en IS NULL) OR (disponible_antes_de_reservar IS NOT NULL)))" },
  { "conname": "habitaciones_reservada_no_se_ofrece",
    "definicion": "CHECK (((reservada_en IS NULL) OR (disponible = false)))" },
  { "conname": "habitaciones_sin_reserva_sin_rastro",
    "definicion": "CHECK (((reservada_en IS NOT NULL) OR ((disponible_antes_de_reservar IS NULL) AND (reservada_por IS NULL))))" },
  { "conname": "habitaciones_reservada_por_fkey",
    "definicion": "FOREIGN KEY (reservada_por) REFERENCES usuarios(id) ON DELETE SET NULL" } ]
```

### H.5 · quién puede leer qué

Este es el número que importa, y por eso va desglosado y no en un total:

```json
[ { "grantee": "anon",          "privilege_type": "INSERT",     "columnas": 11 },
  { "grantee": "anon",          "privilege_type": "REFERENCES", "columnas": 11 },
  { "grantee": "anon",          "privilege_type": "SELECT",     "columnas": 8  },
  { "grantee": "authenticated", "privilege_type": "INSERT",     "columnas": 11 },
  { "grantee": "authenticated", "privilege_type": "REFERENCES", "columnas": 11 },
  { "grantee": "authenticated", "privilege_type": "SELECT",     "columnas": 8  },
  { "grantee": "authenticated", "privilege_type": "UPDATE",     "columnas": 5  },
  { "grantee": "postgres",      "privilege_type": "SELECT",     "columnas": 11 },
  { "grantee": "service_role",  "privilege_type": "SELECT",     "columnas": 11 } ]
```

`anon` y `authenticated` leen **8 de 11** columnas: nunca las tres nuevas. Los
privilegios `INSERT` y `REFERENCES` sobre las 11 vienen del `grant` de tabla que ya
existía antes de esta oleada y se derivan a toda columna nueva. No son una puerta:
la política de `INSERT` exige `p.anfitrion_id = auth.uid()`, y sin sesión
`auth.uid()` es `NULL`, así que la condición es falsa. Y sobre `reservada_en` no hay
`UPDATE` para nadie salvo `postgres` y `service_role`.

---

## 4. Semáforos de comportamiento, antes y después

Doce sondas contra la API con la clave anónima, más las tres rutas web.

### Antes — `2026-10-21T14:05:50.187Z`, 12/12

```
ok   ochoColumnas        esperado 200          obtenido 200
ok   reservadaEn         esperado 400 42703    obtenido 400 42703
ok   comodin             esperado 200          obtenido 200
ok   rpcMarcar           esperado 404 PGRST202 obtenido 404 PGRST202
ok   web /               200 · 42501=0 · 42703=0 · 70733 B
```

### Después — `2026-10-21T14:06:58.183Z`, 12/12

```
ok   controlDisponible   esperado 200                obtenido 200
ok   ochoColumnas        esperado 200                obtenido 200
ok   reservadaEn         esperado 401 42501          obtenido 401 42501
ok   reservadaPor        esperado 401 42501          obtenido 401 42501
ok   disponibleAntes     esperado 401 42501          obtenido 401 42501
ok   comodin             esperado 401 42501          obtenido 401 42501
ok   pensionCodigo       esperado 200                obtenido 200
ok   rpcMarcar           esperado 401 42501          obtenido 401 42501
ok   rpcLiberar          esperado 401 42501          obtenido 401 42501
ok   web /                  200 · 42501=0 · 42703=0 · 70733 B
ok   web /pensiones/residencia-makia  200 · 42501=0 · 42703=0 · 83308 B
ok   web /barrios           200 · 42501=0 · 42703=0 · 37332 B
```

Las tres páginas públicas devuelven **el mismo tamaño en bytes** que antes de la
migración. Eso no es un detalle: si una columna se hubiera caído del `select`, el
HTML habría cambiado de tamaño aunque el código HTTP siguiera en 200.

Las transiciones que prueban que la migración entró:

| Sonda | Antes | Después | Significado |
|---|---|---|---|
| `reservada_en` | `42703` columna inexistente | `42501` permiso denegado | la columna existe y no es legible |
| RPC `marcar` | `PGRST202` función no encontrada | `42501` permiso denegado | la función existe y no la llama cualquiera |

El cambio de `400` a `401` es coherente: PostgREST traduce `42501` a `401`.

---

## 5. Verificación §5 del propio `.sql`

| Prueba | Esperado | Obtenido | |
|---|---|---|---|
| G.1 tres columnas, anulables | 3 filas, `YES` | 3 filas, `YES` | ✅ |
| G.2 los cuatro checks nuevos | presentes | 7 checks en total (3 previos + 4) | ✅ |
| G.3 el estado no se lee de fuera | `f \| f` | `false \| false` | ✅ |
| G.4 lo que la app necesita sigue concedido | `t \| t \| f \| f` | `true \| true \| false \| false` | ✅ |
| G.5 las dos funciones son `security definer` | 2 filas, `t` | 2 filas, `true` | ✅ |
| G.6 `anon` no puede llamarlas | `f \| f` | `false \| false` | ✅ |
| G.7 prueba funcional | ver abajo | ver abajo | ✅ |
| G.9 nadie quedó reservado | 0 | 0 | ✅ |

### G.7 · la prueba funcional, con la cuenta maestra real

Ejecutada dentro de un bloque que **revierte por excepción**: si todo pasa, el
mensaje de error transporta el resultado y la transacción no deja rastro. La
habitación usada fue `b3229954-f512-4d10-a8cb-ce357f15e57d`.

```json
{ "antes_disponible": true,
  "marcar_1_devuelve_fecha": "2026-10-21T14:08:37.802715+00:00",
  "marcar_2_devuelve_misma": true,
  "tras_marcar_disponible": false,
  "tras_marcar_reservada": true,
  "tras_marcar_previo": true,
  "reofrecer_sqlstate": "23514",
  "liberar_devuelve": true,
  "tras_liberar_disponible": true,
  "tras_liberar_reservada": false,
  "tras_liberar_previo": null,
  "otra_cuenta_sqlstate": "42501" }
```

Se lee de arriba abajo:

- marcar devuelve la fecha y deja la habitación fuera de la oferta;
- repetir marcar **no mueve la fecha** (idempotente);
- intentar ofrecerla otra vez choca con el check: `23514`;
- liberar la devuelve al valor que tenía y borra todo rastro;
- **otra cuenta distinta del maestro y del anfitrión recibe `42501`**: la reserva no
  se la marca cualquiera.

Y después del bloque: `reservadas = 0`. No quedó residuo.

---

## 6. Dos defectos en la §5 del `.sql`, que no afectan a lo aplicado

La §5 se ejecutó aparte y no se aplicó, así que ninguno de los dos toca la base.
Pero están escritos en el archivo y conviene que no se copien a la próxima oleada.

**G.1 usa `pg_catalog.pg_columns`, que no existe.** Devuelve `42P01`. El catálogo
correcto es `pg_catalog.pg_attribute` (o `information_schema.columns`). La prueba se
corrió con `pg_attribute` y dio las 3 filas anulables.

**G.7, tal como está escrito, no puede funcionar.** Hace
`set local role authenticated` y a continuación
`select id, disponible, reservada_en from public.habitaciones`. Bajo el rol
`authenticated`, `reservada_en` **no es legible** —ese es justamente el objetivo de la
migración—, de modo que la prueba fallaría con `42501` antes de medir nada. La versión
que se ejecutó hace `reset role` antes de inspeccionar estado, y comprueba el
`23514` dentro de un bloque `exception` para no abortar la transacción.

---

## 7. El único cambio de comportamiento deliberado

**Un cliente que pida `?select=*` sobre `habitaciones` recibe ahora `42501`.**

Es consecuencia inevitable de pasar de `SELECT` de tabla a `SELECT` por columna: el
comodín se expande a las 11 columnas, incluida `reservada_en`, y el cliente no tiene
privilegio sobre ella.

Las 12 sondas lo confirman: `comodin` respondía `200` antes y `42501` después, y
**ningún consumidor del repositorio lo usa**. Fuera del repositorio no hay forma de
saberlo; si algo externo lee esa tabla con `select=*`, dejará de funcionar.

---

## 8. Reversión: lo que sí y lo que no

La §6 del `.sql` devuelve la **estructura** a como estaba. **No devuelve el estado.**

Una habitación marcada queda con `disponible = false`, y al hacer `drop column`,
`disponible_antes_de_reservar` —el único dato que sabía devolverla— desaparece.
Revenir con reservas abiertas deja la habitación apagada para siempre.

Hoy eso es inocuo porque `reservada_en is not null` = **0 filas**. Si en el futuro hay
que revertir con reservas vivas, el orden es: copiar `disponible` desde
`respaldo.habitaciones_20261021` **antes** del `drop column`, nunca después.

---

## 9. Lo que este registro no demuestra

- **No prueba la escritura desde el panel.** Los privilegios están medidos
  (`authenticated` puede `UPDATE` sobre 5 columnas, no sobre `reservada_en`), pero
  nadie con sesión real ha pulsado el botón: eso es la tarea #106.
- **No prueba que el anfitrión vea el rótulo «Reservada»** en `/maestro`. Sigue
  pendiente de la sesión de Juan.
- **No decide las dos preguntas de negocio** escritas en la §7 del `.sql`: si
  «reservada» debe distinguirse de «ocupada», y si reservar exige anuncio verificado.

---

## 10. Cierre

- Respaldo creado y verificado **antes** de la migración, con conteo y diferencia
  simétrica en los dos sentidos.
- Migración aplicada en una transacción, `commit` limpio.
- 12/12 sondas en verde antes y después; las tres páginas públicas con **0** errores
  `42501` y **0** errores `42703`.
- Huella estructural: solo cambiaron las cuatro dimensiones previstas.
- El archivo con el token se borró al terminar, y el token debe **revocarse hoy**
  porque apareció escrito en el chat.
