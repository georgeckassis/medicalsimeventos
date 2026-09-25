import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorApi, idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { revisarAlertasSiCorresponde } from "@/lib/alertas/motor";
import { eventoVisible } from "@/lib/acceso";
import { eliminarItem, guardarItem, hayEtapasCerradas, obtenerItem, registrarHistorial } from "@/lib/db/eventos";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

async function preparar(ctx: Ctx) {
  const usuario = await requerirUsuario((u) => esGestor(u.rol));
  const p = await ctx.params;
  const evento = await eventoVisible(usuario, idDeParams(p.id));
  const item = await obtenerItem(evento.id, idDeParams(p.itemId));
  if (!item) throw new ErrorApi(404, "Ese objeto no está en la lista del evento.");
  if (await hayEtapasCerradas(evento.id)) {
    throw new ErrorApi(409, "La carga ya se cerró con firma. Reabrí la etapa para modificar la lista de objetos.");
  }
  return { usuario, evento, item };
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { usuario, evento, item } = await preparar(ctx);
    const { cantidad } = await leerCuerpo(req, z.object({ cantidad: z.number().int().positive("La cantidad tiene que ser mayor a 0.") }));
    await guardarItem(evento.id, item.inventarioId, cantidad);
    await registrarHistorial(evento.id, usuario.id, "Cambió la cantidad", `${item.nombre}: ${item.cantidad} → ${cantidad}`);
    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "cambiando la cantidad");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { usuario, evento, item } = await preparar(ctx);
    await eliminarItem(evento.id, item.id);
    await registrarHistorial(evento.id, usuario.id, "Quitó de la lista", `${item.cantidad} × ${item.nombre}`);
    after(() => revisarAlertasSiCorresponde(true));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "quitando objeto del evento");
  }
}
