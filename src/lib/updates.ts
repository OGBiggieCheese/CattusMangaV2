// Lógica de la sección Novedades (sin React ni red, para poder testearla).
import { toMs } from "./format";

/**
 * Margen para considerar que un capítulo llegó en la primera carga de su manga: Suwayomi inserta
 * todos los capítulos de una carga con la misma marca de tiempo, pero se deja holgura por si tarda.
 */
export const INITIAL_FETCH_WINDOW_MS = 2 * 60_000;

/**
 * ¿Es un capítulo nuevo de verdad? Los capítulos que llegaron en la primera carga del manga (al
 * abrirlo o añadirlo, o al restaurar una copia) no son novedades: sin esto, añadir un manga de 300
 * capítulos llenaría la lista. `firstFetchedAt` es el fetchedAt más antiguo de ese manga.
 */
export function isNewChapter(fetchedAt: string | number, firstFetchedAt: string | number | undefined): boolean {
  const fetched = toMs(fetchedAt);
  if (!fetched) return false;
  if (firstFetchedAt === undefined) return true;
  return fetched - toMs(firstFetchedAt) >= INITIAL_FETCH_WINDOW_MS;
}

/** Agrupa capítulos consecutivos del mismo manga (para mostrar "Manga X · 3 capítulos nuevos"). */
export function groupConsecutiveByManga<T extends { manga: { id: number } }>(items: T[]) {
  const groups: { mangaId: number; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last?.mangaId === item.manga.id) last.items.push(item);
    else groups.push({ mangaId: item.manga.id, items: [item] });
  }
  return groups;
}
