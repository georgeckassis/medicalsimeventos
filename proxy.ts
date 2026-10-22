import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESION, crearTokenSesion, leerTokenSesion, opcionesCookie } from "@/lib/auth/sesion";

// Next.js 16 renombró middleware.ts a proxy.ts. Acá solo se valida que la
// cookie esté firmada y vigente; qué puede hacer cada rol lo decide cada
// API route contra la base (lib/api.ts).
export function proxy(request: NextRequest) {
  const sesion = leerTokenSesion(request.cookies.get(COOKIE_SESION)?.value);
  if (sesion) {
    // Freno a CSRF: un pedido que modifica datos tiene que venir de la propia app.
    if (request.nextUrl.pathname.startsWith("/api/") && !mismoOrigen(request)) {
      return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    }
    // Sliding expiry: cada pedido renueva las 8 horas.
    const res = NextResponse.next();
    res.cookies.set(COOKIE_SESION, crearTokenSesion(sesion), opcionesCookie);
    return res;
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Tu sesión expiró. Volvé a iniciar sesión." }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

/** En pedidos que modifican datos, el navegador manda Origin: tiene que ser el de la app. */
function mismoOrigen(request: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origen = request.headers.get("origin");
  if (!origen) return true; // pedidos sin navegador (curl, cron) no llevan cookie de sesión de otro sitio
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    // Afuera del login: la pantalla de login, el formulario público de
    // inscripción por QR, el endpoint del cron (tiene su propio secreto) y
    // los archivos estáticos (incluido el motor de detección de manos del
    // simulador, que es una librería pública).
    "/((?!login|api/login|inscripcion|api/inscripcion|api/cron|simulador-recursos/|_next/static|_next/image|icons/|.*\\.(?:png|svg|jpg|jpeg|webp|gif|ico|webmanifest)$).*)",
  ],
};
