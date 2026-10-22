import * as THREE from "three";
import { LADOS, type Configuracion, type Lado } from "./configuracion";
import { Consola, type EstadoMaestro } from "./consola/maestro";
import { Pedales } from "./consola/pedales";
import type { DatoResultado, DefinicionEjercicio, Ejercicio, EstadoEjercicio } from "./ejercicios/tipos";
import { Escena } from "./escena/escena";
import { BusEventos } from "./eventos/bus";
import { guardarResultado } from "./historial";
import { INSTRUMENTOS, Instrumento } from "./instrumentos/instrumento";
import { Teleoperacion } from "./teleoperacion/teleoperacion";
import type { ManoCruda, ProveedorManos } from "./tracking/proveedor";
import { ProveedorWebcam } from "./tracking/webcam";
import { dibujarVistaPrevia } from "./vistaPrevia";

/**
 * Une todas las capas y corre el ciclo de cada cuadro:
 * cámara → manos → consola → teleoperación → ejercicio → render.
 */

export type EstadoSesion = "preparado" | "en_curso" | "pausado" | "completado";

export interface Instantanea {
  estado: EstadoSesion;
  segundos: number;
  manos: Record<Lado, boolean>;
  clutch: boolean;
  camara: boolean;
  pinzaPendiente: Record<Lado, boolean>;
  ejercicio: EstadoEjercicio;
  /** Flecha hacia el objetivo si está fuera de la vista (posición en % del lienzo y ángulo en radianes). */
  flecha: { x: number; y: number; angulo: number } | null;
  resultados: DatoResultado[] | null;
  /** Detecciones de manos por segundo. */
  deteccionesPorSegundo: number;
}

interface Opciones {
  lienzo: HTMLCanvasElement;
  vistaPrevia: HTMLCanvasElement | null;
  config: Configuracion;
  definicion: DefinicionEjercicio;
  alCambiar: (i: Instantanea) => void;
}

const PERDIDA_S = 0.4;
const ANCHO_VISTA_PREVIA = 320;

export class Simulacion {
  private escena: Escena;
  private proveedor: ProveedorManos;
  private consola: Consola;
  private pedales: Pedales;
  private teleop: Teleoperacion;
  private instrumentos: Record<Lado, Instrumento>;
  private ejercicio: Ejercicio;
  private bus: BusEventos;

  private estado: EstadoSesion = "preparado";
  private segundos = 0;
  private resultados: DatoResultado[] | null = null;
  private maestros: Record<Lado, EstadoMaestro | null> = { izquierda: null, derecha: null };
  private ultimasManos: ManoCruda[] = [];
  private sinVer: Record<Lado, number> = { izquierda: Infinity, derecha: Infinity };
  private pedalesAntes = { clutch: false, camara: false };
  private recorrido: Record<Lado, number> = { izquierda: 0, derecha: 0 };
  private puntaAnterior: Record<Lado, THREE.Vector3> = { izquierda: new THREE.Vector3(), derecha: new THREE.Vector3() };

  private raf = 0;
  private ultimoCuadro = 0;
  private ultimoAviso = 0;
  private detecciones = 0;
  private deteccionesPorSegundo = 0;
  private inicioConteo = 0;
  private destruida = false;

  constructor(private opciones: Opciones) {
    const { config, definicion } = opciones;
    this.escena = new Escena(opciones.lienzo);
    this.bus = new BusEventos(() => this.segundos);
    this.ejercicio = definicion.crear();
    this.instrumentos = {
      izquierda: new Instrumento("izquierda", this.ejercicio.trocares.izquierda, INSTRUMENTOS.pinza),
      derecha: new Instrumento("derecha", this.ejercicio.trocares.derecha, INSTRUMENTOS.pinza),
    };
    for (const lado of LADOS) this.escena.escena.add(this.instrumentos[lado].grupo);
    this.proveedor = new ProveedorWebcam(config.camaraId);
    this.consola = new Consola(config);
    this.pedales = new Pedales(config);
    this.teleop = new Teleoperacion(this.instrumentos, this.escena.camara, this.ejercicio.limites);
    this.ejercicio.montar({ escena: this.escena, instrumentos: this.instrumentos, bus: this.bus });
    this.reiniciar();
  }

