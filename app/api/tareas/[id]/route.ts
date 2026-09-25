import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorApi, idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { registrarHistorial } from "@/lib/db/eventos";
import { actualizarTarea, cambiarEstadoTarea, eliminarTarea, obtenerTarea } from "@/lib/db/tareas";
import { ESTADOS_TAREA, NOMBRE_ESTADO_TAREA } from "@/lib/db/types";
import { esquemaTarea } from "@/lib/esquemas";

type Ctx = { params: Promise<{ id: string }> };

/**
 * El encargado general edita todo; el responsable de la tarea solo puede
 * cambiarle el estado (pendiente / en progreso / completada / bloqueada).
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const usuario = await requerirUsuario();
    const id = idDeParams((await params).id);
    const tarea = await obtenerTarea(id);
    if (!tarea) throw new ErrorApi(404, "Tarea no encontrada.");

    if (esGestor(usuario.rol)) {
      const actualizada = await actualizarTarea(id, await leerCuerpo(req, esquemaTarea));
      after(() => revisarAlertasSiCorresponde(true));
      return NextResponse.json(actualizada);
    }
    if (tarea.responsableId !== usuario.id) throw new ErrorApi(403, "Solo podés cambiar el estado de tus propias tareas.");
    const { estado } = await leerCuerpo(req, z.object({ estado: z.enum(ESTADOS_TAREA) }));
    await cambiarEstadoTarea(id, estado);
    if (tarea.eventoId) {
      await registrarHistorial(tarea.eventoId, usuario.id, "Actualizó una tarea", `"${tarea.titulo}": ${NOMBRE_ESTADO_TAREA[estado]}`);
    }
    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json(await obtenerTarea(id));
  } catch (error) {
    return respuestaError(error, "actualizando tarea");
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    await eliminarTarea(idDeParams((await params).id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "eliminando tarea");
  }
}
