import { NextRequest, NextResponse } from "next/server";
import { idDeParams, requerirUsuario, respuestaError } from "@/lib/api";
import { eventoVisible } from "@/lib/acceso";
import { obtenerArchivo } from "@/lib/db/archivos";

/** Fotos y firmas: solo para quien puede ver el evento al que pertenecen. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await requerirUsuario();
    const archivo = await obtenerArchivo(idDeParams((await params).id));
    if (!archivo || archivo.eventoId === null) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    await eventoVisible(usuario, archivo.eventoId);
    return new NextResponse(new Uint8Array(archivo.datos), {
      headers: { "Content-Type": archivo.tipoMime, "Cache-Control": "private, max-age=86400" },
    });
  } catch (error) {
    return respuestaError(error, "leyendo archivo");
  }
}
