import { NextRequest, NextResponse } from "next/server";
import { leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esquemaInstitucion, UNICIDAD_INSTITUCION } from "@/lib/esquemas";
import { validarRepresentante } from "@/lib/acceso";
import { esGestor } from "@/lib/auth/permisos";
import { crearInstitucion, listarInstituciones } from "@/lib/db/instituciones";

export async function GET() {
  try {
    await requerirUsuario();
    return NextResponse.json(await listarInstituciones());
  } catch (error) {
    return respuestaError(error, "listando instituciones");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    const input = await leerCuerpo(req, esquemaInstitucion);
    await validarRepresentante(input.representanteId);
    return NextResponse.json(await crearInstitucion(input), { status: 201 });
  } catch (error) {
    return respuestaError(error, "creando institución", UNICIDAD_INSTITUCION);
  }
}
