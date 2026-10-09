/**
 * Panel del perfil maestro (tarea #34).
 *
 * Se prueba en cuatro frentes, porque cada uno protege algo distinto:
 *
 *   1. **El 404 del botón «Editar anuncio», con comportamiento y no con lectura de
 *      código.** Es el defecto que la tarea encontró al prepararse: el cargador de
 *      la página leía con la clave anónima, que solo alcanza `activa = true`, así
 *      que un anuncio retirado no se podía abrir ni por su dueño y la ruta acababa
 *      en `notFound()`. Aquí se conduce el cargador **real** contra dos lectores
 *      sembrados —uno que se comporta como la clave anónima y otro como una sesión
 *      autorizada por la RLS— y se mide qué devuelve cada uno. Ese resultado es lo
 *      que decide si la página llama a `notFound()`.
 *   2. **El predicado del anfitrión sigue intacto.** Es el hallazgo A-3 de la tarea
 *      #16: el camino del maestro se añade al lado, no debilitando el del anfitrión.
 *   3. **La superficie del maestro dice lo que debe decir** y no dice lo que no: el
 *      rol se pregunta a la base, nunca se lee de `user_metadata`; las acciones del
 *      maestro no escriben `anfitrion_id` ni `precio_mensual`; el panel es
 *      `force-dynamic` y guarda con `es_maestro()`; el middleware cubre la ruta.
 *   4. **La palabra del borrado**, que es la parte que el servidor sí puede exigir
 *      (la pantalla previa vive en el cliente y se puede saltar).
 *
 * LO QUE ESTA PRUEBA NO DEMUESTRA, DICHO SIN ADORNOS
 * -------------------------------------------------
 * Los dos lectores sembrados **imitan** el comportamiento de la RLS que ya se midió
 * en la base: la suite `supabase/pruebas/oleada-9.sql` comprobó por comportamiento
 * real que un anfitrión ajeno ve `0` filas de una publicación retirada (paso 3) y
 * que el maestro ve `1` (paso 4), y que la clave anónima solo alcanza las activas
 * (paso 2d). Esta prueba da por buenos esos hechos y comprueba **qué hace el
 * cargador con ellos**: con cero filas devuelve «no existe», y «no existe» es
 * exactamente lo que la página convierte en 404. No sustituye a la suite de la
 * base ni pretende hacerlo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  obtenerPensionPorIdConSesion,
  resolverPension,
  resolverPensionConSesion,
} from "@/lib/datos";
import { PALABRA_DE_BORRADO, confirmacionDeBorradoValida } from "@/lib/borrado";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Quita los comentarios antes de afirmar nada sobre un archivo.
 *
 * No es cosmética. Varias de estas comprobaciones son del tipo «esto **no**
 * aparece», y los propios archivos explican en sus comentarios exactamente lo que
 * no hacen —`app/actions/maestro.ts` dice «aquí no se escribe ni una vez
 * `anfitrion_id`»—. Sin quitarlos, la afirmación mediría la prosa en vez del
 * código, y el comentario que documenta una ausencia haría fallar la prueba que
 * la vigila.
 *
 * Respeta las cadenas ('…', "…", `…`) para no confundir una barra dentro de un
 * texto con el comienzo de un comentario.
 */
function sinComentarios(codigoFuente: string): string {
  let salida = "";
  let i = 0;
  let comilla: string | null = null;

  while (i < codigoFuente.length) {
    const caracter = codigoFuente[i];
    const siguiente = codigoFuente[i + 1];

    if (comilla) {
      salida += caracter;
      if (caracter === "\\") {
        salida += siguiente ?? "";
        i += 2;
        continue;
      }
      if (caracter === comilla) comilla = null;
      i += 1;
      continue;
    }

    if (caracter === "'" || caracter === '"' || caracter === "`") {
      comilla = caracter;
      salida += caracter;
      i += 1;
      continue;
    }

    if (caracter === "/" && siguiente === "/") {
      while (i < codigoFuente.length && codigoFuente[i] !== "\n") i += 1;
      continue;
    }

    if (caracter === "/" && siguiente === "*") {
      i += 2;
      while (
        i < codigoFuente.length &&
        !(codigoFuente[i] === "*" && codigoFuente[i + 1] === "/")
      ) {
        i += 1;
      }
      i += 2;
      continue;
    }

    salida += caracter;
    i += 1;
  }

  return salida;
}

