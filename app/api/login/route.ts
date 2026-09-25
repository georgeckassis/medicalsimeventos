import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { crearTokenSesion, COOKIE_SESION, opcionesCookie } from "@/lib/auth/sesion";
import { verificarPassword } from "@/lib/auth/password";
import { leerCuerpo, respuestaError, ErrorApi } from "@/lib/api";
import { obtenerUsuarioConHashPorEmail } from "@/lib/db/usuarios";

const esquema = z.object({ email: z.string().trim().min(1), password: z.string().min(1) });

// Freno simple contra adivinar contraseñas: 5 intentos fallidos por mail
// cada 15 minutos (por instancia del servidor).
const intentos = new Map<string, { fallos: number; desde: number }>();
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60_000;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await leerCuerpo(req, esquema);
    const clave = email.toLowerCase();
    const registro = intentos.get(clave);
    if (registro && Date.now() - registro.desde < VENTANA_MS && registro.fallos >= MAX_FALLOS) {
      throw new ErrorApi(429, "Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.");
    }

    const usuario = await obtenerUsuarioConHashPorEmail(email);
    const ok = usuario && usuario.activo && (await verificarPassword(password, usuario.passwordHash));
    if (!ok) {
      const vigente = registro && Date.now() - registro.desde < VENTANA_MS ? registro : { fallos: 0, desde: Date.now() };
      intentos.set(clave, { ...vigente, fallos: vigente.fallos + 1 });
      throw new ErrorApi(401, "Mail o contraseña incorrectos.");
    }
    intentos.delete(clave);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_SESION, crearTokenSesion(usuario.id), opcionesCookie);
    return res;
  } catch (error) {
    return respuestaError(error, "iniciando sesión");
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESION, "", { ...opcionesCookie, maxAge: 0 });
  return res;
}
