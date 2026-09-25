import { z } from "zod";
import { fechaOpcional, textoOpcional } from "@/lib/api";
import { ESTADOS_EVENTO, ESTADOS_TAREA, ETAPAS, ROLES_ASIGNABLES } from "@/lib/db/types";

// Esquemas de validación de lo que llega a la API (compartidos entre la ruta
// de la colección y la de cada id — Next no deja exportar otra cosa que los
// handlers desde un route.ts).

export const esquemaUsuario = z.object({
  email: z.email("Mail inválido.").trim(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  rol: z.enum(ROLES_ASIGNABLES),
  telefono: textoOpcional,
  dni: textoOpcional,
  institucionId: z.number().int().positive().nullable().optional().default(null),
  activo: z.boolean().optional().default(true),
  password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres.").optional(),
});

export const esquemaInstitucion = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  direccion: textoOpcional,
  contacto: textoOpcional,
  telefono: textoOpcional,
  email: textoOpcional,
  representanteId: z.number().int().positive().nullable().optional().default(null),
});
export const UNICIDAD_INSTITUCION = { instituciones_nombre_key: "Ya existe una institución con ese nombre." };

export const esquemaVehiculo = z.object({
  patente: z.string().trim().min(1, "La patente es obligatoria."),
  marca: textoOpcional,
  modelo: textoOpcional,
  notas: textoOpcional,
  activo: z.boolean().optional().default(true),
});
export const UNICIDAD_VEHICULO = { vehiculos_patente_key: "Ya existe un vehículo con esa patente." };

export const esquemaInventario = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  descripcion: textoOpcional,
  categoria: textoOpcional,
  stock: z.number().int().min(0, "El stock no puede ser negativo."),
  activo: z.boolean().optional().default(true),
});
export const UNICIDAD_INVENTARIO = { inventario_nombre_key: "Ya existe un objeto con ese nombre en el inventario." };

const idOpcional = z.number().int().positive().nullable().optional().default(null);

export const esquemaEvento = z
  .object({
    nombre: z.string().trim().min(1, "El nombre del curso es obligatorio."),
    tipoCapacitacion: textoOpcional,
    inicio: z.iso.datetime({ offset: true, message: "Fecha de inicio inválida." }),
    fin: z.iso.datetime({ offset: true, message: "Fecha de fin inválida." }),
    sede: textoOpcional,
    direccion: textoOpcional,
    institucionId: idOpcional,
    representanteId: idOpcional,
    cantidadAlumnos: z.number().int().min(0).optional().default(0),
    instructores: textoOpcional,
    estado: z.enum(ESTADOS_EVENTO).optional().default("planificado"),
    observaciones: textoOpcional,
    armadoEn: fechaOpcional,
    desarmadoEn: fechaOpcional,
    emailsNotificacion: textoOpcional,
  })
  .refine((e) => new Date(e.fin) >= new Date(e.inicio), { message: "La fecha de fin no puede ser anterior al inicio.", path: ["fin"] });

export const esquemaLogistica = z.object({
  logisticaId: idOpcional,
  cargaDepositoEn: fechaOpcional,
  salidaEn: fechaOpcional,
  retiroEn: fechaOpcional,
  devolucionEn: fechaOpcional,
  choferId: idOpcional,
  vehiculoId: idOpcional,
});

export const esquemaItemEvento = z.object({
  inventarioId: z.number().int().positive(),
  cantidad: z.number().int().positive("La cantidad tiene que ser mayor a 0."),
});

export const esquemaCheck = z.object({
  itemId: z.number().int().positive(),
  etapa: z.enum(ETAPAS),
  /** null = destildar */
  cantidad: z.number().int().min(0).nullable(),
});

const imagen = z.string().startsWith("data:image/", "Imagen inválida.");

export const esquemaCierreEtapa = z.object({
  nombreFirmante: z.string().trim().min(1, "Falta el nombre de quien firma."),
  firma: imagen,
  foto: imagen.nullable().optional().default(null),
  observaciones: textoOpcional,
});

export const esquemaValidacion = z.object({ firma: imagen, observaciones: textoOpcional });

export const esquemaAlumno = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(100),
  apellido: z.string().trim().min(1, "El apellido es obligatorio.").max(100),
  dni: z
    .string()
    .trim()
    .transform((d) => d.replace(/\D/g, ""))
    .pipe(z.string().min(6, "DNI inválido.").max(10, "DNI inválido.")),
  email: z.email("Mail inválido.").trim().max(200),
  telefono: z.string().trim().max(50).optional().default(""),
  institucion: z.string().trim().max(200).optional().default(""),
  especialidad: z.string().trim().max(200).optional().default(""),
});

export const esquemaTarea = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio."),
  descripcion: textoOpcional,
  responsableId: idOpcional,
  eventoId: idOpcional,
  venceEn: fechaOpcional,
  estado: z.enum(ESTADOS_TAREA).optional().default("pendiente"),
});
