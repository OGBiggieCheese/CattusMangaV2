import { describe, expect, it } from "vitest";
import { dayKey, dayLabel, groupByDay, langName, timeAgo, toMs } from "./format";

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 10, 6, 18);

describe("toMs", () => {
  it("normaliza segundos y milisegundos", () => {
    expect(toMs("1790000000")).toBe(1_790_000_000_000);
    expect(toMs(1_790_000_000_000)).toBe(1_790_000_000_000);
  });

  it("devuelve 0 si no hay valor", () => {
    expect(toMs(null)).toBe(0);
    expect(toMs(undefined)).toBe(0);
    expect(toMs("")).toBe(0);
    expect(toMs("abc")).toBe(0);
  });
});

describe("timeAgo", () => {
  it.each([
    [NOW - 10_000, "hace un momento"],
    [NOW - 60_000, "hace 1 minuto"],
    [NOW - 5 * 60_000, "hace 5 minutos"],
    [NOW - 2 * 3_600_000, "hace 2 horas"],
    [NOW - 86_400_000, "hace 1 día"],
    [NOW - 14 * 86_400_000, "hace 2 semanas"],
    [NOW - 400 * 86_400_000, "hace 1 año"],
  ])("%s → %s", (ms, text) => {
    expect(timeAgo(ms, NOW)).toBe(text);
  });

  it("vacío sin fecha", () => {
    expect(timeAgo("0", NOW)).toBe("");
  });
});

describe("dayLabel / dayKey / groupByDay", () => {
  it("etiquetas relativas", () => {
    expect(dayLabel(at(2026, 10, 6, 0, 5), NOW)).toBe("Hoy");
    expect(dayLabel(at(2026, 10, 5, 23, 59), NOW)).toBe("Ayer");
    expect(dayLabel(at(2026, 10, 2), NOW)).toBe("Viernes");
    expect(dayLabel(at(2026, 9, 20), NOW)).toBe("20 de septiembre");
    expect(dayLabel(at(2025, 12, 31), NOW)).toBe("31 de diciembre de 2025");
  });

  it("dayKey usa el día local", () => {
    expect(dayKey(at(2026, 1, 2, 0, 30))).toBe("2026-01-02");
  });

  it("agrupa elementos consecutivos del mismo día", () => {
    const items = [at(2026, 10, 6, 15), at(2026, 10, 6, 9), at(2026, 10, 5), at(2026, 10, 1)];
    const groups = groupByDay(items, (x) => x, NOW);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ["Hoy", 2],
      ["Ayer", 1],
      ["Jueves", 1],
    ]);
  });
});

describe("langName", () => {
  it("traduce los códigos conocidos y deja el resto en mayúsculas", () => {
    expect(langName("es")).toBe("Español");
    expect(langName("all")).toBe("Multi");
    expect(langName("xx")).toBe("XX");
  });
});
