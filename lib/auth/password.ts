import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: string, keylen: number) => Promise<Buffer>;
const LARGO_CLAVE = 64;

/** Formato guardado: "scrypt$<salt>$<hash>" — nunca se guarda la contraseña en texto plano. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, LARGO_CLAVE);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verificarPassword(password: string, guardado: string): Promise<boolean> {
  const [algoritmo, salt, hashHex] = guardado.split("$");
  if (algoritmo !== "scrypt" || !salt || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const hash = await scrypt(password, salt, esperado.length);
  return hash.length === esperado.length && timingSafeEqual(hash, esperado);
}

const COMUNES = new Set([
  "12345678", "123456789", "1234567890", "password", "contraseña", "contrasena", "qwerty123", "11111111",
  "00000000", "abcd1234", "admin123", "password1", "medicalsim", "icomsalud", "iloveyou",
]);

/** Devuelve el problema de la contraseña nueva, o null si está bien. */
export function problemaPassword(password: string, email = ""): string | null {
  if (password.length < 8) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (password.length > 200) return "La contraseña es demasiado larga.";
  if (!/[a-zA-ZñÑ]/.test(password) || !/\d/.test(password)) return "La contraseña tiene que tener letras y números.";
  const baja = password.toLowerCase();
  if (COMUNES.has(baja)) return "Esa contraseña es muy común; elegí otra.";
  const usuarioMail = email.split("@")[0]?.toLowerCase();
  if (usuarioMail && usuarioMail.length >= 3 && baja.includes(usuarioMail)) return "La contraseña no puede contener tu mail.";
  return null;
}

/** Hash de relleno para comparar aunque el mail no exista (así el tiempo de respuesta no revela qué mails existen). */
let hashRelleno: Promise<string> | null = null;
export function hashDeRelleno(): Promise<string> {
  hashRelleno ??= hashPassword(randomBytes(16).toString("hex"));
  return hashRelleno;
}
