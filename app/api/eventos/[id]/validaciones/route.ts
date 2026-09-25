import { NextRequest, NextResponse } from "next/server";
import { idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { puedeValidarComoRepresentante } from "@/lib/auth/permisos";
import { eventoVisible } from "@/lib/acceso";
import { guardarDataUrl } from "@/lib/db/archivos";
import { crearValidacion, registrarHistorial } from "@/lib/db/eventos";
import { esquemaValidacion } from "@/lib/esquemas";

/** El representante firma que revisó el evento y está al tanto. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await requerirUsuario((u) => puedeValidarComoRepresentante(u.rol));
    const evento = await eventoVisible(usuario, idDeParams((await params).id));
    const { firma, observaciones } = await leerCuerpo(req, esquemaValidacion);
    const firmaId = await guardarDataUrl(firma, usuario.id);
    await crearValidacion(evento.id, usuario.id, firmaId, observaciones);
    await registrarHistorial(evento.id, usuario.id, "Validó el evento como representante", observaciones);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return respuestaError(error, "guardando la validación");
  }
}
