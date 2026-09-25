import { db } from "./client";
import { aIso, aIsoONull } from "@/lib/fechas";
import type { Alerta, Usuario } from "./types";

/**
 * Qué alertas ve cada uno: gestores todas; logística y chofer las de todos
 * los eventos más las de sus tareas; el representante solo las de eventos de
 * su institución más las de sus tareas.
 */
export async function listarAlertas(usuario: Usuario, opciones: { soloActivas: boolean; eventoId?: number }): Promise<Alerta[]> {
  const sql = await db();
  const gestor = usuario.rol === "superadmin" || usuario.rol === "general";
  const representante = usuario.rol === "representante";
  const rows = await sql`
    SELECT a.*, e.nombre AS evento_nombre, e.institucion_id, t.responsable_id
    FROM alertas a
    LEFT JOIN eventos e ON e.id = a.evento_id
    LEFT JOIN tareas t ON t.id = a.tarea_id
    WHERE (${!opciones.soloActivas} OR a.resuelta_en IS NULL)
      AND (${opciones.eventoId ?? null}::int IS NULL OR a.evento_id = ${opciones.eventoId ?? null})
      AND (
        ${gestor}
        OR (a.tarea_id IS NOT NULL AND t.responsable_id = ${usuario.id})
        OR (a.tarea_id IS NULL AND a.evento_id IS NOT NULL AND (NOT ${representante} OR e.institucion_id = ${usuario.institucionId ?? -1}))
      )
    ORDER BY a.resuelta_en IS NULL DESC, a.severidad = 'incumplimiento' DESC, a.creada_en DESC
    LIMIT 200
  `;
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    severidad: r.severidad,
    mensaje: r.mensaje,
    eventoId: r.evento_id,
    eventoNombre: r.evento_nombre ?? null,
    tareaId: r.tarea_id,
    creadaEn: aIso(r.creada_en),
    resueltaEn: aIsoONull(r.resuelta_en),
    notificacion: r.notificacion,
  }));
}

/** El encargado general la da por vista/aceptada: se cierra y no se vuelve a activar. */
export async function descartarAlerta(id: number): Promise<boolean> {
  const sql = await db();
  const rows = await sql`UPDATE alertas SET descartada = true, resuelta_en = COALESCE(resuelta_en, now()) WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
