import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { obtenerPensionesDelAnfitrion } from "@/lib/datos";
import FormularioPension from "@/components/FormularioPension";
import PanelPublicacion from "@/components/PanelPublicacion";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Publicar mi pensión",
  description: "Panel de anfitriones para publicar y administrar pensiones.",
  robots: { index: false, follow: false },
};

/** Panel privado: siempre se renderiza en el servidor con la sesión activa. */
export const dynamic = "force-dynamic";

interface Props {
  /** En Next 15 `searchParams` pasa a ser Promise (ver nota en la ruta de detalle). */
  searchParams: Promise<{ creada?: string; editada?: string; sinNumero?: string }>;
}

export default async function PublicarPage({ searchParams }: Props) {
  const { creada, editada, sinNumero } = await searchParams;

  if (!esSupabaseConfigurado()) return <ConfiguracionPendiente />;

  // La comprobación de sesión se protege a propósito: si Supabase no responde
  // (red, DNS, servicio caído), antes se lanzaba una excepción sin capturar y el
  // anfitrión veía "Algo no cargó". Ahora se distingue "sin sesión" de
  // "no se pudo verificar" y se muestra un mensaje útil.
  let user: { id: string; email?: string } | null = null;
  let falloSesion = false;

  try {
    const supabase = crearClienteServidor();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("No se pudo verificar la sesión con Supabase:", error);
    falloSesion = true;
  }

  if (falloSesion) return <ErrorSesion />;

  // Doble salvaguarda: el middleware ya protege esta ruta.
  if (!user) redirect("/login?destino=/publicar");

  const publicaciones = await obtenerPensionesDelAnfitrion(user.id);

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-neutro-900">
            Panel del anfitrión
          </h1>
          <p className="mt-1 text-sm text-neutro-600">{user.email}</p>
        </div>

        {creada === "1" && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800"
          >
            ✓ Publicación creada. Ya aparece en el catálogo.
          </p>
        )}

        {editada === "1" && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800"
          >
            ✓ Cambios guardados. El catálogo y la ficha ya los muestran.
          </p>
        )}

        {sinNumero === "1" && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-confianza-gold/40 bg-confianza-gold/10 px-4 py-3 text-sm font-semibold text-neutro-700"
          >
            Tu anuncio se publicó, pero no pudimos guardar tu número de WhatsApp: pulsa «Editar
            anuncio» para intentarlo de nuevo. Mientras tanto, las reservas llegan al WhatsApp de la
            plataforma.
          </p>
        )}

        <div className="mt-6">
          <FormularioPension />
        </div>

        <section className="mt-10" aria-label="Mis publicaciones">
          <h2 className="font-display text-lg font-bold text-neutro-800">
            Mis publicaciones ({publicaciones.length})
          </h2>

          {publicaciones.length === 0 ? (
            <p className="mt-2 text-sm text-neutro-600">
              Todavía no has publicado ninguna pensión. Usa el formulario de arriba.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {publicaciones.map((pension) => (
                <PanelPublicacion key={pension.id} pension={pension} />
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 text-center text-sm">
          <Link href="/" className="font-bold text-primary-700 hover:underline">
            ← Volver al catálogo
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}

/** Aviso cuando aún no se han pegado las credenciales de Supabase. */
function ConfiguracionPendiente() {
  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <h1 className="font-display text-2xl font-extrabold text-neutro-900">
          Modo dinámico pendiente de activar
        </h1>

        <div className="mt-4 rounded-2xl border border-accent-200 bg-accent-50 p-5">
          <p className="text-sm leading-relaxed text-neutro-700">
            El formulario de publicación y el inicio de sesión ya están construidos, pero
            necesitan las credenciales de Supabase para funcionar. Mientras tanto, el catálogo
            sigue mostrando los datos de demostración: <strong>nada está roto</strong>.
          </p>
        </div>

        <ol className="mt-6 space-y-4 text-sm leading-relaxed text-neutro-700">
          <li>
            <strong>1.</strong> Crea un proyecto en{" "}
            <span className="font-semibold">supabase.com</span> (plan gratuito) y copia la
            <em> Project URL</em> y la <em>anon key</em> desde Project Settings → API.
          </li>
          <li>
            <strong>2.</strong> Pégalas en <code className="rounded bg-neutro-100 px-1.5 py-0.5">.env.local</code>:
            <pre className="mt-2 overflow-x-auto rounded-xl bg-neutro-900 p-3 text-xs text-neutro-50">
{`NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key`}
            </pre>
          </li>
          <li>
            <strong>3.</strong> Ejecuta <code className="rounded bg-neutro-100 px-1.5 py-0.5">supabase/esquema.sql</code>{" "}
            en el SQL Editor de Supabase (crea las tablas, políticas y el perfil automático).
          </li>
          <li>
            <strong>4.</strong> Reinicia el servidor local: <code className="rounded bg-neutro-100 px-1.5 py-0.5">npm run dev</code>.
          </li>
        </ol>

        <p className="mt-6 text-sm text-neutro-600">
          Guía completa paso a paso en <strong>docs/integracion-supabase.md</strong> del proyecto.
        </p>

        <p className="mt-8 text-center text-sm">
          <Link href="/" className="font-bold text-primary-700 hover:underline">
            ← Volver al catálogo
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}

/** Aviso cuando la sesión no se pudo verificar (Supabase no respondió). */
function ErrorSesion() {
  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-16 text-center md:px-6">
        <h1 className="font-display text-2xl font-extrabold text-neutro-900">
          No pudimos verificar tu sesión
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutro-600">
          Tu sesión está guardada, pero el servicio de cuentas no respondió. Suele ser
          algo temporal: vuelve a intentarlo en unos segundos.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/publicar"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-primary-600 px-6 text-[15px] font-bold text-white transition hover:bg-primary-700"
          >
            Reintentar
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-neutro-300 px-6 text-[15px] font-bold text-neutro-700 transition hover:bg-neutro-100"
          >
            Volver al catálogo
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
