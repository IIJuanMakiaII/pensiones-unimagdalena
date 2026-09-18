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
        const { data } = await crearClienteNavegador().auth.getSession();
        const usuario = data.session?.user;
        if (cancelado || !usuario) return;

        const metadatos = usuario.user_metadata as { nombre?: unknown } | undefined;
        const nombre = typeof metadatos?.nombre === "string" ? metadatos.nombre.trim() : "";

        setIdentidad({ nombre, correo: usuario.email ?? "" });
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

      <Link
        href="/registro"
        className="inline-flex h-11 shrink-0 items-center rounded-xl border border-primary-600 px-3 text-sm font-bold text-primary-700 transition hover:bg-primary-50"
      >
        Hazte una cuenta
      </Link>

      <Link
        href="/login"
        className="inline-flex h-11 shrink-0 items-center rounded-xl bg-primary-600 px-3.5 text-sm font-bold text-white transition hover:bg-primary-700"
      >
        Inicia sesión
      </Link>
    </nav>
  );
}

/** Anfitrión con sesión: identidad + sus publicaciones + cerrar sesión. */
function BloqueSesion({ identidad }: { identidad: Identidad }) {
  const visible = identidad.nombre || identidad.correo;
  const inicial = visible.charAt(0).toLocaleUpperCase("es") || "·";

  return (
    <nav aria-label="Tu cuenta" className="flex min-w-0 items-center gap-1.5 md:gap-2">
      {/* Identidad y acceso al panel en un solo control. */}
      <Link
        href="/publicar"
        title={`Sesión iniciada como ${visible}`}
        className="flex h-11 min-w-0 items-center gap-2 rounded-xl px-1.5 transition hover:bg-neutro-100 md:px-2"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[13px] font-extrabold text-white"
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
