// Lógica del historial de lectura (sin dependencias de React ni de red, para poder testearla).
import type { HistoryEntry } from "./api";

/** Clave de metadata de capítulo (guardada en Suwayomi) usada para ocultar entradas del historial. */
export const HIDDEN_HISTORY_META_KEY = "cattus_hiddenFromHistory";

/**
 * Suwayomi no permite borrar el historial (deriva de lastReadAt, que no es editable), así que se
 * oculta guardando en la metadata del capítulo el lastReadAt más reciente en el momento de ocultar.
 * Si luego se vuelve a leer, su lastReadAt pasa a ser mayor y reaparece, como es de esperar.
 * El valor "true" es el formato antiguo, que ocultaba para siempre.
 */
export function isHiddenFromHistory(entry: Pick<HistoryEntry, "meta" | "lastReadAt">): boolean {
  const value = entry.meta.find((m) => m.key === HIDDEN_HISTORY_META_KEY)?.value;
  if (value === undefined) return false;
  if (value === "true") return true;
  return Number(entry.lastReadAt) <= Number(value);
}

export interface HistoryGroup {
  /** Último capítulo leído del manga. */
  entry: HistoryEntry;
  /** Cuántos capítulos de este manga aparecen en el historial cargado. */
  count: number;
}

/**
 * Agrupa el historial por manga (como Mihon): una fila por manga con su último capítulo leído.
 * `entries` debe venir ordenado del más reciente al más antiguo.
 */
export function groupHistory(entries: HistoryEntry[], maxMangas: number): HistoryGroup[] {
  const groups = new Map<number, HistoryGroup>();
  for (const entry of entries) {
    if (isHiddenFromHistory(entry)) continue;
    const group = groups.get(entry.manga.id);
    if (group) group.count++;
    else if (groups.size < maxMangas) groups.set(entry.manga.id, { entry, count: 1 });
  }
  return [...groups.values()];
}

/** Valor a guardar para ocultar estos capítulos: el lastReadAt más reciente entre ellos. */
export function hideMarker(chapters: { lastReadAt: string }[]): string {
  return String(chapters.reduce((max, c) => Math.max(max, Number(c.lastReadAt) || 0), 0));
}
