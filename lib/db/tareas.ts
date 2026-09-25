import { db } from "./client";
import { aIso, aIsoONull } from "@/lib/fechas";
import type { EstadoTarea, Tarea } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Tarea {
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    responsableId: row.responsable_id,
    responsableNombre: row.responsable_nombre ?? null,
    eventoId: row.evento_id,
    eventoNombre: row.evento_nombre ?? null,
    venceEn: aIsoONull(row.vence_en),
    estado: row.estado,
    creadoPorNombre: row.creado_por_nombre ?? null,
    creadoEn: aIso(row.creado_en),
  };
}

export interface TareaInput {
  titulo: string;
  descripcion: string;
  responsableId: number | null;
  eventoId: number | null;
  venceEn: string | null;
  estado: EstadoTarea;
}

export async function listarTareas(filtro: { responsableId?: number; eventoId?: number }): Promise<Tarea[]> {
  const sql = await db();
  const rows = await sql`
    SELECT t.*, r.nombre AS responsable_nombre, e.nombre AS evento_nombre, c.nombre AS creado_por_nombre
    FROM tareas t
    LEFT JOIN usuarios r ON r.id = t.responsable_id
    LEFT JOIN eventos e ON e.id = t.evento_id
    LEFT JOIN usuarios c ON c.id = t.creado_por
    WHERE (${filtro.responsableId ?? null}::int IS NULL OR t.responsable_id = ${filtro.responsableId ?? null})
      AND (${filtro.eventoId ?? null}::int IS NULL OR t.evento_id = ${filtro.eventoId ?? null})
    ORDER BY (t.estado = 'completada'), t.vence_en ASC NULLS LAST, t.id DESC
  `;
  return rows.map(mapRow);
}

export async function obtenerTarea(id: number): Promise<Tarea | null> {
  const sql = await db();
  const rows = await sql`
    SELECT t.*, r.nombre AS responsable_nombre, e.nombre AS evento_nombre, c.nombre AS creado_por_nombre
    FROM tareas t
    LEFT JOIN usuarios r ON r.id = t.responsable_id
    LEFT JOIN eventos e ON e.id = t.evento_id
    LEFT JOIN usuarios c ON c.id = t.creado_por
    WHERE t.id = ${id}
  `;
  return rows.length ? mapRow(rows[0]) : null;
}

export async function crearTarea(input: TareaInput, usuarioId: number): Promise<Tarea> {
  const sql = await db();
  const rows = await sql`
    INSERT INTO tareas (titulo, descripcion, responsable_id, evento_id, vence_en, estado, creado_por)
    VALUES (${input.titulo}, ${input.descripcion}, ${input.responsableId}, ${input.eventoId}, ${input.venceEn},
      ${input.estado}, ${usuarioId})
    RETURNING id
  `;
  return (await obtenerTarea(rows[0].id))!;
}

export async function actualizarTarea(id: number, input: TareaInput): Promise<Tarea | null> {
  const sql = await db();
  const rows = await sql`
    UPDATE tareas SET titulo = ${input.titulo}, descripcion = ${input.descripcion}, responsable_id = ${input.responsableId},
      evento_id = ${input.eventoId}, vence_en = ${input.venceEn}, estado = ${input.estado}, actualizado_en = now()
    WHERE id = ${id} RETURNING id
  `;
  return rows.length ? obtenerTarea(id) : null;
}

export async function cambiarEstadoTarea(id: number, estado: EstadoTarea): Promise<void> {
  const sql = await db();
  await sql`UPDATE tareas SET estado = ${estado}, actualizado_en = now() WHERE id = ${id}`;
}

export async function eliminarTarea(id: number): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM tareas WHERE id = ${id}`;
}
