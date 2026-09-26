import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { listarDiagnostico, registrarDiagnostico } from "@/lib/db/diagnostico";

const esquema = z.object({
  tipo: z.string().trim().min(1).max(50),
  mensaje: z.string().max(1000),
  detalle: z.string().max(4000).optional().default(""),
  ruta: z.string().max(300).optional().default(""),
});

export async function GET() {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    return NextResponse.json(await listarDiagnostico());
  } catch (error) {
    return respuestaError(error, "leyendo el diagnóstico");
  }
}

/** Lo que manda el navegador: errores de la pantalla e intentos de guardado. */
export async function POST(req: NextRequest) {
  try {
    const usuario = await requerirUsuario();
    const entrada = await leerCuerpo(req, esquema);
    await registrarDiagnostico({ ...entrada, navegador: req.headers.get("user-agent") ?? "", usuarioId: usuario.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "registrando diagnóstico");
  }
}
