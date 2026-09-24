/**
 * Accesibilidad dependiente del sistema (M-24).
 *
 * La media query de `globals.css` cubre lo que anima el CSS, pero no lo que
 * anima JavaScript: `scrollTo({ behavior: "smooth" })` del carrusel seguiría
 * deslizando la pantalla aunque el sistema pida reducir el movimiento. Esto es
 * justo el caso que más afecta a quien tiene sensibilidad vestibular, así que la
 * preferencia se consulta también aquí.
 */

/** ¿El sistema pide reducir el movimiento? (WCAG 2.3.3) */
export function prefiereMenosMovimiento(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Comportamiento de desplazamiento acorde a la preferencia del sistema. */
export function comportamientoScroll(): ScrollBehavior {
  return prefiereMenosMovimiento() ? "auto" : "smooth";
}
