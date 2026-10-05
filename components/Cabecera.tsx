import Link from "next/link";
import EntradaCuenta from "@/components/EntradaCuenta";
import LogoNido from "@/components/LogoNido";

/**
 * Cabecera del sitio (tarea #17): marca + entrada de cuenta.
 *
 * Es un componente de SERVIDOR y no consulta la sesión a propósito. Resolverla
 * aquí obligaría a renderizar en cada visita todas las páginas que hoy son
 * estáticas/ISR —la portada y las fichas— porque el layout afecta a todas. Solo
 * compone la parte estática (marca) y delega el acceso a la cuenta en
 * `EntradaCuenta`, que resuelve la sesión en el cliente después de hidratar.
 *
 * NO es `sticky`: el catálogo ya tiene su barra de filtros fija en `top-0` y dos
 * barras pegadas se comerían la primera pantalla del móvil. Además, la cabecera
 * es compacta (h-14 en móvil) para no desplazar el hero.
 */
export default function Cabecera() {
  return (
    <header className="border-b border-neutro-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 md:h-16 md:px-6">
        <Link
          href="/"
          aria-label="Nido, ir al inicio"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-xl py-1 pr-1 transition hover:opacity-90"
        >
          <LogoNido className="h-8" />
        </Link>

        <div className="ml-auto flex min-w-0 items-center">
          <EntradaCuenta />
        </div>
      </div>
    </header>
  );
}
