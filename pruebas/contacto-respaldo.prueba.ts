/**
 * Contacto de respaldo (tarea #59).
 *
 * QUÉ DEFIENDE ESTA PRUEBA, Y POR QUÉ ES LA PRUEBA QUE FALTABA
 * -----------------------------------------------------------
 * El sitio tenía un solo canal de captación: un enlace `wa.me` a un número que
 * sale de una variable de entorno. Si esa variable no llega —o llega con el
 * número de ejemplo— el enlace seguía construyéndose, apuntaba a un número que
 * no existe, y **nada lo decía**: el botón se veía igual de bien y el estudiante
 * escribía al vacío. El fallo no estaba en que faltara el número, sino en que
 * faltaba la pregunta «¿este canal sirve?».
 *
 * Los cuatro casos del número —ausente, vacío, inválido y de ejemplo— se prueban
 * como función pura (`estadoDelCanalWhatsApp`), porque una variable de entorno se
 * lee una sola vez al cargar el módulo y sin esto quedarían fuera de las pruebas,
 * que es exactamente donde vivía el agujero.
 *
 * LA TRAMPA DE ESTE ARCHIVO, DICHA ANTES DE QUE SORPRENDA
 * ------------------------------------------------------
 * Abajo se fija `NEXT_PUBLIC_WHATSAPP_NUMBER` **al número de ejemplo** antes de
 * importar `@/lib/formato`. Es el caso peligroso y por eso se prueba este y no
 * otro: con el número de ejemplo, la tentación del código es seguir ofreciendo
 * WhatsApp como si fuera real. El camino contrario —con un número bueno, el
 * enlace tiene que seguir siendo el `wa.me` de siempre— lo cubre
 * `pruebas/whatsapp.prueba.ts`, que fija un número real. Las dos pruebas juntas
 * cierran las dos mitades; cada una sola sería medio examen.
 *
 * Como `pruebas/registrar.mjs` no carga ningún `.env`, el valor de aquí es el
 * único que ve el módulo en este proceso. Node ejecuta cada archivo de prueba en
 * su propio proceso, que es el mismo supuesto del que ya depende
 * `pruebas/whatsapp.prueba.ts`.
 */
process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = "573001234567";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const NUMERO_DE_EJEMPLO_ENV = "573001234567";
process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = NUMERO_DE_EJEMPLO_ENV;

/**
 * Import dinámico, y no un `import` de cabecera, porque hace falta.
 *
 * Los `import` se elevan por encima del cuerpo del módulo: con uno de cabecera,
 * `lib/formato` se cargaría **antes** de la línea que fija la variable de
 * entorno, leería el valor equivocado y la prueba entera mediría otra cosa. El
 * import dinámico se evalúa donde está escrito. Es el mismo motivo —y la misma
 * forma— que usa `pruebas/whatsapp.prueba.ts`.
 */
const {
  ESTADO_WHATSAPP,
  NUMERO_DE_EJEMPLO,
  RUTA_CONTACTO,
  WHATSAPP_DISPONIBLE,
  atributosDeContacto,
  enlaceWhatsApp,
  enlaceWhatsAppPlataforma,
  estadoDelCanalWhatsApp,
} = await import("@/lib/formato");

const {
  LIMITE_CONTACTO,
  LIMITE_MENSAJE,
  LIMITE_NOMBRE,
  clasificarFalloDeGuardado,
  esContactoValido,
  esCorreoValido,
  esTelefonoValido,
  limpiarLinea,
  limpiarMensaje,
  validarSolicitudContacto,
} = await import("@/lib/contacto-respaldo");

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Quita los comentarios antes de afirmar nada sobre un archivo.
 *
 * No es cosmética: varias de estas comprobaciones son del tipo «esto **no**
 * aparece», y los propios archivos explican en su prosa exactamente lo que no
 * hacen —el formulario dice en un comentario que no lleva `"use client"`, y el
 * pie cuenta que dejó de componer su propio `wa.me`—. Sin quitarlos, la
 * afirmación mediría la explicación en vez del código, y el comentario que
 * documenta una ausencia haría fallar la prueba que la vigila. Pasó en la
 * primera pasada de este mismo archivo.
 *
 * Respeta las cadenas ('…', "…", `…`) para no confundir una barra dentro de un
 * texto con el comienzo de un comentario. Es el mismo criterio que usan
 * `pruebas/sello.prueba.ts` y `pruebas/panel-maestro.prueba.ts`; se repite aquí
 * para no editar el archivo de otra tarea mientras su dueño lo está tocando.
 */
