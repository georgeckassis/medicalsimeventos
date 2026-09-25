import { NextResponse } from "next/server";
import { requerirUsuario, respuestaError } from "@/lib/api";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";

/** Botón "Revisar ahora" de la pantalla de alertas. */
export async function POST() {
  try {
    await requerirUsuario();
    await revisarAlertasSiCorresponde(true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "revisando alertas");
  }
}
