import type { MangaStatus } from "./api";

const LANGS: Record<string, string> = {
  all: "Multi",
  es: "Español",
  "es-419": "Español (Latam)",
  en: "Inglés",
  pt: "Portugués",
  "pt-BR": "Portugués (BR)",
  fr: "Francés",
  it: "Italiano",
  de: "Alemán",
  ja: "Japonés",
  ko: "Coreano",
  zh: "Chino",
  "zh-Hans": "Chino simp.",
  "zh-Hant": "Chino trad.",
  ru: "Ruso",
  id: "Indonesio",
  vi: "Vietnamita",
  th: "Tailandés",
  tr: "Turco",
  ar: "Árabe",
  pl: "Polaco",
  uk: "Ucraniano",
  localsourcelang: "Local",
};

export const langName = (code: string) => LANGS[code] ?? code.toUpperCase();

export const STATUS_LABEL: Record<MangaStatus, string> = {
  UNKNOWN: "Desconocido",
  ONGOING: "En emisión",
  COMPLETED: "Completado",
  LICENSED: "Licenciado",
  PUBLISHING_FINISHED: "Publicación terminada",
  CANCELLED: "Cancelado",
  ON_HIATUS: "En pausa",
};

/** Suwayomi guarda algunas fechas en segundos y otras en milisegundos: se normaliza a ms (0 si no hay). */
export function toMs(value: string | number | null | undefined) {
  const n = Number(value ?? 0) || 0;
  return n < 1e12 ? n * 1000 : n;
}

/** Clave del día local ("2026-10-06"), para agrupar por fecha. */
export function dayKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Hoy", "Ayer", "Lunes" (esta semana) o "6 de octubre de 2026". */
export function dayLabel(ms: number, now = Date.now()) {
  const startOfDay = (t: number) => new Date(new Date(t).toDateString()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  const date = new Date(ms);
  if (days > 1 && days < 7) {
    const weekday = date.toLocaleDateString("es", { weekday: "long" });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  return date.toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Agrupa elementos (ya ordenados por fecha) por día, conservando el orden. */
export function groupByDay<T>(items: T[], getMs: (item: T) => number, now = Date.now()) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const ms = getMs(item);
    const key = dayKey(ms);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(ms, now), items: [item] });
  }
  return groups;
}

export function formatDate(value: string | number) {
  const n = Number(value);
  if (!n) return "";
  return new Date(toMs(n)).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(value: string | number, now = Date.now()) {
  const n = Number(value);
  if (!n) return "";
  const s = Math.round((now - toMs(n)) / 1000);
  if (s < 60) return "hace un momento";
  const units: [number, string, string][] = [
    [60, "minuto", "minutos"],
    [24, "hora", "horas"],
    [7, "día", "días"],
    [4.35, "semana", "semanas"],
    [12, "mes", "meses"],
    [Infinity, "año", "años"],
  ];
  let v = s / 60;
  for (const [size, one, many] of units) {
    if (v < size) {
      const r = Math.floor(v);
      return `hace ${r} ${r === 1 ? one : many}`;
    }
    v /= size;
  }
  return "";
}
