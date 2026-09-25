import { db } from "./client";
import type { ItemInventario } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): ItemInventario {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    categoria: row.categoria,
    stock: Number(row.stock),
    activo: row.activo,
  };
}

export type ItemInventarioInput = Omit<ItemInventario, "id">;

export async function listarInventario(): Promise<ItemInventario[]> {
  const sql = await db();
  return (await sql`SELECT * FROM inventario ORDER BY activo DESC, categoria, nombre`).map(mapRow);
}

export async function crearItemInventario(input: ItemInventarioInput): Promise<ItemInventario> {
  const sql = await db();
  const rows = await sql`
    INSERT INTO inventario (nombre, descripcion, categoria, stock, activo)
    VALUES (${input.nombre}, ${input.descripcion}, ${input.categoria}, ${input.stock}, ${input.activo})
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function actualizarItemInventario(id: number, input: ItemInventarioInput): Promise<ItemInventario | null> {
  const sql = await db();
  const rows = await sql`
    UPDATE inventario SET nombre = ${input.nombre}, descripcion = ${input.descripcion}, categoria = ${input.categoria},
      stock = ${input.stock}, activo = ${input.activo}
    WHERE id = ${id} RETURNING *
  `;
  return rows.length ? mapRow(rows[0]) : null;
}

/** Si el objeto ya se usó en algún evento no se borra (queda el registro): se desactiva. */
export async function eliminarItemInventario(id: number): Promise<"eliminado" | "desactivado"> {
  const sql = await db();
  const usado = await sql`SELECT 1 FROM evento_items WHERE inventario_id = ${id} LIMIT 1`;
  if (usado.length) {
    await sql`UPDATE inventario SET activo = false WHERE id = ${id}`;
    return "desactivado";
  }
  await sql`DELETE FROM inventario WHERE id = ${id}`;
  return "eliminado";
}
