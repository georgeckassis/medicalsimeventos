import { ClutchCamara } from "./clutchCamara";
import { PickPlace } from "./pickPlace";
import { RingWalk } from "./ringWalk";
import type { DefinicionEjercicio } from "./tipos";

/** Ejercicios disponibles. Para sumar uno: implementar `Ejercicio` y agregarlo acá. */
export const EJERCICIOS: DefinicionEjercicio[] = [
  {
    id: "clutch-camara",
    nombre: "Clutch y cámara",
    descripcion: "Alcanzar esferas lejanas y fuera de la vista.",
    habilidades: "Reposicionar las manos con el clutch y mover el endoscopio.",
    crear: () => new ClutchCamara(),
  },
  {
    id: "pick-place",
    nombre: "Pick & place",
    descripcion: "Pasar 6 aros de un lado al otro, transfiriéndolos entre pinzas en el aire.",
    habilidades: "Agarre, coordinación bimanual y profundidad.",
    crear: () => new PickPlace(),
  },
  {
    id: "ring-walk",
    nombre: "Ring walk",
    descripcion: "Llevar un aro por un alambre curvo sin tocarlo, pasándolo entre pinzas.",
    habilidades: "Precisión de trayectoria y uso de la muñeca.",
    crear: () => new RingWalk(),
  },
];

export function buscarEjercicio(id: string): DefinicionEjercicio | undefined {
  return EJERCICIOS.find((e) => e.id === id);
}
