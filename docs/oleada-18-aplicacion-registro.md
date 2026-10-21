# Oleada 18 — lectura de reservas: registro de aplicación

**Estado:** aplicada en el proyecto `ayznnqkacpdvvufclhon` el **2026-10-21**, 14:29 UTC.
**Nada se fusionó a `main`.** `origin/main` sigue en `8fdf160`.

Pega la salida real de cada comprobación. Si algo aquí no coincide con lo que
devuelve la base hoy, manda la base.

---

## 1. Qué se aplicó

| Dato | Valor |
|---|---|
| Archivo | `supabase/oleada-18-lectura-reservas.sql` |
| `sha256` | `d0f930d348a8fa1ec757f6f88017754620d7f8c3717a08ec42faed7834a52fb8` |
| Tamaño | 13.530 bytes · 300 líneas |
| Cambios de esquema | **ninguno**: ni tabla, ni columna, ni restricción, ni índice, ni política |
| Objetos creados | 1 función, `public.listar_reservas()` |
| Envoltura | `begin; … commit;` en una sola petición |
| Respuesta | `HTTP 201 · 672 ms · 0 filas` |

**Cómo se verifica el `sha256`, y por qué no es el hash del archivo entero.** El
hash va escrito en la cabecera, así que no puede cubrir su propia línea. La regla
es exacta y está en la cabecera del `.sql`: se retira la línea `-- sha256 (de este
archivo…` y se hashea el resto, leído como UTF-8 sin BOM y unido con `\n`. Quien
ejecute el comando de la cabecera obtiene este mismo valor; comprobado después de
insertarlo.

---

## 2. Por qué existe

La oleada 17 dejó `reservada_en` ilegible para `anon` y `authenticated`, y eso es
correcto. Pero el panel del maestro necesita mostrar **cuándo** se reservó, y sin
lectura no puede: al recargar, la fecha desaparece.

Las dos salidas posibles:

- conceder `SELECT` sobre `reservada_en` → **no**. Deshace la oleada 17.
- una función `security definer` que devuelva solo la fecha → **sí**, y es esto.

La función **no** devuelve `reservada_por` ni `disponible_antes_de_reservar`. El
panel necesita la fecha; todo lo demás que se devuelve de más acaba usándose para
otra cosa.

---

## 3. Respaldo, verificado antes de tocar nada

Esta migración no modifica datos, así que el respaldo útil es doble: comprobar que
el respaldo de datos de la oleada 17 **sigue vigente**, y guardar las definiciones
de las funciones que podrían verse afectadas.

```sql
create table respaldo.funciones_20261021b as
select p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid),
       pg_catalog.pg_get_functiondef(p.oid), p.proacl
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('es_maestro','marcar_habitacion_reservada','liberar_habitacion_reservada');
revoke all on table respaldo.funciones_20261021b from public, anon, authenticated;
```

Verificación:

```json
{ "origen_hab": 2, "copia_hab": 2,
  "origen_pen": 1, "copia_pen": 1,
  "dif_hab": 0,
  "funciones_respaldadas": 3,
  "funciones_public_antes": 16 }
```

Conteo **y** diferencia simétrica en los dos sentidos: cero. Dieciséis funciones
en `public` antes de empezar.

---

## 4. Rollback probado en seco, antes de aplicar de verdad

La prueba en seco de una migración aditiva es exacta: crear y borrar dentro de la
misma transacción. Si el `commit` deja la base igual, el rollback está probado.

```
begin;
  -- bloques 0, 1 y 2 enteros
  drop function if exists public.listar_reservas();
commit;
```

Respuesta: `HTTP 201`. Y el estado después:

```json
{ "existe_listar_reservas": 0, "funciones_public": 16, "reservadas": 0 }
```

La función no existe, el contador volvió a 16 y nadie quedó reservado. **Recién
entonces** se aplicó de verdad, y el mismo contador pasó a:

```json
{ "existe_listar_reservas": 1, "funciones_public": 17, "reservadas": 0 }
```

