import { db } from "./client";
import { aIso } from "@/lib/fechas";

export interface EntradaDiagnostico {
  id: number;
  creadoEn: string;
  tipo: string;
  mensaje: string;
  detalle: string;
  ruta: string;
  navegador: string;
  usuarioNombre: string | null;
}

/** Nunca tira error: si no se puede registrar, no tiene que romper lo que se estaba haciendo. */
export async function registrarDiagnostico(entrada: {
  tipo: string;
  mensaje: string;
  detalle?: string;
  ruta?: string;
  navegador?: string;
  usuarioId?: number | null;
}): Promise<void> {
  try {
    const sql = await db();
    await sql`
      INSERT INTO diagnostico (tipo, mensaje, detalle, ruta, navegador, usuario_id)
      VALUES (${entrada.tipo.slice(0, 50)}, ${entrada.mensaje.slice(0, 1000)}, ${(entrada.detalle ?? "").slice(0, 4000)},
        ${(entrada.ruta ?? "").slice(0, 300)}, ${(entrada.navegador ?? "").slice(0, 400)}, ${entrada.usuarioId ?? null})
    `;
    // Se guarda solo el último mes.
    if (Math.random() < 0.05) await sql`DELETE FROM diagnostico WHERE creado_en < now() - interval '30 days'`;
  } catch (error) {
    console.error("No se pudo registrar el diagnóstico:", error);
  }
}

export async function listarDiagnostico(limite = 150): Promise<EntradaDiagnostico[]> {
  const sql = await db();
  const rows = await sql`
    SELECT d.*, u.nombre AS usuario_nombre FROM diagnostico d LEFT JOIN usuarios u ON u.id = d.usuario_id
    ORDER BY d.creado_en DESC LIMIT ${limite}
  `;
  return rows.map((r) => ({
    id: r.id,
    creadoEn: aIso(r.creado_en),
    tipo: r.tipo,
    mensaje: r.mensaje,
    detalle: r.detalle,
    ruta: r.ruta,
    navegador: r.navegador,
    usuarioNombre: r.usuario_nombre ?? null,
  }));
}
