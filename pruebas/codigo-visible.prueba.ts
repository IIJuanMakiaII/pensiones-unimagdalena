/**
 * El código visible de una pensión, de la columna al dominio (Oleada 16 · tarea #87).
 *
 * El código (`NID-0001`) es el identificador con el que se nombra un anuncio por
 * teléfono y se busca en el panel maestro. Entre la columna y quien lo muestra
 * hay tres eslabones que pueden romperse **en silencio**, y este archivo existe
 * para que ninguno pueda hacerlo sin que se note. El primero ya ocurrió una vez
 * en este proyecto con `verificado_en`:
 *
 *   1. **El nombre.** El campo se llama `codigo_visible` —igual que la columna—
 *      en la fila, en la proyección y en el dominio. Un `codigoVisible` en el
 *      mapeo compila, pasa todas las pruebas y no llega nunca; quien dibuja el
 *      código leería `undefined` para siempre. Lo que lee el consumidor es la
 *      convención de los campos que vienen de la base (`creada_en`,
 *      `verificado_en`), y este es el aserto que la vigila.
 *   2. **La proyección.** `COLUMNAS_PENSION` tiene que pedir la columna. Es lo
 *      que hace que una migración sin aplicar se manifieste en voz alta —`42703`,
 *      y con ella el catálogo entero en estado de error— en lugar de parecer que
 *      los anuncios no tienen código.
 *   3. **El valor.** Con la columna ausente el campo llega `null`, y `null` se
 *      conserva: no se rellena con el `id`, ni con el `slug`, ni con la posición
 *      en la lista. Un identificador fabricado en la interfaz puede repetirse o
 *      cambiar de un listado a otro, que es exactamente lo contrario de lo que
 *      este campo existe para hacer.
 *
 * Y una cuarta, que no es del mapeo sino de la migración y que se comprueba aquí
 * porque es la que ya se cobró una tarde en este proyecto: la lista de columnas
 * del `grant select` de `oleada-16` tiene que cubrir **exactamente** las mismas
 * columnas que `COLUMNAS_PENSION`. `pensiones` concede la lectura columna por
 * columna, así que una columna que la aplicación pida y el `grant` no conceda no
 * llega vacía: **hace fallar la consulta con `42501`**. Si alguien renombra el
 * campo en TypeScript y se olvida del SQL —o al revés— esto falla antes de que
 * el catálogo se caiga en producción.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { COLUMNAS_PENSION, filaAPension, type PensionFila } from "@/lib/supabase/mapeo";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** La migración que reparte los códigos. Es la otra mitad de este contrato. */
const FUENTE_MIGRACION = readFileSync(
  join(RAIZ, "supabase", "oleada-16-codigo-visible-pension.sql"),
  "utf8"
);

/** El código tal como lo escribe la base: mayúsculas, guion y ceros a la izquierda. */
const CODIGO = "NID-0001";

/**
 * Una fila mínima pero completa. **No** declara `codigo_visible`: es la forma que
 * tendrá contra una base sin la migración aplicada, y ese caso hay que poder
 * construir para probarlo.
 */
function filaBase(): PensionFila {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "residencia-de-prueba",
    anfitrion_id: "22222222-2222-2222-2222-222222222222",
    titulo: "Residencia de prueba",
    descripcion: "Una descripción",
    precio_mensual: 500000,
    direccion: "Calle 1 # 2-3",
    barrio: "Mamatoco",
    distancia_a_pie_minutos: 8,
    servicios: ["wifi"],
    normas: [],
    calificacion: 4.5,
    verificado: true,
    imagenes: ["https://ejemplo.test/foto.jpg"],
    activa: true,
    creada_en: "2026-09-01T09:00:00.000Z",
  };
}

/** Las columnas de una lista de `grant` del .sql, en orden y sin espacios. */
function columnasDeLaLista(bloque: string): string[] {
  return bloque
    .split(",")
    .map((columna) => columna.trim())
    .filter((columna) => columna.length > 0);
}

/** El bloque de columnas de un `grant` concreto de la migración. */
function listaConcedida(privilegio: "select" | "update"): string[] {
  const revocado = new RegExp(
    `revoke ${privilegio} on public\\.pensiones from anon, authenticated;[\\s\\S]*?grant ${privilegio} \\(([\\s\\S]*?)\\) on public\\.pensiones to (?:anon, authenticated|authenticated);`
  );
  const bloque = revocado.exec(FUENTE_MIGRACION)?.[1];

  assert.ok(
    bloque,
    `no se pudo leer la lista de \`grant ${privilegio}\` de oleada-16. Si cambió su forma, actualiza esta comprobación`
  );

  return columnasDeLaLista(bloque as string);
}