---

## 5. La función

```sql
create or replace function public.listar_reservas()
returns table (habitacion_id uuid, reservada_en timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  return query
    select h.id as habitacion_id, h.reservada_en as reservada_en
      from public.habitaciones as h
      join public.pensiones    as p on p.id = h.pension_id
     where h.reservada_en is not null
       and (public.es_maestro() or p.anfitrion_id = (select auth.uid()))
     order by h.reservada_en desc, h.id;
end;
$$;
```

El predicado es **el mismo de `marcar_habitacion_reservada` y
`liberar_habitacion_reservada`, literal**. No se inventó uno nuevo: quien puede
marcar es quien puede leer que está marcado, y nadie más.

Devuelve **cero filas, no un error**, a quien no tiene derecho a ver ninguna. Un
estudiante con cuenta que llegue al panel debe recibir nada, no un `42501`. El
`42501` se reserva para quien no puede ni ejecutar la función.

### Contrato para quien consume

```
POST /rest/v1/rpc/listar_reservas     (sin argumentos)
→ 200 · [ { "habitacion_id": "<uuid>", "reservada_en": "<timestamptz>" }, … ]
```

Presencia en la lista = está reservada. Un `disponible = false` **no** implica
reserva: puede ser una habitación apagada a mano. La lista es la única fuente de
verdad sobre qué está reservado.

---

## 6. Verificaciones

| Prueba | Esperado | Obtenido | |
|---|---|---|---|
| V.1 firma y propiedades | 1 fila, `definer`, `stable`, `search_path` | 1 fila, `true`, `s`, `{search_path=pg_catalog}` | ✅ |
| V.2 quién puede ejecutarla | `f \| f \| t` | `false \| false \| true` | ✅ |
| V.3 las columnas siguen cerradas | `f \| f \| f \| f` | `false \| false \| false \| false` | ✅ |
| V.4 prueba funcional | ver abajo | ver abajo | ✅ |
| V.5 nadie quedó reservado | 0 | 0 | ✅ |
| V.6 las tres columnas, una por una | 3 filas, `f` y `f` | 3 filas, `false` y `false` | ✅ |

### V.1 · la firma

```json
{ "proname": "listar_reservas",
  "argumentos": "",
  "devuelve": "TABLE(habitacion_id uuid, reservada_en timestamp with time zone)",
  "security_definer": true,
  "volatilidad": "s",
  "configuracion": ["search_path=pg_catalog"] }
```

`volatilidad: "s"` es `stable`: solo lee.

### V.2 · los privilegios

```json
{ "rol_public": false, "anon": false, "authenticated": true }
```

`public` trae `EXECUTE` por defecto en Postgres para toda función nueva; hay que
revocarlo de los tres y solo después conceder a `authenticated`. `anon` se queda
fuera.

### V.3 y V.6 · el atajo que no se tomó

Esta es la comprobación que delata a quien resuelva el problema concediendo
`SELECT` sobre las columnas:

```json
{ "anon_reservada_en": false, "auth_reservada_en": false,
  "auth_reservada_por": false, "anon_select_tabla": false }
```

```json
[ { "columna": "disponible_antes_de_reservar", "anon_lee": false, "auth_lee": false },
  { "columna": "reservada_en",                 "anon_lee": false, "auth_lee": false },
  { "columna": "reservada_por",                "anon_lee": false, "auth_lee": false } ]
```

La foto de la oleada 17 sigue siendo la misma.

### V.4 · la prueba funcional, con tres identidades

Marca una habitación con la cuenta maestra real, lee la fecha por la función como
tres cuentas distintas y termina en `raise`, así que **revierte todo**. Las cuentas
se resuelven desde los datos, no se llevan escritas: la migración no adivina UUIDs.

```json
{ "fecha_marcada": "2026-10-21T14:29:35.214665+00:00",
  "fecha_leida":   "2026-10-21T14:29:35.214665+00:00",
  "fechas_iguales": true,
  "filas_maestro": 1,
  "filas_dueno": 1,
  "filas_otra_cuenta": 0 }
```

