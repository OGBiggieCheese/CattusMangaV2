import { describe, expect, it } from "vitest";
import { activityByDay, intensity, streaks, topCounts, type ActivityDay } from "./stats";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 10, 6, 18);
/** lastReadAt en segundos, como lo guarda Suwayomi. */
const read = (y: number, m: number, d: number, h = 12) => String(Math.floor(at(y, m, d, h) / 1000));

describe("activityByDay", () => {
  it("cuenta capítulos por día local y rellena los días sin lectura", () => {
    const days = activityByDay([read(2026, 10, 6), read(2026, 10, 6, 1), read(2026, 10, 4)], 3, NOW);
    expect(days.map((d) => [d.key, d.count])).toEqual([
      ["2026-10-04", 1],
      ["2026-10-05", 0],
      ["2026-10-06", 2],
    ]);
  });

  it("ignora lecturas fuera del periodo y valores vacíos", () => {
    const days = activityByDay([read(2026, 9, 1), "0", ""], 2, NOW);
    expect(days.every((d) => d.count === 0)).toBe(true);
  });

  it("no se descuadra con el cambio de hora (último domingo de octubre)", () => {
    const days = activityByDay([], 5, at(2026, 10, 27));
    expect(days.map((d) => d.key)).toEqual(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
  });
});

const days = (counts: number[]): ActivityDay[] => counts.map((count, i) => ({ key: String(i), date: i, count }));

describe("streaks", () => {
  it("racha actual hasta hoy y mejor racha", () => {
    expect(streaks(days([1, 1, 1, 0, 1, 1]))).toEqual({ current: 2, best: 3 });
  });

  it("si hoy aún no has leído, la racha de ayer sigue viva", () => {
    expect(streaks(days([0, 1, 1, 0]))).toEqual({ current: 2, best: 2 });
  });

  it("dos días sin leer rompen la racha", () => {
    expect(streaks(days([1, 1, 0, 0]))).toEqual({ current: 0, best: 2 });
  });

  it("sin datos", () => {
    expect(streaks([])).toEqual({ current: 0, best: 0 });
  });
});

describe("topCounts", () => {
  it("ordena por frecuencia y, a igualdad, alfabéticamente", () => {
    expect(topCounts(["Acción", "Drama", "Acción", "Comedia", "Drama", "Acción", " ", ""], 2)).toEqual([
      ["Acción", 3],
      ["Drama", 2],
    ]);
    expect(topCounts(["b", "a"], 5)).toEqual([
      ["a", 1],
      ["b", 1],
    ]);
  });
});

describe("intensity", () => {
  it("escala de 0 a 4 relativa al máximo", () => {
    expect(intensity(0, 10)).toBe(0);
    expect(intensity(1, 10)).toBe(1);
    expect(intensity(5, 10)).toBe(2);
    expect(intensity(10, 10)).toBe(4);
    expect(intensity(3, 0)).toBe(0);
  });
});
