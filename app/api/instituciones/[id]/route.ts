import { NextRequest, NextResponse } from "next/server";
import { idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { validarRepresentante } from "@/lib/acceso";
import { esGestor } from "@/lib/auth/permisos";
import { actualizarInstitucion, eliminarInstitucion } from "@/lib/db/instituciones";
import { esquemaInstitucion, UNICIDAD_INSTITUCION } from "@/lib/esquemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    const id = idDeParams((await params).id);
    const input = await leerCuerpo(req, esquemaInstitucion);
    await validarRepresentante(input.representanteId);
    const institucion = await actualizarInstitucion(id, input);
    if (!institucion) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    return NextResponse.json(institucion);
  } catch (error) {
    return respuestaError(error, "actualizando institución", UNICIDAD_INSTITUCION);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    await eliminarInstitucion(idDeParams((await params).id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "eliminando institución");
  }
}
