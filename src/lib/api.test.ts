import { describe, expect, it } from "vitest";
import { cleanError, coverUrl, filterChanges, safeHref, swUrl } from "./api";

describe("swUrl / coverUrl", () => {
  it("pasa las rutas de Suwayomi por el proxy", () => {
    expect(swUrl("/api/v1/manga/1/thumbnail")).toBe("/api/sw/api/v1/manga/1/thumbnail");
    expect(swUrl("https://cdn.ejemplo.com/a.png")).toBe("https://cdn.ejemplo.com/a.png");
    expect(swUrl(null)).toBe("");
  });

  it("añade la versión de la portada para no ver una antigua cacheada", () => {
    expect(coverUrl({ thumbnailUrl: "/api/v1/manga/1/thumbnail", thumbnailUrlLastFetched: "123" })).toBe(
      "/api/sw/api/v1/manga/1/thumbnail?v=123",
    );
    expect(coverUrl({ thumbnailUrl: "/api/v1/manga/1/thumbnail", thumbnailUrlLastFetched: null })).toBe(
      "/api/sw/api/v1/manga/1/thumbnail",
    );
    expect(coverUrl({ thumbnailUrl: null, thumbnailUrlLastFetched: null })).toBeNull();
  });
});

describe("safeHref", () => {
  it("solo deja pasar http(s)", () => {
    expect(safeHref("https://ejemplo.com/manga/1")).toBe("https://ejemplo.com/manga/1");
    expect(safeHref("HTTP://EJEMPLO.COM")).toBe("HTTP://EJEMPLO.COM");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref(" javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>")).toBeNull();
    expect(safeHref("//evil.com")).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(safeHref("")).toBeNull();
  });
});

describe("filterChanges", () => {
  it("convierte los valores en la lista que espera Suwayomi", () => {
    expect(
      filterChanges({
        "0": { selectState: 2 },
        "3.1": { triState: "INCLUDE" },
      }),
    ).toEqual([
      { position: 0, selectState: 2 },
      { position: 3, groupChange: { position: 1, triState: "INCLUDE" } },
    ]);
  });

  it("sin valores, lista vacía", () => {
    expect(filterChanges({})).toEqual([]);
  });
});

describe("cleanError", () => {
  it("quita el prefijo y el stack trace de Java", () => {
    expect(cleanError("Exception while fetching data (/fetchSourceManga) : Algo falló\n\tat java.lang.Thread.run")).toBe(
      "Algo falló",
    );
  });

  it("traduce los errores HTTP habituales", () => {
    expect(cleanError("HTTP error 403")).toMatch(/bloqueó la petición \(HTTP 403\)/);
    expect(cleanError("HTTP error 503")).toMatch(/Cloudflare/);
    expect(cleanError("HTTP error 404")).toMatch(/404/);
    expect(cleanError("HTTP error 500")).toBe("La fuente respondió con un error HTTP 500.");
    expect(cleanError("java.net.SocketTimeoutException: timeout")).toBe("La fuente tardó demasiado en responder.");
  });

  it("nunca devuelve un mensaje vacío", () => {
    expect(cleanError("")).toBe("Error desconocido");
  });
});
