import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "./api";
import { groupHistory, HIDDEN_HISTORY_META_KEY, hideMarker, isHiddenFromHistory } from "./history";

let nextId = 1;
const entry = (mangaId: number, lastReadAt: number, hiddenValue?: string): HistoryEntry => ({
  id: nextId++,
  name: `Capítulo ${nextId}`,
  lastPageRead: 0,
  pageCount: 20,
  lastReadAt: String(lastReadAt),
  isRead: false,
  manga: { id: mangaId, title: `Manga ${mangaId}`, thumbnailUrl: null, thumbnailUrlLastFetched: null, inLibrary: true },
  meta: hiddenValue === undefined ? [] : [{ key: HIDDEN_HISTORY_META_KEY, value: hiddenValue }],
});

describe("isHiddenFromHistory", () => {
  it("sin metadata, visible", () => {
    expect(isHiddenFromHistory(entry(1, 100))).toBe(false);
  });

  it("oculto mientras no se vuelva a leer", () => {
    expect(isHiddenFromHistory(entry(1, 100, "100"))).toBe(true);
    expect(isHiddenFromHistory(entry(1, 90, "100"))).toBe(true);
  });

  it("reaparece al releerlo (lastReadAt posterior a cuando se ocultó)", () => {
    expect(isHiddenFromHistory(entry(1, 101, "100"))).toBe(false);
  });

  it("respeta el formato antiguo ('true' = oculto siempre)", () => {
    expect(isHiddenFromHistory(entry(1, 999999, "true"))).toBe(true);
  });

  it("ignora otras claves de metadata", () => {
    const e = entry(1, 100);
    e.meta = [{ key: "otra", value: "999" }];
    expect(isHiddenFromHistory(e)).toBe(false);
  });
});

describe("groupHistory", () => {
  it("una fila por manga con su capítulo más reciente y el total", () => {
    const list = [entry(1, 50), entry(2, 40), entry(1, 30), entry(1, 20)];
    const groups = groupHistory(list, 10);
    expect(groups.map((g) => [g.entry.manga.id, g.entry.lastReadAt, g.count])).toEqual([
      [1, "50", 3],
      [2, "40", 1],
    ]);
  });

  it("salta las entradas ocultas (y el manga aparece con su siguiente capítulo visible)", () => {
    const list = [entry(1, 50, "50"), entry(2, 40), entry(1, 30, "60")];
    expect(groupHistory(list, 10).map((g) => g.entry.manga.id)).toEqual([2]);
    const partly = [entry(1, 70), entry(1, 50, "50")];
    expect(groupHistory(partly, 10)[0]).toMatchObject({ count: 1 });
  });

  it("respeta el máximo de mangas", () => {
    const list = [entry(1, 5), entry(2, 4), entry(3, 3), entry(1, 2)];
    const groups = groupHistory(list, 2);
    expect(groups.map((g) => g.entry.manga.id)).toEqual([1, 2]);
    expect(groups[0].count).toBe(2);
  });
});

describe("hideMarker", () => {
  it("es el lastReadAt más reciente", () => {
    expect(hideMarker([{ lastReadAt: "10" }, { lastReadAt: "30" }, { lastReadAt: "20" }])).toBe("30");
    expect(hideMarker([])).toBe("0");
  });
});
