"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type NavegadorConStandalone = Navigator & { standalone?: boolean };

const CLAVE_DESCARTE = "pwa-aviso-descartado";
const DIAS_DE_ESPERA = 14;

/**
 * PWA (Agente 3): registra el service worker y ofrece instalar la app.
 * - Android/Chrome/Edge: usa el evento nativo `beforeinstallprompt`.
 * - iOS/Safari: muestra las instrucciones manuales (Apple no expone el prompt).
 * El aviso solo aparece en la portada, para no competir con el CTA de reserva.
 */
export default function InstalarApp() {
  const ruta = usePathname();
  const [eventoInstalacion, setEventoInstalacion] = useState<EventoInstalacion | null>(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        // `updateViaCache: "none"` evita que el propio sw.js se sirva desde la
        // caché HTTP, que es la causa típica de que una actualización no llegue.
        const registrar = () =>
          navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
            /* Si el service worker no se registra, la web sigue funcionando igual. */
          });
        if (document.readyState === "complete") registrar();
        else window.addEventListener("load", registrar, { once: true });
      } else {
        /**
         * En DESARROLLO no se registra ningún service worker, y además se
         * desregistran los que hayan quedado de sesiones anteriores limpiando
         * sus cachés. Motivo: en dev los archivos de `/_next/static/` no llevan
         * hash de contenido, así que la estrategia de caché servía JavaScript
         * viejo y la página se quedaba colgada hasta recargar con Ctrl+Shift+R.
         */
        // Si la página actual todavía está controlada por un service worker
        // viejo, se desregistra pero NO se borran sus cachés en ese momento: la
        // página en curso puede necesitar aún esos archivos y borrarlos haría
        // que la siguiente navegación interna fallara ("Algo no cargó"). Las
        // cachés se limpian en la siguiente carga, cuando la página ya no está
        // controlada por ningún service worker.
        const paginaControlada = Boolean(navigator.serviceWorker.controller);

        navigator.serviceWorker
          .getRegistrations()
          .then((registros) => Promise.all(registros.map((registro) => registro.unregister())))
          .then(() => {
            if (paginaControlada || !("caches" in window)) return undefined;
            return caches
              .keys()
              .then((claves) => Promise.all(claves.map((clave) => caches.delete(clave))));
          })
          .catch(() => {
            /* Sin permisos o sin soporte: no es crítico. */
          });

        // El aviso de instalación tampoco tiene sentido en desarrollo: sin
        // service worker no hay app instalable real.
        return;
      }
    }

    const yaInstalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as NavegadorConStandalone).standalone === true;
    if (yaInstalada) return;

    const descartadoEn = Number(window.localStorage.getItem(CLAVE_DESCARTE) ?? 0);
    if (Date.now() - descartadoEn < DIAS_DE_ESPERA * 24 * 60 * 60 * 1000) return;

    const alPoderInstalar = (evento: Event) => {
      evento.preventDefault();
      setEventoInstalacion(evento as EventoInstalacion);
      setVisible(true);
    };
    const alInstalar = () => {
      setVisible(false);
      setMostrarIOS(false);
    };

    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);

    const agente = navigator.userAgent;
    const esIOS =
      /iPad|iPhone|iPod/.test(agente) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const esSafari = /Safari/.test(agente) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(agente);
    if (esIOS && esSafari) {
      setMostrarIOS(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  const descartar = () => {
    window.localStorage.setItem(CLAVE_DESCARTE, String(Date.now()));
    setVisible(false);
  };

  const instalar = async () => {
    if (!eventoInstalacion) return;
    await eventoInstalacion.prompt();
    const eleccion = await eventoInstalacion.userChoice;
    if (eleccion.outcome === "accepted") {
      setVisible(false);
      return;
    }
    descartar();
  };

  if (!visible || ruta !== "/") return null;

  return (
    <aside
      role="region"
      aria-label="Instalar la aplicación"
      className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-neutro-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:w-96"
    >
      <div className="flex items-start gap-3">
        <Image
          src="/iconos/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold text-neutro-900">
            Instala Pensiones Unimagdalena
          </p>
          <p className="mt-1 text-xs leading-relaxed text-neutro-600">
            {mostrarIOS
              ? "Toca el botón Compartir y elige «Agregar a pantalla de inicio» para abrirla como app."
              : "Accede en un toque desde tu pantalla de inicio, incluso sin datos."}
          </p>
          {mostrarIOS ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-neutro-100 px-2 py-1 text-xs font-semibold text-neutro-700">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M12 3v12" />
                <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
                <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
              </svg>
              Compartir → Agregar a pantalla de inicio
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={descartar}
          aria-label="Cerrar aviso de instalación"
          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutro-500 transition hover:bg-neutro-100 hover:text-neutro-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        {!mostrarIOS ? (
          <button
            type="button"
            onClick={instalar}
            className="min-h-11 flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            Instalar app
          </button>
        ) : null}
        <button
          type="button"
          onClick={descartar}
          className="min-h-11 rounded-xl border border-neutro-200 px-4 py-2.5 text-sm font-semibold text-neutro-700 transition hover:bg-neutro-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          Ahora no
        </button>
      </div>
    </aside>
  );
}
