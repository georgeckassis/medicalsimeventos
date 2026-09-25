import { NextRequest, NextResponse } from "next/server";
import { requerirUsuario, respuestaError } from "@/lib/api";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { listarAlertas } from "@/lib/db/alertas";

/** ?todas=1 incluye las ya resueltas (historial de alertas). */
export async function GET(req: NextRequest) {
  try {
    const usuario = await requerirUsuario();
    // Antes de mostrar, se revisa si hay algo nuevo (como mucho una vez por minuto).
    await revisarAlertasSiCorresponde();
    return NextResponse.json(await listarAlertas(usuario, { soloActivas: req.nextUrl.searchParams.get("todas") !== "1" }));
  } catch (error) {
    return respuestaError(error, "listando alertas");
  }
}
