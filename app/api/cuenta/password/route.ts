import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorApi, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { verificarPassword } from "@/lib/auth/password";
import { cambiarPassword, obtenerHash } from "@/lib/db/usuarios";

const esquema = z.object({
  actual: z.string().min(1, "Ingresá tu contraseña actual."),
  nueva: z.string().min(8, "La contraseña nueva tiene que tener al menos 8 caracteres."),
});

export async function PUT(req: NextRequest) {
  try {
    const usuario = await requerirUsuario();
    const { actual, nueva } = await leerCuerpo(req, esquema);
    const hash = await obtenerHash(usuario.id);
    if (!hash || !(await verificarPassword(actual, hash))) throw new ErrorApi(400, "La contraseña actual no es correcta.");
    await cambiarPassword(usuario.id, nueva);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "cambiando la contraseña");
  }
}
