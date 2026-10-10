"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Entrada de cuenta de la cabecera (tarea #17).
 *
 * POR QUÉ SE RESUELVE EN EL CLIENTE Y NO EN EL SERVIDOR
 * ----------------------------------------------------
 * Esta parte es la única que depende de la sesión. Si se resolviera aquí arriba
 * con `supabase.auth.getUser()`, Next tendría que renderizar en cada visita
 * todas las páginas del layout —incluida la portada y las fichas, que son
 * estáticas/ISR (`revalidate = 60`)— y se perdería justo el rendimiento que
 * costó conseguir. Al resolverla en el cliente, el HTML servido sigue siendo
 * estático y el estado se completa después de la hidratación.
 *
 * El estado inicial es «visitante», que es el caso mayoritario y además el que
 * deben ver los buscadores: la cabecera sirve el enlace a la cuenta en el HTML
 * estático, sin esqueletos ni saltos.
 *
 * COSTE PARA UN VISITANTE ANÓNIMO: 0 kB de JavaScript extra. El cliente de
 * Supabase (`supabase-js`) solo se descarga con `import()` dinámico si existe la
 * cookie de sesión; sin cookie no se importa nada.
 */

interface Identidad {
  nombre: string;
  correo: string;
  /**
   * Si esta cuenta tiene el perfil maestro (tarea #34).
   *
   * Se pregunta a la base con `es_maestro()` —la misma función que usa el panel
   * para autorizar— y **nunca** se lee de `user_metadata`: esos metadatos los
   * escribe el propio usuario, así que cualquiera podría ponerse
   * `rol: "maestro"` sin tocar la base y vería el enlace. Ver el enlace no da
   * acceso (el panel vuelve a preguntar), pero enseñar una puerta que no existe
   * es engañoso y enseñarla a quien no le corresponde filtra que hay un rol
   * superior.
   */
  esMaestro: boolean;
}

/**
 * Cookie de sesión de Supabase: `sb-<ref>-auth-token` (y sus trozos
 * `…-auth-token.0`, `…-auth-token.1` cuando la sesión es grande).
 */
const COOKIE_SESION = /(?:^|;\s*)sb-[^=;\s]*-auth-token/;

function hayCookieDeSesion(): boolean {
  return typeof document !== "undefined" && COOKIE_SESION.test(document.cookie);
}

