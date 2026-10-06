"use client";
// Recuerda de qué ruta se vino, para que los botones "Volver" retrocedan en el historial en vez de
// apilar páginas nuevas (lo que hacía que volver desde la ficha llevara otra vez al lector).
import { useEffect } from "react";
import { usePathname } from "next/navigation";

let current: string | null = null;
let previous: string | null = null;

const isReader = (path: string | null) => !!path?.startsWith("/leer/");

/** Se monta una sola vez, en el Shell. */
export function useTrackNavigation() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === current) return;
    // Pasar de un capítulo a otro reemplaza la entrada del lector: no cuenta como "venir de".
    if (!(isReader(current) && isReader(pathname))) previous = current;
    current = pathname;
  }, [pathname]);
}

/** Ruta anterior dentro de la web, o null si se entró directamente (enlace, recarga…). */
export const previousPath = () => previous;
