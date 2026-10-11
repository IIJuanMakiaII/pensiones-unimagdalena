import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import FormularioContactoRespaldo from "@/components/FormularioContactoRespaldo";
import {
  CORREO_CONTACTO,
  WHATSAPP_DISPONIBLE,
  enlaceWhatsAppPlataforma,
} from "@/lib/formato";
import { SITIO_URL } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Escríbenos",
  description:
    "Déjanos tu correo o tu teléfono y te contactamos sobre pensiones y habitaciones cerca de la Universidad del Magdalena.",
  alternates: { canonical: `${SITIO_URL}/contacto` },
  /**
   * Sin indexar: es la página de respaldo del contacto, no una página para
   * buscadores. Lo que debe aparecer en Google es el catálogo, no un formulario
   * vacío. `follow` se deja activo para no cortar el rastro hacia el catálogo.
   */
  robots: { index: false, follow: true },
};

interface Props {
  /** En Next 15 `searchParams` pasa a ser Promise (misma nota que en `/maestro`). */
  searchParams: Promise<{
    enviado?: string;
    error?: string;
    pension?: string;
    motivo?: string;
  }>;
}

/**
 * Por qué existe esta página (tarea #59).
 *
 * Todo el contacto del sitio abría WhatsApp. Un solo número, un solo canal: si el
 * número se cae, se satura o la persona simplemente no tiene WhatsApp —que no es
 * lo mismo que no tener teléfono—, la captación se detiene y no queda ni rastro de
 * quién lo intentó. Esta es la salida.
 *
 * El estado NO vive en el navegador: llega en la dirección (`?enviado=1`,
 * `?error=...`) porque la acción de servidor responde con una redirección. Así el
 * resultado se puede compartir, recargar y —lo que importa— verse **sin
 * JavaScript**.
 */
export default async function ContactoPage({ searchParams }: Props) {
  const { enviado, error, pension, motivo } = await searchParams;
  const volvioBien = enviado === "1";

  const mensajeDeError = error ? TEXTO_DE_ERROR[error] ?? TEXTO_DE_ERROR.guardado : null;

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-10">
        <p className="mb-4">
          <Link href="/" className="text-sm font-bold text-primary-700 hover:underline">
            ← Volver al catálogo
          </Link>
        </p>

        <h1 className="font-display text-2xl font-extrabold text-neutro-900">Escríbenos</h1>
        <p className="mt-2 text-base leading-relaxed text-neutro-600">
          Déjanos tu correo o tu teléfono y te escribimos nosotros: precios, disponibilidad
          y visitas. También sirve si el botón de WhatsApp no te funciona.
        </p>

        {volvioBien && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800"
          >
            Listo, recibimos tus datos. Te escribimos al contacto que dejaste.
          </p>
        )}

        {mensajeDeError && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-confianza-danger/30 bg-confianza-danger/10 px-3 py-2 text-sm font-semibold text-confianza-danger"
          >
            {mensajeDeError}
          </p>
        )}

        {/*
          Si se llegó aquí porque el canal de WhatsApp no sirve, se dice. Callarlo
          dejaría a la persona buscando un botón que no está, que es el mismo fallo
          de antes con otra cara. Lo que NO se hace es explicar el detalle técnico:
          a quien busca alojamiento no le sirve de nada saber qué variable falta.
        */}
        {!volvioBien && !WHATSAPP_DISPONIBLE && (
          <p className="mt-5 rounded-xl border border-neutro-200 bg-neutro-100 px-3 py-2 text-sm font-semibold text-neutro-700">
            Ahora mismo el contacto por WhatsApp no está disponible en este sitio, así que el
            formulario de abajo es la vía más rápida.
          </p>
        )}

        {WHATSAPP_DISPONIBLE && (
          <p className="mt-5 text-base leading-relaxed text-neutro-600">
            Si prefieres hablar ya,{" "}
            <a
              href={enlaceWhatsAppPlataforma(
                "Hola, quiero información sobre una pensión cerca de la Universidad del Magdalena."
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary-700 underline"
            >
              escríbenos por WhatsApp
            </a>
            .
          </p>
        )}

        <div className="mt-6">
          <FormularioContactoRespaldo
            pension={pension}
            mensajeInicial={
              pension
                ? "Hola, quiero información sobre un alojamiento que vi en Nido."
                : ""
            }
          />
        </div>

        {CORREO_CONTACTO && (
          <p className="mt-6 text-base leading-relaxed text-neutro-600">
            ¿Prefieres el correo? Escríbenos a{" "}
            <a href={`mailto:${CORREO_CONTACTO}`} className="font-semibold text-primary-700 underline">
              {CORREO_CONTACTO}
            </a>
            .
          </p>
        )}

        {/*
          El motivo viaja en la dirección para que quien despliegue pueda ver de un
          vistazo por qué se está usando el respaldo, sin mirar los registros del
          servidor. No se muestra como texto: al visitante no le dice nada útil.
        */}
        {motivo && !WHATSAPP_DISPONIBLE && process.env.NODE_ENV !== "production" && (
          <p className="mt-6 text-xs text-neutro-500">
            Diagnóstico (solo visible fuera de producción): canal de WhatsApp sin usar por
            «{motivo}».
          </p>
        )}
      </main>
      <Footer />
    </>
  );
}

/**
 * Un mensaje por motivo, y ninguno culpa a quien rellena el formulario.
 *
 * `sin_migracion` está separado a propósito: significa que a la base de este
 * despliegue le falta la migración —la tabla, la función que escribe o el permiso
 * de ejecución—, y confundirlo con «no se pudo guardar» haría buscar una avería
 * donde solo falta ejecutar un archivo. Por eso su mensaje no invita a
 * reintentar: reintentar no arregla nada de lo que le falta a la base.
 */
const TEXTO_DE_ERROR: Record<string, string> = {
  validacion:
    "Revisa el nombre y el contacto, y marca la casilla de autorización: sin ella no podemos guardar tus datos.",
  sin_base:
    "El formulario todavía no está conectado a la base de datos de este despliegue. Escríbenos por WhatsApp mientras lo terminamos de configurar.",
  sin_migracion:
    "El formulario todavía no está listo en este despliegue. Escríbenos por WhatsApp mientras lo terminamos.",
  guardado:
    "No pudimos guardar tus datos ahora mismo. Vuelve a intentarlo en un momento o escríbenos por WhatsApp.",
};
