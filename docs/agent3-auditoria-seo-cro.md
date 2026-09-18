
---

## Anexo — Migración a la paleta de marca del cliente (2026-09)

**Identidad entregada:** verde bosque `#325334` + naranja quemado `#E16118`.

### Cómo se aplicó

La paleta se redefinió en `tailwind.config.ts` **manteniendo los nombres de los
tokens** (`primary-*`, `secondary-*`, `accent-*`), por lo que todos los
componentes heredaron el cambio sin reescribir la interfaz. Después se
ajustaron solo los puntos donde el contraste habría fallado.

| Rol | Token | Hex | Uso |
|---|---|---|---|
| Primario (brand) | `primary-600` | `#325334` | Botones principales, sellos, hero, iconos |
| Botón primario (hover) | `primary-700` | `#2A4529` | Estados hover/pressed |
| Superficie oscura | `secondary-700` | `#2B3529` | Footer y degradado del hero |
| Acento de marca | `accent-500` | `#E16118` | Precios grandes (≥ 20 px negrita), estrellas, slider, bordes hover |
| Acento accesible | `accent-700` | `#A4440D` | CTA con texto blanco y textos naranjas pequeños |
| WhatsApp (relleno) | `whatsapp-deep` | `#075E54` | Botones de reserva con texto blanco |

### Hallazgos de accesibilidad corregidos

1. **`#E16118` con texto blanco = 3.54:1** → no cumplía AA para texto pequeño.
   Los CTA y chips activos pasaron a `accent-700` (`#A4440D`, **6.16:1**).
   `accent-500` se conserva donde es seguro: precios grandes en negrita (3.54:1,
   umbral 3:1 para texto grande) y elementos gráficos.
2. **Verde oficial de WhatsApp `#25D366` con texto blanco = 1.98:1** (fallo
   grave preexistente) → los botones de reserva usan `whatsapp-deep` (`#075E54`,
   **7.67:1**), conservando el reconocimiento de marca de WhatsApp.
3. **Estrellas doradas `#D4A017` = 2.38:1** (por debajo del 3:1 requerido para
   gráficos informativos) → ahora usan `accent-500` (3.54:1), alineadas además
   con la identidad del cliente.
4. **Color de foco fijo** en `app/globals.css` (`#059669`) → actualizado a
   `#325334`.

### Verificación

```
node scripts/verificar-contraste.mjs
→ 16/16 combinaciones cumplen WCAG AA (mín. 4.5:1 texto / 3:1 gráficos)
```

Comprobado también en el build de producción: el CSS compilado contiene los 6
colores nuevos, ninguno de los antiguos (`#059669`, `#FF6B35`, `#174863`), y el
HTML emite `theme-color: #325334` junto al manifest, apple-touch-icon y JSON-LD.
Los íconos PWA (`public/iconos/*.png`) se regeneraron desde el SVG de marca con
los nuevos colores.
