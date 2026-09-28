import { db } from "./client";

/**
 * Contador de intentos por clave (ej. "login-email:ana@x.com") dentro de una
 * ventana de tiempo. Vive en la base para que funcione igual con varias
 * instancias del servidor.
 */
export async function intentosActuales(clave: string, ventanaSegundos: number): Promise<number> {
  const sql = await db();
  const rows = await sql`
    SELECT cantidad FROM limites WHERE clave = ${clave} AND desde > now() - ${ventanaSegundos} * interval '1 second'
  `;
  return rows.length ? Number(rows[0].cantidad) : 0;
}

/** Suma un intento y devuelve el total dentro de la ventana (si la ventana venció, arranca de nuevo). */
export async function sumarIntento(clave: string, ventanaSegundos: number): Promise<number> {
  const sql = await db();
  const rows = await sql`
    INSERT INTO limites (clave, desde, cantidad) VALUES (${clave}, now(), 1)
    ON CONFLICT (clave) DO UPDATE SET
      cantidad = CASE WHEN limites.desde <= now() - ${ventanaSegundos} * interval '1 second' THEN 1 ELSE limites.cantidad + 1 END,
      desde = CASE WHEN limites.desde <= now() - ${ventanaSegundos} * interval '1 second' THEN now() ELSE limites.desde END
    RETURNING cantidad
  `;
  if (Math.random() < 0.02) await sql`DELETE FROM limites WHERE desde < now() - interval '2 days'`;
  return Number(rows[0].cantidad);
}

export async function borrarIntentos(clave: string): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM limites WHERE clave = ${clave}`;
}

/** IP de quien hace el pedido (Vercel la pone en x-real-ip / x-forwarded-for). */
export function ipDe(req: Request): string {
  return req.headers.get("x-real-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
}
