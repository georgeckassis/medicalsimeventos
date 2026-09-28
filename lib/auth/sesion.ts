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

/** Aunque se use todos los días, una sesión dura como máximo 7 días: después hay que volver a entrar. */
const VIDA_MAXIMA_MS = 7 * 24 * 3600_000;

export interface DatosSesion {
  usuarioId: number;
  /** Tiene que coincidir con usuarios.sesion_version: al cambiar la contraseña o desactivar al usuario se incrementa y todas sus sesiones dejan de valer. */
  version: number;
  emitido: number;
}

/**
 * Token "<usuarioId>.<version>.<emitido>.<vence>.<firma>" firmado con HMAC.
 * El usuario, su rol y su versión de sesión se verifican siempre contra la base.
 */
export function crearTokenSesion(datos: { usuarioId: number; version: number; emitido?: number }): string {
  const emitido = datos.emitido ?? Date.now();
  const vence = Math.min(Date.now() + MAX_AGE_COOKIE * 1000, emitido + VIDA_MAXIMA_MS);
  const cuerpo = `${datos.usuarioId}.${datos.version}.${emitido}.${vence}`;
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function leerTokenSesion(token: string | undefined | null): DatosSesion | null {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 5) return null;
  const [id, version, emitido, vence, firma] = partes;
  const esperado = Buffer.from(firmar(`${id}.${version}.${emitido}.${vence}`));
  const recibido = Buffer.from(firma);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  const ahora = Date.now();
  if (!(Number(vence) > ahora) || !(Number(emitido) > ahora - VIDA_MAXIMA_MS)) return null;
  const usuarioId = Number(id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) return null;
  return { usuarioId, version: Number(version), emitido: Number(emitido) };
}

export const opcionesCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_COOKIE,
};
