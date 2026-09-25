import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import { db } from "./client";
import { aIso, aIsoONull } from "@/lib/fechas";
import type {
  Usuario,
  CierreEtapa,
  Etapa,
  EstadoEvento,
  Evento,
  EventoItem,
  EventoResumen,
  EntradaHistorial,
  ValidacionRepresentante,
} from "./types";

/**
 * Condición SQL (sobre eventos "e" e instituciones "i") con los eventos que
 * puede ver cada rol. Tiene que coincidir con puedeVerEvento (lib/acceso.ts).
 */
export function filtroVisibilidad(sql: postgres.Sql, u: Usuario) {
  switch (u.rol) {
    case "representante":
      return sql`e.institucion_id = ${u.institucionId ?? -1}`;
    case "instructor":
      return sql`e.instructor_id = ${u.id}`;
    case "vendedor":
      return sql`(e.vendedor_id = ${u.id} OR i.vendedor_id = ${u.id})`;
    default:
      return sql`true`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapResumen(row: any): EventoResumen {
  return {
    id: row.id,
    nombre: row.nombre,
    tipoCapacitacion: row.tipo_capacitacion,
    inicio: aIso(row.inicio),
    fin: aIso(row.fin),
    sede: row.sede,
    institucionId: row.institucion_id,
    institucionNombre: row.institucion_nombre ?? null,
    instructorId: row.instructor_id ?? null,
    vendedorId: row.vendedor_id ?? null,
    institucionVendedorId: row.institucion_vendedor_id ?? null,
    cantidadAlumnos: Number(row.cantidad_alumnos),
    estado: row.estado,
    armadoEn: aIsoONull(row.armado_en),
    desarmadoEn: aIsoONull(row.desarmado_en),
    cargaDepositoEn: aIsoONull(row.carga_deposito_en),
    salidaEn: aIsoONull(row.salida_en),
    retiroEn: aIsoONull(row.retiro_en),
    devolucionEn: aIsoONull(row.devolucion_en),
    alertasActivas: Number(row.alertas_activas ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvento(row: any): Evento {
  return {
    ...mapResumen(row),
    direccion: row.direccion,
    instructores: row.instructores,
    observaciones: row.observaciones,
    emailsNotificacion: row.emails_notificacion,
    instructorNombre: row.instructor_nombre ?? null,
    vendedorNombre: row.vendedor_nombre ?? null,
    logisticaId: row.logistica_id,
    logisticaNombre: row.logistica_nombre ?? null,
    choferId: row.chofer_id,
    choferNombre: row.chofer_nombre ?? null,
    choferDni: row.chofer_dni ?? null,
    choferTelefono: row.chofer_telefono ?? null,
    vehiculoId: row.vehiculo_id,
    vehiculoPatente: row.vehiculo_patente ?? null,
    vehiculoDescripcion: row.vehiculo_patente ? `${row.vehiculo_marca} ${row.vehiculo_modelo}`.trim() : null,
    tokenInscripcion: row.token_inscripcion,
    alumnosInscriptos: Number(row.alumnos_inscriptos ?? 0),
  };
}

/**
 * Eventos que se superponen con [desde, hasta), filtrados según lo que puede
 * ver quien pregunta (ver lib/acceso.ts): el representante de la institución
 * solo los de su institución; el instructor los que dicta; el representante
 * de ventas los que tiene a cargo o los de las instituciones que atiende.
 */
export async function listarEventos(filtro: { desde?: string; hasta?: string; usuario: Usuario }): Promise<EventoResumen[]> {
  const sql = await db();
  const u = filtro.usuario;
  const rows = await sql`
    SELECT e.*, i.nombre AS institucion_nombre, i.vendedor_id AS institucion_vendedor_id,
      (SELECT count(*) FROM alertas a WHERE a.evento_id = e.id AND a.resuelta_en IS NULL) AS alertas_activas
    FROM eventos e LEFT JOIN instituciones i ON i.id = e.institucion_id
    WHERE (${filtro.hasta ?? null}::timestamptz IS NULL OR e.inicio < ${filtro.hasta ?? null})
      AND (${filtro.desde ?? null}::timestamptz IS NULL OR e.fin >= ${filtro.desde ?? null})
      AND ${filtroVisibilidad(sql, u)}
    ORDER BY e.inicio ASC
  `;
  return rows.map(mapResumen);
}

export async function obtenerEvento(id: number): Promise<Evento | null> {
  const sql = await db();
  const rows = await sql`
    SELECT e.*, i.nombre AS institucion_nombre, i.vendedor_id AS institucion_vendedor_id,
      l.nombre AS logistica_nombre, ins.nombre AS instructor_nombre, ven.nombre AS vendedor_nombre,
      c.nombre AS chofer_nombre, c.dni AS chofer_dni, c.telefono AS chofer_telefono,
      v.patente AS vehiculo_patente, v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo,
      (SELECT count(*) FROM alertas a WHERE a.evento_id = e.id AND a.resuelta_en IS NULL) AS alertas_activas,
      (SELECT count(*) FROM alumnos al WHERE al.evento_id = e.id) AS alumnos_inscriptos
    FROM eventos e
    LEFT JOIN instituciones i ON i.id = e.institucion_id
    LEFT JOIN usuarios l ON l.id = e.logistica_id
    LEFT JOIN usuarios ins ON ins.id = e.instructor_id
    LEFT JOIN usuarios ven ON ven.id = e.vendedor_id
    LEFT JOIN usuarios c ON c.id = e.chofer_id
    LEFT JOIN vehiculos v ON v.id = e.vehiculo_id
    WHERE e.id = ${id}
  `;
  return rows.length ? mapEvento(rows[0]) : null;
}

export async function obtenerEventoPorToken(token: string) {
  const sql = await db();
  const rows = await sql`
    SELECT e.id, e.nombre, e.inicio, e.fin, e.sede, e.estado, i.nombre AS institucion_nombre
    FROM eventos e LEFT JOIN instituciones i ON i.id = e.institucion_id
    WHERE e.token_inscripcion = ${token}
  `;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id as number,
    nombre: r.nombre as string,
    inicio: aIso(r.inicio),
    fin: aIso(r.fin),
    sede: r.sede as string,
    estado: r.estado as EstadoEvento,
    institucionNombre: (r.institucion_nombre as string | null) ?? null,
  };
}

export interface EventoInput {
  nombre: string;
  tipoCapacitacion: string;
  inicio: string;
  fin: string;
  sede: string;
  direccion: string;
  institucionId: number | null;
  instructorId: number | null;
  vendedorId: number | null;
  cantidadAlumnos: number;
  instructores: string;
  estado: EstadoEvento;
  observaciones: string;
  armadoEn: string | null;
  desarmadoEn: string | null;
  emailsNotificacion: string;
}

export async function crearEvento(input: EventoInput, usuarioId: number): Promise<number> {
  const sql = await db();
  const rows = await sql`
    INSERT INTO eventos (nombre, tipo_capacitacion, inicio, fin, sede, direccion, institucion_id, instructor_id, vendedor_id, cantidad_alumnos,
      instructores, estado, observaciones, armado_en, desarmado_en, emails_notificacion, token_inscripcion, creado_por)
    VALUES (${input.nombre}, ${input.tipoCapacitacion}, ${input.inicio}, ${input.fin}, ${input.sede}, ${input.direccion},
      ${input.institucionId}, ${input.instructorId}, ${input.vendedorId}, ${input.cantidadAlumnos}, ${input.instructores}, ${input.estado}, ${input.observaciones},
      ${input.armadoEn}, ${input.desarmadoEn}, ${input.emailsNotificacion}, ${randomBytes(12).toString("base64url")}, ${usuarioId})
    RETURNING id
  `;
  return rows[0].id;
}

export async function actualizarEvento(id: number, input: EventoInput): Promise<boolean> {
  const sql = await db();
  const rows = await sql`
    UPDATE eventos SET
      nombre = ${input.nombre}, tipo_capacitacion = ${input.tipoCapacitacion}, inicio = ${input.inicio}, fin = ${input.fin},
      sede = ${input.sede}, direccion = ${input.direccion}, institucion_id = ${input.institucionId},
      instructor_id = ${input.instructorId}, vendedor_id = ${input.vendedorId},
      cantidad_alumnos = ${input.cantidadAlumnos}, instructores = ${input.instructores}, estado = ${input.estado},
      observaciones = ${input.observaciones}, armado_en = ${input.armadoEn}, desarmado_en = ${input.desarmadoEn},
      emails_notificacion = ${input.emailsNotificacion}, actualizado_en = now()
    WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

export async function eliminarEvento(id: number): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM eventos WHERE id = ${id}`;
}

export interface LogisticaInput {
  logisticaId: number | null;
  cargaDepositoEn: string | null;
  salidaEn: string | null;
  retiroEn: string | null;
  devolucionEn: string | null;
  choferId: number | null;
  vehiculoId: number | null;
}

export async function actualizarLogistica(id: number, input: LogisticaInput): Promise<boolean> {
  const sql = await db();
  const rows = await sql`
    UPDATE eventos SET
      logistica_id = ${input.logisticaId}, carga_deposito_en = ${input.cargaDepositoEn}, salida_en = ${input.salidaEn},
      retiro_en = ${input.retiroEn}, devolucion_en = ${input.devolucionEn}, chofer_id = ${input.choferId},
      vehiculo_id = ${input.vehiculoId}, actualizado_en = now()
    WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

// ---------- Lista de objetos y checklist ----------

export async function listarItems(eventoId: number): Promise<EventoItem[]> {
  const sql = await db();
  // "comprometidoOtros": cuánto del mismo objeto piden otros eventos no
  // cancelados cuya ventana (desde la carga en depósito hasta la devolución)
  // se superpone con la de este evento — para avisar si no alcanza el stock.
  const rows = await sql`
    WITH ventana AS (
      SELECT id,
        COALESCE(carga_deposito_en, armado_en, inicio) AS desde,
        COALESCE(devolucion_en, desarmado_en, fin) AS hasta
      FROM eventos WHERE estado <> 'cancelado'
    ),
    este AS (SELECT * FROM ventana WHERE id = ${eventoId})
    SELECT ei.id, ei.inventario_id, ei.cantidad, inv.nombre, inv.categoria, inv.stock,
      COALESCE((
        SELECT sum(o.cantidad) FROM evento_items o
        JOIN ventana v ON v.id = o.evento_id
        CROSS JOIN este
        WHERE o.inventario_id = ei.inventario_id AND o.evento_id <> ${eventoId}
          AND v.desde < este.hasta AND v.hasta > este.desde
      ), 0) AS comprometido_otros,
      COALESCE((
        SELECT json_agg(json_build_object('etapa', c.etapa, 'cantidad', c.cantidad, 'usuario', u.nombre, 'en', c.actualizado_en))
        FROM evento_checks c LEFT JOIN usuarios u ON u.id = c.usuario_id
        WHERE c.evento_item_id = ei.id
      ), '[]'::json) AS checks
    FROM evento_items ei JOIN inventario inv ON inv.id = ei.inventario_id
    WHERE ei.evento_id = ${eventoId}
    ORDER BY inv.categoria, inv.nombre
  `;
  return rows.map((r) => ({
    id: r.id,
    inventarioId: r.inventario_id,
    nombre: r.nombre,
    categoria: r.categoria,
    cantidad: Number(r.cantidad),
    stock: Number(r.stock),
    comprometidoOtros: Number(r.comprometido_otros),
    checks: Object.fromEntries(
      (r.checks as Array<{ etapa: Etapa; cantidad: number; usuario: string | null; en: string }>).map((c) => [
        c.etapa,
        { cantidad: Number(c.cantidad), usuarioNombre: c.usuario, actualizadoEn: aIso(c.en) },
      ]),
    ),
  }));
}

/** Si el objeto ya está en la lista, se reemplaza la cantidad. */
export async function guardarItem(eventoId: number, inventarioId: number, cantidad: number): Promise<void> {
  const sql = await db();
  await sql`
    INSERT INTO evento_items (evento_id, inventario_id, cantidad) VALUES (${eventoId}, ${inventarioId}, ${cantidad})
    ON CONFLICT (evento_id, inventario_id) DO UPDATE SET cantidad = EXCLUDED.cantidad
  `;
}

export async function obtenerItem(eventoId: number, itemId: number) {
  const sql = await db();
  const rows = await sql`
    SELECT ei.id, ei.cantidad, ei.inventario_id, inv.nombre FROM evento_items ei JOIN inventario inv ON inv.id = ei.inventario_id
    WHERE ei.id = ${itemId} AND ei.evento_id = ${eventoId}
  `;
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id as number, inventarioId: r.inventario_id as number, cantidad: Number(r.cantidad), nombre: r.nombre as string };
}

export async function eliminarItem(eventoId: number, itemId: number): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM evento_items WHERE id = ${itemId} AND evento_id = ${eventoId}`;
}

/** cantidad null = destildar. */
export async function guardarCheck(itemId: number, etapa: Etapa, cantidad: number | null, usuarioId: number): Promise<void> {
  const sql = await db();
  if (cantidad === null) {
    await sql`DELETE FROM evento_checks WHERE evento_item_id = ${itemId} AND etapa = ${etapa}`;
    return;
  }
  await sql`
    INSERT INTO evento_checks (evento_item_id, etapa, cantidad, usuario_id) VALUES (${itemId}, ${etapa}, ${cantidad}, ${usuarioId})
    ON CONFLICT (evento_item_id, etapa) DO UPDATE SET cantidad = EXCLUDED.cantidad, usuario_id = EXCLUDED.usuario_id, actualizado_en = now()
  `;
}

// ---------- Cierre de etapas (foto + firma) ----------

export async function listarCierres(eventoId: number): Promise<CierreEtapa[]> {
  const sql = await db();
  const rows = await sql`
    SELECT ee.*, u.nombre AS cerrada_por_nombre FROM evento_etapas ee LEFT JOIN usuarios u ON u.id = ee.cerrada_por
    WHERE ee.evento_id = ${eventoId}
  `;
  return rows.map((r) => ({
    etapa: r.etapa,
    cerradaEn: aIso(r.cerrada_en),
    cerradaPorNombre: r.cerrada_por_nombre ?? null,
    nombreFirmante: r.nombre_firmante,
    firmaId: r.firma_id,
    fotoId: r.foto_id,
    observaciones: r.observaciones,
  }));
}

export async function etapaCerrada(eventoId: number, etapa: Etapa): Promise<boolean> {
  const sql = await db();
  const rows = await sql`SELECT 1 FROM evento_etapas WHERE evento_id = ${eventoId} AND etapa = ${etapa}`;
  return rows.length > 0;
}

export async function hayEtapasCerradas(eventoId: number): Promise<boolean> {
  const sql = await db();
  const rows = await sql`SELECT 1 FROM evento_etapas WHERE evento_id = ${eventoId} LIMIT 1`;
  return rows.length > 0;
}

export async function cerrarEtapa(datos: {
  eventoId: number;
  etapa: Etapa;
  usuarioId: number;
  nombreFirmante: string;
  firmaId: number;
  fotoId: number | null;
  observaciones: string;
}): Promise<void> {
  const sql = await db();
  await sql`
    INSERT INTO evento_etapas (evento_id, etapa, cerrada_por, nombre_firmante, firma_id, foto_id, observaciones)
    VALUES (${datos.eventoId}, ${datos.etapa}, ${datos.usuarioId}, ${datos.nombreFirmante}, ${datos.firmaId},
      ${datos.fotoId}, ${datos.observaciones})
  `;
}

export async function reabrirEtapa(eventoId: number, etapa: Etapa): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM evento_etapas WHERE evento_id = ${eventoId} AND etapa = ${etapa}`;
}

// ---------- Validación del representante ----------

export async function listarValidaciones(eventoId: number): Promise<ValidacionRepresentante[]> {
  const sql = await db();
  const rows = await sql`
    SELECT v.*, u.nombre AS usuario_nombre FROM validaciones_representante v LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.evento_id = ${eventoId} ORDER BY v.creado_en DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    usuarioNombre: r.usuario_nombre ?? null,
    firmaId: r.firma_id,
    observaciones: r.observaciones,
    creadoEn: aIso(r.creado_en),
  }));
}