/** El código de un archivo, sin comentarios. Todo lo que se afirma aquí se afirma sobre esto. */
function fuente(relativa: string): string {
  return sinComentarios(readFileSync(join(RAIZ, ...relativa.split("/")), "utf8"));
}

/* -------------------------------------------------------------------------- */
/* Lectores sembrados                                                          */
/* -------------------------------------------------------------------------- */

const PENSION_RETIRADA = "8f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const HABITACION_RETIRADA = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const FILA_RETIRADA = {
  id: PENSION_RETIRADA,
  slug: "residencia-retirada",
  anfitrion_id: "f101e4d0-5312-4d96-8d2c-c67e03f9cc1d",
  titulo: "Residencia retirada",
  descripcion: "Un anuncio que su dueño retiró y quiere volver a publicar.",
  precio_mensual: 600000,
  direccion: "Calle 30 # 12-45",
  barrio: "Mamatoco",
  distancia_a_pie_minutos: 10,
  servicios: ["Wi-Fi"],
  normas: ["No fumadores"],
  calificacion: null,
  verificado: false,
  imagenes: [],
  // El dato que decide todo: está retirada.
  activa: false,
  creada_en: "2026-09-18T01:28:35.000Z",
  latitud: null,
  longitud: null,
};

const FILA_HABITACION = {
  id: HABITACION_RETIRADA,
  pension_id: PENSION_RETIRADA,
  tipo: "individual",
  genero: "mixto",
  precio_mensual_cop: 600000,
  alimentacion_incluida: false,
  disponible: true,
};

/**
 * Un lector de Supabase en miniatura.
 *
 * Reproduce la cadena que usan los cargadores —
 * `.from(t).select(c).eq(col, val)[.maybeSingle()]`— y aplica la única regla que
 * aquí importa: `anonimo: true` es la clave anónima, que solo alcanza
 * `activa = true`; `anonimo: false` es una lectura con sesión, a la que la
 * política entrega también la retirada.
 */
function crearLector(opciones: { anonimo: boolean }): SupabaseClient {
  const pensiones = [FILA_RETIRADA];
  const habitaciones = [FILA_HABITACION];

  const lector = {
    from(tabla: string) {
      const filtros: Array<[string, unknown]> = [];

      const resolver = (): Record<string, unknown>[] => {
        let filas =
          tabla === "pensiones"
            ? (pensiones as unknown as Record<string, unknown>[])
            : (habitaciones as unknown as Record<string, unknown>[]);

        if (tabla === "pensiones" && opciones.anonimo) {
          filas = filas.filter((fila) => fila.activa === true);
        }

        for (const [columna, valor] of filtros) {
          filas = filas.filter((fila) => fila[columna] === valor);
        }

        return filas;
      };

      const consulta = {
        select: () => consulta,
        eq: (columna: string, valor: unknown) => {
          filtros.push([columna, valor]);
          return consulta;
        },
        maybeSingle: async () => ({ data: resolver()[0] ?? null, error: null }),
        // `await` directo sobre la consulta (lo que hace la lectura de habitaciones).
        then: (resolverPromesa: (valor: unknown) => unknown) =>
          Promise.resolve({ data: resolver(), error: null }).then(resolverPromesa),
      };

      return consulta;
    },
  };

  return lector as unknown as SupabaseClient;
}

/* -------------------------------------------------------------------------- */

