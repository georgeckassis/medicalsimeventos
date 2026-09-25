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
    vendedorId: row.vendedor_id ?? null,
    vendedorNombre: row.vendedor_nombre ?? null,
  };
}

export type InstitucionInput = Omit<Institucion, "id" | "vendedorNombre">;

export async function listarInstituciones(): Promise<Institucion[]> {
  const sql = await db();
  const rows = await sql`
    SELECT i.*, u.nombre AS vendedor_nombre
    FROM instituciones i LEFT JOIN usuarios u ON u.id = i.vendedor_id
    ORDER BY i.nombre
  `;
  return rows.map(mapRow);
}

async function obtenerInstitucion(id: number): Promise<Institucion | null> {
  const sql = await db();
  const rows = await sql`
    SELECT i.*, u.nombre AS vendedor_nombre
    FROM instituciones i LEFT JOIN usuarios u ON u.id = i.vendedor_id
    WHERE i.id = ${id}
  `;
  return rows.length ? mapRow(rows[0]) : null;
}

export async function crearInstitucion(input: InstitucionInput): Promise<Institucion> {
  const sql = await db();
  const rows = await sql`
    INSERT INTO instituciones (nombre, direccion, contacto, telefono, email, vendedor_id)
    VALUES (${input.nombre}, ${input.direccion}, ${input.contacto}, ${input.telefono}, ${input.email}, ${input.vendedorId})
    RETURNING id
  `;
  return (await obtenerInstitucion(rows[0].id))!;
}

export async function actualizarInstitucion(id: number, input: InstitucionInput): Promise<Institucion | null> {
  const sql = await db();
  const rows = await sql`
    UPDATE instituciones SET nombre = ${input.nombre}, direccion = ${input.direccion}, contacto = ${input.contacto},
      telefono = ${input.telefono}, email = ${input.email}, vendedor_id = ${input.vendedorId}
    WHERE id = ${id} RETURNING id
  `;
  return rows.length ? obtenerInstitucion(id) : null;
}

export async function eliminarInstitucion(id: number): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM instituciones WHERE id = ${id}`;
}
