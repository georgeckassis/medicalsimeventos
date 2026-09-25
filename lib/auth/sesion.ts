import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_SESION = "medicalsim_eventos_sesion";

/**
 * 8 horas de inactividad — el proxy renueva la cookie en cada pedido
 * (sliding expiry). Más largo que el panel interno porque logística y los
 * choferes usan la app desde el celular durante toda una jornada de evento.
 */
export const MAX_AGE_COOKIE = 60 * 60 * 8;

/**
 * SESSION_SECRET debería estar configurada; si falta, se deriva una clave de
 * DATABASE_URL (que también es secreta y solo vive en el servidor) para que
 * la app no quede inutilizable por un olvido en Vercel.
 */
function secreto(): string {
  const propio = process.env.SESSION_SECRET?.trim();
  if (propio) return propio;
  const base = process.env.DATABASE_URL || process.env.POSTGRES_URL || "medicalsim-eventos-dev";
  return createHash("sha256").update(`sesion:${base}`).digest("hex");
}

function firmar(mensaje: string): string {
  return createHmac("sha256", secreto()).update(mensaje).digest("hex");
}

/** Token "<usuarioId>.<vence>.<firma>" — el usuario y su rol se leen siempre de la base. */
export function crearTokenSesion(usuarioId: number): string {
  const vence = Date.now() + MAX_AGE_COOKIE * 1000;
  const cuerpo = `${usuarioId}.${vence}`;
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function leerTokenSesion(token: string | undefined | null): number | null {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [id, vence, firma] = partes;
  const esperado = Buffer.from(firmar(`${id}.${vence}`));
  const recibido = Buffer.from(firma);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  if (!(Number(vence) > Date.now())) return null;
  const usuarioId = Number(id);
  return Number.isInteger(usuarioId) && usuarioId > 0 ? usuarioId : null;
}

export const opcionesCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_COOKIE,
};
