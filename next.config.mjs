/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    // AVIF desactivado a propósito mientras el proyecto esté en next@14.2.35:
    // habilitarlo activa la superficie del advisory de RCE en la Image
    // Optimization API (GHSA-2xp9-vwfh-vxw4). Reactivar tras migrar a Next 16:
    //   formats: ["image/avif", "image/webp"]
    formats: ["image/webp"],

    // Solo hosts de confianza. El comodín "**" que había antes permitía
    // optimizar cualquier URL (DoS por remotePatterns, CVE-2025-59471) y
    // convertía el optimizador en un proxy abierto. La lista blanca se valida
    // también en el formulario de publicación (lib/imagenes.ts).
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],

    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
    minimumCacheTTL: 604800,
  },

  /**
   * Cabeceras de seguridad para todas las rutas.
   *
   * Nota sobre CSP: en next@14.2.35 NO se pueden usar nonces (se heredaría el
   * advisory GHSA-ffhc-5mcf-pf4q), así que se permite 'unsafe-inline' para los
   * scripts que Next inyecta. Aun así aporta: bloquea orígenes externos de
   * script, impide objetos embebidos, fija `base-uri` y `form-action` y anula
   * el framing. Al migrar a Next 16, sustituir por hashes/nonces.
   */
  async headers() {
    const esDesarrollo = process.env.NODE_ENV === "development";

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${esDesarrollo ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' https://*.supabase.co${esDesarrollo ? " ws: wss:" : ""}`,
      // `blob:` es necesario porque el servidor de desarrollo crea workers
      // desde blobs; sin él, la compilación en caliente se bloquea.
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ...(esDesarrollo ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");

    const cabeceras = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];

    // HSTS solo tiene sentido sobre HTTPS real.
    if (!esDesarrollo) {
      cabeceras.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/:ruta*", headers: cabeceras }];
  },
};

export default nextConfig;
