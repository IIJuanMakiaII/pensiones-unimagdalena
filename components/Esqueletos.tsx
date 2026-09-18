/**
 * Esqueletos de carga (skeleton loaders) con `animate-pulse`.
 * Imitan la estructura real (tarjeta de pensión y ficha de detalle) para que la
 * pantalla nunca quede en blanco mientras el servidor consulta la base de datos.
 */

export function EsqueletoCard() {
  return (
    <article
      className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-neutro-200"
      aria-hidden="true"
    >
      <div className="aspect-[16/10] w-full animate-pulse bg-neutro-200" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-2/5 animate-pulse rounded bg-neutro-200" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-neutro-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-neutro-200" />
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-neutro-100" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-neutro-100" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-neutro-100" />
        </div>
        <div className="h-6 w-1/3 animate-pulse rounded bg-neutro-200" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-neutral-200" />
      </div>
    </article>
  );
}

/** Rejilla de tarjetas para la página del catálogo. */
export function EsqueletoCatalogo({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-4 w-52 animate-pulse rounded bg-neutro-200" />
        <div className="h-11 w-48 animate-pulse rounded-xl bg-neutro-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {Array.from({ length: cantidad }, (_, i) => (
          <EsqueletoCard key={i} />
        ))}
      </div>
    </div>
  );
}

/** Ficha de detalle: portada, título, precios y lista de habitaciones. */
export function EsqueletoDetalle() {
  return (
    <div className="mx-auto max-w-3xl" aria-hidden="true">
      <div className="h-64 w-full animate-pulse bg-neutro-200 md:h-80" />
      <div className="space-y-4 px-4 py-6 md:px-0">
        <div className="h-3 w-1/4 animate-pulse rounded bg-neutro-200" />
        <div className="h-8 w-3/4 animate-pulse rounded bg-neutro-200" />
        <div className="h-4 w-2/5 animate-pulse rounded bg-neutro-200" />
        <div className="h-20 w-full animate-pulse rounded-xl bg-neutro-100" />
        <div className="h-48 w-full animate-pulse rounded-2xl bg-neutro-200" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-11 animate-pulse rounded-xl bg-neutro-100" />
          <div className="h-11 animate-pulse rounded-xl bg-neutro-100" />
          <div className="h-11 animate-pulse rounded-xl bg-neutro-100" />
          <div className="h-11 animate-pulse rounded-xl bg-neutro-100" />
        </div>
        <div className="h-24 w-full animate-pulse rounded-2xl bg-neutro-100" />
      </div>
    </div>
  );
}
