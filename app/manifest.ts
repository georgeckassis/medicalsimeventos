import type { MetadataRoute } from "next";
import { marca } from "@/lib/marca";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: marca.nombreApp,
    short_name: marca.nombreCorto,
    description: "Calendario de cursos, logística y tareas",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: marca.colores.principal,
    icons: [
      { src: marca.iconos.i192, sizes: "192x192", type: "image/png" },
      { src: marca.iconos.i512, sizes: "512x512", type: "image/png" },
      { src: marca.iconos.maskable, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
