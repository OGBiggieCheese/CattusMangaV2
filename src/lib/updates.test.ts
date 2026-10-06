import { describe, expect, it } from "vitest";
import { groupConsecutiveByManga, INITIAL_FETCH_WINDOW_MS, isNewChapter } from "./updates";

const sec = (ms: number) => String(Math.floor(ms / 1000));
const first = 1_790_000_000_000;

describe("isNewChapter", () => {
  it("los capítulos de la primera carga del manga no son novedad", () => {
    expect(isNewChapter(sec(first), sec(first))).toBe(false);
    expect(isNewChapter(sec(first + INITIAL_FETCH_WINDOW_MS - 1000), sec(first))).toBe(false);
  });

  it("lo que llega en cargas posteriores sí lo es", () => {
    expect(isNewChapter(sec(first + INITIAL_FETCH_WINDOW_MS), sec(first))).toBe(true);
    expect(isNewChapter(sec(first + 86_400_000), sec(first))).toBe(true);
  });

  it("acepta segundos y milisegundos mezclados", () => {
    expect(isNewChapter(first + 86_400_000, sec(first))).toBe(true);
  });

  it("sin fecha de carga no es novedad; sin primera carga conocida, sí", () => {
    expect(isNewChapter("0", sec(first))).toBe(false);
    expect(isNewChapter(sec(first), undefined)).toBe(true);
  });
});

describe("groupConsecutiveByManga", () => {
  it("agrupa solo capítulos seguidos del mismo manga", () => {
    const c = (id: number, manga: number) => ({ id, manga: { id: manga } });
    const groups = groupConsecutiveByManga([c(1, 10), c(2, 10), c(3, 20), c(4, 10)]);
    expect(groups.map((g) => [g.mangaId, g.items.map((i) => i.id)])).toEqual([
      [10, [1, 2]],
      [20, [3]],
      [10, [4]],
    ]);
  });
});
