import { after, NextResponse } from "next/server";
import { requerirUsuario, respuestaError } from "@/lib/api";
import { verificarPassword } from "@/lib/auth/password";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { listarAlertas } from "@/lib/db/alertas";
import { obtenerHash } from "@/lib/db/usuarios";

export async function GET() {
  try {
    const usuario = await requerirUsuario();
    // Cada vez que alguien abre la app se aprovecha para revisar alertas
    // (después de responder, así no demora la pantalla).
    after(() => revisarAlertasSiCorresponde());
    const alertas = await listarAlertas(usuario, { soloActivas: true });
    const hash = await obtenerHash(usuario.id);
    const passwordInicial = usuario.rol === "superadmin" && hash !== null && (await verificarPassword("admin", hash));
    return NextResponse.json({
      usuario,
      alertasActivas: alertas.length,
      incumplimientos: alertas.filter((a) => a.severidad === "incumplimiento").length,
      passwordInicial,
    });
  } catch (error) {
    return respuestaError(error, "leyendo la sesión");
  }
}
