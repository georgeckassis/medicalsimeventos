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