describe("el 404 del botón «Editar anuncio» · comportamiento, no lectura", () => {
  it("con la clave anónima, un anuncio retirado no se resuelve: es el 404", async () => {
    const resultado = await resolverPension(PENSION_RETIRADA, crearLector({ anonimo: true }));

    // «no-existe» es lo que `obtenerPensionPorId` convierte en `null`, y `null` es
    // lo que la página convierte en `notFound()`. La cadena entera empieza aquí.
    assert.equal(
      resultado.estado,
      "no-existe",
      "la lectura anónima resolvió una retirada: el defecto ya no estaría reproducido"
    );
  });

  it("con la sesión, el mismo anuncio retirado sí se resuelve", async () => {
    const resultado = await resolverPensionConSesion(
      PENSION_RETIRADA,
      crearLector({ anonimo: false })
    );

    assert.equal(resultado.estado, "ok");

    if (resultado.estado !== "ok") return;

    assert.equal(resultado.pension.id, PENSION_RETIRADA);
    assert.equal(resultado.pension.activa, false, "debe seguir leyéndose como retirada");
    assert.equal(resultado.pension.habitaciones.length, 1, "las habitaciones también se leen");
  });

  it("el cargador de la página devuelve el anuncio en vez de quedarse en null", async () => {
    // Esta es la comprobación que cierra el defecto: antes la página pedía el
    // anuncio por la vía anónima y recibía `null` para una retirada. Ahora la vía
    // con sesión devuelve la fila, así que `notFound()` no se alcanza.
    const resultado = await resolverPensionConSesion(
      PENSION_RETIRADA,
      crearLector({ anonimo: false })
    );

    assert.notEqual(resultado.estado, "no-existe");
    assert.equal(resultado.estado, "ok");
  });

  it("el cargador con sesión es el mismo que usa `obtenerPensionPorIdConSesion`", () => {
    const datos = fuente("lib/datos.ts");

    assert.ok(
      /export async function obtenerPensionPorIdConSesion[\s\S]*?resolverPensionConSesion\(/.test(datos),
      "`obtenerPensionPorIdConSesion` debe delegar en el cargador con sesión"
    );
  });

  it("la página del anfitrión ya no lee el anuncio por la vía anónima", () => {
    const pagina = fuente("app/publicar/[id]/editar/page.tsx");

    assert.ok(
      pagina.includes("obtenerPensionPorIdConSesion"),
      "la página debe usar el cargador con sesión, o un anuncio retirado vuelve a dar 404"
    );

    // `obtenerPensionPorId` a secas no puede aparecer: ni importado ni llamado.
    assert.equal(
      /obtenerPensionPorId\b(?!ConSesion)/.test(pagina),
      false,
      "la página sigue usando el cargador anónimo: el botón «Editar anuncio» volvería a dar 404"
    );
  });
});

describe("el predicado del anfitrión sigue intacto", () => {
  it("las acciones del anfitrión conservan sus cuatro filtros de propiedad", () => {
    const acciones = fuente("app/actions/pensiones.ts");
    const predicados = acciones.match(/\.eq\("anfitrion_id",\s*user\.id\)/g) ?? [];

    assert.ok(
      predicados.length >= 4,
      `el hallazgo A-3 exige al menos 4 escrituras filtradas por dueño y hay ${predicados.length}`
    );
  });

  it("el camino del maestro no se cuela dentro de las acciones del anfitrión", () => {
    const acciones = fuente("app/actions/pensiones.ts");

    assert.equal(
      /es_maestro|esMaestro/.test(acciones),
      false,
      "el maestro tiene su propio módulo: mezclarlo aquí dejaría las dos autorizaciones en una condición"
    );
  });

  it("la lógica compartida no decide permisos", () => {
    const escritura = fuente("lib/pension-escritura.ts");

    assert.equal(
      /anfitrion_id|es_maestro|esMaestro/.test(escritura),
      false,
      "`lib/pension-escritura.ts` valida y reconcilia; autorizar es de cada acción"
    );
  });

  it("el formulario de edición no decide quién puede guardar", () => {
    const formulario = fuente("components/FormularioEditarPension.tsx");

    // La acción entra por prop y trae su propio defecto: el editor compartido no
    // sabe si quien edita es el dueño o el maestro, y no debe saberlo.
    assert.ok(formulario.includes("accionRecibida ?? actualizarPension"));
    assert.equal(/anfitrion_id|es_maestro/.test(formulario), false);
  });
});

describe("la superficie del maestro", () => {
  it("las acciones del maestro nunca escriben `anfitrion_id` ni `precio_mensual`", () => {
    const acciones = fuente("app/actions/maestro.ts");

    assert.equal(
      /anfitrion_id/.test(acciones),
      false,
      "el maestro administra por `id`; filtrar por dueño aquí sería copiar el predicado ajeno"
    );

    assert.equal(
      /precio_mensual\s*:/.test(acciones),
      false,
      "el precio es derivado: se cambia en las habitaciones, nunca escribiendo `pensiones.precio_mensual`"
    );
  });

  it("cada acción del maestro comprueba el perfil y la fila afectada", () => {
    const acciones = fuente("app/actions/maestro.ts");

    const guardias = acciones.match(/exigirMaestro\(\)/g) ?? [];
    assert.ok(guardias.length >= 4, `se esperaban 4 acciones con guardia y hay ${guardias.length}`);

    // Nunca «ok» sin un cambio real: la fila devuelta se comprueba en las tres
    // escrituras directas.
    const comprobaciones = acciones.match(/\(data \?\? \[\]\)\.length !== 1|\(actualizadas \?\? \[\]\)\.length !== 1/g) ?? [];
    assert.ok(
      comprobaciones.length >= 3,
      `se esperaban 3 comprobaciones de fila afectada y hay ${comprobaciones.length}`
    );
  });

  it("el borrado va por la función de la base, que es la que conserva la reserva del slug", () => {
    const acciones = fuente("app/actions/maestro.ts");

    assert.ok(acciones.includes('rpc("borrar_pension"'));
    assert.equal(
      /\.from\("pensiones"\)\s*\n?\s*\.delete\(\)/.test(acciones),
      false,
      "un `delete` desde aquí se saltaría la reserva del slug y podría dejar habitaciones huérfanas"
    );
    assert.ok(
      acciones.includes("confirmacionDeBorradoValida"),
      "la palabra de confirmación es lo único que el servidor puede exigir de la pantalla previa"
    );
  });

  it("el panel es dinámico y guarda con `es_maestro()` contra la base", () => {
    const panel = fuente("app/maestro/page.tsx");

    assert.ok(panel.includes('export const dynamic = "force-dynamic"'));
    assert.ok(panel.includes("esMaestroConCliente"));
    assert.ok(panel.includes("notFound()"), "un anfitrión que abra la dirección a mano no ve el panel");
    assert.ok(panel.includes("obtenerTodasLasPensiones"));
  });

  it("la ruta de edición del maestro también guarda y también lee con sesión", () => {
    const pagina = fuente("app/maestro/[id]/editar/page.tsx");

    assert.ok(pagina.includes('export const dynamic = "force-dynamic"'));
    assert.ok(pagina.includes("esMaestroConCliente"));
    assert.ok(pagina.includes("notFound()"));
    assert.ok(
      pagina.includes("obtenerPensionPorIdConSesion"),
      "un anuncio retirado no se puede leer con la clave anónima"
    );
    assert.ok(pagina.includes("actualizarPensionMaestro"));
  });

  it("la entrada de cuenta pregunta el rol a la base, no lo lee de los metadatos", () => {
    const entrada = fuente("components/EntradaCuenta.tsx");

    assert.ok(
      entrada.includes('rpc("es_maestro")'),
      "el rol se pregunta con la misma función que autoriza el panel"
    );

    // El agujero que esto evita: `user_metadata` lo escribe el propio usuario, así
    // que leer el rol de ahí permitiría ponerse `rol: "maestro"` sin tocar la base.
    assert.equal(
      /metadatos\??\.\s*rol/.test(entrada),
      false,
      "el rol no puede leerse de los metadatos del usuario"
    );
  });

  it("la cabecera de servidor sigue sin consultar la sesión (ISR intacto)", () => {
    const cabecera = fuente("components/Cabecera.tsx");

    assert.equal(
      /crearClienteServidor|getUser\(\)|auth\./.test(cabecera),
      false,
      "la cabecera es de servidor: consultar la sesión ahí perdería el ISR de portada y fichas"
    );
  });

  it("el middleware cubre la ruta nueva, o la sesión no se refresca allí", () => {
    const middleware = fuente("middleware.ts");

    assert.ok(
      /matcher: \[[^\]]*"\/maestro"/.test(middleware),
      "sin `/maestro` en el matcher, el panel leería una sesión sin refrescar"
    );
  });

  it("`RolUsuario` admite el rol nuevo", () => {
    const tipos = fuente("types/index.ts");

    assert.ok(/"estudiante"\s*\|\s*"anfitrion"\s*\|\s*"maestro"/.test(tipos));
  });

  it("el estado del formulario tiene una sola declaración", () => {
    const acciones = fuente("app/actions/pensiones.ts");
    const escritura = fuente("lib/pension-escritura.ts");

    assert.equal(
      /export interface EstadoFormulario/.test(acciones),
      false,
      "con dos copias del contrato, el día que cambie una la otra se queda atrás sin que nada lo delate"
    );
    assert.ok(/export interface EstadoFormulario/.test(escritura));
  });
});

describe("la confirmación del borrado", () => {
  it("exige la palabra exacta", () => {
    assert.equal(PALABRA_DE_BORRADO, "BORRAR");
    assert.equal(confirmacionDeBorradoValida("BORRAR"), true);
  });

  it("tolera espacios sobrantes y minúsculas (escribir a mano no es un examen de mecanografía)", () => {
    assert.equal(confirmacionDeBorradoValida("  borrar  "), true);
    assert.equal(confirmacionDeBorradoValida("Borrar"), true);
  });

  it("rechaza la confirmación vacía y cualquier otra palabra", () => {
    assert.equal(confirmacionDeBorradoValida(""), false);
    assert.equal(confirmacionDeBorradoValida("   "), false);
    assert.equal(confirmacionDeBorradoValida("BORRA"), false);
    assert.equal(confirmacionDeBorradoValida("si"), false);
    assert.equal(confirmacionDeBorradoValida("BORRAR TODO"), false);
  });

  it("la palabra vive en un archivo sin dependencias, para que las dos orillas la compartan", () => {
    const borrado = fuente("lib/borrado.ts");

    assert.equal(
      /^import /m.test(borrado),
      false,
      "si `lib/borrado.ts` importara algo, un componente de cliente arrastraría ese algo al navegador"
    );
  });
});

/**
 * El aviso previo del borrado, medido sobre el componente.
 *
 * El criterio de aceptación no pide «un diálogo de confirmación»: pide que **nombre
 * el anuncio** y que **avise de que no tiene vuelta atrás**. Son dos frases
 * concretas, y por eso se comprueban una por una en vez de dar por bueno que el
 * bloque exista. La pieza tiene además una obligación que se incumple con
 * facilidad: ser **honesta sobre lo que NO muere**. Las fotos siguen en el
 * almacenamiento —la acción no las toca y limpiarlas queda fuera de esta tarea—, y
 * un aviso que solo hablara de lo que desaparece dejaría al maestro creyendo que
 * borró también las imágenes.
 *
 * Se mide el texto visible. Los comentarios van fuera por `fuente()`, así que las
 * afirmaciones de aquí son sobre lo que el maestro lee, no sobre lo que el código
 * explica de sí mismo.
 */
describe("el borrado en dos pasos de la interfaz", () => {
  const panel = fuente("components/PanelMaestro.tsx");

  it("nombra el anuncio que se va a borrar", () => {
    assert.ok(
      panel.includes("Vas a borrar «{pension.titulo}»"),
      "el aviso tiene que decir qué anuncio concreto se borra, no «este anuncio»"
    );

    // El nombre viaja también al botón que abre el paso y al grupo que lo contiene,
    // que es lo que anuncia un lector de pantalla.
    assert.ok(
      panel.includes("Confirmar el borrado de ${pension.titulo}"),
      "el grupo del aviso debe anunciarse con el nombre del anuncio"
    );
  });

  it("avisa de que no tiene vuelta atrás", () => {
    assert.ok(
      /no tiene vuelta atrás/.test(panel),
      "el criterio de aceptación exige decirlo con esas palabras"
    );
  });

  it("avisa de que la dirección queda muerta y no se recicla", () => {
    assert.ok(
      panel.includes("/pensiones/{pension.slug}"),
      "el aviso debe mostrar la dirección concreta que muere"
    );

    assert.ok(
      /queda muerta/.test(panel) && /no las vuelve a\s+usar/.test(panel),
      "el disparador de la Oleada 7 reserva el slug: hay que decir que la dirección no se reutiliza"
    );
  });

  it("es honesto sobre lo que NO muere: las fotos siguen guardadas", () => {
    assert.ok(
      /fotos no se borran/.test(panel),
      "las fotos quedan huérfanas en el almacenamiento y el aviso debe decirlo"
    );

    assert.ok(
      /Limpiarlas es otra tarea/.test(panel),
      "decir que quedan huérfanas sin decir que limpiarlas queda fuera evita prometer lo que no se hace"
    );
  });

  it("el formulario destructivo no existe hasta que se pide: son dos pasos", () => {
    assert.ok(
      panel.includes("useState(false)") && panel.includes("confirmandoBorrado ?"),
      "el formulario de borrado debe aparecer solo tras pulsar «Borrar anuncio»"
    );

    // El botón que abre el paso NO es de tipo submit: si lo fuera, quedaría dentro
    // de un formulario y un Enter lo enviaría, saltándose la confirmación.
    assert.ok(
      panel.includes("setConfirmandoBorrado(true)"),
      "el primer paso debe activar el aviso, no enviar nada"
    );

    // Y el que borra de verdad sí es submit, con la palabra exigida y obligatoria.
    assert.ok(
      /name="confirmacion"/.test(panel) && /required/.test(panel),
      "la palabra de confirmación debe ir en un campo obligatorio del formulario de borrado"
    );

    assert.ok(
      panel.includes("PALABRA_DE_BORRADO"),
      "la palabra que muestra la interfaz es la misma que exige el servidor"
    );
  });
});
