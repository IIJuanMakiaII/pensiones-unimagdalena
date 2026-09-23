"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/utils/supabase/client";
import { mensajeDeError } from "@/lib/auth-mensajes";

interface Props {
  configurado: boolean;
}

/** Registro de anfitriones (Supabase Auth + perfil en la tabla `usuarios`). */
export default function FormularioRegistro({ configurado }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    configurado ? null : "Supabase aún no está configurado: falta agregar las credenciales en .env.local."
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  /** Aceptación de los textos legales (tarea #30): sin ella no se crea la cuenta. */
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  const registrar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!configurado) return;

    setError(null);
    setAviso(null);

    if (!aceptaTerminos) {
      setError(
        "Para crear la cuenta necesitamos que aceptes las condiciones de uso y el aviso de privacidad."
      );
      return;
    }

    setEnviando(true);

    const supabase = crearClienteNavegador();
    const { data, error: errorAuth } = await supabase.auth.signUp({
      email,
      password,
        options: {
          // El trigger `crear_perfil_usuario` toma estos datos para la tabla usuarios.
          data: {
            nombre,
            rol: "anfitrion",
            // Constancia de la aceptación de los textos legales, con su fecha, en
            // los metadatos de la cuenta. La autorización del número de contacto
            // se registra aparte, al publicar (ver supabase/oleada-6.sql).
            acepta_terminos: true,
            terminos_aceptados_en: new Date().toISOString(),
          },
          emailRedirectTo: `${window.location.origin}/auth/confirmar?next=/publicar`,
        },
    });

    setEnviando(false);

    if (errorAuth) {
      setError(mensajeDeError(errorAuth.message));
      return;
    }

    // Si el proyecto exige confirmación por correo, no hay sesión todavía.
    if (!data.session) {
      setAviso(
        "Cuenta creada. Te enviamos un correo para confirmarla: ábrelo y luego inicia sesión."
      );
      return;
    }

    router.push("/publicar");
    router.refresh();
  };

  return (
    <form onSubmit={registrar} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200 md:p-8">
      <h1 className="font-display text-2xl font-extrabold text-neutro-900">Publica tu pensión</h1>
      <p className="mt-1 text-sm text-neutro-600">
        Crea tu cuenta de anfitrión y sube tu pensión al catálogo.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-confianza-danger/30 bg-confianza-danger/10 px-3 py-2 text-sm font-semibold text-confianza-danger">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="mt-4 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800">
          {aviso}
        </p>
      )}

      <div className="mt-5">
        <label htmlFor="nombre" className="block text-sm font-semibold text-neutro-700">
          Nombre o razón social
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          minLength={3}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
          placeholder="Ej.: Residencias La Marina"
        />
      </div>

      <div className="mt-4">
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
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
          placeholder="tucorreo@ejemplo.com"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="password" className="block text-sm font-semibold text-neutro-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
          placeholder="Mínimo 6 caracteres"
        />
      </div>

      {/* Los textos legales deben alcanzarse también desde el registro: la cuenta
          se crea con ellos publicados (tarea #30). */}
      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="aceptaTerminos"
          value="si"
          required
          checked={aceptaTerminos}
          onChange={(evento) => setAceptaTerminos(evento.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary-600"
        />
        <span className="text-sm leading-relaxed text-neutro-700">
          He leído y acepto las{" "}
          <Link
            href="/legal/condiciones"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary-700 underline underline-offset-2"
          >
            condiciones de uso
          </Link>{" "}
          y el{" "}
          <Link
            href="/legal/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary-700 underline underline-offset-2"
          >
            aviso de privacidad
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={enviando || !configurado}
        className="mt-6 h-12 w-full rounded-xl bg-accent-700 px-4 text-[15px] font-bold text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? "Creando cuenta…" : "Crear cuenta de anfitrión"}
      </button>

      <p className="mt-4 text-center text-sm text-neutro-600">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-bold text-primary-700 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
