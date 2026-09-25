import { NextRequest, NextResponse } from "next/server";
import { idDeParams, requerirUsuario, respuestaError } from "@/lib/api";
import { eventoVisible } from "@/lib/acceso";
import { listarHistorial } from "@/lib/db/eventos";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await requerirUsuario();
    const evento = await eventoVisible(usuario, idDeParams((await params).id));
    return NextResponse.json(await listarHistorial(evento.id));
  } catch (error) {
    return respuestaError(error, "leyendo el historial");
  }
}
