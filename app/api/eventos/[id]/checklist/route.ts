import { after, NextRequest, NextResponse } from "next/server";
import { ErrorApi, idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { puedeTildar } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { eventoVisible } from "@/lib/acceso";
import { etapaCerrada, guardarCheck, obtenerItem, registrarHistorial } from "@/lib/db/eventos";
import { NOMBRE_ETAPA } from "@/lib/db/types";
import { esquemaCheck } from "@/lib/esquemas";

/**
 * Tildar (o destildar) un objeto en una etapa. Logística, chofer y el
 * encargado general pueden; el representante solo mira. Una vez que la etapa
 * se cerró con foto y firma ya no se puede tocar.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await requerirUsuario((u) => puedeTildar(u.rol));
    const evento = await eventoVisible(usuario, idDeParams((await params).id));
    const { itemId, etapa, cantidad } = await leerCuerpo(req, esquemaCheck);
    const item = await obtenerItem(evento.id, itemId);
    if (!item) throw new ErrorApi(404, "Ese objeto no está en la lista del evento.");
    if (await etapaCerrada(evento.id, etapa)) {
      throw new ErrorApi(409, `"${NOMBRE_ETAPA[etapa]}" ya se cerró con firma. Solo el encargado general puede reabrirla.`);
    }
    if (cantidad !== null && cantidad > item.cantidad) {
      throw new ErrorApi(400, `Se pidieron ${item.cantidad} de ${item.nombre}; no se puede tildar más que eso.`);
    }
    await guardarCheck(item.id, etapa, cantidad, usuario.id);
    const detalle =
      cantidad === null ? `Destildó ${item.nombre}` : `${item.nombre}: ${cantidad} de ${item.cantidad}${cantidad < item.cantidad ? " (incompleto)" : ""}`;
    await registrarHistorial(evento.id, usuario.id, NOMBRE_ETAPA[etapa], detalle);
    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "guardando el tilde");
  }
}