export default function EntradaCuenta() {
  const [identidad, setIdentidad] = useState<Identidad | null>(null);

  useEffect(() => {
    if (!hayCookieDeSesion()) return;

    let cancelado = false;

    void (async () => {
      try {
        const { crearClienteNavegador } = await import("@/utils/supabase/client");
        // Un solo cliente para las dos consultas: la segunda reutiliza la sesión
        // que la primera acaba de resolver.
        const supabase = crearClienteNavegador();

        const { data } = await supabase.auth.getSession();
        const usuario = data.session?.user;
        if (cancelado || !usuario) return;

        const metadatos = usuario.user_metadata as { nombre?: unknown } | undefined;
        const nombre = typeof metadatos?.nombre === "string" ? metadatos.nombre.trim() : "";

        // El perfil maestro se pregunta a la base, no se deduce de los metadatos.
        // Si la comprobación falla, el resultado es «no es maestro»: el enlace
        // desaparece, pero nada más se rompe.
        let esMaestro = false;
        try {
          const { data: resultado } = await supabase.rpc("es_maestro");
          esMaestro = resultado === true;
        } catch {
          esMaestro = false;
        }

        if (cancelado) return;

        setIdentidad({ nombre, correo: usuario.email ?? "", esMaestro });
      } catch {
        // Si la sesión no se puede resolver, la cabecera se queda como visitante.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return identidad ? <BloqueSesion identidad={identidad} /> : <BloqueVisitante />;
}

/** Visitante sin sesión: oferta de alojamiento + crear cuenta + iniciar sesión. */
function BloqueVisitante() {
  return (
    <nav
      aria-label="Acceso a tu cuenta"
      className="flex min-w-0 items-center gap-1.5 md:gap-2"
    >
      {/* «Registra tu pensión» es la oferta (anfitrión); «Hazte una cuenta» es la
          cuenta. Son acciones distintas y por eso tienen rótulos distintos. */}
      <Link
        href="/registro"
        className="hidden h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 md:inline-flex"
      >
        Registra tu pensión
      </Link>

      {/* A 375 px el ancho útil es de 328 px y el bloque no podía encogerse
          (`shrink-0`), así que los botones se salían 21 px y «Inicia sesión»
          quedaba cortado. El arreglo es estructural: en móvil el rótulo y la
          densidad son más compactos (250 px en total, 78 px de margen), y desde
          `sm` se recuperan los rótulos completos. */}
      <Link
        href="/registro"
        className="inline-flex h-11 shrink-0 items-center rounded-xl border border-primary-600 px-2.5 text-sm font-bold text-primary-700 transition hover:bg-primary-50 sm:px-3 sm:text-sm"
      >
        <span className="sm:hidden">Crear cuenta</span>
        <span className="hidden sm:inline">Hazte una cuenta</span>
      </Link>

      <Link
        href="/login"
        className="inline-flex h-11 shrink-0 items-center rounded-xl bg-primary-600 px-3 text-sm font-bold text-white transition hover:bg-primary-700 sm:px-3.5 sm:text-sm"
      >
        Inicia sesión
      </Link>
    </nav>
  );
}

/** Cuenta con sesión: identidad + sus publicaciones + cerrar sesión. */
function BloqueSesion({ identidad }: { identidad: Identidad }) {
  const visible = identidad.nombre || identidad.correo;
  const inicial = visible.charAt(0).toLocaleUpperCase("es") || "·";

  return (
    <nav aria-label="Tu cuenta" className="flex min-w-0 items-center gap-1.5 md:gap-2">
      {/* Acceso al panel maestro (tarea #34). Solo aparece si la base confirmó el
          perfil: es una entrada más en la misma barra, no un menú aparte, porque
          en móvil el ancho útil es de 328 px y un desplegable costaría más de lo
          que aporta. El rótulo se acorta a «Maestro» por el mismo motivo. */}
      {identidad.esMaestro && (
        <Link
          href="/maestro"
          className="inline-flex h-11 shrink-0 items-center rounded-xl border border-accent-500 px-2.5 text-sm font-bold text-accent-700 transition hover:bg-accent-50 sm:px-3 sm:text-sm"
        >
          Maestro
        </Link>
      )}

      {/* Identidad y acceso al panel en un solo control. */}
      <Link
        href="/publicar"
        title={`Sesión iniciada como ${visible}`}
        className="flex h-11 min-w-0 items-center gap-2 rounded-xl px-1.5 transition hover:bg-neutro-100 md:px-2"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-extrabold text-white"
        >
          {inicial}
        </span>
        <span className="min-w-0 max-w-[6.5rem] truncate text-xs font-semibold text-neutro-600 md:max-w-[10rem] md:text-sm">
          {visible}
        </span>
        <span className="shrink-0 text-sm font-bold text-primary-700">
          <span className="md:hidden">Mis anuncios</span>
          <span className="hidden md:inline">Mis publicaciones</span>
        </span>
      </Link>

      {/* POST al route handler existente: borra la sesión y vuelve a la portada. */}
      <form action="/auth/signout" method="post" className="shrink-0">
        <button
          type="submit"
          aria-label="Cerrar sesión"
          className="inline-flex h-11 w-11 items-center justify-center gap-2 rounded-xl border border-neutro-300 text-neutro-600 transition hover:bg-neutro-100 hover:text-neutro-800 md:w-auto md:px-3.5"
        >
          <SalirIcono />
          <span className="hidden text-sm font-bold text-neutro-700 md:inline">Cerrar sesión</span>
        </button>
      </form>
    </nav>
  );
}

function SalirIcono() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h10" />
    </svg>
  );
}
