import { TEXTO_SELLO, formatearFechaVerificacion } from "@/lib/sello";

interface Props {
  className?: string;
  /**
   * Fecha de la visita de verificación, tal como llegue de la base (`verificado_en`,
   * tarea #61). Sin ella el sello se dibuja exactamente como antes, sin fecha.
   *
   * Es `unknown` a propósito: la decisión de qué cuenta como fecha válida vive en
   * `formatearFechaVerificacion` y no repartida por cada componente que dibuje el
   * sello. Y mientras el dato no exista, la firma `unknown` evita inventar el campo
   * en el contrato de tipos antes que en la base.
   */
  verificadoEn?: unknown;
}

/**
 * Etiqueta «Verificado por Nido ✓» (tarea #51).
 *
 * Sustituye en la tarjeta al círculo sin texto que había antes. Un punto de
 * color no comunica nada a quien no conoce el sitio, y el fundador pidió texto
 * visible; el círculo se conserva para la ficha, donde acompaña a la píldora
 * «Verificada por el equipo (inspección presencial)» y no compite con nada.
 *
 * Este componente **no decide nada**: se dibuja siempre que se le invoca. La
 * decisión —y su única fuente, `pension.verificado`— vive en quien lo usa, para
 * que no exista una segunda puerta por la que el sello pueda aparecer.
 *
 * Accesibilidad: el texto visible es el nombre accesible, así que no lleva
 * `aria-label` que lo repita (un lector lo anunciaría dos veces). El único
 * adorno es el propio ✓, que forma parte del texto y no es un SVG aparte que
 * haya que marcar como decorativo.
 *
 * Contraste: el fondo es el tono `primary-600` con texto blanco. El rojo del
 * círculo anterior (`confianza-success`, #FF385C) da 3,52:1 — suficiente para
 * un gráfico, **insuficiente para texto**; por eso al pasar de icono a etiqueta
 * con texto hay que bajar de tono. El par está declarado en
 * `scripts/verificar-contraste.mjs` con mínimo 4,5:1, y ese verificador lo mide
 * en cada pasada leyendo la paleta real.
 */
export default function EtiquetaVerificado({ className = "", verificadoEn }: Props) {
  const fecha = formatearFechaVerificacion(verificadoEn);

  return (
    <span
      className={`inline-flex justify-center rounded-full bg-primary-600 px-2 py-1 text-xs font-semibold leading-none text-white shadow-sm ${
        // Con fecha, la insignia pasa a dos líneas en vez de estirarse a lo ancho:
        // a 320 px la tarjeta tiene 288 px y la etiqueta va anclada arriba a la
        // derecha, así que una sola línea larga chocaría con el corazón de
        // favoritos. En columna, el ancho lo fija el texto más largo —el sello— y
        // la fecha cabe debajo sin moverse de su sitio.
        fecha ? "flex-col items-start gap-0.5" : "items-center whitespace-nowrap"
      } ${className}`}
    >
      {TEXTO_SELLO}
      {/* «el 12 oct 2026» y no «12 oct 2026»: junto al sello, sin preposición, la
          fecha se lee como el día en que se publicó o se actualizó el anuncio. */}
      {fecha && <span className="font-normal">el {fecha}</span>}
    </span>
  );
}
