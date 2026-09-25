import { db } from "./client";
import type { Institucion } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Institucion {
  return {
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion,
    contacto: row.contacto,
    telefono: row.telefono,
    email: row.email,
    representanteId: row.representante_id ?? null,
    representanteNombre: row.representante_nombre ?? null,
  };
}

export type InstitucionInput = Omit<Institucion, "id" | "representanteNombre">;

export async function listarInstituciones(): Promise<Institucion[]> {
  const sql = await db();
  const rows = await sql`
    SELECT i.*, u.nombre AS representante_nombre
    FROM instituciones i LEFT JOIN usuarios u ON u.id = i.representante_id
    ORDER BY i.nombre
  `;
  return rows.map(mapRow);
}

async function obtenerInstitucion(id: number): Promise<Institucion | null> {
  const sql = await db();
  const rows = await sql`
    SELECT i.*, u.nombre AS representante_nombre
    FROM instituciones i LEFT JOIN usuarios u ON u.id = i.representante_id
    WHERE i.id = ${id}
  `;
  return rows.length ? mapRow(rows[0]) : null;
}

export async function crearInstitucion(input: InstitucionInput): Promise<Institucion> {
  const sql = await db();
  const rows = await sql`
    INSERT INTO instituciones (nombre, direccion, contacto, telefono, email, representante_id)
    VALUES (${input.nombre}, ${input.direccion}, ${input.contacto}, ${input.telefono}, ${input.email}, ${input.representanteId})
    RETURNING id
  `;
  return (await obtenerInstitucion(rows[0].id))!;
}

export async function actualizarInstitucion(id: number, input: InstitucionInput): Promise<Institucion | null> {
  const sql = await db();
  const rows = await sql`
    UPDATE instituciones SET nombre = ${input.nombre}, direccion = ${input.direccion}, contacto = ${input.contacto},
      telefono = ${input.telefono}, email = ${input.email}, representante_id = ${input.representanteId}
    WHERE id = ${id} RETURNING id
  `;
  return rows.length ? obtenerInstitucion(id) : null;
}

export async function eliminarInstitucion(id: number): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM instituciones WHERE id = ${id}`;
}
