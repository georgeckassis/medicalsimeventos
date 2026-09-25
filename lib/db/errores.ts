import postgres from "postgres";

/** Código SQLSTATE de Postgres para "violación de restricción única" — evita mostrar el error crudo de Postgres en la UI. */
const CODIGO_UNIQUE_VIOLATION = "23505";

export function esViolacionUnicidad(error: unknown, constraintName?: string): boolean {
  if (!(error instanceof postgres.PostgresError)) return false;
  if (error.code !== CODIGO_UNIQUE_VIOLATION) return false;
  return !constraintName || error.constraint_name === constraintName;
}

const CODIGOS_ERROR_CONEXION = new Set([
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

function esErrorDeConexion(error: unknown): boolean {
  const codigo = (error as { code?: string } | null)?.code;
  if (codigo && CODIGOS_ERROR_CONEXION.has(codigo)) return true;
  const mensaje = error instanceof Error ? error.message : "";
  return /CONNECT_TIMEOUT|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Connection terminated/i.test(mensaje);
}

/**
 * Traduce un error a un mensaje para mostrar en la UI — nunca el texto
 * crudo del driver de Postgres (ej. "write CONNECT_TIMEOUT
 * ep-xxx.neon.tech:5432"), que no dice nada útil para alguien que no es
 * programador. Un error de conexión suele ser Neon "despertando" la base
 * tras un rato sin uso (plan gratuito) — ya se reintenta solo una vez
 * (ver lib/db/client.ts), así que si esto se ve es porque también falló el
 * reintento.
 */
export function mensajeError(error: unknown, fallback = "Error desconocido."): string {
  if (esErrorDeConexion(error)) {
    return "No se pudo conectar con la base de datos — puede estar reactivándose tras un rato sin uso. Probá de nuevo en unos segundos.";
  }
  return error instanceof Error ? error.message : fallback;
}