describe("el código visible · de la fila al dominio", () => {
  it("llega al dominio, y llega tal cual lo escribió la base", () => {
    const pension = filaAPension({ ...filaBase(), codigo_visible: CODIGO }, []);

    assert.equal(
      pension.codigo_visible,
      CODIGO,
      "el código se reformateó al traducir la fila: quien lo dicta por teléfono y quien lo busca escriben lo que hay en la base"
    );
  });

  it("no se le cambian las mayúsculas ni los ceros a la izquierda", () => {
    // La base guarda `NID-0001` y lo garantiza con una restricción de formato.
    // Una interfaz que «normalice» aquí —a minúsculas, o quitando ceros— haría
    // que el código mostrado dejara de ser el código guardado, y el buscador
    // dejaría de encontrarlo. El campo es de la base; la interfaz solo lo enseña.
    const pension = filaAPension({ ...filaBase(), codigo_visible: "NID-0007" }, []);

    assert.equal(pension.codigo_visible, "NID-0007");
    assert.notEqual(pension.codigo_visible, "nid-0007");
    assert.notEqual(pension.codigo_visible, "NID-7");
  });

  it("el campo se llama `codigo_visible`, igual en la columna, en la fila y en el dominio", () => {
    // El nombre no es cosmética: es lo que lee quien muestra el código y quien
    // busca por él. Un `codigoVisible` aquí compila, pasa las pruebas y no llega
    // nunca. Es el mismo defecto que ya ocurrió con `verificado_en`.
    const pension = filaAPension({ ...filaBase(), codigo_visible: CODIGO }, []);

    assert.ok(
      "codigo_visible" in pension,
      "el dominio dejó de exponer `codigo_visible`: quien muestra o busca el código lo lee con ese nombre"
    );
    assert.ok(
      COLUMNAS_PENSION.split(",")
        .map((columna) => columna.trim())
        .includes("codigo_visible"),
      "la proyección dejó de pedir la columna: el código no llegaría nunca y nada fallaría"
    );
  });

  it("contra una base sin la migración el campo llega `null`, y no se fabrica con otro dato", () => {
    // Es el caso de la base a la que todavía no se le aplicó `oleada-16`. Ni el
    // `id` ni el `slug` son códigos: el `id` es un uuid que nadie dicta y el
    // `slug` cambia si el anfitrión renombra el anuncio. Un código inventado en
    // la interfaz se repetiría entre pantallas, y entonces no identificaría nada.
    const pension = filaAPension(filaBase(), []);

    assert.equal(pension.codigo_visible, null, "se inventó un código donde la base no tiene ninguno");
    assert.notEqual(pension.codigo_visible, pension.id);
    assert.notEqual(pension.codigo_visible, pension.slug);
  });

  it("el mapeo no valida ni repara el código: el formato lo impone la base", () => {
    // La restricción de formato vive en la base —y se comprueba más abajo—. Si
    // el mapeo además «arreglara» lo que no encaja, habría dos reglas para lo
    // mismo, y la de la interfaz podría tapar una fila que la base considera
    // inválida. Aquí no se repara nada: lo que llega, sale. El código de cinco
    // dígitos entra en esa regla: a partir del anuncio 10000 la serie crece, y
    // una interfaz que recortara a cuatro dígitos lo volvería a repetir.
    assert.equal(filaAPension({ ...filaBase(), codigo_visible: "" }, []).codigo_visible, "");
    assert.equal(filaAPension({ ...filaBase(), codigo_visible: null }, []).codigo_visible, null);
    assert.equal(
      filaAPension({ ...filaBase(), codigo_visible: "NID-10000" }, []).codigo_visible,
      "NID-10000"
    );
  });
});

describe("el código visible · el contrato con la migración", () => {
  it("la lectura concedida cubre EXACTAMENTE las columnas que pide la aplicación", () => {
    // Es la trampa de `oleada-13`, y no es teórica: `pensiones` concede `select`
    // por columna, así que una columna que la aplicación pida y el `grant` no
    // conceda hace fallar la consulta con `42501` y deja el catálogo vacío. En
    // los dos sentidos: si el `grant` concede de más, hay una columna publicada
    // que nadie usa.
    assert.deepEqual(
      listaConcedida("select").sort(),
      columnasDeLaLista(COLUMNAS_PENSION).sort(),
      "la lista del `grant select` de oleada-16 y la proyección de la aplicación se han separado"
    );
  });

  it("la escritura del código NO se concede a nadie", () => {
    // El código lo pone la base. Si `authenticated` pudiera escribirlo, un
    // anfitrión podría renombrar su anuncio con el código de otro y el panel
    // maestro buscaría la pensión equivocada.
    assert.equal(
      listaConcedida("update").includes("codigo_visible"),
      false,
      "el `grant update` de oleada-16 concede el código: pasaría a ser falsificable desde el cliente"
    );
  });

  it("el código se sella en el alta y el formato lo impone la base", () => {
    // Tres cosas que la migración tiene que hacer, y que se pueden comprobar
    // aquí sin aplicar nada: el disparador asigna el código en el INSERT, el
    // formato está cerrado por una restricción, y la secuencia que reparte los
    // números es alcanzable por quien publica (si no, el alta fallaría con 42501
    // en la secuencia).
    assert.match(
      FUENTE_MIGRACION,
      /new\.codigo_visible := 'NID-' \|\| lpad\(nextval\('public\.pensiones_codigo_visible_seq'\)::text, 4, '0'\);/,
      "el disparador dejó de asignar el código en el alta: los anuncios nuevos nacerían sin código"
    );
    assert.match(
      FUENTE_MIGRACION,
      /check \(codigo_visible ~ '\^NID-\[0-9\]\{4,\}\$'\)/,
      "la restricción de formato desapareció: la base podría contener un código que no se puede dictar"
    );
    assert.match(
      FUENTE_MIGRACION,
      /grant usage on sequence public\.pensiones_codigo_visible_seq to authenticated;/,
      "quien publica no puede pedir el siguiente número: el alta fallaría con 42501 sobre la secuencia"
    );
  });

  it("la migración no renombra ni reescribe: el relleno solo toca las filas sin código", () => {
    // La promesa es que un código no cambia NUNCA después. Se sostiene en una
    // sola línea: el relleno filtra por `codigo_visible is null`. Sin ese filtro,
    // volver a aplicar la migración renumeraría anuncios ya publicados.
    assert.match(
      FUENTE_MIGRACION,
      /where p\.codigo_visible is null/,
      "el relleno perdió el filtro: una segunda aplicación renumeraría los anuncios ya publicados"
    );
    assert.doesNotMatch(
      FUENTE_MIGRACION,
      /order by creada_en (desc|DESC)/,
      "el relleno cambió de sentido: el anuncio más antiguo tiene que ser el NID-0001"
    );
  });
});
