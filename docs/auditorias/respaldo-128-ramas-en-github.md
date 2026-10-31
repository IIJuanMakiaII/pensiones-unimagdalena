# Respaldo en GitHub antes de la migración a Mac (#128)

**Fecha:** 31 de octubre de 2026
**Autorización:** Juan pidió que se suba todo a GitHub porque se cambia a un Mac y el trabajo del PC no viaja solo.
**Alcance:** publicar en `origin` toda rama y todo trabajo que existía solo en el PC. **Sin fusionar nada, sin abrir PR, sin tocar `main`, sin cambiar la visibilidad del repositorio.**

---

## 1. El punto de partida, medido

| | Antes |
|---|---|
| Ramas locales | **39** |
| Ramas en `origin` | **9** |
| Ramas que solo existían en el PC | **30** |
| `stash` | 1 (`7f79ad6`, sobre `arreglar-mapa-teselas-72`) |
| Suelto sin rastrear | `supabase/oleada-14-retirar-anuncio-de-prueba.sql` (12.411 bytes) y el directorio `tmp-72/` |
| Tags | ninguno, local ni remoto |
| `main` | `e261b9c`, sincronizada con `origin/main` |

**Corrección al conteo que circulaba:** se hablaba de 29 ramas en riesgo. Medido hoy sobre
`git for-each-ref`, son **30** ramas locales sin par en `origin`. No se investigó el origen
de la diferencia; lo que vale es la medición, no el recuento previo.

## 2. Auditoría de credenciales antes de empujar

Ninguna rama llevaba credenciales. Método y resultado:

- **Archivos de entorno versionados:** en las 30 ramas el único archivo que coincide con `.env` es **`.env.example`**, que está a la vista a propósito (así lo exige `.gitignore`). Ni `.env`, ni `.env.local`, ni `.env.production` en ninguna rama.
- **Búsqueda por patrón** en las 30 ramas, excluyendo `scripts/verificar-secretos.mjs` y `scripts/verificar-storage.mjs`, que contienen los patrones por oficio: 60 coincidencias, y todas son **referencias a variables o documentación**, no valores. Las revisé una por una. Ejemplos de lo que salió:
  - `docs/despliegue.md:53` — «**Nunca añadas `SUPABASE_SERVICE_ROLE_KEY`.**» (una advertencia).
  - `middleware.ts:82` — `apikey: SUPABASE_ANON_KEY` (identificador, no valor).
  - `components/FormularioRestablecer.tsx:90` — `if (password !== repetir)` (una comparación del formulario).
  - `docs/aplicar-migraciones-pendientes.md:50` — `-H "apikey: $K"` (variable de shell).
- **Claves literales (JWT `eyJ…`, cadenas de 32+ caracteres entre comillas, cadenas `postgres://` con usuario y contraseña):** **cero**.

## 3. Las 30 ramas publicadas

Todas con upstream configurado (`branch 'X' set up to track 'origin/X'`).

