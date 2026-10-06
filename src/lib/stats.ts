// Cálculos de estadísticas para el Perfil (sin React ni red, para poder testearlos).
import { dayKey, toMs } from "./format";

export interface ActivityDay {
  key: string;
  /** Inicio del día local, en ms. */
  date: number;
  count: number;
}

/**
 * Capítulos leídos por día en los últimos `days` días (incluido hoy), del más antiguo al más reciente.
 * Suwayomi solo guarda la última vez que se leyó cada capítulo, así que releer uno lo "mueve" de día.
 */
export function activityByDay(lastReadAts: (string | number)[], days: number, now = Date.now()): ActivityDay[] {
  const counts = new Map<string, number>();
  for (const value of lastReadAts) {
    const ms = toMs(value);
    if (ms) counts.set(dayKey(ms), (counts.get(dayKey(ms)) ?? 0) + 1);
  }
  const today = new Date(new Date(now).toDateString());
  const out: ActivityDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    // Se resta en días de calendario (no 24 h fijas) para no descuadrarse con los cambios de hora.
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = dayKey(d.getTime());
    out.push({ key, date: d.getTime(), count: counts.get(key) ?? 0 });
  }
  return out;
}

/**
 * Racha actual (días seguidos leyendo hasta hoy; si hoy aún no has leído, cuenta hasta ayer) y
 * mejor racha dentro del periodo.
 */
export function streaks(activity: ActivityDay[]): { current: number; best: number } {
  let best = 0;
  let run = 0;
  for (const day of activity) {
    run = day.count > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  let current = 0;
  let i = activity.length - 1;
  if (i >= 0 && activity[i].count === 0) i--; // hoy todavía no cuenta como racha rota
  for (; i >= 0 && activity[i].count > 0; i--) current++;
  return { current, best };
}

/** Los `n` valores más repetidos, de más a menos (empates por orden alfabético). */
export function topCounts(values: string[], n: number): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

/** Nivel de intensidad (0–4) de un día para el mapa de actividad, relativo al día más activo. */
export function intensity(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((count / max) * 4)) as 1 | 2 | 3 | 4;
}
