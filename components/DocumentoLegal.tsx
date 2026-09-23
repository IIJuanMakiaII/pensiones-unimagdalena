import { readFileSync } from "node:fs";
import path from "node:path";
import { markdownAHtml } from "@/lib/markdown-legal";

interface Props {
  /** Nombre del archivo dentro de `docs/legales/`, por ejemplo `aviso-de-privacidad.md`. */
  archivo: string;
}

/**
 * Publica un documento de `docs/legales/` tal cual, sin reescribirlo.
 *
 * Se lee en tiempo de compilación: el contenido queda dentro del HTML estático,
 * así que la página no necesita el archivo en el servidor de producción y sigue
 * siendo estática (lo que mantiene el rendimiento del sitio).
 */
export default function DocumentoLegal({ archivo }: Props) {
  const ruta = path.join(process.cwd(), "docs", "legales", archivo);
  const markdown = readFileSync(ruta, "utf8");

  return (
    <article
      className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-neutro-200 md:p-8"
      // El HTML lo genera `markdownAHtml`, que escapa la entrada antes de añadir
      // cualquier etiqueta (ver lib/markdown-legal.ts).
      dangerouslySetInnerHTML={{ __html: markdownAHtml(markdown) }}
    />
  );
}
