import type { NextConfig } from "next";

const desarrollo = process.env.NODE_ENV !== "production";

/**
 * Política de contenido: la app solo carga código, estilos, imágenes y datos
 * de su propio dominio, no se puede mostrar dentro de otro sitio (evita
 * clickjacking) y los formularios solo envían a la propia app.
 * 'unsafe-inline' en scripts lo necesita Next.js para sus scripts de arranque.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${desarrollo ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${desarrollo ? " ws:" : ""}`,
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // No anunciar qué tecnología usa el servidor.
  poweredByHeader: false,
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La cámara se usa para la foto de la carga; nada más.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // Las respuestas de la API nunca se guardan en cachés intermedias.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ]);
  },
};

export default nextConfig;