  async iniciar(): Promise<void> {
    await this.proveedor.iniciar();
    if (this.destruida) {
      this.proveedor.detener();
      return;
    }
    this.ultimoCuadro = performance.now();
    this.inicioConteo = this.ultimoCuadro;
    this.raf = requestAnimationFrame(this.cuadro);
  }

  /** Vuelve todo a la posición de partida, sin cronómetro. */
  reiniciar(): void {
    this.estado = "preparado";
    this.segundos = 0;
    this.resultados = null;
    this.recorrido = { izquierda: 0, derecha: 0 };
    const { posicion, mira } = this.ejercicio.camaraInicial;
    this.escena.ubicarCamara(posicion, mira);
    for (const lado of LADOS) {
      const inst = this.instrumentos[lado];
      const punta = this.ejercicio.puntasIniciales[lado];
      inst.fijarPose(punta, inst.orientacionAlineada(punta));
      inst.fijarApertura(1);
      this.puntaAnterior[lado].copy(punta);
    }
    this.teleop.soltar();
    this.ejercicio.reiniciar();
    this.bus.limpiar();
    this.avisar(true);
  }

  comenzar(): void {
    this.reiniciar();
    this.estado = "en_curso";
    this.bus.emitir("inicio");
    this.avisar(true);
  }

  pausar(): void {
    if (this.estado !== "en_curso") return;
    this.estado = "pausado";
    this.teleop.soltar();
    this.bus.emitir("pausa");
    this.avisar(true);
  }

  reanudar(): void {
    if (this.estado !== "pausado") return;
    this.estado = "en_curso";
    this.bus.emitir("reanudacion");
    this.avisar(true);
  }

  redimensionar(ancho: number, alto: number): void {
    this.escena.redimensionar(ancho, alto);
  }

  destruir(): void {
    this.destruida = true;
    cancelAnimationFrame(this.raf);
    this.pedales.destruir();
    this.proveedor.detener();
    this.escena.destruir();
  }

  private cuadro = (ahora: number) => {
    if (this.destruida) return;
    this.raf = requestAnimationFrame(this.cuadro);
    const dt = Math.min((ahora - this.ultimoCuadro) / 1000, 0.1);
    this.ultimoCuadro = ahora;
    const enCurso = this.estado === "en_curso";

    const manos = this.proveedor.detectar(ahora);
    if (manos) {
      this.detecciones++;
      this.ultimasManos = manos;
      this.maestros = this.consola.procesar(manos, ahora / 1000);
      if (this.estado !== "pausado") this.teleop.actualizar(this.maestros, this.pedales, this.opciones.config);
    }
    if (enCurso) this.segundos += dt;
    this.registrar(dt, enCurso);
    if (this.estado !== "pausado") this.ejercicio.actualizar(dt, enCurso);

    for (const lado of LADOS) {
      const inst = this.instrumentos[lado];
      if (enCurso) this.recorrido[lado] += inst.punta.distanceTo(this.puntaAnterior[lado]);
      this.puntaAnterior[lado].copy(inst.punta);
      inst.fijarAyudaProfundidad(this.opciones.config.ayudaProfundidad, this.ejercicio.limites.alturaSuperficie(inst.punta.x, inst.punta.z));
    }

    if (enCurso && this.ejercicio.estado().completo) this.terminar();

    this.escena.renderizar();
    const video = this.proveedor.video;
    if (this.opciones.vistaPrevia && video) {
      dibujarVistaPrevia(this.opciones.vistaPrevia, video, this.ultimasManos, this.opciones.config, ANCHO_VISTA_PREVIA);
    }
    if (ahora - this.inicioConteo >= 1000) {
      this.deteccionesPorSegundo = Math.round((this.detecciones * 1000) / (ahora - this.inicioConteo));
      this.detecciones = 0;
      this.inicioConteo = ahora;
    }
    this.avisar(false);
  };

