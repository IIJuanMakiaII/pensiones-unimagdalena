import Link from "next/link";

/**
 * Navegación entre los documentos legales.
 *
 * Los tres se enlazan entre sí para que quien entra por un enlace suelto —el pie,
 * la ficha o un WhatsApp— pueda llegar a los otros dos sin volver a la portada.
 * El documento en el que ya estás no se repite como enlace: sería un enlace a la
 * misma página.
 */
const DOCUMENTOS = [
  { href: "/legal/condiciones", etiqueta: "Condiciones de uso" },
  { href: "/legal/privacidad", etiqueta: "Aviso de privacidad" },
  { href: "/legal/reembolsos", etiqueta: "Política de reembolsos" },
];

export default function EnlacesLegales({ actual }: { actual: string }) {
  const otros = DOCUMENTOS.filter((documento) => documento.href !== actual);

  return (
    <nav
      aria-label="Otros documentos legales"
      className="mb-5 flex flex-wrap gap-x-5 gap-y-2 border-b border-neutro-200 pb-4 text-sm"
    >
      {otros.map((documento) => (
        <Link
          key={documento.href}
          href={documento.href}
          className="font-bold text-primary-700 hover:underline"
        >
          {documento.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
