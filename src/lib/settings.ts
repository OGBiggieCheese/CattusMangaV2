"use client";
// Preferencias de este navegador (tema, lector, filtros). La biblioteca y el progreso viven en Suwayomi.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light" | "system";
export type ReaderMode = "webtoon" | "paged";
export type ReaderDirection = "ltr" | "rtl";
export type ReaderFit = "width" | "height" | "original";
export type LibrarySort = "added" | "lastRead" | "updated" | "unread" | "title";

export interface LibraryFilters {
  unread: boolean;
  downloaded: boolean;
  /** Id de fuente ("" = todas). */
  source: string;
}

interface Settings {
  theme: Theme;
  readerMode: ReaderMode;
  readerDirection: ReaderDirection;
  readerFit: ReaderFit;
  /** Ancho máximo del modo cascada, en px (0 = sin límite). */
  webtoonMaxWidth: number;
  webtoonGap: boolean;
  /** Carga por adelantado el siguiente capítulo al acercarse al final del actual. */
  preloadNext: boolean;
  showNsfw: boolean;
  /** Idioma para filtrar extensiones ("" = todos). Las extensiones multi-idioma ("all") se muestran siempre. */
  extLang: string;
  /** Orden de las extensiones instaladas (por nombre), elegido arrastrándolas en Extensiones. */
  sourceOrder: string[];
  /** Fuentes (por nombre) que la búsqueda global se salta. */
  globalSearchExclude: string[];
  librarySort: LibrarySort;
  librarySortDesc: boolean;
  libraryFilters: LibraryFilters;
  set: (patch: Partial<Omit<Settings, "set">>) => void;
}

export const SETTINGS_KEY = "cattus-settings";

export const NO_LIBRARY_FILTERS: LibraryFilters = { unread: false, downloaded: false, source: "" };

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: "dark",
      readerMode: "webtoon",
      readerDirection: "ltr",
      readerFit: "width",
      webtoonMaxWidth: 800,
      webtoonGap: false,
      preloadNext: true,
      showNsfw: false,
      extLang: "es",
      sourceOrder: [],
      globalSearchExclude: [],
      librarySort: "added",
      librarySortDesc: true,
      libraryFilters: NO_LIBRARY_FILTERS,
      set: (patch) => set(patch),
    }),
    // Se rehidrata en el cliente tras montar (ver Providers) para evitar desajustes con el HTML del servidor.
    { name: SETTINGS_KEY, skipHydration: true },
  ),
);

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
