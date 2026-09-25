import { NextRequest, NextResponse } from "next/server";
import { idDeParams, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { eliminarAlumno } from "@/lib/db/alumnos";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; alumnoId: string }> }) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    const p = await params;
    await eliminarAlumno(idDeParams(p.id), idDeParams(p.alumnoId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "eliminando alumno");
  }
}
