import postgres from "postgres";
import { hashPassword } from "@/lib/auth/password";

let cachedSql: postgres.Sql | null = null;
let schemaReady: Promise<void> | null = null;

function getConnectionString(): string {
  // La integración de Vercel con Neon expone varias variables equivalentes;
  // probamos las más comunes en orden.
  const value =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED;

  if (!value) {
    throw new Error(
      "Falta la variable de entorno DATABASE_URL (o POSTGRES_URL). Verificá que la base de datos esté conectada al proyecto en Vercel → Storage.",
    );
  }
  return value;
}

function getSql(): postgres.Sql {
  if (!cachedSql) {
    const url = getConnectionString();
    // Una base local (npm run dev contra Postgres en la propia máquina) no
    // tiene SSL; Neon/Vercel sí lo exigen.
    const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
    cachedSql = postgres(url, { ssl: local ? false : "require", connect_timeout: 8 });
  }
  return cachedSql;
}

async function crearTablas(sql: postgres.ISql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS instituciones (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      direccion TEXT NOT NULL DEFAULT '',
      contacto TEXT NOT NULL DEFAULT '',
      telefono TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      telefono TEXT NOT NULL DEFAULT '',
      dni TEXT NOT NULL DEFAULT '',
      institucion_id INTEGER REFERENCES instituciones(id) ON DELETE SET NULL,
      activo BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vehiculos (
      id SERIAL PRIMARY KEY,
      patente TEXT NOT NULL UNIQUE,
      marca TEXT NOT NULL DEFAULT '',
      modelo TEXT NOT NULL DEFAULT '',
      notas TEXT NOT NULL DEFAULT '',
      activo BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS inventario (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT NOT NULL DEFAULT '',
      categoria TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0,
      activo BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS eventos (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      tipo_capacitacion TEXT NOT NULL DEFAULT '',
      inicio TIMESTAMPTZ NOT NULL,
      fin TIMESTAMPTZ NOT NULL,
      sede TEXT NOT NULL DEFAULT '',
      direccion TEXT NOT NULL DEFAULT '',
      institucion_id INTEGER REFERENCES instituciones(id) ON DELETE SET NULL,
      cantidad_alumnos INTEGER NOT NULL DEFAULT 0,
      instructores TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'planificado',
      observaciones TEXT NOT NULL DEFAULT '',
      armado_en TIMESTAMPTZ,
      desarmado_en TIMESTAMPTZ,
      emails_notificacion TEXT NOT NULL DEFAULT '',
      -- Datos que carga el encargado de logística
      logistica_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      carga_deposito_en TIMESTAMPTZ,
      salida_en TIMESTAMPTZ,
      retiro_en TIMESTAMPTZ,
      devolucion_en TIMESTAMPTZ,
      chofer_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      vehiculo_id INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL,
      token_inscripcion TEXT NOT NULL UNIQUE,
      creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS evento_items (
      id SERIAL PRIMARY KEY,
      evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      inventario_id INTEGER NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      UNIQUE (evento_id, inventario_id)
    )
  `;

  // Un tilde por objeto y por etapa (carga en depósito, descarga en sede,
  // carga para el retiro, devolución al depósito).
  await sql`
    CREATE TABLE IF NOT EXISTS evento_checks (
      evento_item_id INTEGER NOT NULL REFERENCES evento_items(id) ON DELETE CASCADE,
      etapa TEXT NOT NULL,
      cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (evento_item_id, etapa)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS archivos (
      id SERIAL PRIMARY KEY,
      tipo_mime TEXT NOT NULL,
      datos BYTEA NOT NULL,
      subido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Cierre de cada etapa con foto + firma de quien carga o descarga.
  await sql`
    CREATE TABLE IF NOT EXISTS evento_etapas (
      evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      etapa TEXT NOT NULL,
      cerrada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      cerrada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      nombre_firmante TEXT NOT NULL,
      firma_id INTEGER NOT NULL REFERENCES archivos(id),
      foto_id INTEGER REFERENCES archivos(id),
      observaciones TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (evento_id, etapa)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS validaciones_representante (
      id SERIAL PRIMARY KEY,
      evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      firma_id INTEGER NOT NULL REFERENCES archivos(id),
      observaciones TEXT NOT NULL DEFAULT '',
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS alumnos (
      id SERIAL PRIMARY KEY,
      evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      dni TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      telefono TEXT NOT NULL DEFAULT '',
      institucion TEXT NOT NULL DEFAULT '',
      especialidad TEXT NOT NULL DEFAULT '',
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (evento_id, dni)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tareas (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL DEFAULT '',
      responsable_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
      vence_en TIMESTAMPTZ,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // "clave" identifica la condición que disparó la alerta (ej. carga sin
  // tildar del evento 12 a las 8:00) para no duplicarla en cada revisión.
  await sql`
    CREATE TABLE IF NOT EXISTS alertas (
      id SERIAL PRIMARY KEY,
      clave TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL,
      severidad TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
      tarea_id INTEGER REFERENCES tareas(id) ON DELETE CASCADE,
      creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      resuelta_en TIMESTAMPTZ,
      -- Descartada a mano por el encargado general: no se vuelve a activar.
      descartada BOOLEAN NOT NULL DEFAULT false,
      notificacion TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS historial (
      id SERIAL PRIMARY KEY,
      evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      accion TEXT NOT NULL,
      detalle TEXT NOT NULL DEFAULT '',
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS eventos_inicio_idx ON eventos (inicio)`;
  await sql`CREATE INDEX IF NOT EXISTS historial_evento_idx ON historial (evento_id, creado_en DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS alertas_activas_idx ON alertas (resuelta_en, creada_en DESC)`;

  await crearSuperadmin(sql);
}

/**
 * Acceso propio de MedicalSim para resolver cosas mientras se pone en marcha
 * la app. Solo se crea si todavía no existe — cambiar la contraseña desde
 * "Mi cuenta" no se pisa en el próximo arranque.
 */
async function crearSuperadmin(sql: postgres.ISql): Promise<void> {
  const email = (process.env.SUPERADMIN_EMAIL || "george@medicalsim.com.ar").trim().toLowerCase();
  const existe = await sql`SELECT 1 FROM usuarios WHERE email = ${email}`;
  if (existe.length > 0) return;
  const password = process.env.SUPERADMIN_PASSWORD || "admin";
  await sql`
    INSERT INTO usuarios (email, nombre, rol, password_hash)
    VALUES (${email}, 'MedicalSim', 'superadmin', ${await hashPassword(password)})
  `;
}

const REINTENTOS_CONEXION = 1;
const ESPERA_ENTRE_REINTENTOS_MS = 1500;
/** Evita que dos instancias creen las tablas a la vez al arrancar en frío. */
const LOCK_SETUP_ESQUEMA = 72_450_001;

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function db(): Promise<postgres.Sql> {
  const sql = getSql();
  if (!schemaReady) {
    schemaReady = (async () => {
      let ultimoError: unknown;
      for (let intento = 0; intento <= REINTENTOS_CONEXION; intento++) {
        try {
          await sql.begin(async (tx) => {
            await tx`SELECT pg_advisory_xact_lock(${LOCK_SETUP_ESQUEMA})`;
            await crearTablas(tx);
          });
          return;
        } catch (error) {
          ultimoError = error;
          if (intento < REINTENTOS_CONEXION) await esperar(ESPERA_ENTRE_REINTENTOS_MS * (intento + 1));
        }
      }
      throw ultimoError;
    })();
  }
  try {
    await schemaReady;
  } catch (error) {
    schemaReady = null;
    throw error;
  }
  return sql;
}
