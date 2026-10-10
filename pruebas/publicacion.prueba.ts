/**
 * Publicación de un anuncio: de dónde salía «Mamatoco a 10 min a pie» (tarea #50).
 *
 * El defecto que reportó el fundador tenía dos capas, y las dos se prueban aquí
 * porque arreglar una sola no cierra nada:
 *
 *   1. **La pantalla preseleccionaba.** El desplegable de barrio traía «Mamatoco»
 *      puesto y el campo de minutos, `10`. Un valor preseleccionado no se lee como
 *      una pregunta: si el anfitrión no lo mira, publica un dato que nunca declaró.
 *   2. **El servidor lo fabricaba igual.** `leerCamposDePension` sustituía un barrio
 *      vacío por «Santa Marta» y unos minutos ausentes o absurdos por `10`. Esa
 *      capa es la grave: un `required` en el HTML se salta con una petición a mano,
 *      así que era el servidor —y no el navegador— quien decidía si el dato entraba
 *      inventado. Y como lo escribía el servidor, el resultado **parecía
 *      verificado**.
 *
 * La segunda capa se prueba por comportamiento, con `FormData` de verdad: se
 * conduce la función real y se mide qué devuelve. La primera se prueba sobre el
 * código fuente, porque un formulario de React no se puede montar en este arnés
 * —no hay DOM ni renderizador— y lo que importa aquí no es cómo se ve, sino que no
 * quede ningún valor puesto por defecto.
 *
 * LO QUE ESTA PRUEBA NO DEMUESTRA, DICHO SIN ADORNOS
 * -------------------------------------------------
 * No demuestra que el formulario se vea como dice el código. Que el desplegable
 * arranque vacío en una pantalla real, que el campo de texto aparezca al elegir
 * «Otro» y que el navegador bloquee el envío sin barrio son cosas que se comprueban
 * con el arnés de navegador (`verificar:filtros-movil-navegador`), no aquí: esta
 * suite lee el fuente y conduce la validación, nada más. Tampoco demuestra que las
 * tres acciones que llaman a `leerCamposDePension` aborten al recibir errores —
 * eso se comprobó leyendo `app/actions/pensiones.ts:101-102` y `:450-451`, y
 * `app/actions/maestro.ts:274-275`—, y sin eso los errores serían decorativos.
 * Y no toca la base: que el anuncio ya publicado conserve su «10 min» en disco es
 * un hecho aparte que el código no puede deshacer.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BARRIO_OTRO, BARRIOS } from "@/lib/formulario-pension";
import { BARRIO_MIN, DISTANCIA_MAX, leerCamposDePension } from "@/lib/pension-escritura";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * El fuente sin comentarios.
 *
 * Hace falta de verdad: el arreglo de la tarea #50 está documentado con las
 * cadenas que **se eliminaron** —`«Santa Marta»`, `10`, `defaultValue="Mamatoco"`—,
 * así que buscar el literal sobre el archivo entero encontraría la explicación
 * del arreglo y se creería el defecto. Sin esto, la documentación haría fallar la
 * prueba que la propia documentación describe.
 */
