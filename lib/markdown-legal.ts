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
 * POR QUÉ SE AGRUPAN LAS LÍNEAS ANTES DE MARCAR (tarea #125)
 * ---------------------------------------------------------
 * Los documentos están escritos con salto de línea manual, a unos 80 caracteres,
 * porque así se leen en el editor y así los revisa quien los escribe. Un salto de
 * línea del archivo **no es** un salto de párrafo en Markdown: un párrafo dura
 * hasta la línea en blanco. La versión anterior de este conversor cerraba cada
 * línea no vacía como su propio `<p>`, y eso producía dos defectos visibles:
 *
 *   1. Cada frase partida por el ancho del archivo salía como un párrafo suelto.
 *   2. La negrita se aplicaba línea a línea, así que un `**` que abría en una
 *      línea y cerraba en la siguiente nunca encontraba su pareja y se publicaba
 *      literal: 50 negritas rotas entre los dos documentos.
 *
 * De ahí que ahora haya dos fases: primero se arma la lista de bloques —uniendo
 * las líneas que pertenecen al mismo párrafo, al mismo ítem de lista o a la misma
 * cita— y solo después se aplica el marcado en línea sobre el bloque ya unido.
 * Una negrita que cruza el salto de línea se resuelve sola, porque para entonces
 * el salto ya no existe.
 *
 * Seguridad: **se escapa el HTML de la entrada antes de nada**, así que un `<` o
 * un `&` del documento nunca se interpretan como etiqueta. Solo después se añaden
 * las etiquetas que genera este conversor.
 */

const CLASES: Record<string, string> = {
  h1: "mt-2 font-display text-2xl font-extrabold text-neutro-900 md:text-3xl",
  h2: "mt-8 font-display text-xl font-bold text-neutro-900",
  h3: "mt-6 font-display text-lg font-bold text-neutro-800",
  p: "mt-3 text-base leading-relaxed text-neutro-700",
  ul: "mt-3 space-y-1.5 pl-5 text-base leading-relaxed text-neutro-700",
  ol: "mt-3 list-decimal space-y-1.5 pl-5 text-base leading-relaxed text-neutro-700",
  li: "list-disc",
  blockquote:
    "mt-4 rounded-xl border-l-4 border-confianza-gold bg-confianza-gold/10 px-4 py-3 text-base leading-relaxed text-neutro-700",
  hr: "mt-8 border-neutro-200",
  table: "mt-4 w-full border-collapse text-left text-sm",
  th: "border-b border-neutro-300 bg-neutro-100 px-3 py-2 font-bold text-neutro-800",
  td: "border-b border-neutro-200 px-3 py-2 align-top text-neutro-700",
  a: "font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800",
  code: "rounded bg-neutro-100 px-1.5 py-0.5 font-mono text-sm text-neutro-800",
  strong: "font-semibold text-neutro-900",
};

/** Un párrafo o una tabla dentro de una cita. */
type ParteDeCita =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "tabla"; cabecera: string[]; filas: string[][] };

/**
 * Un bloque del documento. Los párrafos, ítems y citas llegan aquí **ya unidos**:
 * el texto de un bloque es una sola cadena, con los saltos de línea del archivo
 * convertidos en un espacio.
 */
type Bloque =
  | { tipo: "encabezado"; nivel: 1 | 2 | 3; texto: string }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; ordenada: boolean; items: string[] }
  | { tipo: "cita"; partes: ParteDeCita[] }
  | { tipo: "hr" }
  | { tipo: "tabla"; cabecera: string[]; filas: string[][] };

/** Escapa lo que el documento traiga como texto, no como marcado. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Marcado dentro de un bloque ya unido: negrita, cursiva, código y enlaces. */
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
  salida = salida.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, `$1<em>$2</em>`);

  return salida;
}

/** Celdas de una fila `| a | b |`. */
function celdasDe(texto: string): string[] {
  return texto
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((celda) => celda.trim());
}

/** `|---|---|` separa la cabecera de las filas; no es una fila de datos. */
function esSeparadorDeTabla(celdas: string[]): boolean {
  return celdas.length > 0 && celdas.every((celda) => /^:?-{2,}:?$/.test(celda));
}

