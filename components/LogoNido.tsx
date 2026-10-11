interface Props {
  className?: string;
  /**
   * En la cabecera, deja solo la marca por debajo de `sm` (tarea #56).
   *
   * Medido a 320 px: la marca con el texto ocupa 106 px de los 288 útiles, y con
   * dos botones a su lado el contenido llegaba a x365 —45 px fuera—. Se midió
   * intentando lo contrario antes de decidirlo: recortar los rótulos («Inicia
   * sesión» → «Entrar») y los rellenos dejaba el contenido en ~296 px sobre 288,
   * sin margen y a merced de las métricas de la fuente. Quitar el texto de la
   * marca libera 74 px y deja 12 px de holgura, sin tocar ningún rótulo.
   *
   * No es una pérdida de identidad: el nombre sigue en el `aria-label` del enlace
   * («Nido, ir al inicio») y vuelve a verse desde 640 px. Solo se usa en la
   * cabecera; el pie conserva el logotipo completo.
   */
  soloMarcaEnMovil?: boolean;
}

export default function LogoNido({ className = "h-8", soloMarcaEnMovil = false }: Props) {
  return (
    <span className={`inline-flex select-none items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-auto shrink-0 text-airbnb-rausch"
        fill="none"
        stroke="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 44 L50 14 L88 44"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 58 C20 84 36 94 50 94 C64 94 80 84 80 58"
          strokeWidth="7.5"
          strokeLinecap="round"
        />
        <path
          d="M34 58 C34 44 42 36 44 46 L56 68 C58 76 66 70 66 58"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={`${
          soloMarcaEnMovil ? "hidden sm:flex" : "flex"
        } items-baseline text-2xl font-black tracking-tight text-airbnb-charcoal`}
      >
        nido<span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-airbnb-rausch" />
      </span>
    </span>
  );
}