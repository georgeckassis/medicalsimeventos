/**
 * Todo lo que pasa en una sesión queda registrado como evento con su
 * momento. Hoy alimenta el resumen de resultados; más adelante, las métricas.
 */

export type TipoEvento =
  | "inicio"
  | "fin"
  | "pausa"
  | "reanudacion"
  | "clutch"
  | "camara"
  | "mano_perdida"
  | "agarre"
  | "suelta"
  | "transferencia"
  | "caida"
  | "colocacion"
  | "objetivo"
  | "contacto";

export interface EventoSimulador {
  /** Segundos desde el inicio del ejercicio. */
  t: number;
  tipo: TipoEvento;
  datos?: Record<string, string | number | boolean>;
}

export class BusEventos {
  private registro: EventoSimulador[] = [];
  private oyentes = new Set<(e: EventoSimulador) => void>();
  private reloj: () => number;

  constructor(reloj: () => number) {
    this.reloj = reloj;
  }

  emitir(tipo: TipoEvento, datos?: EventoSimulador["datos"]): void {
    const evento = { t: this.reloj(), tipo, datos };
    this.registro.push(evento);
    for (const oyente of this.oyentes) oyente(evento);
  }

  escuchar(oyente: (e: EventoSimulador) => void): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  contar(tipo: TipoEvento): number {
    return this.registro.filter((e) => e.tipo === tipo).length;
  }

  eventos(): readonly EventoSimulador[] {
    return this.registro;
  }

  limpiar(): void {
    this.registro = [];
  }
}
