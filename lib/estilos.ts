import type { EstadoEvento, EstadoTarea } from "@/lib/db/types";

export const COLOR_ESTADO: Record<EstadoEvento, string> = {
  planificado: "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200",
  confirmado: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200",
  en_curso: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200",
  finalizado: "bg-zinc-50 text-zinc-500 border-zinc-200 line-through dark:bg-zinc-900",
  cancelado: "bg-red-50 text-red-400 border-red-200 line-through dark:bg-red-950",
};

export const COLOR_ESTADO_TAREA: Record<EstadoTarea, string> = {
  pendiente: "bg-zinc-100 text-zinc-700",
  en_progreso: "bg-sky-100 text-sky-800",
  completada: "bg-emerald-100 text-emerald-800",
  bloqueada: "bg-red-100 text-red-700",
};
