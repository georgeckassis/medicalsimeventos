import { db } from "./client";
import type { Vehiculo } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Vehiculo {
  return { id: row.id, patente: row.patente, marca: row.marca, modelo: row.modelo, notas: row.notas, activo: row.activo };
}

export type VehiculoInput = Omit<Vehiculo, "id">;

export async function listarVehiculos(): Promise<Vehiculo[]> {
  const sql = await db();
  return (await sql`SELECT * FROM vehiculos ORDER BY activo DESC, patente`).map(mapRow);
}

export async function crearVehiculo(input: VehiculoInput): Promise<Vehiculo> {
  const sql = await db();
  const rows = await sql`
    INSERT INTO vehiculos (patente, marca, modelo, notas, activo)
    VALUES (${input.patente.toUpperCase()}, ${input.marca}, ${input.modelo}, ${input.notas}, ${input.activo})
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function actualizarVehiculo(id: number, input: VehiculoInput): Promise<Vehiculo | null> {
  const sql = await db();
  const rows = await sql`
    UPDATE vehiculos SET patente = ${input.patente.toUpperCase()}, marca = ${input.marca}, modelo = ${input.modelo},
      notas = ${input.notas}, activo = ${input.activo}
    WHERE id = ${id} RETURNING *
  `;
  return rows.length ? mapRow(rows[0]) : null;
}

export async function eliminarVehiculo(id: number): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM vehiculos WHERE id = ${id}`;
}
