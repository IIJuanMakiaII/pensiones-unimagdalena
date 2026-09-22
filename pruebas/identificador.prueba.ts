/**
 * Resolución de la dirección pública de un anuncio (`lib/identificador.ts`).
 *
 * Esta es la lógica que decide **por qué columna** se busca un anuncio. Se prueba
 * aquí, y no contra la base de datos, porque el fallo que viene a evitar es de
 * tipos, no de datos: pedir un slug contra la columna `id` (uuid) no devuelve
 * «cero filas», devuelve un **error de tipo** de PostgreSQL — y ese error era el
 * que hacía caer la capa de datos a la semilla de demostración, mezclando
 * anuncios ficticios con reales.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  columnaDeIdentificador,
  esSlug,
  esUuid,
  identificadorPlausible,
  normalizarIdentificador,
} from "@/lib/identificador";

const UUID_REAL = "f555e5b3-6629-402a-ae37-32c366c3f022";
const SLUG_REAL = "residencia-makia";

describe("normalizarIdentificador", () => {
  it("acepta la dirección tal como se dicta por teléfono", () => {
    assert.equal(normalizarIdentificador("  Residencia-Makia "), "residencia-makia");
    assert.equal(normalizarIdentificador("RESIDENCIA-MAKIA"), "residencia-makia");
  });

  it("no altera lo que ya está normalizado", () => {
    assert.equal(normalizarIdentificador(SLUG_REAL), SLUG_REAL);
  });
});

describe("esUuid", () => {
  it("reconoce un uuid, también en mayúsculas (los enlaces compartidos varían)", () => {
    assert.equal(esUuid(UUID_REAL), true);
    assert.equal(esUuid(UUID_REAL.toUpperCase()), true);
  });

  it("no confunde un slug con un uuid", () => {
    assert.equal(esUuid(SLUG_REAL), false);
  });
});

describe("esSlug", () => {
  it("acepta direcciones legibles normales", () => {
    assert.equal(esSlug(SLUG_REAL), true);
    assert.equal(esSlug("pension-costa-verde"), true);
    assert.equal(esSlug("casa2"), true);
  });

  it("rechaza lo que no puede ser una dirección", () => {
    assert.equal(esSlug("con espacios"), false);
    assert.equal(esSlug("mayusculas-Mal"), false);
    assert.equal(esSlug("guion--doble"), false);
    assert.equal(esSlug("-empieza-con-guion"), false);
    assert.equal(esSlug("termina-con-guion-"), false);
    assert.equal(esSlug("simbolo!"), false);
    assert.equal(esSlug(""), false);
  });
});

describe("columnaDeIdentificador · la decisión que evita el error de tipos", () => {
  it("un uuid se busca por la clave primaria", () => {
    assert.equal(columnaDeIdentificador(UUID_REAL), "id");
  });

  it("una dirección legible NUNCA se busca contra la columna del uuid", () => {
    // Es la regresión concreta que este módulo existe para evitar.
    assert.equal(columnaDeIdentificador(SLUG_REAL), "slug");
    assert.notEqual(columnaDeIdentificador(SLUG_REAL), "id");
  });

  it("el uuid con mayúsculas y espacios sigue siendo la clave primaria", () => {
    assert.equal(columnaDeIdentificador(`  ${UUID_REAL.toUpperCase()} `), "id");
  });

  it("las direcciones de la semilla también se resuelven por slug", () => {
    assert.equal(columnaDeIdentificador("pension-costa-verde"), "slug");
  });
});

describe("identificadorPlausible · descartar antes de gastar una consulta", () => {
  it("acepta las dos formas válidas", () => {
    assert.equal(identificadorPlausible(UUID_REAL), true);
    assert.equal(identificadorPlausible(SLUG_REAL), true);
  });

  it("descarta lo que no puede existir ni como uuid ni como dirección", () => {
    assert.equal(identificadorPlausible("con espacios internos"), false);
    assert.equal(identificadorPlausible("simbolo#raro"), false);
    assert.equal(identificadorPlausible(""), false);
    assert.equal(identificadorPlausible("   "), false);
    assert.equal(identificadorPlausible("guion--doble"), false);
  });
});