function sinComentarios(codigoFuente: string): string {
  return codigoFuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function fuente(relativa: string): string {
  return sinComentarios(readFileSync(join(RAIZ, ...relativa.split("/")), "utf8"));
}

/* -------------------------------------------------------------------------- */
/* El servidor ya no inventa el dato                                          */
/* -------------------------------------------------------------------------- */

describe("leerCamposDePension · el barrio y los minutos se declaran, no se suponen", () => {
  const HABITACION = JSON.stringify([
    { tipo: "individual", genero: "mixto", precio_mensual_cop: 450000 },
  ]);

  /** Un formulario completo y válido, para aislar el campo que cada prueba rompe. */
  function formulario(extra: Record<string, string> = {}): FormData {
    const datos = new FormData();
    datos.set("titulo", "Habitación cerca a Unimagdalena");
    datos.set("descripcion", "Habitación amoblada con servicios incluidos, a pocas cuadras del campus.");
    datos.set("direccion", "Calle 22 # 3-45");
    datos.set("barrio", "Ciudadela");
    datos.set("distancia", "12");
    datos.set("habitaciones", HABITACION);
    for (const [clave, valor] of Object.entries(extra)) datos.set(clave, valor);
    return datos;
  }

  it("un formulario completo pasa sin errores y conserva lo que se escribió", () => {
    const { campos, errores } = leerCamposDePension(formulario());

    assert.deepEqual(errores, []);
    assert.equal(campos.barrio, "Ciudadela");
    assert.equal(campos.distanciaValida, 12);
  });

  it("sin barrio hay error, y el anuncio NO se guarda como «Santa Marta»", () => {
    const { campos, errores } = leerCamposDePension(formulario({ barrio: "" }));

    assert.ok(errores.length > 0, "un barrio vacío tiene que producir un error");
    assert.equal(campos.barrio, "", "el servidor no puede inventarse un barrio");
    assert.ok(
      !errores.some((error) => error.includes("Santa Marta")),
      "nada sustituye al barrio por el nombre de la ciudad"
    );
  });

  it("un barrio demasiado corto tampoco cuela", () => {
    const { errores } = leerCamposDePension(formulario({ barrio: "a" }));
    assert.ok(errores.length > 0);
    assert.ok(BARRIO_MIN >= 3, "el mínimo existe para que no entre la cadena vacía ni un carácter suelto");
  });

  /**
   * «Otro» es el desplegable, no un barrio.
   *
   * Si la palabra se guardara, generaría una página pública `/barrios/otro` para un
   * marcador de posición y la tarjeta mostraría «Otro» como ubicación. El campo de
   * texto existe justo para que ese nombre llegue, así que llega o hay error.
   */
  it("«Otro» no se acepta como barrio: exige el nombre real", () => {
    const { campos, errores } = leerCamposDePension(formulario({ barrio: BARRIO_OTRO }));

    assert.ok(errores.length > 0, "«Otro» por sí solo no es una ubicación");
    assert.ok(
      errores.some((error) => error.includes(BARRIO_OTRO)),
      "el mensaje tiene que nombrar el marcador para que se entienda qué falta"
    );
    /*
     * `campos.barrio` devuelve «Otro» tal como llegó, y eso es el contrato, no un
     * descuido: este módulo lee y valida, y **el llamador decide** qué hace con los
     * errores. Sustituir el valor aquí sería volver a inventar el dato en silencio,
     * que es justo lo que la tarea #50 quita. Lo que impide que «Otro» se escriba es
     * el error: las tres acciones que llaman —`app/actions/pensiones.ts:101`,
     * `:450` y `app/actions/maestro.ts:274`— devuelven antes de tocar la base si la
     * lista no está vacía. Por eso la prueba comprueba el error, y la dependencia
     * queda declarada en la cabecera de este archivo.
     */
    assert.equal(campos.barrio, BARRIO_OTRO, "el módulo no reescribe lo que se envió; el error es la puerta");
  });

  /**
   * El caso que más fácil se cuela: `Number("")` es `0`.
   *
   * La validación anterior comprobaba `distancia >= 0 && distancia <= 60`, y esa
   * condición la cumple el `0` que sale de un campo vacío. Así que un formulario sin
   * minutos se guardaba como «a cero minutos a pie» sin un solo error: el mismo dato
   * inventado, con otra cara. Por eso la lectura mira el texto antes que el número.
   */
  it("sin minutos hay error, aunque `Number(\"\")` sea 0 y 0 sea válido", () => {
    const { errores } = leerCamposDePension(formulario({ distancia: "" }));

    assert.equal(Number(""), 0, "el `0` del campo vacío es lo que hacía pasar la comprobación vieja");
    assert.ok(errores.length > 0, "un campo de minutos vacío tiene que producir un error");
  });

  it("el campo ausente se trata igual que el vacío", () => {
    const datos = formulario();
    datos.delete("distancia");
    const { errores } = leerCamposDePension(datos);
    assert.ok(errores.length > 0);
  });

  it("cero minutos sí es un dato: un alojamiento dentro del campus", () => {
    const { campos, errores } = leerCamposDePension(formulario({ distancia: "0" }));

    assert.deepEqual(errores, []);
    assert.equal(campos.distanciaValida, 0);
  });

  it("los minutos fuera del rango de la base se rechazan en vez de recortarse", () => {
    for (const absurdo of [String(DISTANCIA_MAX + 1), "-1", "abc", "Infinity"]) {
      const { errores } = leerCamposDePension(formulario({ distancia: absurdo }));
      assert.ok(errores.length > 0, `«${absurdo}» no es un dato admisible y tiene que dar error`);
    }
  });

  it("el tope de la base sigue siendo 60 minutos, y el formulario lo comparte", () => {
    assert.equal(DISTANCIA_MAX, 60);
    const { errores } = leerCamposDePension(formulario({ distancia: String(DISTANCIA_MAX) }));
    assert.deepEqual(errores, []);
  });
});

/* -------------------------------------------------------------------------- */
/* Las pantallas no preseleccionan nada                                       */
/* -------------------------------------------------------------------------- */

describe("los formularios de publicación y edición no traen valores puestos", () => {
  it("el formulario de publicación ya no elige el barrio por nadie", () => {
    const publicacion = fuente("components/FormularioPension.tsx");

    assert.equal(
      publicacion.includes('defaultValue="Mamatoco"'),
      false,
      "«Mamatoco» preseleccionado es el origen del error que reportó el fundador"
    );
    assert.equal(
      /defaultValue=\{10\}/.test(publicacion),
      false,
      "diez minutos preseleccionados es el otro origen"
    );
    assert.ok(
      publicacion.includes('id="distancia"') && /id="distancia"[\s\S]{0,400}?\brequired\b/.test(publicacion),
      "los minutos pasan a ser obligatorios"
    );
  });

  it("con «Otro» elegido el nombre viaja en el campo de texto, no en el desplegable", () => {
    for (const archivo of ["components/FormularioPension.tsx", "components/FormularioEditarPension.tsx"]) {
      const formulario = fuente(archivo);

      assert.ok(formulario.includes("BARRIO_OTRO"), `${archivo} tiene que conocer el marcador`);
      assert.ok(
        formulario.includes('name={esOtro ? undefined : "barrio"}'),
        `${archivo}: el desplegable suelta el \`name\` con «Otro» para que la palabra no se guarde como barrio`
      );
      assert.ok(
        formulario.includes('name="barrio"') && formulario.includes("barrioOtro"),
        `${archivo}: el campo de texto es quien lleva el nombre real`
      );
    }
  });

  it("el editor arranca en el barrio guardado y no lo pierde al guardar", () => {
    const edicion = fuente("components/FormularioEditarPension.tsx");

    // Un anuncio viejo con un barrio que ya no está en la lista cae en «Otro» con el
    // nombre ya escrito: así no se borra un dato que existía antes de esta tarea.
    assert.ok(edicion.includes("barrioEnLaLista"));
    assert.ok(
      /useState\(barrioEnLaLista \? pension\.barrio : BARRIO_OTRO\)/.test(edicion),
      "el barrio guardado se respeta; solo lo desconocido cae en el marcador"
    );
    assert.ok(
      /useState\(barrioEnLaLista \? "" : pension\.barrio\)/.test(edicion),
      "y su nombre verdadero llega ya escrito al campo de texto"
    );
  });
});

/* -------------------------------------------------------------------------- */
/* La lista de barrios                                                        */
/* -------------------------------------------------------------------------- */

describe("la lista curada de barrios", () => {
  it("son los 25 sectores verificados, más Las Malvinas, más el marcador", () => {
    const verificados = [
      "El Piñón",
      "Portal Universitario",
      "Villa Marbella",
      "Ciudad del Sol",
      "La Lucha",
      "Portal de las Avenidas",
      "Mirador de la Sierra",
      "Ciudadela",
      "Urbanización Canarias",
      "El Mayor",
      "Urbanización El Río",
      "El Pando",
      "Villas del Mayor",
      "Ciudad Campestre El Nogal",
      "Silvia Rosa",
      "Bavaria",
      "Villas de Alejandría",
      "La Capilla",
      "La 30",
      "Los Almendros",
      "Mamatoco",
      "Parque Central BCH",
      "Cundí",
      "17 de Diciembre",
      "Ondas del Caribe",
    ];

    assert.equal(verificados.length, 25);
    for (const barrio of verificados) {
      assert.ok(BARRIOS.includes(barrio), `falta «${barrio}», que está verificado a menos de 2,7 km`);
    }
    assert.ok(BARRIOS.includes("Las Malvinas"), "Las Malvinas es uno de los sectores que pidió el fundador");
    assert.equal(BARRIOS.length, verificados.length + 2, "25 verificados + Las Malvinas + «Otro»");
  });

  it("«Otro» cierra la lista: el marcador no se mezcla con los barrios", () => {
    assert.equal(BARRIOS[BARRIOS.length - 1], BARRIO_OTRO);
    assert.equal(BARRIOS.filter((barrio) => barrio === BARRIO_OTRO).length, 1);
  });

  it("los sectores del otro extremo de la ciudad ya no están en la lista", () => {
    // Estaban en la lista de ocho entradas y no son «cerca de la universidad»: el
    // filtro de distancia los dejaba fuera igual, así que ofrecerlos solo servía
    // para que un anfitrión eligiera una ubicación que no puede declarar.
    for (const lejano of ["Zaragoza", "Los Troncos", "Gaira", "San Fernando", "Centro"]) {
      assert.equal(BARRIOS.includes(lejano), false, `«${lejano}» está lejos del campus y no debe ofrecerse`);
    }
  });

  it("no hay duplicados, que producirían dos opciones idénticas y un slug repetido", () => {
    assert.equal(new Set(BARRIOS).size, BARRIOS.length);
  });
});
