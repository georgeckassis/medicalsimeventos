import { after, NextRequest, NextResponse } from "next/server";
import { ErrorApi, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { obtenerEvento } from "@/lib/db/eventos";
import { crearTarea, listarTareas } from "@/lib/db/tareas";
import { obtenerUsuario } from "@/lib/db/usuarios";
import { esquemaTarea } from "@/lib/esquemas";

/** El encargado general ve todas (o ?mias=1); el resto solo las que tiene asignadas. */
export async function GET(req: NextRequest) {
  try {
    const usuario = await requerirUsuario();
    const soloMias = !esGestor(usuario.rol) || req.nextUrl.searchParams.get("mias") === "1";
    const eventoId = Number(req.nextUrl.searchParams.get("eventoId")) || undefined;
    return NextResponse.json(await listarTareas({ responsableId: soloMias ? usuario.id : undefined, eventoId }));
  } catch (error) {
    return respuestaError(error, "listando tareas");
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await requerirUsuario((u) => esGestor(u.rol));
    const input = await leerCuerpo(req, esquemaTarea);
    if (input.responsableId && !(await obtenerUsuario(input.responsableId))?.activo) {
      throw new ErrorApi(400, "El responsable elegido no es válido.");
    }
    if (input.eventoId && !(await obtenerEvento(input.eventoId))) throw new ErrorApi(400, "El evento elegido no existe.");
    const tarea = await crearTarea(input, usuario.id);
    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json(tarea, { status: 201 });
  } catch (error) {
    return respuestaError(error, "creando tarea");
  }
}
