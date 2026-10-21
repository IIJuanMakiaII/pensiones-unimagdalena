"use client";

import { useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { actualizarPension } from "@/app/actions/pensiones";
import type { EstadoFormulario } from "@/lib/pension-escritura";
import type { PensionConHabitaciones } from "@/types";
import type { ContactoDePanel } from "@/lib/contacto-panel";
import { formatearCOP } from "@/lib/formato";
import { IMAGEN_RESPALDO, imagenesDe } from "@/lib/pension";
import { MAXIMO_FOTOS } from "@/lib/imagenes";
import SubidorFotos from "@/components/SubidorFotos";
import ContactoAnfitrionPrivado from "@/components/ContactoAnfitrionPrivado";
import EditorHabitaciones, {
  HABITACION_INICIAL,
  type HabitacionForm,
} from "@/components/EditorHabitaciones";
import {
  AYUDA_WHATSAPP,
  BARRIO_OTRO,
  BARRIOS,
  CAMPO_WHATSAPP,
  ETIQUETA_WHATSAPP,
  NORMAS,
  SERVICIOS,
  claseEtiqueta,
  claseInput,
  conOpcionesActuales,
} from "@/lib/formulario-pension";

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensaje: null };

/** Iguales a los límites de la base: la interfaz los comunica antes de fallar. */
const TITULO_MAX = 120;
const DESCRIPCION_MAX = 2000;

/** Firma de la acción que guarda el formulario (anfitrión o maestro). */
export type AccionDeFormulario = (
  estado: EstadoFormulario,
  formData: FormData
) => Promise<EstadoFormulario>;

interface Props {
  pension: PensionConHabitaciones;
  /**
   * Acción que guarda los cambios. Por defecto la del anfitrión, que es el camino
   * de siempre: el maestro pasa la suya desde `/maestro/[id]/editar`.
   *
   * Se recibe como prop en lugar de decidirse dentro a propósito. Este
   * componente no debe saber si quien edita es el dueño o el maestro —esa
   * pregunta la resuelve el servidor—, y así los dos formularios comparten un
   * único editor en vez de mantener dos que se separan con el tiempo.
   */
  accion?: AccionDeFormulario;
  /** A dónde vuelve «Cancelar». Cada panel vuelve al suyo. */
  volverA?: string;
  /**
   * Aviso mostrado cuando el anuncio está retirado (cambia según quién edita).
   *
   * Es un nodo y no una cadena porque cada panel lo redacta a su manera —el
   * anfitrión habla de «volver a publicarlo desde tu panel» y el maestro, del
   * panel maestro— y las dos versiones llevan énfasis en medio de la frase.
   */
  avisoRetirada?: ReactNode;
  /**
   * Pinta el campo del WhatsApp privado (tarea #77).
   *
   * POR QUÉ EL VALOR POR DEFECTO ES «NO», Y ES LO IMPORTANTE DE ESTA PROP
   * --------------------------------------------------------------------
   * Este editor lo comparten dos caminos: el anfitrión
   * (`/publicar/[id]/editar`) y el maestro (`/maestro/[id]/editar`, que pasa su
   * propia acción). El número es de la persona, no del anuncio, y **el maestro no
   * debe poder pisarlo**: si el campo se pintara en los dos caminos, el maestro
   * vería un campo vacío —él no tiene número que mostrar— y al guardar cualquier
   * cambio lo sobrescribiría con nada, sin que nadie se enterara.
   *
   * Con el defecto en «no», un camino nuevo que olvide declarar la prop no puede
   * destruir el dato, y el servidor del maestro ni siquiera lee ese campo del
   * formulario. Es la misma idea del `accionRecibida ?? actualizarPension`: el
   * defecto es el lado seguro.
   */
  mostrarWhatsapp?: boolean;
  /** El número que el anfitrión ya había dejado. Solo se usa para mostrarlo. */
  whatsappActual?: string | null;
  /**
   * El WhatsApp del propietario, para que el maestro lo **vea sin poder tocarlo**
   * (tarea #79).
   *
   * POR QUÉ ES UNA PROP DISTINTA DE `whatsappActual`, Y NO LA MISMA
   * -----------------------------------------------------------------
   * Porque son dos cosas opuestas con un nombre parecido. `whatsappActual` alimenta
   * un `<input>`: existe para que su valor viaje de vuelta al servidor. Esto otro
   * **no monta ningún campo**: pinta la tarjeta compartida de solo lectura y no se
   * envía a ningún sitio. Si se reutilizara `whatsappActual` para las dos cosas, el
   * día que alguien pase `mostrarWhatsapp` en la ruta del maestro el número se
   * volvería editable otra vez, sin que nada lo delatara.
   *
   * Se tipa con la forma ya resuelta (`ContactoDePanel`) y no con un `string`
   * suelto porque «no hay número» y «no se pudo comprobar» tienen que seguir siendo
   * distinguibles también aquí: el maestro no puede leer que el anfitrión no dejó su
   * número cuando lo que ocurrió es que la consulta falló.
   *
   * Puede venir `null` —cuando la ruta no pudo ni intentar la lectura— y entonces no
   * se pinta nada, que es lo correcto: un panel de edición no es el sitio para dar
   * noticias sobre un dato privado.
   */
  contactoDelAnfitrion?: ContactoDePanel | null;
  /**
   * Las reservas vigentes de este anuncio, con su fecha (tarea #119).
   *
   * El editor las necesita para no ofrecer la casilla «Disponible ahora» en una
   * habitación que la base rechazaría por estar reservada. Se leen en el servidor
   * por `public.listar_reservas()`: la columna `reservada_en` no tiene `SELECT`
   * para `authenticated`, y pedirla daría `42501` en toda la lectura.
   *
   * Por defecto vacío, por la misma razón que las demás props opcionales de este
   * formulario: un camino que se olvide de declararla se comporta como antes de la
   * oleada 17, en vez de inventar reservas.
   */
  reservas?: Readonly<Record<string, string>>;
}

