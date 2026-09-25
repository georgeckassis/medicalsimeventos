import { db } from "./client";
import { aIso } from "@/lib/fechas";
import type { Alumno } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Alumno {
  return {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    dni: row.dni,
    email: row.email,
    telefono: row.telefono,
    institucion: row.institucion,
    especialidad: row.especialidad,
    creadoEn: aIso(row.creado_en),
  };
}

export type AlumnoInput = Omit<Alumno, "id" | "creadoEn">;

export async function listarAlumnos(eventoId: number): Promise<Alumno[]> {
  const sql = await db();
  return (await sql`SELECT * FROM alumnos WHERE evento_id = ${eventoId} ORDER BY apellido, nombre`).map(mapRow);
}

/** Si el mismo DNI se inscribe dos veces en el mismo evento, se actualizan sus datos en vez de duplicarlo. */
export async function inscribirAlumno(eventoId: number, input: AlumnoInput): Promise<Alumno> {
  const sql = await db();
  const rows = await sql`
    INSERT INTO alumnos (evento_id, nombre, apellido, dni, email, telefono, institucion, especialidad)
    VALUES (${eventoId}, ${input.nombre}, ${input.apellido}, ${input.dni}, ${input.email}, ${input.telefono},
      ${input.institucion}, ${input.especialidad})
    ON CONFLICT (evento_id, dni) DO UPDATE SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido,
      email = EXCLUDED.email, telefono = EXCLUDED.telefono, institucion = EXCLUDED.institucion,
      especialidad = EXCLUDED.especialidad
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function eliminarAlumno(eventoId: number, alumnoId: number): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM alumnos WHERE id = ${alumnoId} AND evento_id = ${eventoId}`;
}
