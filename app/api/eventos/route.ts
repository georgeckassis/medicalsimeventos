import { after, NextRequest, NextResponse } from "next/server";
import { leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { validarAsignado } from "@/lib/acceso";
import { esGestor } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { crearEvento, listarEventos, registrarHistorial } from "@/lib/db/eventos";
import { esquemaEvento } from "@/lib/esquemas";

/** ?desde=ISO&hasta=ISO — eventos que se superponen con ese rango (para el calendario). */
export async function GET(req: NextRequest) {
  try {
    const usuario = await requerirUsuario();
    const fecha = (clave: string) => {
      const v = req.nextUrl.searchParams.get(clave);
      return v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined;
    };
    const eventos = await listarEventos({
      desde: fecha("desde"),
      hasta: fecha("hasta"),
      usuario,
    });
    return NextResponse.json(eventos);
  } catch (error) {
    return respuestaError(error, "listando eventos");
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await requerirUsuario((u) => esGestor(u.rol));
    const input = await leerCuerpo(req, esquemaEvento);
    await validarAsignado(input.instructorId, "instructor");
    await validarAsignado(input.vendedorId, "vendedor");
    const id = await crearEvento(input, usuario.id);
    await registrarHistorial(id, usuario.id, "Creó el evento");
    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return respuestaError(error, "creando evento");
  }
}