function sinComentarios(codigoFuente: string): string {
  let salida = "";
  let comilla: string | null = null;
  let i = 0;

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

    if (caracter === "/" && siguiente === "/") {
      while (i < codigoFuente.length && codigoFuente[i] !== "\n") i += 1;
      continue;
    }

    if (caracter === "/" && siguiente === "*") {
      i += 2;
      while (i < codigoFuente.length && !(codigoFuente[i] === "*" && codigoFuente[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }

    if (caracter === '"' || caracter === "'" || caracter === "`") comilla = caracter;
    salida += caracter;
    i += 1;
  }

  return salida;
}

const leerSinComentarios = (ruta: string) =>
  sinComentarios(readFileSync(join(RAIZ, ruta), "utf8"));

/** Un anuncio mínimo, con lo que el enlace necesita para armarse. */
const anuncio = {
  slug: "residencia-makia",
  titulo: "Residencia 101",
  barrio: "Mamatoco",
  precioMensual: 600000,
} as unknown as Parameters<typeof enlaceWhatsApp>[0];

describe("estadoDelCanalWhatsApp · las cuatro formas en que el número no sirve", () => {
  it("sin configurar: no hay valor", () => {
    assert.deepEqual(estadoDelCanalWhatsApp(undefined), {
      disponible: false,
      motivo: "sin_configurar",
    });
    assert.deepEqual(estadoDelCanalWhatsApp(null), { disponible: false, motivo: "sin_configurar" });
  });

  it("sin configurar: hay valor pero está vacío o solo tiene espacios", () => {
    // Es el caso que `WHATSAPP_CONFIGURADO` ya cubría, y el que más se da cuando
    // la variable viene del panel del despliegue en vez de un `.env.local`.
    for (const vacio of ["", "   ", "\t", "\n"]) {
      assert.deepEqual(
        estadoDelCanalWhatsApp(vacio),
        { disponible: false, motivo: "sin_configurar" },
        `«${vacio}» no es un número configurado`
      );
    }
  });

  it("inválido: no es un valor con forma de número", () => {
    for (const malo of ["300", "57300123", "abc", "+57 300 123", "1".repeat(16)]) {
      assert.deepEqual(
        estadoDelCanalWhatsApp(malo),
        { disponible: false, motivo: "invalido" },
        `«${malo}» debería rechazarse`
      );
    }
  });

  it("de ejemplo: es un número válido, pero no existe", () => {
    // Aquí está el corazón de la tarea. El número de ejemplo **pasa** la
    // validación de formato, así que una comprobación de forma no lo detiene: hay
    // que compararlo con el ejemplo a propósito.
    assert.deepEqual(estadoDelCanalWhatsApp(NUMERO_DE_EJEMPLO), {
      disponible: false,
      motivo: "ejemplo",
    });
  });

  it("de ejemplo, escrito con separadores, tampoco cuela", () => {
    // El número se normaliza antes de compararse. Si la comparación se hiciera
    // sobre el valor crudo, un `+57 300 123 4567` en el panel esquivaría el
    // control y volveríamos al enlace que no lleva a nadie.
    const disfrazado = `+${NUMERO_DE_EJEMPLO.slice(0, 2)} ${NUMERO_DE_EJEMPLO.slice(2, 5)} ${NUMERO_DE_EJEMPLO.slice(5, 8)} ${NUMERO_DE_EJEMPLO.slice(8)}`;
    assert.deepEqual(estadoDelCanalWhatsApp(disfrazado), {
      disponible: false,
      motivo: "ejemplo",
    });
  });

  it("disponible: solo cuando hay un número real al que escribir", () => {
    assert.deepEqual(estadoDelCanalWhatsApp("573009998888"), {
      disponible: true,
      motivo: null,
    });
    assert.deepEqual(estadoDelCanalWhatsApp("+57 300 999 8888"), {
      disponible: true,
      motivo: null,
    });
  });
});

describe("enlaceWhatsApp · con el canal caído no se cae al número de ejemplo", () => {
  it("este proceso está, de verdad, en el caso peligroso", () => {
    // Sin esta comprobación, todo lo de abajo podría pasar por casualidad: si el
    // número que se fija arriba dejara de ser el de ejemplo, las afirmaciones
    // siguientes medirían un caso distinto del que dicen medir.
    assert.equal(NUMERO_DE_EJEMPLO_ENV, NUMERO_DE_EJEMPLO);
    assert.equal(WHATSAPP_DISPONIBLE, false);
    assert.equal(ESTADO_WHATSAPP.motivo, "ejemplo");
  });

  it("el enlace del anuncio va al formulario, no a un número que no existe", () => {
    const enlace = enlaceWhatsApp(anuncio);
    assert.ok(
      enlace.startsWith(`${RUTA_CONTACTO}?`),
      `el enlace debería llevar al respaldo y llevó a «${enlace}»`
    );
    assert.doesNotMatch(enlace, /wa\.me/);
    assert.doesNotMatch(enlace, new RegExp(NUMERO_DE_EJEMPLO));
  });

  it("lleva el anuncio que la persona estaba mirando y el motivo", () => {
    // El motivo deja ver en el servidor por qué se está usando el respaldo sin
    // abrir los registros; el anuncio, que no tenga que volver a explicarlo.
    const consulta = new URLSearchParams(enlaceWhatsApp(anuncio).split("?")[1]);
    assert.equal(consulta.get("motivo"), "ejemplo");
    assert.equal(consulta.get("pension"), "residencia-makia");
  });

  it("con habitación, el enlace también la lleva", () => {
    const habitacion = {
      id: "hab-1",
      tipo: "individual",
      genero: "mixto",
      precio_mensual_cop: 600000,
      alimentacion_incluida: false,
    } as unknown as Parameters<typeof enlaceWhatsApp>[1];
    const consulta = new URLSearchParams(enlaceWhatsApp(anuncio, habitacion).split("?")[1]);
    assert.equal(consulta.get("habitacion"), "hab-1");
    assert.equal(consulta.get("pension"), "residencia-makia");
  });

  it("el enlace del pie tampoco apunta al ejemplo", () => {
    // El pie componía su propio `wa.me` a mano; era el sitio por donde el número
    // de ejemplo se quedaba vivo aunque el resto se arreglara.
    const enlace = enlaceWhatsAppPlataforma();
    assert.ok(enlace.startsWith(`${RUTA_CONTACTO}?`));
    assert.equal(new URLSearchParams(enlace.split("?")[1]).get("origen"), "pie");
  });
});

describe("atributosDeContacto · abrir en otra pestaña solo cuando sale del sitio", () => {
  it("un enlace externo se abre en otra pestaña y sin acceso al referente", () => {
    assert.deepEqual(atributosDeContacto("https://wa.me/573009998888"), {
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("una ruta propia no se abre en otra pestaña", () => {
    // Es el detalle que se rompe al reutilizar el botón: abrir Nido en una
    // pestaña nueva y sin avisar desconcierta a quien navega con lector de
    // pantalla, porque el foco se queda en la pestaña vieja.
    assert.deepEqual(atributosDeContacto(`${RUTA_CONTACTO}?motivo=ejemplo`), {});
    assert.deepEqual(atributosDeContacto("/pensiones/residencia-makia"), {});
  });
});

describe("validarSolicitudContacto · la autorización no se cuela sola", () => {
  const base = { nombre: "Ana Gómez", contacto: "ana@ejemplo.com", mensaje: "", consentimiento: true };

  it("con todo correcto y autorización, se acepta", () => {
    const resultado = validarSolicitudContacto(base);
    assert.equal(resultado.valido, true);
    assert.deepEqual(resultado.errores, {});
  });

  it("sin autorización no se envía, y lo dice", () => {
    const resultado = validarSolicitudContacto({ ...base, consentimiento: false });
    assert.equal(resultado.valido, false);
    assert.ok(resultado.errores.consentimiento);
  });

  it("nada que no sea el booleano `true` concede la autorización", () => {
    // La Ley 1581 de 2012 exige una autorización previa, expresa e informada. Un
    // formulario manipulado puede mandar cualquier cosa en esa casilla, así que
    // se compara contra `true` y no contra la veracidad del valor: `"false"`, que
    // es una cadena no vacía y por tanto «verdadera» en JavaScript, no autoriza.
    const noEsUnSi = ["on", "true", "false", "1", "si", 1, 0, [], {}, null, undefined];
    for (const valor of noEsUnSi) {
      const resultado = validarSolicitudContacto({ ...base, consentimiento: valor });
      assert.equal(
        resultado.valido,
        false,
        `«${String(valor)}» no debería conceder la autorización`
      );
      assert.ok(resultado.errores.consentimiento);
    }
  });

  it("el nombre tiene que existir y caber", () => {
    assert.ok(validarSolicitudContacto({ ...base, nombre: "A" }).errores.nombre);
    assert.ok(validarSolicitudContacto({ ...base, nombre: "   " }).errores.nombre);
    assert.ok(
      validarSolicitudContacto({ ...base, nombre: "a".repeat(LIMITE_NOMBRE + 1) }).errores.nombre
    );
  });

  it("el contacto tiene que servir para responder", () => {
    assert.ok(validarSolicitudContacto({ ...base, contacto: "" }).errores.contacto);
    assert.ok(validarSolicitudContacto({ ...base, contacto: "ana@" }).errores.contacto);
    assert.ok(validarSolicitudContacto({ ...base, contacto: "no es un contacto" }).errores.contacto);
  });

  it("el mensaje no puede pasar del límite", () => {
    assert.ok(
      validarSolicitudContacto({ ...base, mensaje: "a".repeat(LIMITE_MENSAJE + 1) }).errores.mensaje
    );
    assert.equal(validarSolicitudContacto({ ...base, mensaje: "" }).valido, true);
  });

  it("un campo que no es texto no revienta ni se guarda como texto raro", () => {
    // Un `FormData` puede traer un fichero donde se espera texto, y `String(...)`
    // sobre él devolvería algo plausible en vez de fallar.
    const conFichero = validarSolicitudContacto({
      nombre: { nombre: "foto.png" },
      contacto: Buffer.from("x"),
      mensaje: 42,
      consentimiento: true,
    });
    assert.equal(conFichero.valido, false);
    assert.equal(conFichero.datos.nombre, "");
    assert.equal(conFichero.datos.mensaje, "");
  });

  it("lo que se valida es el texto ya limpio, no el crudo", () => {
    // Si la longitud se midiera antes de recortar, ochenta espacios pasarían por
    // un nombre.
    const resultado = validarSolicitudContacto({ ...base, nombre: `  ${" ".repeat(3)}Ana  ` });
    assert.equal(resultado.datos.nombre, "Ana");
  });
});

describe("limpiar y reconocer · las piezas sueltas", () => {
  it("una línea pierde los saltos y los espacios repetidos", () => {
    assert.equal(limpiarLinea("  Ana \n  Gómez  "), "Ana Gómez");
    assert.equal(limpiarLinea(undefined), "");
  });

  it("un mensaje conserva los párrafos", () => {
    assert.equal(limpiarMensaje("Hola\r\n\r\n\r\n\r\nQué tal"), "Hola\n\nQué tal");
    assert.equal(limpiarMensaje(7), "");
  });

  it("un correo plausible pasa y uno imposible no", () => {
    for (const bueno of ["ana@ejemplo.com", "a.b+c@sub.dominio.co"]) {
      assert.equal(esCorreoValido(bueno), true, `${bueno} debería pasar`);
    }
    for (const malo of ["ana@", "@ejemplo.com", "ana ejemplo@x.com", "ana@ejemplo", "ana@ejemplo.c"]) {
      assert.equal(esCorreoValido(malo), false, `${malo} no debería pasar`);
    }
  });

  it("un teléfono se cuenta por dígitos, con o sin separadores", () => {
    for (const bueno of ["+57 300 123 4567", "3001234567", "(57) 3001234567", "300-1234567"]) {
      assert.equal(esTelefonoValido(bueno), true, `${bueno} debería pasar`);
    }
    for (const malo of ["300 12 tres", "12345", "1234567890123456", ""]) {
      assert.equal(esTelefonoValido(malo), false, `${malo} no debería pasar`);
    }
  });

  it("basta con que sea una de las dos cosas", () => {
    assert.equal(esContactoValido("ana@ejemplo.com"), true);
    assert.equal(esContactoValido("+57 300 123 4567"), true);
    assert.equal(esContactoValido("ana"), false);
  });

  it("los límites son los que la base también exige", () => {
    // Si estos números cambiaran en un solo lado, el formulario aceptaría algo
    // que la función de la base rechazaría, y el visitante vería un error sin
    // haber hecho nada mal.
    assert.equal(LIMITE_NOMBRE, 80);
    assert.equal(LIMITE_CONTACTO, 120);
    assert.equal(LIMITE_MENSAJE, 1200);
  });
});

describe("el formulario · lo que tiene que llevar para poder funcionar sin JavaScript", () => {
  const componente = leerSinComentarios("components/FormularioContactoRespaldo.tsx");

  it("es un componente de servidor", () => {
    // Sin `"use client"` el `action` se envía como un `POST` normal del navegador
    // y el respaldo sigue funcionando aunque el script no cargue. Con él, el
    // formulario dependería justo de lo que puede haber fallado.
    assert.doesNotMatch(componente, /use client/);
    assert.match(componente, /action=\{enviarContactoRespaldo\}/);
  });

  it("exige marcar la casilla antes de enviar", () => {
    assert.match(componente, /name="consentimiento"[\s\S]{0,200}required/);
  });

  it("la autorización enlaza el aviso de privacidad publicado", () => {
    assert.match(componente, /href="\/legal\/privacidad"/);
  });

  it("la trampa para robots está fuera de la pantalla y fuera del tabulador", () => {
    assert.match(componente, /className="sr-only" aria-hidden="true"/);
    assert.match(componente, /name="empresa"[\s\S]{0,120}tabIndex=\{-1\}/);
  });

  it("cada campo tiene su etiqueta asociada", () => {
    for (const campo of ["nombre", "contacto", "mensaje", "consentimiento"]) {
      assert.match(componente, new RegExp(`htmlFor="${campo}"`));
      assert.match(componente, new RegExp(`id="${campo}"`));
    }
  });

  it("el botón usa un par de color declarado para texto sobre color", () => {
    assert.match(componente, /bg-primary-600/);
    assert.match(componente, /text-white/);
  });
});

describe("la acción de servidor · valida antes de guardar", () => {
  const accion = leerSinComentarios("app/actions/contacto.ts");

  it("solo acepta la casilla marcada", () => {
    assert.match(accion, /formData\.get\("consentimiento"\) === "on"/);
  });

  it("valida antes de tocar la base", () => {
    const validacion = accion.indexOf("validarSolicitudContacto");
    const escritura = accion.indexOf('.rpc("registrar_contacto_respaldo"');
    assert.ok(validacion !== -1, "la acción tiene que validar");
    assert.ok(escritura !== -1, "la acción tiene que guardar");
    assert.ok(
      validacion < escritura,
      "la validación tiene que ir antes de la escritura, no después"
    );
  });

  it("escribe por la función, nunca contra la tabla (tarea #63)", () => {
    // El defecto medido: la tabla tiene RLS activo y **cero** privilegios para
    // `anon`, así que un `insert` directo responde `42501` y no guarda nada. La
    // única puerta es la función. Si alguien vuelve a escribir contra la tabla,
    // esta prueba lo dice antes de que el formulario vuelva a fallar en silencio.
    assert.match(accion, /\.rpc\("registrar_contacto_respaldo"/);
    assert.doesNotMatch(accion, /\.from\("contactos_respaldo"\)/);
  });

  it("no manda el `origen`: lo decide la base, no quien envía", () => {
    // La columna tiene `default 'formulario_respaldo'` y la función no lo acepta.
    assert.doesNotMatch(accion, /origen\s*:/);
  });

  it("sin base configurada lo dice en lugar de fallar en silencio", () => {
    assert.match(accion, /esSupabaseConfigurado\(\)/);
    assert.match(accion, /"sin_base"/);
  });

  it("clasifica el fallo en vez de decidirlo con un solo código a mano", () => {
    assert.match(accion, /clasificarFalloDeGuardado\(error\.code\)/);
  });

  it("no le cuenta al visitante el detalle técnico del fallo", () => {
    assert.match(accion, /console\.error/);
    assert.doesNotMatch(accion, /redirect\([^)]*error\.message/);
  });
});

describe("clasificarFalloDeGuardado · qué fallo es de despliegue y qué de verdad", () => {
  const accion = leerSinComentarios("app/actions/contacto.ts");

  /**
   * Al escribir por la función en vez de por la tabla, «falta la migración» dejó
   * de tener un solo código. Estos cinco son las cinco formas en que la misma
   * causa se manifiesta según qué parte falte, y los cinco los arregla quien
   * despliega — ninguno se arregla reintentando.
   */
  it("los cinco códigos de «a esta base le falta la migración»", () => {
    for (const codigo of ["PGRST202", "42883", "PGRST205", "42P01", "42501"]) {
      assert.equal(
        clasificarFalloDeGuardado(codigo),
        "sin_migracion",
        `${codigo} debería leerse como migración pendiente, no como avería`
      );
    }
  });

  it("cualquier otro código es un fallo de guardado de verdad", () => {
    // `23514` es un `check` violado, `57014` una consulta cancelada, `08006` un
    // fallo de conexión: los tres son transitorios o de datos, y esos sí
    // invitan a reintentar.
    for (const codigo of ["23514", "23505", "57014", "08006", "PGRST301", "", null, undefined]) {
      assert.equal(
        clasificarFalloDeGuardado(codigo),
        "guardado",
        `«${String(codigo)}» no debería leerse como migración pendiente`
      );
    }
  });

  it("el mensaje de la migración pendiente no invita a reintentar", () => {
    // Es la mitad que importa de la distinción: si el aviso dijera «vuelve a
    // intentarlo» cuando falta la migración, la persona reintentaría en vano y
    // quien despliega no se enteraría de que tiene un archivo que ejecutar.
    const pagina = leerSinComentarios("app/contacto/page.tsx");
    const desde = pagina.indexOf("sin_migracion:");
    const hasta = pagina.indexOf("guardado:");
    assert.ok(desde !== -1 && hasta > desde, "los dos motivos tienen que existir");
    const bloque = pagina.slice(desde, hasta);
    assert.doesNotMatch(bloque, /reintent|vuelve a intentarlo/i);
    assert.match(bloque, /WhatsApp/);
  });

  it("el motivo viejo ya no existe en ninguna parte", () => {
    // `sin_tabla` describía una tabla; ahora lo que puede faltar es la función o
    // el permiso. Dejar el nombre viejo haría buscar el problema en la tabla
    // cuando el que falta es el `grant execute`.
    assert.doesNotMatch(accion, /sin_tabla/);
    assert.doesNotMatch(leerSinComentarios("app/contacto/page.tsx"), /sin_tabla/);
  });
});

describe("la página · los tres caminos se ven sin depender del navegador", () => {
  const pagina = leerSinComentarios("app/contacto/page.tsx");

  it("lee el resultado de la dirección, no de un estado en memoria", () => {
    // Es lo que permite que el resultado sobreviva a una recarga y se vea sin
    // JavaScript, porque la acción responde con una redirección.
    assert.match(pagina, /await searchParams/);
    assert.match(pagina, /enviado === "1"/);
  });

  it("el éxito se anuncia como estado y el fallo como alerta", () => {
    assert.match(pagina, /role="status"/);
    assert.match(pagina, /role="alert"/);
  });

  it("avisa cuando el canal de WhatsApp no sirve, sin explicar tecnicismos", () => {
    assert.match(pagina, /!WHATSAPP_DISPONIBLE/);
    assert.match(pagina, /no está disponible en este sitio/);
  });

  it("solo ofrece WhatsApp si de verdad está disponible", () => {
    assert.match(pagina, /WHATSAPP_DISPONIBLE &&/);
    assert.match(pagina, /enlaceWhatsAppPlataforma\(/);
  });

  it("no deja un correo escrito en el código", () => {
    // Igual que con el número: un dato del negocio dentro del programa cambia sin
    // que el programa cambie, y nadie lo encuentra el día que hay que cambiarlo.
    assert.match(pagina, /CORREO_CONTACTO &&/);
    assert.match(pagina, /href=\{`mailto:\$\{CORREO_CONTACTO\}`\}/);
    assert.doesNotMatch(pagina, /[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/);
  });

  it("el destino del enlace de salto es el que ya usan las demás páginas", () => {
    assert.match(pagina, /<main id="resultados" tabIndex=\{-1\}/);
  });
});

describe("los botones de contacto · el respaldo llega hasta donde está el CTA", () => {
  const ficha = leerSinComentarios("components/DetallePension.tsx");
  const pie = leerSinComentarios("components/Footer.tsx");

  it("la ficha decide los atributos por el enlace, no los fija a mano", () => {
    // Un `target="_blank"` fijo se quedaría puesto sobre la página de respaldo.
    assert.doesNotMatch(ficha, /target="_blank"/);
    assert.equal((ficha.match(/atributosDeContacto\(/g) ?? []).length, 3);
  });

  it("el pie deja de componer su propio enlace", () => {
    assert.doesNotMatch(pie, /wa\.me/);
    assert.match(pie, /enlaceWhatsAppPlataforma\(\)/);
    assert.match(pie, /WHATSAPP_DISPONIBLE/);
  });
});