function tablaAHtml(cabecera: string[], filas: string[][]): string {
  const partes = [`<div class="mt-4 overflow-x-auto"><table class="${CLASES.table}">`];
  if (cabecera.length > 0) {
    partes.push("<thead><tr>");
    for (const celda of cabecera) partes.push(`<th class="${CLASES.th}">${enLinea(celda)}</th>`);
    partes.push("</tr></thead>");
  }
  partes.push("<tbody>");
  for (const fila of filas) {
    partes.push("<tr>");
    for (const celda of fila) partes.push(`<td class="${CLASES.td}">${enLinea(celda)}</td>`);
    partes.push("</tr>");
  }
  partes.push("</tbody></table></div>");
  return partes.join("\n");
}

/**
 * Fase 1 — arma los bloques uniendo las líneas que pertenecen al mismo bloque.
 *
 * Las reglas son las del Markdown que usan estos documentos: un bloque dura hasta
 * la línea en blanco o hasta una línea que abre otro bloque (encabezado, ítem,
 * tabla, cita, separador). Una línea suelta dentro de un ítem de lista continúa
 * ese ítem, no abre un párrafo nuevo.
 */
function enBloques(markdown: string): Bloque[] {
  const lineas = markdown.replace(/\r\n/g, "\n").split("\n");
  const bloques: Bloque[] = [];

  let parrafo: string[] | null = null;
  let item: string[] | null = null;
  let items: string[] = [];
  let abierta = false;
  let ordenada = false;

  let tabla: { cabecera: string[]; filas: string[][] } | null = null;
  let tablaEnCita = false;

  let cita: ParteDeCita[] = [];
  let citaParrafo: string[] | null = null;
  let enCita = false;

  const cerrarParrafo = () => {
    if (!parrafo) return;
    bloques.push({ tipo: "parrafo", texto: parrafo.join(" ") });
    parrafo = null;
  };

  const cerrarItem = () => {
    if (!item) return;
    items.push(item.join(" "));
    item = null;
  };

  const cerrarLista = () => {
    cerrarItem();
    if (!abierta) return;
    bloques.push({ tipo: "lista", ordenada, items });
    abierta = false;
    ordenada = false;
    items = [];
  };

  const cerrarTabla = () => {
    if (!tabla) return;
    if (tablaEnCita) {
      cita.push({ tipo: "tabla", cabecera: tabla.cabecera, filas: tabla.filas });
    } else {
      bloques.push({ tipo: "tabla", cabecera: tabla.cabecera, filas: tabla.filas });
    }
    tabla = null;
    tablaEnCita = false;
  };

  const cerrarCitaParrafo = () => {
    if (!citaParrafo) return;
    cita.push({ tipo: "parrafo", texto: citaParrafo.join(" ") });
    citaParrafo = null;
  };

  const cerrarCita = () => {
    cerrarCitaParrafo();
    if (tabla && tablaEnCita) cerrarTabla();
    if (!enCita) return;
    bloques.push({ tipo: "cita", partes: cita });
    enCita = false;
    cita = [];
  };

  /** Abre una tabla en el contenedor que corresponda y acumula la fila. */
  const acumularTabla = (texto: string, dentroDeCita: boolean) => {
    const celdas = celdasDe(texto);
    if (esSeparadorDeTabla(celdas)) return;
    if (!tabla) {
      tabla = { cabecera: celdas, filas: [] };
      tablaEnCita = dentroDeCita;
      return;
    }
    tabla.filas.push(celdas);
  };

  for (const linea of lineas) {
    const texto = linea.trimEnd();

    // Cita: `>` seguido de espacio o del final de la línea.
    if (/^>(\s|$)/.test(texto)) {
      cerrarParrafo();
      cerrarLista();
      if (tabla && !tablaEnCita) cerrarTabla();
      enCita = true;
      const contenido = texto.replace(/^>/, "").trim();

      // `>` solo: cierra el párrafo o la tabla de dentro de la cita, pero la cita
      // sigue abierta, porque el siguiente bloque también es parte de ella.
      if (contenido === "") {
        cerrarCitaParrafo();
        if (tabla && tablaEnCita) cerrarTabla();
        continue;
      }

      if (contenido.startsWith("|")) {
        cerrarCitaParrafo();
        acumularTabla(contenido, true);
        continue;
      }

      if (tabla && tablaEnCita) cerrarTabla();
      if (!citaParrafo) citaParrafo = [];
      citaParrafo.push(contenido);
      continue;
    }

    if (enCita) cerrarCita();

    if (texto.startsWith("|")) {
      cerrarParrafo();
      cerrarLista();
      acumularTabla(texto, false);
      continue;
    }
    cerrarTabla();

    if (texto.trim() === "") {
      cerrarParrafo();
      cerrarLista();
      continue;
    }

    if (/^-{3,}$/.test(texto)) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: "hr" });
      continue;
    }

    const encabezado = /^(#{1,3})\s+(.*)$/.exec(texto);
    if (encabezado) {
      cerrarParrafo();
      cerrarLista();
      const nivel = encabezado[1].length as 1 | 2 | 3;
      bloques.push({ tipo: "encabezado", nivel, texto: encabezado[2] });
      continue;
    }

    if (/^[-*]\s+/.test(texto)) {
      cerrarParrafo();
      if (abierta && ordenada) cerrarLista();
      if (!abierta) {
        abierta = true;
        ordenada = false;
        items = [];
      }
      cerrarItem();
      item = [texto.replace(/^[-*]\s+/, "")];
      continue;
    }

    if (/^\d+\.\s+/.test(texto)) {
      cerrarParrafo();
      if (abierta && !ordenada) cerrarLista();
      if (!abierta) {
        abierta = true;
        ordenada = true;
        items = [];
      }
      cerrarItem();
      item = [texto.replace(/^\d+\.\s+/, "")];
      continue;
    }

    // Línea de continuación: pertenece a lo que esté abierto, no abre un párrafo.
    const continuacion = texto.trim();
    if (abierta && item) {
      item.push(continuacion);
      continue;
    }
    if (!parrafo) parrafo = [];
    parrafo.push(continuacion);
  }

  cerrarCita();
  cerrarTabla();
  cerrarParrafo();
  cerrarLista();

  return bloques;
}

