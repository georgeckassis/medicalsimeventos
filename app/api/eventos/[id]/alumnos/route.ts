import { NextRequest, NextResponse } from "next/server";
import { idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { eventoVisible } from "@/lib/acceso";
import { inscribirAlumno, listarAlumnos } from "@/lib/db/alumnos";
import { esquemaAlumno } from "@/lib/esquemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const usuario = await requerirUsuario();
    const evento = await eventoVisible(usuario, idDeParams((await params).id));
    return NextResponse.json(await listarAlumnos(evento.id));
  } catch (error) {
    return respuestaError(error, "listando alumnos");
  }
}

/** Carga manual (además del formulario por QR), para quien no tenga celular. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const usuario = await requerirUsuario((u) => esGestor(u.rol));
    const evento = await eventoVisible(usuario, idDeParams((await params).id));
    const alumno = await inscribirAlumno(evento.id, await leerCuerpo(req, esquemaAlumno));
    return NextResponse.json(alumno, { status: 201 });
  } catch (error) {
    return respuestaError(error, "cargando alumno");
  }
}
