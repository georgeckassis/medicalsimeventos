// Copia el motor de detección de manos (WebAssembly de MediaPipe) a public/
// para servirlo desde la propia app: la política de contenido no deja cargar
// código de otros dominios. Corre solo después de cada `npm install`.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const origen = "node_modules/@mediapipe/tasks-vision/wasm";
const destino = "public/simulador-recursos/mediapipe";

if (existsSync(origen)) {
  mkdirSync(destino, { recursive: true });
  for (const archivo of [
    "vision_wasm_internal.js",
    "vision_wasm_internal.wasm",
    "vision_wasm_nosimd_internal.js",
    "vision_wasm_nosimd_internal.wasm",
  ]) {
    cpSync(`${origen}/${archivo}`, `${destino}/${archivo}`);
  }
}
