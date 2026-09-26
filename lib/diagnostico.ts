/**
 * Manda al registro de diagnóstico algo que pasó en el navegador (errores de
 * la pantalla, intentos de guardado). No espera respuesta ni tira errores.
 */
export function reportar(tipo: string, mensaje: string, detalle = ""): void {
  try {
    void fetch("/api/diagnostico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, mensaje: mensaje.slice(0, 1000), detalle: detalle.slice(0, 4000), ruta: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // sin conexión o sin sesión: no hay dónde registrarlo
  }
}
