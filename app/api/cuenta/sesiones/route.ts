import { NextResponse } from "next/server";
import { requerirUsuario, respuestaError } from "@/lib/api";
import { COOKIE_SESION, crearTokenSesion, opcionesCookie } from "@/lib/auth/sesion";
import { cerrarSesiones } from "@/lib/db/usuarios";

/** "Cerrar sesión en todos los demás dispositivos" (por ejemplo, si se perdió un celular). */
export async function DELETE() {
  try {
    const usuario = await requerirUsuario(undefined, { permitirSinCambiarPassword: true });
    const version = await cerrarSesiones(usuario.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_SESION, crearTokenSesion({ usuarioId: usuario.id, version }), opcionesCookie);
    return res;
  } catch (error) {
    return respuestaError(error, "cerrando sesiones");
  }
}
