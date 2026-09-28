import { after, NextResponse } from "next/server";
import { requerirUsuario, respuestaError } from "@/lib/api";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { listarAlertas } from "@/lib/db/alertas";
import { sinDatosInternos } from "@/lib/db/usuarios";

export async function GET() {
  try {
    const usuario = await requerirUsuario(undefined, { permitirSinCambiarPassword: true });
    if (usuario.debeCambiarPassword) {
      // Hasta que cambie la contraseña no ve nada más de la app.
      return NextResponse.json({ usuario: sinDatosInternos(usuario), alertasActivas: 0, incumplimientos: 0, debeCambiarPassword: true });
    }
    // Cada vez que alguien abre la app se aprovecha para revisar alertas
    // (después de responder, así no demora la pantalla).
    after(() => revisarAlertasSiCorresponde());
    const alertas = await listarAlertas(usuario, { soloActivas: true });
    return NextResponse.json({
      usuario: sinDatosInternos(usuario),
      alertasActivas: alertas.length,
      incumplimientos: alertas.filter((a) => a.severidad === "incumplimiento").length,
      debeCambiarPassword: false,
    });
  } catch (error) {
    return respuestaError(error, "leyendo la sesión");
  }
}
