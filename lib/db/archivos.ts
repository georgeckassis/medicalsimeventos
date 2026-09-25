import { db } from "./client";
import { ErrorApi } from "@/lib/api";

/** 3 MB: las fotos se achican en el celular antes de subirlas (components/CapturaFoto.tsx). */
const TAMANO_MAXIMO = 3 * 1024 * 1024;
const TIPOS_PERMITIDOS = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Fotos y firmas se guardan en la propia base (no en un servicio aparte) para
 * que la app funcione sin configurar nada más. Llegan como data URL
 * ("data:image/jpeg;base64,...") desde el canvas de firma o la cámara.
 */
export async function guardarDataUrl(dataUrl: string, usuarioId: number): Promise<number> {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m || !TIPOS_PERMITIDOS.has(m[1])) throw new ErrorApi(400, "La imagen no tiene un formato válido (PNG, JPG o WEBP).");
  const datos = Buffer.from(m[2], "base64");
  if (datos.length === 0) throw new ErrorApi(400, "La imagen está vacía.");
  if (datos.length > TAMANO_MAXIMO) throw new ErrorApi(400, "La imagen supera los 3 MB.");
  const sql = await db();
  const rows = await sql`INSERT INTO archivos (tipo_mime, datos, subido_por) VALUES (${m[1]}, ${datos}, ${usuarioId}) RETURNING id`;
  return rows[0].id;
}

/** Devuelve también el evento al que pertenece, para validar que quien lo pide lo pueda ver. */
export async function obtenerArchivo(id: number): Promise<{ tipoMime: string; datos: Buffer; eventoId: number | null } | null> {
  const sql = await db();
  const rows = await sql`
    SELECT a.tipo_mime, a.datos,
      COALESCE(
        (SELECT evento_id FROM evento_etapas WHERE firma_id = a.id OR foto_id = a.id LIMIT 1),
        (SELECT evento_id FROM validaciones_representante WHERE firma_id = a.id LIMIT 1)
      ) AS evento_id
    FROM archivos a WHERE a.id = ${id}
  `;
  return rows.length ? { tipoMime: rows[0].tipo_mime, datos: rows[0].datos, eventoId: rows[0].evento_id } : null;
}
