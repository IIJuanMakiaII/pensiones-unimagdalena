# Oleada 0 implementada — bloqueantes antes de lanzar

**Pensiones Unimagdalena** · 2026-09-17
Origen: [INFORME-MAESTRO.md](INFORME-MAESTRO.md) §3 (Oleada 0)

---

## Resumen

| Ítem | Estado | Evidencia |
|---|---|---|
| M-01 XSS almacenado por JSON-LD | ✅ Corregido y probado | Prueba end-to-end con payload real (§2) |
| M-02 Optimizador de imágenes + AVIF | ✅ Mitigado | `next.config.mjs` |
| M-03 Cabeceras de seguridad | ✅ Implementadas | `next.config.mjs` (`headers()`) |
| M-04 WhatsApp con fallback silencioso | ✅ Fallo visible | `app/layout.tsx` |
| M-05 Abuso: verificación de correo y límite | ✅ En código (+1 paso en Supabase) | `app/actions/pensiones.ts` |
| M-05 Abuso: moderación previa | ⏸️ Aplazado a Oleada 1 | Requiere interfaz de aprobación (§4) |
| M-06 Dominio canónico hardcodeado | ✅ Configurable | `lib/sitio.ts` |
| M-18 Redirección abierta (bonus, 5 líneas) | ✅ Corregido | `app/login/page.tsx` |

**Resultado de la verificación final:** build ✓, 19/19 comprobaciones SEO, 16/16 de contraste WCAG AA.

---

## 1. Qué se cambió y por qué

### M-01 · XSS almacenado en el JSON-LD

**Problema:** `JSON.stringify` no escapa `<`. Un anfitrión podía publicar un título como
`</script><script>alert(1)</script>` y el script se ejecutaba en el dominio de la marca para todos
los visitantes (el JSON-LD se inyecta con `dangerouslySetInnerHTML`).

**Solución:** nuevo `lib/json-ld.ts` con `serializarJsonLd()`, que escapa `<`, `>`, `&`, U+2028 y
U+2029 en su forma `\u00xx` (sigue siendo JSON válido). Aplicado en los **tres** puntos donde se
emiten datos estructurados: `app/layout.tsx`, `app/page.tsx` y `app/pensiones/[id]/page.tsx`.

### M-02 · Optimizador de imágenes

**Problema:** `formats: ["image/avif"]` + `remotePatterns: [{ hostname: "**" }]` sobre
`next@14.2.35` activaba la superficie del advisory crítico de RCE en la Image Optimization API
(GHSA-2xp9-vwfh-vxw4), y el comodín permitía usar el optimizador como proxy abierto
(CVE-2025-59471).

**Solución:** AVIF desactivado (queda WebP, ~30 % más ligero que JPEG), `remotePatterns` limitado a
`images.unsplash.com` y `**.supabase.co`, y **validación en el servidor** con
`lib/imagenes.ts` (`hostImagenPermitido`) para que un anfitrión no pueda colar una URL de un host no
permitido. El formulario ahora explica qué enlaces se aceptan.

**Reactivar AVIF** solo después de migrar a Next 16 (queda documentado en el propio `next.config.mjs`).

### M-03 · Cabeceras de seguridad

