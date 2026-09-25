import { after, NextRequest, NextResponse } from "next/server";
import { ErrorApi, idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { eventoVisible } from "@/lib/acceso";
import { guardarItem, hayEtapasCerradas, registrarHistorial } from "@/lib/db/eventos";
import { listarInventario } from "@/lib/db/inventario";
import { esquemaItemEvento } from "@/lib/esquemas";

/** Solo el encargado general arma la lista de objetos del evento. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await requerirUsuario((u) => esGestor(u.rol));
    const evento = await eventoVisible(usuario, idDeParams((await params).id));
    const { inventarioId, cantidad } = await leerCuerpo(req, esquemaItemEvento);
    if (await hayEtapasCerradas(evento.id)) {
      throw new ErrorApi(409, "La carga ya se cerró con firma. Reabrí la etapa para modificar la lista de objetos.");
    }
    const objeto = (await listarInventario()).find((i) => i.id === inventarioId && i.activo);
    if (!objeto) throw new ErrorApi(400, "Ese objeto no está en el inventario.");
    await guardarItem(evento.id, inventarioId, cantidad);
    await registrarHistorial(evento.id, usuario.id, "Agregó a la lista", `${cantidad} × ${objeto.nombre}`);
    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return respuestaError(error, "agregando objeto al evento");
  }
}
