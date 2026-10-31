# Restos de la medición del mapa (#72)

Esta carpeta existía suelta en el disco del PC, sin versionar. Se publica aquí para que
sobreviva al cambio de equipo. **Nada de esto es código de producción ni se importa desde
la aplicación.**

## Qué se conservó y por qué

| Archivo | Qué es | Por qué se guarda |
|---|---|---|
| `comprobar-http.mjs` | Guion que hacía las comprobaciones HTTP del criterio (d) contra el sitio construido con `next start` en el puerto 3312. Incluye un guardián de identidad que aborta si el servidor de ese puerto no es Nido. | Su contenido no existe en ninguna otra rama. |
| `sw-viejo.js` | Copia del Service Worker **anterior** al arreglo del mapa, usada como referencia del «antes» durante el diagnóstico de #72. | Su contenido no existe en ninguna otra rama: el `public/sw.js` de todas las ramas ya es el arreglado. Es la única evidencia del estado previo. |

## Qué se dejó fuera, y por qué

| Archivo | Motivo |
|---|---|
| `sw-arreglado.js` | Es **byte a byte** el `public/sw.js` que ya está versionado en todas las ramas (blob `80268f0f23`). Duplicarlo no aporta nada. |
| `srv3312.out.log` | 99 bytes del arranque de `next start` en el puerto 3312 ("Ready in 2.2s"). Sin valor. |
| `srv3312.err.log` | Vacío (0 bytes). |

## Nota

La rama `arreglar-mapa-teselas-72` ya está publicada en origin y contiene el arreglo real
y su informe. Esto de aquí es solo el material de laboratorio de aquella medición.