`next.config.mjs` aplica a todas las rutas: `Content-Security-Policy`, `Strict-Transport-Security`
(solo producción), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy` y `Cross-Origin-Opener-Policy`.

**Decisión documentada:** la CSP permite `'unsafe-inline'` para los scripts que Next inyecta, porque
en 14.2.35 **no se pueden usar nonces** (se heredaría GHSA-ffhc-5mcf-pf4q). Aun así bloquea orígenes
externos de script, prohíbe objetos embebidos y fija `base-uri`, `form-action` y `frame-ancestors`.
Sustituir por hashes/nonces al migrar a Next 16.

### M-04 · WhatsApp sin fallback silencioso

Antes, si faltaba `NEXT_PUBLIC_WHATSAPP_NUMBER` se usaba un número de demostración y **todas las
reservas habrían ido a un número ajeno sin que nadie lo notara**. Ahora `app/layout.tsx` lanza un
error explicado durante la compilación de producción si el número falta o es inválido: el despliegue
falla de forma visible.

### M-05 · Abuso (lo que sí se puede aplicar hoy)

1. **Solo cuentas con correo confirmado pueden publicar** (`user.email_confirmed_at`).
2. **Límite de 5 publicaciones por cuenta en 24 horas**, verificado contra la base.

### M-06 · Dominio configurable

`SITIO_URL` se lee de `NEXT_PUBLIC_SITE_URL` (con el dominio de producción como respaldo), así que
canónicas, JSON-LD y enlaces de compartir apuntan siempre al dominio real del despliegue.

### M-18 · Redirección abierta (bonus)

`?destino=` solo acepta rutas internas (`/^\/(?!\/)/`): antes `//evil.com` pasaba el filtro
`startsWith("/")` y el navegador lo interpretaba como dominio externo.

---

## 2. Prueba de aceptación del XSS (evidencia real)

Criterio: *un título con `</script><script>…` no debe ejecutar nada y el JSON-LD debe seguir siendo válido.*

Procedimiento ejecutado: se inyectó el título `</script><script>alert('xss')</script>` en los datos
del catálogo, se compiló y se inspeccionó el HTML generado. Después se restauró el dato original y se
volvió a compilar.

```
✓ Compiled successfully
=== PRUEBA XSS (título malicioso en los datos) ===
  Home   contiene la secuencia cruda: False        ← no hay XSS
  Home   contiene la versión escapada: True        ← \u003c/script\u003e
  Home   apariciones de \u003c       : 9
  Detalle contiene la secuencia cruda: False
  Detalle contiene la versión escapada: True
```

Estado final: datos restaurados (6 títulos correctos), build ✓, 19/19 y 16/16 en verde.

---

## 3. Acciones que dependen de ti (configuración externa)

| Acción | Dónde | Por qué |
|---|---|---|
| **Activar "Confirm email"** | Supabase → Authentication → Providers → Email | Sin esta casilla, Supabase marca el correo como confirmado al registrarse y la protección M-05 no se aplica |
| Definir `NEXT_PUBLIC_WHATSAPP_NUMBER` | Variables de entorno del despliegue | En producción su ausencia ahora **falla el build** |
| Definir `NEXT_PUBLIC_SITE_URL` | Variables de entorno del despliegue | Canónicas y JSON-LD al dominio correcto |
| Definir `NEXT_PUBLIC_SUPABASE_URL` y `..._ANON_KEY` | Variables de entorno del despliegue | Activa el modo dinámico; sin ellas el sitio sigue en modo demo |

---

## 4. Lo que se aplazó a propósito

**Estado de moderación (`en_revision`)** — el informe de datos propone añadir la columna, pero
**activarla sin interfaz de aprobación ocultaría todas las publicaciones nuevas sin forma de
aprobarlas**. Va en la Oleada 1, junto con la pantalla de moderación y la RPC transaccional que crea
pensión + habitaciones.

**Fallback visual del botón de WhatsApp** — hoy el fallo es en tiempo de compilación (más ruidoso y
suficiente). El estado deshabilitado en la interfaz es un refinamiento de Oleada 1.

---

## 5. Cómo verificarlo

```bash
npm run build                          # debe terminar en ✓ Compiled successfully
node scripts/verificar-seo.mjs         # 19/19
node scripts/verificar-contraste.mjs   # 16/16

# Con el servidor levantado (Iniciar-App.bat), comprobar las cabeceras:
curl.exe -I http://localhost:3000 | findstr /i "content-security strict-transport x-content-type referrer x-frame permissions"
```

**Límite declarado:** las cabeceras se validan al compilar (Next verifica la sintaxis de `headers()`)
y están presentes en el archivo de configuración; la comprobación HTTP en vivo queda pendiente de un
servidor en ejecución.
