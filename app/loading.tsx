import { EsqueletoCatalogo } from "@/components/Esqueletos";

/**
 * Estado de carga del catálogo (Next.js lo muestra automáticamente mientras el
 * Server Component resuelve los datos de Supabase).
 */
export default function CargandoCatalogo() {
  return (
    <div className="min-h-dvh bg-neutro-50">
      <div className="bg-primary-800 px-4 py-10 md:py-14">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-8 w-4/5 animate-pulse rounded bg-primary-700 md:h-12" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-primary-700" />
          <div className="h-12 w-56 animate-pulse rounded-xl bg-primary-700" />
        </div>
      </div>
      <div className="border-b border-neutro-200 bg-white py-4">
        <div className="mx-auto max-w-6xl px-4">
          <div className="h-12 w-full animate-pulse rounded-xl bg-neutro-100" />
        </div>
      </div>
      <EsqueletoCatalogo />
    </div>
  );
}
