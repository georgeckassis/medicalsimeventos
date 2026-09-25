import { NextRequest, NextResponse } from "next/server";
import { idDeParams, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { descartarAlerta } from "@/lib/db/alertas";

/** El encargado general da una alerta por atendida (ej. un faltante ya justificado): no vuelve a aparecer. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    if (!(await descartarAlerta(idDeParams((await params).id)))) {
      return NextResponse.json({ error: "No encontrada." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "descartando alerta");
  }
}
