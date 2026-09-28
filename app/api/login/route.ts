import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { crearTokenSesion, COOKIE_SESION, opcionesCookie } from "@/lib/auth/sesion";
import { hashDeRelleno, verificarPassword } from "@/lib/auth/password";
import { leerCuerpo, respuestaError, ErrorApi } from "@/lib/api";
import { registrarDiagnostico } from "@/lib/db/diagnostico";
import { borrarIntentos, intentosActuales, ipDe, sumarIntento } from "@/lib/db/limites";
import { obtenerUsuarioConHashPorEmail } from "@/lib/db/usuarios";

const esquema = z.object({ email: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) });

// Freno contra adivinar contraseñas, guardado en la base (vale para todas las
// instancias del servidor): 5 intentos fallidos por mail y 20 por IP cada 15 min.
const VENTANA = 15 * 60;
const MAX_POR_MAIL = 5;
const MAX_POR_IP = 20;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await leerCuerpo(req, esquema);
    const mail = email.toLowerCase();
    const ip = ipDe(req);
    const claveMail = `login-mail:${mail}`;
    const claveIp = `login-ip:${ip}`;

    const [porMail, porIp] = await Promise.all([intentosActuales(claveMail, VENTANA), intentosActuales(claveIp, VENTANA)]);
    if (porMail >= MAX_POR_MAIL || porIp >= MAX_POR_IP) {
      throw new ErrorApi(429, "Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.");
    }

    const usuario = await obtenerUsuarioConHashPorEmail(mail);
    // Se verifica igual contra un hash de relleno si el mail no existe: la
    // respuesta tarda lo mismo y no revela qué mails están registrados.
    const ok = (await verificarPassword(password, usuario?.passwordHash ?? (await hashDeRelleno()))) && usuario !== null && usuario.activo;
    if (!ok || !usuario) {
      await Promise.all([sumarIntento(claveMail, VENTANA), sumarIntento(claveIp, VENTANA)]);
      await registrarDiagnostico({ tipo: "login_fallido", mensaje: `Intento fallido para ${mail}`, ruta: ip, navegador: req.headers.get("user-agent") ?? "" });
      throw new ErrorApi(401, "Mail o contraseña incorrectos.");
    }
    await borrarIntentos(claveMail);

    const res = NextResponse.json({ ok: true, debeCambiarPassword: usuario.debeCambiarPassword });
    res.cookies.set(COOKIE_SESION, crearTokenSesion({ usuarioId: usuario.id, version: usuario.sesionVersion ?? 0 }), opcionesCookie);
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
