/**
 * Conversor mínimo de Markdown a HTML para los textos legales.
 *
 * Por qué existe en lugar de copiar los textos a mano en las páginas: los
 * documentos de `docs/legales/` son **la fuente** que revisará el abogado. Si el
 * contenido se transcribiera al código, habría dos versiones del mismo texto y
 * acabarían diciendo cosas distintas. Aquí se publica el archivo, literalmente.
 *
 * Alcance: solo lo que usan esos documentos (encabezados, citas, listas, tablas,
 * separadores, negrita, cursiva, código y enlaces). No es un Markdown completo y
 * no pretende serlo.
 *
 * Seguridad: **se escapa el HTML de la entrada antes de nada**, así que un `<` o
 * un `&` del documento nunca se interpretan como etiqueta. Solo después se añaden
 * las etiquetas que genera este conversor.
 */

const CLASES: Record<string, string> = {
  h1: "mt-2 font-display text-2xl font-extrabold text-neutro-900 md:text-3xl",
  h2: "mt-8 font-display text-xl font-bold text-neutro-900",
  h3: "mt-6 font-display text-lg font-bold text-neutro-800",
  p: "mt-3 text-sm leading-relaxed text-neutro-700 md:text-[15px]",
  ul: "mt-3 space-y-1.5 pl-5 text-sm leading-relaxed text-neutro-700 md:text-[15px]",
  ol: "mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-neutro-700 md:text-[15px]",
  li: "list-disc",
  blockquote:
    "mt-4 rounded-xl border-l-4 border-confianza-gold bg-confianza-gold/10 px-4 py-3 text-sm leading-relaxed text-neutro-700",
  hr: "mt-8 border-neutro-200",
  table: "mt-4 w-full border-collapse text-left text-sm",
  th: "border-b border-neutro-300 bg-neutro-100 px-3 py-2 font-bold text-neutro-800",
  td: "border-b border-neutro-200 px-3 py-2 align-top text-neutro-700",
  a: "font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800",
  code: "rounded bg-neutro-100 px-1.5 py-0.5 font-mono text-[13px] text-neutro-800",
  strong: "font-semibold text-neutro-900",
};

/** Escapa lo que el documento traiga como texto, no como marcado. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Marcado dentro de una línea: negrita, cursiva, código y enlaces. */
function enLinea(texto: string): string {
  let salida = escapar(texto);

  // Enlaces: solo rutas internas o http(s). Un `javascript:` no se convierte en
  // enlace, se deja como texto.
  salida = salida.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (coincidencia, etiqueta: string, url: string) => {
    const destino = url.trim();
    const seguro = /^(\/|#|https?:\/\/)/.test(destino);
    if (!seguro) return coincidencia;
    return `<a class="${CLASES.a}" href="${destino}">${etiqueta}</a>`;
  });

  salida = salida.replace(/`([^`]+)`/g, `<code class="${CLASES.code}">$1</code>`);
  salida = salida.replace(/\*\*([^*]+)\*\*/g, `<strong class="${CLASES.strong}">$1</strong>`);
  salida = salida.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, `$1<em>$2</em>`);

  return salida;
}

/** Convierte el documento completo. */
export function markdownAHtml(markdown: string): string {
  const lineas = markdown.replace(/\r\n/g, "\n").split("\n");
  const salida: string[] = [];

  let enCita = false;
  let lista: "ul" | "ol" | null = null;
  let tabla: { cabecera: string[]; filas: string[][] } | null = null;

  const cerrarCita = () => {
    if (enCita) {
      salida.push("</blockquote>");
      enCita = false;
    }
  };

  const cerrarLista = () => {
    if (lista) {
      salida.push(`</${lista}>`);
      lista = null;
    }
  };

  const cerrarTabla = () => {
    if (!tabla) return;
    const { cabecera, filas } = tabla;
    salida.push(`<div class="mt-4 overflow-x-auto"><table class="${CLASES.table}">`);
    if (cabecera.length > 0) {
      salida.push("<thead><tr>");
      for (const celda of cabecera) salida.push(`<th class="${CLASES.th}">${enLinea(celda)}</th>`);
      salida.push("</tr></thead>");
    }
    salida.push("<tbody>");
    for (const fila of filas) {
      salida.push("<tr>");
      for (const celda of fila) salida.push(`<td class="${CLASES.td}">${enLinea(celda)}</td>`);
      salida.push("</tr>");
    }
    salida.push("</tbody></table></div>");
    tabla = null;
  };

  const cerrarBloques = () => {
    cerrarCita();
    cerrarLista();
    cerrarTabla();
  };

  for (const linea of lineas) {
    const texto = linea.trimEnd();

    // Tabla: | a | b |
    if (texto.startsWith("|")) {
      const celdas = texto
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      const esSeparador = celdas.every((c) => /^:?-{2,}:?$/.test(c));
      if (esSeparador) continue;
      if (!tabla) tabla = { cabecera: celdas, filas: [] };
      else tabla.filas.push(celdas);
      continue;
    }
    cerrarTabla();

    if (texto === "") {
      cerrarBloques();
      continue;
    }

    if (/^-{3,}$/.test(texto)) {
      cerrarBloques();
      salida.push(`<hr class="${CLASES.hr}" />`);
      continue;
    }

    if (texto.startsWith("> ")) {
      cerrarLista();
      const contenido = enLinea(texto.slice(2));
      if (!enCita) {
        salida.push(`<blockquote class="${CLASES.blockquote}">`);
        enCita = true;
      }
      salida.push(`<span class="block">${contenido}</span>`);
      continue;
    }
    if (texto === ">") {
      cerrarCita();
      continue;
    }
    cerrarCita();

    const encabezado = /^(#{1,3})\s+(.*)$/.exec(texto);
    if (encabezado) {
      cerrarLista();
      const nivel = encabezado[1].length;
      const etiqueta = `h${nivel}`;
      salida.push(`<${etiqueta} class="${CLASES[etiqueta]}">${enLinea(encabezado[2])}</${etiqueta}>`);
      continue;
    }

    if (/^[-*]\s+/.test(texto)) {
      if (lista !== "ul") {
        cerrarLista();
        salida.push(`<ul class="${CLASES.ul}">`);
        lista = "ul";
      }
      salida.push(`<li class="${CLASES.li}">${enLinea(texto.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(texto)) {
      if (lista !== "ol") {
        cerrarLista();
        salida.push(`<ol class="${CLASES.ol}">`);
        lista = "ol";
      }
      salida.push(`<li>${enLinea(texto.replace(/^\d+\.\s+/, ""))}</li>`);
      continue;
    }

    cerrarLista();
    salida.push(`<p class="${CLASES.p}">${enLinea(texto)}</p>`);
  }

  cerrarBloques();
  return salida.join("\n");
}
