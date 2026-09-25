import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { guardarConfiguracion, obtenerConfiguracion } from "@/lib/db/configuracion";
import { emailConfigurado } from "@/lib/notificaciones/email";
import { whatsappConfigurado } from "@/lib/notificaciones/whatsapp";

const esquema = z.object({
  minutosAvisoPrevio: z.number().int().min(0).max(24 * 60),
  emailsNotificacion: z.string().trim().max(2000),
});

export async function GET() {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    return NextResponse.json({
      ...(await obtenerConfiguracion()),
      emailConfigurado: emailConfigurado(),
      whatsappConfigurado: whatsappConfigurado(),
    });
  } catch (error) {
    return respuestaError(error, "leyendo la configuración");
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    await guardarConfiguracion(await leerCuerpo(req, esquema));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "guardando la configuración");
  }
}
