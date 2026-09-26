import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "@/components/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eventos — MedicalSim",
  description: "Calendario de cursos de capacitación, logística y tareas",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MedicalSim Eventos",
  },
};

export const viewport: Viewport = {
  themeColor: "#2F71B8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Si el navegador es muy viejo la app no llega a arrancar y los botones
            no responden: a los 10 s sin arrancar se muestra este aviso. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){if(document.documentElement.getAttribute("data-hidratado"))return;var d=document.createElement("div");d.id="aviso-no-cargo";d.style.cssText="position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#b91c1c;color:#fff;padding:14px 16px;font:14px sans-serif";d.textContent="La app no terminó de cargar en este navegador, por eso los botones no responden. Actualizá el navegador (o el sistema del celular) o probá con Chrome. Navegador: "+navigator.userAgent;document.body.appendChild(d);},10000);`,
          }}
        />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
