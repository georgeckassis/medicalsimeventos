import { NextResponse } from "next/server";
import { requerirUsuario, respuestaError } from "@/lib/api";
import { puedeEditarLogistica } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";

/** Botón "Revisar ahora" de la pantalla de alertas. */
export async function POST() {
  try {
    await requerirUsuario((u) => puedeEditarLogistica(u.rol));
    await revisarAlertasSiCorresponde(true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "revisando alertas");
  }
}
