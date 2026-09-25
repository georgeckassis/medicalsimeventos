/** fetch contra la propia API: devuelve el JSON o tira un Error con el mensaje que mandó el servidor. */
export async function pedir<T = unknown>(url: string, opciones: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opciones.method ?? "GET",
    headers: opciones.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
  });
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/login")) {
    // Recarga completa a propósito: la sesión venció y hay que descartar todo el estado de la pantalla.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?from=${encodeURIComponent(window.location.pathname)}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  return data as T;
}

export function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido.";
}