/**
 * Edición de un anuncio ya publicado.
 *
 * Reutiliza los mismos componentes del alta (`EditorHabitaciones`,
 * `SubidorFotos`) para que la experiencia y las reglas sean idénticas. Las
 * habitaciones viajan con su `id`, que es lo que permite actualizarlas en el
 * servidor en lugar de recrearlas y perder su disponibilidad.
 */
export default function FormularioEditarPension({
  pension,
  accion: accionRecibida,
  volverA = "/publicar",
  avisoRetirada,
  mostrarWhatsapp = false,
  whatsappActual = null,
  contactoDelAnfitrion = null,
  reservas = {},
}: Props) {
  const [estado, accion] = useFormState(accionRecibida ?? actualizarPension, ESTADO_INICIAL);

  /**
   * Fotos actuales. Se descarta la de respaldo: es un marcador de posición del
   * catálogo, no una foto del anfitrión, y guardarla la convertiría en suya.
   */
  const [imagenes, setImagenes] = useState<string[]>(
    imagenesDe(pension).filter((url) => url !== IMAGEN_RESPALDO)
  );

  const [habitaciones, setHabitaciones] = useState<HabitacionForm[]>(
    pension.habitaciones.length > 0
      ? pension.habitaciones.map((habitacion) => ({
          id: habitacion.id,
          tipo: habitacion.tipo,
          genero: habitacion.genero,
          precio_mensual_cop: String(habitacion.precio_mensual_cop),
          alimentacion_incluida: habitacion.alimentacion_incluida,
          disponible: habitacion.disponible,
        }))
      : [{ ...HABITACION_INICIAL, precio_mensual_cop: String(pension.precioMensual || "") }]
  );

  const [largoTitulo, setLargoTitulo] = useState(pension.titulo.length);
  const [largoDescripcion, setLargoDescripcion] = useState(pension.descripcion.length);

  /**
   * Barrio del anuncio, sin preseleccionar nada que nadie eligió (tarea #50).
   *
   * Arranca en el barrio guardado y, si ese nombre ya no está en la lista curada
   * —o si es la palabra «Otro», que es un marcador y no un barrio—, en «Otro» con
   * el nombre verdadero ya escrito en el campo de texto. Un anuncio viejo no pierde
   * su barrio al guardar y el anfitrión ve lo que hay antes de tocarlo.
   */
  const barrioEnLaLista = BARRIOS.includes(pension.barrio);
  const [barrio, setBarrio] = useState(barrioEnLaLista ? pension.barrio : BARRIO_OTRO);
  const [barrioOtro, setBarrioOtro] = useState(barrioEnLaLista ? "" : pension.barrio);
  const esOtro = barrio === BARRIO_OTRO;

  // Un servicio o una norma que hoy no esté en la lista se añade para no perderlo
  // al guardar. El barrio no pasa por aquí: su salida es «Otro».
  const opcionesServicios = conOpcionesActuales(SERVICIOS, pension.servicios);
  const opcionesNormas = conOpcionesActuales(NORMAS, pension.normas);

  /** Mismo cálculo que la base: la habitación disponible más barata. */
  const preciosDisponibles = habitaciones
    .filter((habitacion) => habitacion.disponible)
    .map((habitacion) => Number(habitacion.precio_mensual_cop))
    .filter((precio) => Number.isFinite(precio) && precio > 0);
  const precioDesde = preciosDisponibles.length > 0 ? Math.min(...preciosDisponibles) : 0;

  return (
    <form action={accion} className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200">
      <input type="hidden" name="pensionId" value={pension.id} />

      <h1 className="font-display text-xl font-extrabold text-neutro-900">
        Editar «{pension.titulo}»
      </h1>
      {/* El código visible del anuncio (tarea #88), aquí para poder dictarlo o
          buscarlo en el panel cuando el anfitrión llama por teléfono. Es **texto y
          no un campo**: un `<input>` parecería editable y el guardado podría
          intentar escribirlo, y este código lo reparte la base una sola vez
          (es la lección de la tarjeta del WhatsApp). Se imprime tal como llegó. */}
      {pension.codigo_visible ? (
        <p className="mt-1 text-sm text-neutro-600">
          ID de esta pensión:{" "}
          <span className="font-bold tabular-nums text-neutro-800">{pension.codigo_visible}</span>
        </p>
      ) : null}
      <p className="mt-1 text-sm text-neutro-600">
        Los cambios se ven en el catálogo y en la ficha en cuanto guardas.
      </p>

      {!pension.activa && (
        <p className="mt-4 rounded-xl border border-confianza-gold/40 bg-confianza-gold/10 px-3 py-2 text-sm font-semibold text-neutro-700">
          {avisoRetirada ?? (
            <>
              Este anuncio está <strong>retirado</strong>: no aparece en el catálogo. Puedes editarlo
              igualmente y volver a publicarlo desde tu panel.
            </>
          )}
        </p>
      )}

      {estado.mensaje && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-confianza-danger/30 bg-confianza-danger/10 px-3 py-2 text-sm font-semibold text-confianza-danger"
        >
          {estado.mensaje}
        </p>
      )}

      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="titulo" className={claseEtiqueta}>
            Título del alojamiento
          </label>
          <input
            id="titulo"
            name="titulo"
            type="text"
            required
            minLength={6}
            maxLength={TITULO_MAX}
            defaultValue={pension.titulo}
            onChange={(evento) => setLargoTitulo(evento.target.value.length)}
            className={claseInput}
            placeholder="Ej.: Habitación amoblada cerca a la Universidad"
          />
          <p className="mt-1 text-xs text-neutro-500">
            {largoTitulo}/{TITULO_MAX} caracteres
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="direccion" className={claseEtiqueta}>
              Dirección
            </label>
            <input
              id="direccion"
              name="direccion"
              type="text"
              required
              minLength={5}
              defaultValue={pension.direccion}
              className={claseInput}
              placeholder="Calle 30 # 12-45"
            />
          </div>
          <div>
            <label htmlFor="barrio" className={claseEtiqueta}>
              Barrio
            </label>
            <select
              id="barrio"
              /* Con «Otro» elegido el `name` se muda al campo de texto, para que la
                 palabra «Otro» no pueda guardarse como si fuera un barrio. */
              name={esOtro ? undefined : "barrio"}
              required={!esOtro}
              value={barrio}
              onChange={(evento) => setBarrio(evento.target.value)}
              className={claseInput}
            >
              {BARRIOS.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
        </div>

        {esOtro && (
          <div>
            <label htmlFor="barrioOtro" className={claseEtiqueta}>
              ¿Cuál barrio?
            </label>
            <input
              id="barrioOtro"
              name="barrio"
              type="text"
              required
              minLength={3}
              maxLength={60}
              value={barrioOtro}
              onChange={(evento) => setBarrioOtro(evento.target.value)}
              className={claseInput}
              placeholder="Ej.: Ciudadela"
            />
            <p className="mt-1 text-xs text-neutro-500">
              Escríbelo como lo conoce el estudiante: con ese nombre aparece en la tarjeta y se
              crea su página de barrio.
            </p>
          </div>
        )}

        <div className="max-w-xs">
          <label htmlFor="distancia" className={claseEtiqueta}>
            Minutos a pie de Unimagdalena
          </label>
          <input
            id="distancia"
            name="distancia"
            type="number"
            min={0}
            max={60}
            required
            inputMode="numeric"
            defaultValue={pension.distancia_a_pie_minutos}
            className={claseInput}
          />
          <p className="mt-1 text-xs text-neutro-500">
            Los estudiantes filtran por distancia: este dato decide si apareces.
          </p>
        </div>

        {/*
          El WhatsApp privado (tarea #77). Solo lo pinta el camino del anfitrión:
          `mostrarWhatsapp` llega desde `/publicar/[id]/editar` y **no** desde
          `/maestro/[id]/editar`, porque el número es de la persona y el maestro no
          tiene por qué reescribirlo. Ver la prop para el razonamiento entero.

          Llega ya escrito (`whatsappActual`) para que el anfitrión vea lo que hay
          antes de tocarlo, igual que el barrio guardado. Y se dice lo que pasa si lo
          deja vacío, porque es la única forma de que «vacío» signifique algo: no hay
          camino de borrado en la aplicación, así que vaciar el campo no destruye el
          número, simplemente no lo cambia.
        */}
        {mostrarWhatsapp && (
          <div>
            <label htmlFor={CAMPO_WHATSAPP} className={claseEtiqueta}>
              {ETIQUETA_WHATSAPP}
            </label>
            <input
              id={CAMPO_WHATSAPP}
              name={CAMPO_WHATSAPP}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              maxLength={16}
              defaultValue={whatsappActual ?? ""}
              className={claseInput}
              placeholder="3001234567"
              aria-describedby={`${CAMPO_WHATSAPP}-ayuda`}
            />
            <p id={`${CAMPO_WHATSAPP}-ayuda`} className="mt-1 text-xs text-neutro-500">
              {AYUDA_WHATSAPP}{" "}
              {whatsappActual
                ? "Ya tenemos un número tuyo: si lo dejas como está, no cambia."
                : "Déjalo vacío si prefieres no dejarlo; el anuncio se publica igual."}
            </p>
          </div>
        )}

        {/*
          El WhatsApp del propietario, para el maestro que edita el anuncio (tarea
          #79). Va exactamente donde el anfitrión tiene su campo —la sexta posición,
          entre «Minutos a pie de Unimagdalena» y «Habitaciones que ofreces»—, para
          que los dos caminos cuenten lo mismo en el mismo sitio.

          No es un `<input>` y no puede serlo: el número es de la persona, no del
          anuncio, y el maestro no tiene ninguno propio que enseñar. Un campo aquí
          aparecería vacío y, al guardar cualquier cambio, borraría el del anfitrión
          sin que nadie se enterara. Se ve y se escribe, pero no se toca.

          `mt-0` y no el `mt-4` del panel: aquí manda el `space-y-5` del envoltorio de
          campos, y sumar los dos daría 36 px de hueco en vez de 20.
        */}
        {contactoDelAnfitrion && (
          <ContactoAnfitrionPrivado
            contacto={contactoDelAnfitrion}
            titulo={pension.titulo}
            className="mt-0"
          />
        )}

        <div>
          <span className={claseEtiqueta}>Habitaciones que ofreces</span>
          <p className="mt-0.5 text-xs text-neutro-500">
            El precio que verá el estudiante en la tarjeta es el de la habitación disponible más
            barata. Marca «Disponible ahora» solo en las que puedas alquilar hoy.
          </p>

          <EditorHabitaciones
            habitaciones={habitaciones}
            onChange={setHabitaciones}
            reservadas={reservas}
          />

          <input type="hidden" name="habitaciones" value={JSON.stringify(habitaciones)} />

          {precioDesde > 0 && (
            <p
              aria-live="polite"
              className="mt-3 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-800"
            >
              Tu anuncio aparecerá en el catálogo desde {formatearCOP(precioDesde)} /mes.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="descripcion" className={claseEtiqueta}>
            Descripción detallada
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={6}
            required
            minLength={30}
            maxLength={DESCRIPCION_MAX}
            defaultValue={pension.descripcion}
            onChange={(evento) => setLargoDescripcion(evento.target.value.length)}
            className={claseInput}
            placeholder="Describe el ambiente, qué incluye el precio y a quién está dirigido."
          />
          <p className="mt-1 text-xs text-neutro-500">
            {largoDescripcion}/{DESCRIPCION_MAX} caracteres
          </p>
        </div>

        <fieldset>
          <legend className={claseEtiqueta}>Servicios incluidos</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {opcionesServicios.map((servicio) => (
              <label
                key={servicio}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-neutro-200 px-3 text-sm text-neutro-700"
              >
                <input
                  type="checkbox"
                  name="servicios"
                  value={servicio}
                  defaultChecked={pension.servicios.includes(servicio)}
                  className="h-4 w-4 accent-primary-600"
                />
                {servicio}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={claseEtiqueta}>Normas de la casa</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {opcionesNormas.map((norma) => (
              <label
                key={norma}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-neutro-200 px-3 text-sm text-neutro-700"
              >
                <input
                  type="checkbox"
                  name="normas"
                  value={norma}
                  defaultChecked={pension.normas.includes(norma)}
                  className="h-4 w-4 accent-primary-600"
                />
                {norma}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <span className={claseEtiqueta}>Fotos de la pensión</span>
          <p className="mt-0.5 text-xs text-neutro-500">
            Puedes añadir nuevas y quitar las que ya no quieras mostrar (hasta {MAXIMO_FOTOS}). La
            primera de la lista es la principal.
          </p>
          <SubidorFotos valor={imagenes} onChange={setImagenes} />

          <input type="hidden" name="imagenes" value={imagenes.join("\n")} />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <BotonGuardar />
        <Link
          href={volverA}
          className="inline-flex h-12 items-center justify-center rounded-xl border border-neutro-300 px-5 text-base font-bold text-neutro-700 transition hover:bg-neutro-100"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function BotonGuardar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 flex-1 rounded-xl bg-accent-700 px-4 text-base font-bold text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}
