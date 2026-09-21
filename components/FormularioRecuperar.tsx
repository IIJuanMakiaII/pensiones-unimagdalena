"use client";

import { useState } from "react";
import Link from "next/link";
import { crearClienteNavegador } from "@/utils/supabase/client";
import { mensajeDeError } from "@/lib/auth-mensajes";

interface Props {
  configurado: boolean;
}

/**
 * Paso 1 de la recuperación: pedir el enlace por correo.
 *
 * El mensaje de éxito es neutro a propósito («si ese correo tiene cuenta…»): así
 * la pantalla no revela si un correo está registrado o no.
 */
export default function FormularioRecuperar({ configurado }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(
    configurado ? null : "Supabase aún no está configurado: falta agregar las credenciales en .env.local."
  );
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const pedir = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!configurado) return;

    setError(null);
    setEnviando(true);

    const supabase = crearClienteNavegador();
    const { error: errorAuth } = await supabase.auth.resetPasswordForEmail(email, {
      // El enlace pasa por la ruta que canjea el código y deja la sesión lista
      // antes de llegar a /restablecer (ver app/auth/confirmar/route.ts).
      redirectTo: `${window.location.origin}/auth/confirmar?next=/restablecer`,
    });

    setEnviando(false);

    if (errorAuth) {
      setError(mensajeDeError(errorAuth.message));
      return;
    }

    setEnviado(true);
  };

  if (enviado) {
    return (
      <div
        role="status"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200 md:p-8"
      >
        <h1 className="font-display text-2xl font-extrabold text-neutro-900">Revisa tu correo</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutro-600">
          Si <strong className="break-all">{email}</strong> tiene una cuenta, te enviamos un enlace
          para crear una contraseña nueva. Ábrelo desde este mismo dispositivo y tarda poco: los
          enlaces caducan por seguridad.
        </p>
        <p className="mt-3 rounded-xl border border-confianza-gold/40 bg-confianza-gold/10 px-3 py-2 text-xs font-semibold text-neutro-700">
          ¿No lo ves? Mira en la carpeta de spam o correo no deseado: es donde suelen caer los
          primeros mensajes de una web nueva.
        </p>

        <button
          type="button"
          onClick={() => setEnviado(false)}
          className="mt-5 h-12 w-full rounded-xl border border-primary-600 px-4 text-[15px] font-bold text-primary-700 transition hover:bg-primary-50"
        >
          Usar otro correo
        </button>
        <p className="mt-3 text-center text-sm text-neutro-600">
          <Link href="/login" className="font-bold text-primary-700 hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={pedir}
      className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200 md:p-8"
    >
      <h1 className="font-display text-2xl font-extrabold text-neutro-900">
        Recuperar tu contraseña
      </h1>
      <p className="mt-1 text-sm text-neutro-600">
        Escribe el correo con el que te registraste y te enviamos un enlace para crear una nueva.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-confianza-danger/30 bg-confianza-danger/10 px-3 py-2 text-sm font-semibold text-confianza-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-5">
        <label htmlFor="email" className="block text-sm font-semibold text-neutro-700">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
          placeholder="tucorreo@ejemplo.com"
        />
      </div>

      <button
        type="submit"
        disabled={enviando || !configurado}
        className="mt-6 h-12 w-full rounded-xl bg-primary-600 px-4 text-[15px] font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviar enlace de recuperación"}
      </button>

      <p className="mt-4 text-center text-sm text-neutro-600">
        ¿Ya la recordaste?{" "}
        <Link href="/login" className="font-bold text-primary-700 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
