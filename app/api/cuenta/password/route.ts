import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorApi, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { problemaPassword, verificarPassword } from "@/lib/auth/password";
import { COOKIE_SESION, crearTokenSesion, opcionesCookie } from "@/lib/auth/sesion";
import { intentosActuales, sumarIntento } from "@/lib/db/limites";
import { cambiarPassword, obtenerHash } from "@/lib/db/usuarios";

const esquema = z.object({
  actual: z.string().min(1, "Ingresá tu contraseña actual.").max(200),
  nueva: z.string().max(200),
});

/**
 * Cambio de la propia contraseña. Cierra las sesiones en otros dispositivos
 * y deja abierta la de este (se vuelve a emitir la cookie).
 */
export async function PUT(req: NextRequest) {
  try {
    const usuario = await requerirUsuario(undefined, { permitirSinCambiarPassword: true });
    const { actual, nueva } = await leerCuerpo(req, esquema);
    const clave = `cambio-password:${usuario.id}`;
    if ((await intentosActuales(clave, 15 * 60)) >= 5) throw new ErrorApi(429, "Demasiados intentos. Esperá 15 minutos.");
    const hash = await obtenerHash(usuario.id);
    if (!hash || !(await verificarPassword(actual, hash))) {
      await sumarIntento(clave, 15 * 60);
      throw new ErrorApi(400, "La contraseña actual no es correcta.");
    }
    const problema = problemaPassword(nueva, usuario.email);
    if (problema) throw new ErrorApi(400, problema);
    if (nueva === actual) throw new ErrorApi(400, "La contraseña nueva tiene que ser distinta de la actual.");
    const version = await cambiarPassword(usuario.id, nueva, { temporal: false });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_SESION, crearTokenSesion({ usuarioId: usuario.id, version }), opcionesCookie);
    return res;
  } catch (error) {
    return respuestaError(error, "cambiando la contraseña");
  }
}
