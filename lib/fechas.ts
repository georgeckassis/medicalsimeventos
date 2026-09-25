/**
 * Todas las fechas se guardan en UTC (TIMESTAMPTZ) y se muestran / cargan en
 * hora de Argentina, sin importar la zona horaria del servidor o del
 * celular. Argentina no tiene horario de verano: siempre UTC-3.
 */
export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
const OFFSET = "-03:00";

/** "2026-10-01T10:00" (input datetime-local, hora Argentina) → ISO UTC. */
export function localAIso(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(`${valor.length === 16 ? `${valor}:00` : valor}${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function partes(iso: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return p as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

/** ISO → "2026-10-01T10:00" para un input datetime-local. */
export function isoALocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = partes(iso);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** ISO → "2026-10-01" (día en Argentina). */
export function diaLocal(iso: string): string {
  const p = partes(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

export function formatoFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HORARIA,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatoHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_HORARIA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
}

export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_HORARIA, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

export function aIso(valor: unknown): string {
  return valor instanceof Date ? valor.toISOString() : new Date(String(valor)).toISOString();
}

export function aIsoONull(valor: unknown): string | null {
  return valor === null || valor === undefined ? null : aIso(valor);
}