/** Fase 2 — dibuja cada bloque. */
function bloqueAHtml(bloque: Bloque): string {
  switch (bloque.tipo) {
    case "encabezado": {
      const etiqueta = `h${bloque.nivel}`;
      return `<${etiqueta} class="${CLASES[etiqueta]}">${enLinea(bloque.texto)}</${etiqueta}>`;
    }
    case "parrafo":
      return `<p class="${CLASES.p}">${enLinea(bloque.texto)}</p>`;
    case "lista": {
      const etiqueta = bloque.ordenada ? "ol" : "ul";
      const clase = bloque.ordenada ? CLASES.ol : CLASES.ul;
      const elementos = bloque.items
        .map((texto) =>
          bloque.ordenada
            ? `<li>${enLinea(texto)}</li>`
            : `<li class="${CLASES.li}">${enLinea(texto)}</li>`
        )
        .join("\n");
      return `<${etiqueta} class="${clase}">\n${elementos}\n</${etiqueta}>`;
    }
    case "cita": {
      const partes = bloque.partes.map((parte) =>
        parte.tipo === "tabla"
          ? tablaAHtml(parte.cabecera, parte.filas)
          : `<span class="block">${enLinea(parte.texto)}</span>`
      );
      return [`<blockquote class="${CLASES.blockquote}">`, ...partes, "</blockquote>"].join("\n");
    }
    case "hr":
      return `<hr class="${CLASES.hr}" />`;
    case "tabla":
      return tablaAHtml(bloque.cabecera, bloque.filas);
  }
}

/** Convierte el documento completo. */
export function markdownAHtml(markdown: string): string {
  return enBloques(markdown).map(bloqueAHtml).join("\n");
}
