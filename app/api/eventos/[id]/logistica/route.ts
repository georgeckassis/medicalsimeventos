import { after, NextRequest, NextResponse } from "next/server";
import { ErrorApi, idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { puedeEditarLogistica } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { eventoVisible } from "@/lib/acceso";
import { actualizarLogistica, registrarHistorial } from "@/lib/db/eventos";
import { obtenerUsuario } from "@/lib/db/usuarios";
import { esquemaLogistica } from "@/lib/esquemas";
import { formatoFechaHora } from "@/lib/fechas";

/** Horarios de carga / salida / retiro / devolución, chofer y vehículo: los organiza logística. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await requerirUsuario((u) => puedeEditarLogistica(u.rol));
    const evento = await eventoVisible(usuario, idDeParams((await params).id));
    const input = await leerCuerpo(req, esquemaLogistica);

    if (input.choferId) {
      const chofer = await obtenerUsuario(input.choferId);
      if (!chofer || !chofer.activo || chofer.rol !== "chofer") throw new ErrorApi(400, "El chofer elegido no es válido.");
    }
    if (input.logisticaId) {
      const encargado = await obtenerUsuario(input.logisticaId);
      if (!encargado || !encargado.activo || encargado.rol !== "logistica") {
        throw new ErrorApi(400, "El encargado de logística elegido no es válido.");
      }
    }

    await actualizarLogistica(evento.id, input);

    const cambios: string[] = [];
    const horario = (nombre: string, antes: string | null, despues: string | null) => {
      if ((antes ?? null) !== (despues ?? null)) cambios.push(`${nombre}: ${formatoFechaHora(antes)} → ${formatoFechaHora(despues)}`);
    };
    horario("Carga en depósito", evento.cargaDepositoEn, input.cargaDepositoEn);
    horario("Salida", evento.salidaEn, input.salidaEn);
    horario("Retiro", evento.retiroEn, input.retiroEn);
    horario("Devolución", evento.devolucionEn, input.devolucionEn);
    if (evento.choferId !== input.choferId) cambios.push("Cambió el chofer");
    if (evento.vehiculoId !== input.vehiculoId) cambios.push("Cambió el vehículo");
    if (evento.logisticaId !== input.logisticaId) cambios.push("Cambió el encargado de logística");
    if (cambios.length) await registrarHistorial(evento.id, usuario.id, "Actualizó la logística", cambios.join(" · "));

    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "guardando la logística");
  }
}
