import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Shell } from "@/components/Shell";
import { SETTINGS_KEY } from "@/lib/settings";

export const metadata: Metadata = {
  title: { default: "CattusManga", template: "%s · CattusManga" },
  description: "Lee manga desde tus repositorios de extensiones favoritos.",
};

export const viewport: Viewport = {
  themeColor: "#0c0e13",
  width: "device-width",
  initialScale: 1,
};

// Aplica el tema antes de pintar para evitar el destello blanco.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem('${SETTINGS_KEY}')||'{}').state||{};var t=s.theme||'dark';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(_){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