export async function crearValidacion(eventoId: number, usuarioId: number, firmaId: number, observaciones: string): Promise<void> {
  const sql = await db();
  await sql`
    INSERT INTO validaciones_representante (evento_id, usuario_id, firma_id, observaciones)
    VALUES (${eventoId}, ${usuarioId}, ${firmaId}, ${observaciones})
  `;
}

// ---------- Historial ----------

export async function registrarHistorial(eventoId: number | null, usuarioId: number | null, accion: string, detalle = ""): Promise<void> {
  const sql = await db();
  await sql`INSERT INTO historial (evento_id, usuario_id, accion, detalle) VALUES (${eventoId}, ${usuarioId}, ${accion}, ${detalle})`;
}

export async function listarHistorial(eventoId: number): Promise<EntradaHistorial[]> {
  const sql = await db();
  const rows = await sql`
    SELECT h.*, u.nombre AS usuario_nombre FROM historial h LEFT JOIN usuarios u ON u.id = h.usuario_id
    WHERE h.evento_id = ${eventoId} ORDER BY h.creado_en DESC LIMIT 300
  `;
  return rows.map((r) => ({
    id: r.id,
    usuarioNombre: r.usuario_nombre ?? null,
    accion: r.accion,
    detalle: r.detalle,
    creadoEn: aIso(r.creado_en),
  }));
}
