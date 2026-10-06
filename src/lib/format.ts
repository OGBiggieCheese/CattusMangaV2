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

/** Suwayomi guarda algunas fechas en segundos y otras en milisegundos. */
function toMs(value: string | number) {
  const n = Number(value);
  return n < 1e12 ? n * 1000 : n;
}

export function formatDate(value: string | number) {
  const n = Number(value);
  if (!n) return "";
  return new Date(toMs(n)).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(value: string | number) {
  const n = Number(value);
  if (!n) return "";
  const s = Math.round((Date.now() - toMs(n)) / 1000);
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
