import { after, NextRequest, NextResponse } from "next/server";
import { ErrorApi, idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { puedeTildar } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { eventoVisible } from "@/lib/acceso";
import { guardarDataUrl } from "@/lib/db/archivos";
import { cerrarEtapa, etapaCerrada, listarItems, registrarHistorial } from "@/lib/db/eventos";
import { esViolacionUnicidad } from "@/lib/db/errores";
import { ETAPAS, NOMBRE_ETAPA, type Etapa } from "@/lib/db/types";
import { esquemaCierreEtapa } from "@/lib/esquemas";

function etapaDeParams(valor: string): Etapa {
  if (!(ETAPAS as readonly string[]).includes(valor)) throw new ErrorApi(400, "Etapa inválida.");
  return valor as Etapa;
}

/**
 * Cierra una etapa con la firma (y foto) de quien cargó o descargó. Si
 * quedan objetos sin tildar hay que explicar por qué en observaciones; el
 * motor de alertas avisa del faltante a los encargados.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; etapa: string }> }) {
  try {
    const usuario = await requerirUsuario((u) => puedeTildar(u.rol));
    const p = await params;
    const evento = await eventoVisible(usuario, idDeParams(p.id));
    const etapa = etapaDeParams(p.etapa);
    const input = await leerCuerpo(req, esquemaCierreEtapa);

    if (await etapaCerrada(evento.id, etapa)) throw new ErrorApi(409, "Esta etapa ya está cerrada.");
    const items = await listarItems(evento.id);
    if (items.length === 0) throw new ErrorApi(400, "El evento no tiene objetos cargados en la lista.");
    const faltantes = items.filter((i) => (i.checks[etapa]?.cantidad ?? 0) < i.cantidad);
    if (faltantes.length && !input.observaciones) {
      throw new ErrorApi(
        400,
        `Faltan tildar: ${faltantes.map((i) => i.nombre).join(", ")}. Para cerrar igual, explicá el motivo en observaciones.`,
      );
    }

    const firmaId = await guardarDataUrl(input.firma, usuario.id);
    const fotoId = input.foto ? await guardarDataUrl(input.foto, usuario.id) : null;
    await cerrarEtapa({
      eventoId: evento.id,
      etapa,
      usuarioId: usuario.id,
      nombreFirmante: input.nombreFirmante,
      firmaId,
      fotoId,
      observaciones: input.observaciones,
    });
    await registrarHistorial(
      evento.id,
      usuario.id,
      `Cerró "${NOMBRE_ETAPA[etapa]}"`,
      `Firmó ${input.nombreFirmante}${faltantes.length ? ` — con faltantes: ${faltantes.map((i) => i.nombre).join(", ")}` : ""}${
        input.observaciones ? ` — ${input.observaciones}` : ""
      }`,
    );
    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json({ ok: true, faltantes: faltantes.length });
  } catch (error) {
    if (esViolacionUnicidad(error)) return NextResponse.json({ error: "Esta etapa ya está cerrada." }, { status: 409 });
    return respuestaError(error, "cerrando la etapa");
  }
}
