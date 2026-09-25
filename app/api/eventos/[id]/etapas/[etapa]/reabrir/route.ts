import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorApi, idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { eventoVisible } from "@/lib/acceso";
import { etapaCerrada, reabrirEtapa, registrarHistorial } from "@/lib/db/eventos";
import { ETAPAS, NOMBRE_ETAPA, type Etapa } from "@/lib/db/types";

/** Solo el encargado general reabre una etapa firmada, y el motivo queda en el historial. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; etapa: string }> }) {
  try {
    const usuario = await requerirUsuario((u) => esGestor(u.rol));
    const p = await params;
    const evento = await eventoVisible(usuario, idDeParams(p.id));
    if (!(ETAPAS as readonly string[]).includes(p.etapa)) throw new ErrorApi(400, "Etapa inválida.");
    const etapa = p.etapa as Etapa;
    const { motivo } = await leerCuerpo(req, z.object({ motivo: z.string().trim().min(1, "Indicá el motivo para reabrir.") }));
    if (!(await etapaCerrada(evento.id, etapa))) throw new ErrorApi(409, "Esta etapa no está cerrada.");
    await reabrirEtapa(evento.id, etapa);
    await registrarHistorial(evento.id, usuario.id, `Reabrió "${NOMBRE_ETAPA[etapa]}"`, motivo);
    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "reabriendo la etapa");
  }
}
