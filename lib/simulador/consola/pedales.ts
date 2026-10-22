import type { Configuracion } from "../configuracion";

/**
 * Pedales de la consola. Hoy: teclas del teclado. El pedal que fabriquemos
 * se presenta ante la PC como teclado (F13, F14…), así que entra por acá sin
 * cambios.
 */
export class Pedales {
  clutch = false;
  camara = false;
  private teclasClutch: Set<string>;
  private teclasCamara: Set<string>;

  constructor(config: Configuracion) {
    this.teclasClutch = new Set(config.teclasClutch);
    this.teclasCamara = new Set(config.teclasCamara);
    window.addEventListener("keydown", this.alBajar);
    window.addEventListener("keyup", this.alSubir);
    window.addEventListener("blur", this.soltarTodo);
  }

  private static esCampo(e: KeyboardEvent): boolean {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA");
  }

  private alBajar = (e: KeyboardEvent) => {
    if (Pedales.esCampo(e)) return;
    if (this.teclasClutch.has(e.code)) {
      this.clutch = true;
      e.preventDefault();
    } else if (this.teclasCamara.has(e.code)) {
      this.camara = true;
      e.preventDefault();
    }
  };

  private alSubir = (e: KeyboardEvent) => {
    if (!this.teclasClutch.has(e.code) && !this.teclasCamara.has(e.code)) return;
    if (this.teclasClutch.has(e.code)) this.clutch = false;
    if (this.teclasCamara.has(e.code)) this.camara = false;
    // Si hay un botón con foco, el Espacio lo "apretaría" al soltarlo.
    if (!Pedales.esCampo(e)) e.preventDefault();
  };

  /** Si la ventana pierde el foco no llega el "soltar": se sueltan todos para que no queden trabados. */
  private soltarTodo = () => {
    this.clutch = false;
    this.camara = false;
  };

  destruir(): void {
    window.removeEventListener("keydown", this.alBajar);
    window.removeEventListener("keyup", this.alSubir);
    window.removeEventListener("blur", this.soltarTodo);
  }
}
