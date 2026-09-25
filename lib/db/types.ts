export const ROLES = ["superadmin", "general", "logistica", "chofer", "instructor", "vendedor", "representante"] as const;
export type Rol = (typeof ROLES)[number];
/** Roles que se pueden asignar desde la pantalla de usuarios (superadmin no). */
export const ROLES_ASIGNABLES = ["general", "logistica", "chofer", "instructor", "vendedor", "representante"] as const;

export const NOMBRE_ROL: Record<Rol, string> = {
  superadmin: "Super admin",
  general: "Encargado general",
  logistica: "Encargado de logística",
  chofer: "Chofer",
  instructor: "Instructor",
  vendedor: "Representante de ventas",
  representante: "Representante de la institución",
};

export const ESTADOS_EVENTO = ["planificado", "confirmado", "en_curso", "finalizado", "cancelado"] as const;
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number];
export const NOMBRE_ESTADO_EVENTO: Record<EstadoEvento, string> = {
  planificado: "Planificado",
  confirmado: "Confirmado",
  en_curso: "En curso",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const ETAPAS = ["carga_deposito", "descarga_sede", "carga_retiro", "devolucion_deposito"] as const;
export type Etapa = (typeof ETAPAS)[number];
export const NOMBRE_ETAPA: Record<Etapa, string> = {
  carga_deposito: "Carga en depósito",
  descarga_sede: "Descarga en la sede",
  carga_retiro: "Carga para el retiro",
  devolucion_deposito: "Devolución al depósito",
};

export const ESTADOS_TAREA = ["pendiente", "en_progreso", "completada", "bloqueada"] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];
export const NOMBRE_ESTADO_TAREA: Record<EstadoTarea, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  bloqueada: "Bloqueada",
};

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  telefono: string;
  dni: string;
  institucionId: number | null;
  institucionNombre: string | null;
  activo: boolean;
}

export interface Institucion {
  id: number;
  nombre: string;
  direccion: string;
  contacto: string;
  telefono: string;
  email: string;
  /** Representante de ventas de MedicalSim que atiende esta institución. */
  vendedorId: number | null;
  vendedorNombre: string | null;
}

export interface Vehiculo {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  notas: string;
  activo: boolean;
}

export interface ItemInventario {
  id: number;
  nombre: string;
  descripcion: string;
  categoria: string;
  stock: number;
  activo: boolean;
}

export interface EventoResumen {
  id: number;
  nombre: string;
  tipoCapacitacion: string;
  inicio: string;
  fin: string;
  sede: string;
  institucionId: number | null;
  institucionNombre: string | null;
  /** Instructor de MedicalSim a cargo del evento. */
  instructorId: number | null;
  /** Representante de ventas de MedicalSim a cargo del evento. */
  vendedorId: number | null;
  /** Representante de ventas que atiende la institución del evento. */
  institucionVendedorId: number | null;
  cantidadAlumnos: number;
  estado: EstadoEvento;
  armadoEn: string | null;
  desarmadoEn: string | null;
  cargaDepositoEn: string | null;
  salidaEn: string | null;
  retiroEn: string | null;
  devolucionEn: string | null;
  alertasActivas: number;
}

export interface Evento extends EventoResumen {
  direccion: string;
  instructores: string;
  observaciones: string;
  emailsNotificacion: string;
  instructorNombre: string | null;
  vendedorNombre: string | null;
  logisticaId: number | null;
  logisticaNombre: string | null;
  choferId: number | null;
  choferNombre: string | null;
  choferDni: string | null;
  choferTelefono: string | null;
  vehiculoId: number | null;
  vehiculoPatente: string | null;
  vehiculoDescripcion: string | null;
  tokenInscripcion: string;
  alumnosInscriptos: number;
}

export interface CheckEtapa {
  cantidad: number;
  usuarioNombre: string | null;
  actualizadoEn: string;
}

export interface EventoItem {
  id: number;
  inventarioId: number;
  nombre: string;
  categoria: string;
  cantidad: number;
  stock: number;
  /** Cantidad del mismo objeto comprometida en otros eventos que se superponen. */
  comprometidoOtros: number;
  checks: Partial<Record<Etapa, CheckEtapa>>;
}

export interface CierreEtapa {
  etapa: Etapa;
  cerradaEn: string;
  cerradaPorNombre: string | null;
  nombreFirmante: string;
  firmaId: number;
  fotoId: number | null;
  observaciones: string;
}

export interface ValidacionRepresentante {
  id: number;
  usuarioNombre: string | null;
  firmaId: number;
  observaciones: string;
  creadoEn: string;
}

export interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  institucion: string;
  especialidad: string;
  creadoEn: string;
}

export interface Tarea {
  id: number;
  titulo: string;
  descripcion: string;
  responsableId: number | null;
  responsableNombre: string | null;
  eventoId: number | null;
  eventoNombre: string | null;
  venceEn: string | null;
  estado: EstadoTarea;
  creadoPorNombre: string | null;
  creadoEn: string;
}

export interface Alerta {
  id: number;
  tipo: string;
  severidad: "aviso" | "incumplimiento";
  mensaje: string;
  eventoId: number | null;
  eventoNombre: string | null;
  tareaId: number | null;
  creadaEn: string;
  resueltaEn: string | null;
  notificacion: string;
}

export interface EntradaHistorial {
  id: number;
  usuarioNombre: string | null;
  accion: string;
  detalle: string;
  creadoEn: string;
}

/** Respuesta de GET /api/eventos/[id]: todo lo que muestra la pantalla del evento. */
export interface DetalleEvento {
  evento: Evento;
  items: EventoItem[];
  cierres: CierreEtapa[];
  validaciones: ValidacionRepresentante[];
  alertas: Alerta[];
  permisos: { editarEvento: boolean; editarLogistica: boolean; tildar: boolean; validar: boolean };
}
