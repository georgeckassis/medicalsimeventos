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
    debeCambiarPassword: row.debe_cambiar_password ?? false,
    sesionVersion: Number(row.sesion_version ?? 0),
  };
}

/** Lo que se muestra a otros usuarios: sin datos internos de la sesión. */
export function sinDatosInternos(u: Usuario): Usuario {
  const publico = { ...u };
  delete publico.sesionVersion;
  return publico;
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
    INSERT INTO usuarios (email, nombre, rol, password_hash, telefono, dni, institucion_id, activo, debe_cambiar_password)
    VALUES (${input.email.toLowerCase()}, ${input.nombre}, ${input.rol}, ${await hashPassword(input.password)},
            ${input.telefono}, ${input.dni}, ${input.institucionId}, ${input.activo}, true)
    RETURNING id
  `;
  return (await obtenerUsuario(rows[0].id))!;
}

export async function actualizarUsuario(id: number, input: UsuarioInput, password?: string): Promise<Usuario | null> {
  const sql = await db();
  const rows = await sql`
    UPDATE usuarios SET
      email = ${input.email.toLowerCase()}, nombre = ${input.nombre}, rol = ${input.rol},
      telefono = ${input.telefono}, dni = ${input.dni}, institucion_id = ${input.institucionId}, activo = ${input.activo},
      -- Al desactivarlo o cambiarle el rol se cierran sus sesiones abiertas.
      sesion_version = sesion_version + CASE WHEN activo <> ${input.activo} OR rol <> ${input.rol} THEN 1 ELSE 0 END
    WHERE id = ${id} AND rol <> 'superadmin'
    RETURNING id
  `;
  if (!rows.length) return null;
  // Contraseña puesta por un administrador: es temporal, la persona la tiene que cambiar al entrar.
  if (password) await cambiarPassword(id, password, { temporal: true });
  return obtenerUsuario(id);
}

/**
 * Cambia la contraseña y cierra todas las sesiones abiertas de ese usuario
 * (devuelve la nueva versión de sesión, para volver a emitir la propia).
 */
export async function cambiarPassword(id: number, password: string, opciones: { temporal: boolean }): Promise<number> {
  const sql = await db();
  const rows = await sql`
    UPDATE usuarios SET password_hash = ${await hashPassword(password)}, debe_cambiar_password = ${opciones.temporal},
      sesion_version = sesion_version + 1
    WHERE id = ${id} RETURNING sesion_version
  `;
  return Number(rows[0]?.sesion_version ?? 0);
}

/** "Cerrar sesión en todos los dispositivos". */
export async function cerrarSesiones(id: number): Promise<number> {
  const sql = await db();
  const rows = await sql`UPDATE usuarios SET sesion_version = sesion_version + 1 WHERE id = ${id} RETURNING sesion_version`;
  return Number(rows[0]?.sesion_version ?? 0);
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