Mismo instante al microsegundo: lo que se lee es lo que se guardó, no una
aproximación. El anfitrión dueño ve la suya. Una cuenta ajena ve cero, y sin error.

Y después: `reservadas = 0`. No quedó residuo.

---

## 7. Regresión: nada más se movió

Las 12 sondas de la oleada 17, repetidas después de aplicar esta:

```
ok   ochoColumnas        200                      200
ok   reservadaEn         401 42501                401 42501
ok   comodin             401 42501                401 42501
ok   rpcMarcar           401 42501                401 42501
ok   web /               200 · 42501=0 · 42703=0  70733 B
ok   web /pensiones/residencia-makia  200 · 42501=0 · 42703=0  83308 B
ok   web /barrios        200 · 42501=0 · 42703=0  37332 B
PASS — 12/12
```

Mismos bytes en las tres páginas que antes de la oleada 18 y que antes de la
oleada 17. Estructura, también igual:

```json
{ "columnas": 11, "restricciones": 10, "indices": 2, "politicas": 8,
  "disparadores": 1, "filas_habitaciones": 2, "ofrecidas": 2 }
```

### Y qué ve un cliente sin sesión al llamar a la función nueva

```
rpc listar_reservas (sin sesion)     HTTP 401  42501   permission denied for function listar_reservas
control: habitaciones disponible     HTTP 200         [{"disponible":true}]
control: habitaciones reservada_en   HTTP 401  42501
```

La lectura pública sigue intacta y la función nueva **no es alcanzable sin sesión**.

> Nota sobre el discriminador. La prueba de privilegios válida es
> `has_function_privilege` sobre `pg_proc`, que es V.2. Una sonda HTTP **no**
> distingue «la función no existe» de «no puedes ejecutarla» cuando la llamada no
> coincide con la firma: pedir `marcar_habitacion_reservada(uuid)` con `{}` da
> `PGRST202` por el argumento, exista o no la función. Para esta función, que no
> lleva argumentos, la respuesta sí es explícita (`42501 permission denied for
> function`), pero no se debe generalizar ese camino.

---

## 8. Reversión

```sql
drop function if exists public.listar_reservas();
```

No pierde ningún dato: la fecha sigue en la columna. Lo que se pierde es la
capacidad de **leerla** desde el panel, y el panel volvería a mostrar «Reservada»
sin fecha al recargar. Ya probado en seco en el apartado 4.

---

## 9. Lo que este registro no demuestra

- **No prueba el clic con una cuenta maestra real desde la interfaz.** La función
  está probada con la identidad simulada por `request.jwt.claims`, que es como
  `auth.uid()` resuelve de verdad, pero no hay credenciales para pulsar el botón.
- **No prueba que PostgREST ya sirva la función en el instante en que el panel la
  llame.** Si justo después del despliegue devuelve `PGRST202`, es la caché de
  esquema, no la función: se recarga sola.
- **No decide nada de negocio.** Las dos preguntas de la §7 de la oleada 17 siguen
  abiertas: si «reservada» se distingue de «ocupada», y si reservar exige anuncio
  verificado.
- **No autoriza al anfitrión a liberar.** La función de lectura le deja *ver* sus
  reservas; liberarlas ya lo permite `liberar_habitacion_reservada`, pero si la
  interfaz se lo ofrece es una decisión de producto, no de esquema.

---

## 10. Cierre

- Respaldo verificado antes de aplicar, con conteo y diferencia simétrica = 0.
- Rollback probado en seco (crear y borrar en una transacción) antes de aplicar.
- Migración aplicada en una transacción, `commit` limpio.
- V.1 a V.6 en verde; 12/12 sondas; estructura idéntica; cero `42501` y cero
  `42703` en las páginas públicas.
- La columna sigue cerrada. El atajo fácil no se tomó.
- El archivo con el token se borra al terminar, y el token debe **revocarse hoy**
  porque apareció escrito en el chat.
