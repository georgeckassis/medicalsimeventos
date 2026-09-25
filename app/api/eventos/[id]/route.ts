import { after, NextRequest, NextResponse } from "next/server";
import { idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { eventoVisible, validarAsignado } from "@/lib/acceso";
import { esGestor, puedeEditarLogistica, puedeTildar, puedeValidarComoRepresentante } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { listarAlertas } from "@/lib/db/alertas";
import {
  actualizarEvento,
  eliminarEvento,
  listarCierres,
  listarItems,
  listarValidaciones,
  registrarHistorial,
} from "@/lib/db/eventos";
import { esquemaEvento } from "@/lib/esquemas";

type Ctx = { params: Promise<{ id: string }> };

/** Todo lo que necesita la pantalla del evento en un solo pedido. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const usuario = await requerirUsuario();
    const evento = await eventoVisible(usuario, idDeParams((await params).id));
    const [items, cierres, validaciones, alertas] = await Promise.all([
      listarItems(evento.id),
      listarCierres(evento.id),
      listarValidaciones(evento.id),
      listarAlertas(usuario, { soloActivas: true, eventoId: evento.id }),
    ]);
    return NextResponse.json({
      evento,
      items,
      cierres,
      validaciones,
      alertas,
      permisos: {
        editarEvento: esGestor(usuario.rol),
        editarLogistica: puedeEditarLogistica(usuario.rol),
        tildar: puedeTildar(usuario.rol),
        validar: puedeValidarComoRepresentante(usuario.rol),
      },
    });
  } catch (error) {
    return respuestaError(error, "obteniendo el evento");
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const usuario = await requerirUsuario((u) => esGestor(u.rol));
    const id = idDeParams((await params).id);
    const input = await leerCuerpo(req, esquemaEvento);
    await validarAsignado(input.instructorId, "instructor");
    await validarAsignado(input.vendedorId, "vendedor");
    if (!(await actualizarEvento(id, input))) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    await registrarHistorial(id, usuario.id, "Editó los datos del evento");
    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "actualizando el evento");
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    await eliminarEvento(idDeParams((await params).id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "eliminando el evento");
  }
}
