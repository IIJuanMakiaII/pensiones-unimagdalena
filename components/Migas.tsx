import Link from "next/link";
import type { Miga } from "@/lib/migas";

interface Props {
  migas: Miga[];
}

/**
 * Ruta de navegacion (migas de pan).
 *
 * Va como lista ordenada y no como una fila de enlaces sueltos: un lector de
 * pantalla anuncia «lista de 3 elementos» y da la posicion, que es justo el valor
 * que aporta una miga de pan. La ultima no es enlace: es la pagina actual, y
 * enlazarla consigo misma solo anade ruido.
 */
export default function Migas({ migas }: Props) {
  if (migas.length === 0) return null;

  return (
    <nav aria-label="Ruta de navegación" className="text-xs">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-neutro-500">
        {migas.map((miga, indice) => {
          const esUltima = indice === migas.length - 1;

          return (
            <li key={miga.ruta} className="flex min-w-0 items-center gap-x-1.5">
              {esUltima ? (
                <span aria-current="page" className="truncate font-semibold text-neutro-700">
                  {miga.nombre}
                </span>
              ) : (
                <Link
                  href={miga.ruta}
                  className="underline-offset-2 hover:text-primary-700 hover:underline"
                >
                  {miga.nombre}
                </Link>
              )}

              {!esUltima && (
                <span aria-hidden="true" className="text-neutro-400">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
