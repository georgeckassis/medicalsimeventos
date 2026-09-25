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
  };
}

export type InstitucionInput = Omit<Institucion, "id">;

export async function listarInstituciones(): Promise<Institucion[]> {
  const sql = await db();
  return (await sql`SELECT * FROM instituciones ORDER BY nombre`).map(mapRow);
}

export async function crearInstitucion(input: InstitucionInput): Promise<Institucion> {
  const sql = await db();
  const rows = await sql`
    INSERT INTO instituciones (nombre, direccion, contacto, telefono, email)
    VALUES (${input.nombre}, ${input.direccion}, ${input.contacto}, ${input.telefono}, ${input.email})
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function actualizarInstitucion(id: number, input: InstitucionInput): Promise<Institucion | null> {
  const sql = await db();
  const rows = await sql`
    UPDATE instituciones SET nombre = ${input.nombre}, direccion = ${input.direccion}, contacto = ${input.contacto},
      telefono = ${input.telefono}, email = ${input.email}
    WHERE id = ${id} RETURNING *
  `;
  return rows.length ? mapRow(rows[0]) : null;
}

export async function eliminarInstitucion(id: number): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM instituciones WHERE id = ${id}`;
}