| Rama | SHA | Último asunto |
|---|---|---|
| `apagado-verificado-104` | `41aca1e` | Fusiona #88: el panel maestro muestra y busca el ID visible |
| `arreglar-mapa-teselas-72` | `aa18da0` | El mapa de la ficha dibuja las teselas: el Service Worker no intercepta imagenes de otros origenes |
| `codigo-visible-panel-88` | `2e7e076` | Panel maestro: código visible y buscador por NID-0001 (#88) |
| `codigo-visible-pension-87` | `7337917` | El código visible de pensión (oleada-16): columna, relleno, sello y su prueba |
| `comentarios-coherentes-104` | `cd7fc18` | Corregir los comentarios que contradicen al sistema (tarea #104) |
| `condiciones-contacto-directo-78` | `8d884ce` | Las Condiciones prohíben desviar el contacto fuera de la plataforma |
| `contacto-anfitrion-privado-76` | `6a474f0` | Contacto del anfitrion: tabla privada, RLS de dos lectores y prueba |
| `contacto-maestro-solo-lectura-79` | `19308ca` | #79: el maestro ve el WhatsApp del anfitrion sin poder pisarlo |
| `corregir-cierre-de-sesion-y-encabezado` | `5dbd53a` | Cerrar el 405 de cerrar sesion y hacer que la cabecera siga la sesion |
| `corregir-guion-retirada` | `9ed3211` | El paso de barrios del guion deja de leer trozos de Next |
| `desglose-reserva-canon-completo` | `484b0de` | Decir que la suma cierra en el canon completo y quien asume la tarifa |
| `docs-autorizacion-109` | `6f02c3f` | docs(legal): el documento de autorizacion no puede afirmar que el numero no se pide |
| `docs-coherentes-105` | `1c35c04` | docs: el CI verifica 18 pares de contraste, no 16 |
| `docs-reservada-108` | `0fc4dbd` | docs: llamar «reservada» al estado que la interfaz llama asi |
| `escala-tipografia-lexend` | `14081e7` | Escala tipografica legible y Lexend en el cuerpo |
| `ficha-galeria-unica-75` | `0ab8dac` | La ficha dibuja la galería una sola vez: un único carrusel arriba y fuera la portada suelta |
| `filtros-plegables-96` | `f70fd02` | Plegar y desplegar los filtros del catálogo también en escritorio (#96) |
| `guardian-escala-y-contraste-texto` | `c5b4c7b` | Vigilar la escala y el texto oscuro, y corregir el boton que se escapaba |
| `integracion-publicacion-15` | `cada2cb` | Hoja de estado: oleada-15 entra en la tabla y tiene sonda propia |
| `medir-previews-protegidos` | `b591605` | Medir un Preview protegido sin incrustar la clave de omision |
| `mejora-filtros-sello-nido` | `19268e8` | El sello de confianza deja de ser un círculo mudo |
| `payload-publico-93` | `5fff4ab` | Cierra O-1 y O-2: la prueba barre los .rsc y cubre la tercera puerta (#95) |
| `quienes-somos-v2-textos-y-maquetacion` | `8c5632a` | Quienes somos: los textos del fundador y «Por que lo hago» a la derecha de la foto |
| `quienes-somos-y-sello` | `adcc1da` | Quienes somos y la manija del sello en el panel maestro |
| `tarea-55-seguridad-integridad-datos` | `11ab22a` | Fusionar la rama del CI y el arreglo de /registro |
| `tarea-71-barrios-404` | `5206a1a` | Los barrios sin nada que mostrar responden 404 con noindex (#71) |
| `textos-legales-modelo-cobro` | `2ec44c3` | Texto legal: responsable, giro del anticipo y estado del cobro |
| `textos-legales-publicables` | `755fe85` | Dejar publicables los dos textos legales y blindarlos con una prueba |
| `vocabulario-reservada-107` | `bb650b1` | Renombrar «ocupada» a «reservada» en toda la interfaz (tarea #107) |
| `whatsapp-anfitrion-formulario-77` | `a3bf2e4` | #77: cobertura del escritor del contacto privado, que no tenia ninguna |

## 4. El trabajo que no era una rama

### 4.1 El `stash` → rama `rescate-stash-73` (`7f79ad6`)

El `stash@{0}` («Lead: contenido de #73 identico a 8c5632a, apartado antes de integrar») se
preservó **creando una rama que apunta a su commit**, sin aplicarlo y sin borrarlo. El
`stash` sigue en su sitio: `git stash list` lo devuelve intacto. La rama conserva los dos
archivos que llevaba apartados:

- `app/quienes-somos/page.tsx`
- `pruebas/quienes-somos.prueba.ts`

### 4.2 El SQL suelto → rama `respaldo-sql-oleada-14` (`b6a0b89`)

`supabase/oleada-14-retirar-anuncio-de-prueba.sql` (249 líneas) existía solo en el disco.
Se preservó en **rama propia**, creada desde `main` en un worktree aparte para no tocar el
árbol de `main`. **No se aplicó ninguna migración**: el archivo se guarda, no se ejecuta.

### 4.3 `tmp-72/` → rama `respaldo-tmp-72` (`2f0c5a3`)

Se inspeccionó archivo por archivo y se comparó cada uno contra los blobs del repositorio
con `git hash-object` + `git cat-file -e`, que es la prueba de si su contenido ya está en
git. Resultado:

| Archivo | ¿Ya en git? | Decisión |
|---|---|---|
| `comprobar-http.mjs` (1.993 B) | No | **Conservado.** Guion de comprobaciones HTTP del criterio (d) con guardián de identidad del servidor. |
| `sw-viejo.js` (19.744 B) | No | **Conservado.** Copia del Service Worker anterior al arreglo del mapa: la única evidencia del estado previo. |
| `sw-arreglado.js` (12.029 B) | **Sí**, es idéntico al `public/sw.js` de todas las ramas (blob `80268f0f23`) | Descartado por duplicado. |
| `srv3312.out.log` (99 B) | No | Descartado: «Ready in 2.2s» del arranque en el puerto 3312. |
| `srv3312.err.log` (0 B) | No | Descartado: vacío. |

Los dos archivos conservados van con un `LEEME.md` que explica qué son, de dónde salen y
qué se dejó fuera y por qué.

### 4.4 Este informe → rama `informe-respaldo-128`

No se publicó en `main` porque la asignación prohíbe tocar `main` en esta tarea. Vive en su
propia rama, publicada en `origin`. **Pasarlo a `main` es una decisión de Juan o del Líder**,
y entonces sí sería un avance limpio de documentación.

## 5. Estado final, medido después de empujar

```
git ls-remote --heads origin  ->  43
git for-each-ref refs/heads   ->  43
ramas locales sin par en origin -> ninguna
ramas locales sin upstream      -> ninguna
ramas en origin sin par local   -> ninguna
{local, origin}/main            -> e261b9c = e261b9c
```

Correspondencia **uno a uno**: 43 y 43. `main` sin mover.

## 6. Lo que NO se hizo, a propósito

- No se fusionó ninguna rama.
- No se abrió ningún PR.
- No se tocó `main` ni su contenido: sigue en `e261b9c` en local y en `origin`.
- No se cambió la visibilidad del repositorio: **sigue siendo público**. Esa decisión es de Juan.
- No se commiteó `.env.local` ni ninguna credencial.
- No se aplicó ninguna migración ni se tocó Supabase.
- No se borró el `stash` ni el SQL original del disco: siguen donde estaban.

## 7. Efecto secundario esperado

Cada una de las 33 ramas nuevas dispara un Preview en Vercel. Es automático, no toca `main`
ni producción, y consume cuota de despliegue. Si molesta, los Previews se pueden desactivar
por rama desde el panel de Vercel, o borrar las ramas que ya no se necesiten una vez
verificadas en el Mac.

## 8. Lo que queda en manos de Juan para la migración

Esto es el repositorio. Lo demás no viaja por GitHub:

1. **Clonar en el Mac:** `git clone https://github.com/IIJuanMakiaII/pensiones-unimagdalena.git`
2. **Recrear `.env.local`** con las claves de Supabase desde su gestor de contraseñas. No está en GitHub y no debe estarlo.
3. **`npm install`** dentro del proyecto clonado.
4. **La carpeta de Accio Work** (`C:\Users\DELL\.accio\accounts\1743210109\`) — memoria, agentes, skills y conversaciones — **no viaja por GitHub** y hay que copiarla a mano. El Líder ya preparó los respaldos y la guía para eso.
