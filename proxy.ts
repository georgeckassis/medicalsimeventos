import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESION, crearTokenSesion, leerTokenSesion, opcionesCookie } from "@/lib/auth/sesion";

// Next.js 16 renombró middleware.ts a proxy.ts. Acá solo se valida que la
// cookie esté firmada y vigente; qué puede hacer cada rol lo decide cada
// API route contra la base (lib/api.ts).
export function proxy(request: NextRequest) {
  const usuarioId = leerTokenSesion(request.cookies.get(COOKIE_SESION)?.value);
  if (usuarioId) {
    // Sliding expiry: cada pedido renueva las 8 horas.
    const res = NextResponse.next();
    res.cookies.set(COOKIE_SESION, crearTokenSesion(usuarioId), opcionesCookie);
    return res;
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Tu sesión expiró. Volvé a iniciar sesión." }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Afuera del login: la pantalla de login, el formulario público de
    // inscripción por QR, el endpoint del cron (tiene su propio secreto) y
    // los archivos estáticos.
    "/((?!login|api/login|inscripcion|api/inscripcion|api/cron|_next/static|_next/image|icons/|.*\\.(?:png|svg|jpg|jpeg|webp|gif|ico|webmanifest)$).*)",
  ],
};
