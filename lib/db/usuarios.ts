import { db } from "./client";
import { hashPassword } from "@/lib/auth/password";
import type { Rol, Usuario } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Usuario {
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    rol: row.rol,
    telefono: row.telefono,
    dni: row.dni,
    institucionId: row.institucion_id,
    institucionNombre: row.institucion_nombre ?? null,
    activo: row.activo,
  };
}

export async function obtenerUsuario(id: number): Promise<Usuario | null> {
  const sql = await db();
  const rows = await sql`
    SELECT u.*, i.nombre AS institucion_nombre
    FROM usuarios u LEFT JOIN instituciones i ON i.id = u.institucion_id
    WHERE u.id = ${id}
  `;
  return rows.length ? mapRow(rows[0]) : null;
}

export async function obtenerUsuarioConHashPorEmail(email: string): Promise<(Usuario & { passwordHash: string }) | null> {
  const sql = await db();
  const rows = await sql`
    SELECT u.*, i.nombre AS institucion_nombre
    FROM usuarios u LEFT JOIN instituciones i ON i.id = u.institucion_id
    WHERE u.email = ${email.trim().toLowerCase()}
  `;
  return rows.length ? { ...mapRow(rows[0]), passwordHash: rows[0].password_hash } : null;
}

export async function obtenerHash(id: number): Promise<string | null> {
  const sql = await db();
  const rows = await sql`SELECT password_hash FROM usuarios WHERE id = ${id}`;
  return rows.length ? rows[0].password_hash : null;
}

/** El superadmin nunca aparece en los listados que ven los demás usuarios. */
export async function listarUsuarios(opciones: { incluirSuperadmin: boolean; rol?: Rol; soloActivos?: boolean }): Promise<Usuario[]> {
  const sql = await db();
  const rows = await sql`
    SELECT u.*, i.nombre AS institucion_nombre
    FROM usuarios u LEFT JOIN instituciones i ON i.id = u.institucion_id
    WHERE (${opciones.incluirSuperadmin} OR u.rol <> 'superadmin')
      AND (${opciones.rol ?? null}::text IS NULL OR u.rol = ${opciones.rol ?? null})
      AND (${!opciones.soloActivos} OR u.activo)
    ORDER BY u.activo DESC, u.nombre ASC
  `;
  return rows.map(mapRow);
}

export interface UsuarioInput {
  email: string;
  nombre: string;
  rol: Rol;
  telefono: string;
  dni: string;
  institucionId: number | null;
  activo: boolean;
}

export async function crearUsuario(input: UsuarioInput & { password: string }): Promise<Usuario> {
  const sql = await db();
  const rows = await sql`
    INSERT INTO usuarios (email, nombre, rol, password_hash, telefono, dni, institucion_id, activo)
    VALUES (${input.email.toLowerCase()}, ${input.nombre}, ${input.rol}, ${await hashPassword(input.password)},
            ${input.telefono}, ${input.dni}, ${input.institucionId}, ${input.activo})
    RETURNING id
  `;
  return (await obtenerUsuario(rows[0].id))!;
}

export async function actualizarUsuario(id: number, input: UsuarioInput, password?: string): Promise<Usuario | null> {
  const sql = await db();
  const rows = await sql`
    UPDATE usuarios SET
      email = ${input.email.toLowerCase()}, nombre = ${input.nombre}, rol = ${input.rol},
      telefono = ${input.telefono}, dni = ${input.dni}, institucion_id = ${input.institucionId}, activo = ${input.activo}
    WHERE id = ${id} AND rol <> 'superadmin'
    RETURNING id
  `;
  if (!rows.length) return null;
  if (password) await cambiarPassword(id, password);
  return obtenerUsuario(id);
}

export async function cambiarPassword(id: number, password: string): Promise<void> {
  const sql = await db();
  await sql`UPDATE usuarios SET password_hash = ${await hashPassword(password)} WHERE id = ${id}`;
}

/** Emails y teléfonos para notificar: todos los usuarios activos con alguno de esos roles o ids. */
export async function contactosNotificacion(roles: Rol[], ids: number[]): Promise<Array<{ email: string; telefono: string }>> {
  const sql = await db();
  const rows = await sql`
    SELECT email, telefono FROM usuarios
    WHERE activo AND rol <> 'superadmin' AND (rol = ANY(${roles}) OR id = ANY(${ids}))
  `;
  return rows.map((r) => ({ email: r.email as string, telefono: r.telefono as string }));
}
