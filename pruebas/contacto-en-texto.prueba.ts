/**
 * El contacto escondido en el texto libre del anuncio (`lib/contacto-en-texto.ts`, tarea #77).
 *
 * QUÉ DEFIENDE ESTA PRUEBA
 * ------------------------
 * Que el número del anfitrión no pueda salir por la puerta de al lado. El WhatsApp pasa a
 * ser un dato privado en `contacto_anfitrion`, pero eso no sirve de nada si el mismo número
 * se puede escribir en la descripción: el que quiera saltarse el servicio solo necesita
 * usarla. Lo que se comprueba aquí es que las tres formas de desviar el contacto —el
 * número, el enlace y la invitación— se detectan, y que las tres se detectan en **todos**
 * los campos públicos, incluidos la dirección y el barrio.
 *
 * POR QUÉ LOS CONTROLES NEGATIVOS SON LA MITAD DE LA PRUEBA
 * --------------------------------------------------------
 * Un detector que rechaza lo correcto es peor que no tenerlo: el anfitrión abandona el
 * formulario y el número acaba en la descripción de todas formas. Por eso hay tantos casos
 * que **no deben** marcar, y no son de relleno: `Calle 30 # 12-45` y `$1.200.000` son
 * exactamente los que motivaron —en la primera versión del módulo— una opción para apagar
 * el detector de teléfonos en los campos «que llevan cifras». Esa opción se retiró al
 * medirla, y estos casos son la razón de que se pudiera retirar: la regla no cuenta una
 * longitud cualquiera, exige **diez dígitos con la forma colombiana** (`3` + 9 o `60` + 8),
 * y eso ni una dirección ni un precio lo producen.
 *
 * LA ÚLTIMA COMPROBACIÓN ES ESTRUCTURAL, Y A PROPÓSITO
 * ---------------------------------------------------
 * Que los cuatro campos pasen por `revisarTextoLibre` dentro de `lib/pension-escritura.ts`,
 * que es el único camino de escritura de un anuncio. Una regla que solo vive en el
 * navegador se salta con una petición a mano —así aparecieron los barrios «Mamatoco» que
 * nadie eligió (tarea #50)—, de modo que lo que hay que sostener no es que el módulo
 * detecte bien, sino que esté enchufado donde decide.
 *
 * NINGÚN NÚMERO REAL
 * ------------------
 * Los números de estas pruebas (`3000000000`, `6055555555`) no son asignables: son ceros y
 * cincos. No hay ni un teléfono de verdad escrito en el repositorio.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  AYUDA_SIN_CONTACTO,
  hallazgosDeTextoLibre,
  revisarTextoLibre,
  tieneContactoOculto,
} from "@/lib/contacto-en-texto";

const CELULAR = "3000000000";
const FIJO = "6055555555";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** El código de un archivo, sin comentarios: lo que decide es lo que ejecuta, no su prosa. */
function fuente(relativa: string): string {
  return readFileSync(join(RAIZ, ...relativa.split("/")), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("contacto escondido en el texto libre", () => {
  describe("lo que sí se detecta", () => {
    it("un celular escrito seguido", () => {
      const hallazgos = hallazgosDeTextoLibre(`Arriendo disponible, llamar al ${CELULAR}`);
      assert.deepEqual(
        hallazgos.map((hallazgo) => hallazgo.clase).slice(0, 1),
        ["telefono"]
      );
    });

    it("un celular partido por espacios, guiones, puntos o paréntesis", () => {
      const formas = ["300 000 0000", "300-000-0000", "300.000.0000", "(300) 000 0000"];
      for (const forma of formas) {
        assert.ok(
          hallazgosDeTextoLibre(`Mi número es ${forma}`).some(
            (hallazgo) => hallazgo.clase === "telefono"
          ),
          `no se detectó la forma «${forma}»`
        );
      }
    });

    it("un celular con el indicativo del país delante", () => {
      assert.ok(
        hallazgosDeTextoLibre(`Escribir al +57 ${CELULAR}`).some(
          (hallazgo) => hallazgo.clase === "telefono"
        )
      );
    });

    it("un fijo de Santa Marta con su indicativo", () => {
      assert.ok(
        hallazgosDeTextoLibre(`El fijo de la casa es ${FIJO}`).some(
          (hallazgo) => hallazgo.clase === "telefono"
        )
      );
    });

    it("un enlace, con o sin esquema, y un dominio suelto", () => {
      const formas = [
        "https://mipension.com",
        "www.mipension.com",
        "mipension.com",
        "wa.me/3000000000",
      ];
      for (const forma of formas) {
        assert.ok(
          hallazgosDeTextoLibre(`Más información en ${forma}`).some(
            (hallazgo) => hallazgo.clase === "enlace"
          ),
          `no se detectó el enlace «${forma}»`
        );
      }
    });

    it("una invitación a seguir por fuera, aunque no lleve ni dígitos ni URL", () => {
      const frases = [
        "Escribeme para más detalles",
        "Escríbeme al número del anuncio",
        "Puedes llamame en la tarde",
        "Mi WhatsApp está en el anuncio",
        "Te paso mi celular por interno",
      ];
      for (const frase of frases) {
        assert.ok(
          hallazgosDeTextoLibre(frase).some((hallazgo) => hallazgo.clase === "invitacion"),
          `no se detectó la invitación «${frase}»`
        );
      }
    });

    it("las tres clases a la vez en un mismo texto", () => {
      const clases = hallazgosDeTextoLibre(
        `Llamame al ${CELULAR} o entra a mipension.com`
      ).map((hallazgo) => hallazgo.clase);

      assert.deepEqual([...clases].sort(), ["enlace", "invitacion", "telefono"]);
    });

    it("un texto vacío no se revisa y no encuentra nada", () => {
      assert.equal(tieneContactoOculto(""), false);
      assert.deepEqual(hallazgosDeTextoLibre(""), []);
    });
  });

  describe("lo que NO se debe marcar, porque es un anuncio legítimo", () => {
    it("una dirección con cifras y almohadilla", () => {
      assert.deepEqual(revisarTextoLibre("La dirección", "Calle 30 # 12-45, Mamatoco"), []);
    });

    it("un precio en pesos con puntos de miles", () => {
      assert.deepEqual(revisarTextoLibre("La descripción", "El arriendo es de $1.200.000 al mes"), []);
    });

    it("diez dígitos que no tienen la forma colombiana", () => {
      assert.deepEqual(revisarTextoLibre("La descripción", "Código interno 1234567890"), []);
      assert.deepEqual(revisarTextoLibre("La descripción", "Referencia 9999999999"), []);
    });

    it("la palabra «teléfono» sin posesivo ni imperativo", () => {
      assert.deepEqual(revisarTextoLibre("La descripción", "La casa no tiene teléfono fijo"), []);
    });

    it("la descripción de un anuncio completo y normal", () => {
      const descripcion =
        "Habitación individual con baño privado a 5 minutos del campus, en el barrio " +
        "Mamatoco. Incluye agua, luz y wifi. Ambiente tranquilo para estudiar, con " +
        "cocina compartida y zona de lavado. Disponible desde el primer semestre.";
      assert.deepEqual(revisarTextoLibre("La descripción", descripcion), []);
    });
  });

  describe("el mensaje que lee el anfitrión", () => {
    it("nombra el campo y enseña qué sobra, en vez de un «no se permite» a ciegas", () => {
      const [mensaje] = revisarTextoLibre("La descripción", `Escribeme al ${CELULAR}`);

      assert.ok(mensaje.startsWith("La descripción:"));
      assert.ok(mensaje.includes(CELULAR));
      assert.ok(mensaje.endsWith(AYUDA_SIN_CONTACTO));
    });

    it("enumera las clases encontradas como se dice en español", () => {
      const [mensaje] = revisarTextoLibre(
        "El título",
        `Llamame al ${CELULAR} o entra a mipension.com`
      );

      assert.ok(mensaje.includes("un número de teléfono, un enlace y una invitación"));
    });

    it("no repite la misma clase dos veces aunque haya dos hallazgos iguales", () => {
      const [mensaje] = revisarTextoLibre(
        "La descripción",
        `Llamame al ${CELULAR} o escribeme al 6055555555`
      );

      assert.equal(mensaje.match(/un número de teléfono/g)?.length, 1);
    });
  });

  describe("donde decide, no solo donde se ve", () => {
    /**
     * Los cuatro campos de texto se publican, así que los cuatro son una salida posible
     * para el número. Si alguno se quedara sin revisar, la privacidad del campo nuevo
     * sería decorativa.
     */
    it("los cuatro campos de texto libre pasan por la revisión", () => {
      const codigo = fuente("lib/pension-escritura.ts");

      for (const campo of ["El título", "La descripción", "La dirección", "El barrio"]) {
        assert.ok(
          codigo.includes(`revisarTextoLibre("${campo}"`),
          `«${campo}» no se revisa en lib/pension-escritura.ts`
        );
      }
    });

    it("no queda ningún interruptor para apagar el detector de teléfonos", () => {
      // La opción `{ telefono: false }` existió y se retiró: se apagaba en la dirección y
      // el barrio, que se publican igual que la descripción. Esto impide que vuelva por
      // descuido, que es como entró.
      assert.equal(fuente("lib/contacto-en-texto.ts").includes("telefono?: boolean"), false);
      assert.equal(fuente("lib/pension-escritura.ts").includes("telefono: false"), false);
    });
  });
});
