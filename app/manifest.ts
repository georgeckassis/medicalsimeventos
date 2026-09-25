import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedicalSim Eventos",
    short_name: "MS Eventos",
    description: "Calendario de cursos, logística y tareas",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2F71B8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