  /** Pedales y pérdidas de tracking, para el registro de eventos. */
  private registrar(dt: number, enCurso: boolean): void {
    const { clutch, camara } = this.pedales;
    if (enCurso && clutch && !this.pedalesAntes.clutch) this.bus.emitir("clutch");
    if (enCurso && camara && !this.pedalesAntes.camara) this.bus.emitir("camara");
    this.pedalesAntes = { clutch, camara };
    for (const lado of LADOS) {
      const antes = this.sinVer[lado];
      this.sinVer[lado] = this.maestros[lado] ? 0 : antes + dt;
      if (enCurso && antes < PERDIDA_S && this.sinVer[lado] >= PERDIDA_S) this.bus.emitir("mano_perdida", { lado });
    }
  }

  private terminar(): void {
    this.estado = "completado";
    this.bus.emitir("fin");
    const minutos = Math.floor(this.segundos / 60);
    const resto = Math.round(this.segundos % 60);
    this.resultados = [
      { etiqueta: "Tiempo", valor: `${minutos}:${String(resto).padStart(2, "0")}` },
      ...this.ejercicio.resultados(),
      { etiqueta: "Recorrido pinza izquierda", valor: `${Math.round(this.recorrido.izquierda)} cm` },
      { etiqueta: "Recorrido pinza derecha", valor: `${Math.round(this.recorrido.derecha)} cm` },
      { etiqueta: "Usos del clutch", valor: String(this.bus.contar("clutch")) },
      { etiqueta: "Movimientos de cámara", valor: String(this.bus.contar("camara")) },
      { etiqueta: "Manos fuera de cámara", valor: String(this.bus.contar("mano_perdida")) },
    ];
    guardarResultado({
      ejercicio: this.opciones.definicion.id,
      fecha: new Date().toISOString(),
      segundos: Math.round(this.segundos),
      datos: this.resultados,
    });
    this.avisar(true);
  }

  private flecha(objetivo: THREE.Vector3 | undefined): Instantanea["flecha"] {
    if (!objetivo) return null;
    const v = objetivo.clone().project(this.escena.camara);
    const detras = v.z > 1;
    if (!detras && Math.abs(v.x) <= 0.95 && Math.abs(v.y) <= 0.95) return null;
    let dx = detras ? -v.x : v.x;
    let dy = detras ? v.y : -v.y;
    const mayor = Math.max(Math.abs(dx), Math.abs(dy), 1e-6);
    dx = (dx / mayor) * 0.88;
    dy = (dy / mayor) * 0.88;
    return { x: 50 + dx * 50, y: 50 + dy * 50, angulo: Math.atan2(dy, dx) };
  }

  /** Avisa a la pantalla 10 veces por segundo (o enseguida si cambió el estado). */
  private avisar(ya: boolean): void {
    const ahora = performance.now();
    if (!ya && ahora - this.ultimoAviso < 100) return;
    this.ultimoAviso = ahora;
    const ejercicio = this.ejercicio.estado();
    this.opciones.alCambiar({
      estado: this.estado,
      segundos: this.segundos,
      manos: { izquierda: !!this.maestros.izquierda, derecha: !!this.maestros.derecha },
      clutch: this.pedales.clutch,
      camara: this.pedales.camara,
      pinzaPendiente: { izquierda: this.teleop.pinzaPendiente("izquierda"), derecha: this.teleop.pinzaPendiente("derecha") },
      ejercicio,
      flecha: this.flecha(ejercicio.objetivo),
      resultados: this.resultados,
      deteccionesPorSegundo: this.deteccionesPorSegundo,
    });
  }
}
