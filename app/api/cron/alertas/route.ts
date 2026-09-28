import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { respuestaError } from "@/lib/api";
import { revisarAlertas } from "@/lib/alertas/motor";

/**
 * Para correr la revisión desde afuera en hosting sin servidor permanente
 * (Vercel Cron, u otro programador). Exige el header
 * "Authorization: Bearer <CRON_SECRET>" — Vercel Cron lo manda solo.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  const recibido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  if (!secreto || recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const resultado = await revisarAlertas();
    return NextResponse.json({ ok: true, ...(resultado ?? { omitida: "Ya había otra revisión en curso." }) });
  } catch (error) {
    return respuestaError(error, "revisando alertas (cron)");
  }
}
