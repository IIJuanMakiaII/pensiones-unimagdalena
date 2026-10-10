import { TEXTO_SELLO } from "@/lib/sello";

interface Props {
  className?: string;
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
export default function EtiquetaVerificado({ className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full bg-primary-600 px-2 py-1 text-[11px] font-semibold leading-none text-white shadow-sm ${className}`}
    >
      {TEXTO_SELLO}
    </span>
  );
}
