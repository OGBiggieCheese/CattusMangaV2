import { describe, expect, it } from "vitest";
import { checkProxyRequest, isSameOrigin } from "./proxy-policy";

const sameOrigin = { secFetchSite: "same-origin", origin: "http://localhost:4590", host: "localhost:4590" };

describe("checkProxyRequest: GET", () => {
  it.each([
    "/api/v1/manga/12/thumbnail",
    "/api/v1/manga/4693/chapter/1/page/0",
    "/api/v1/extension/icon/eu.kanade.tachiyomi.extension.es.lectortmo",
    "/api/graphql/files/backup/org.suwayomi.tachidesk_2026-10-06_21-26.tachibk",
  ])("permite el recurso de solo lectura %s", (path) => {
    expect(checkProxyRequest({ method: "GET", path })).toEqual({ ok: true });
  });

  it.each([
    // Rutas GET de la API REST antigua de Suwayomi que cambian cosas: el motivo de esta política.
    "/api/v1/manga/12/library",
    "/api/v1/extension/install/eu.kanade.tachiyomi.extension.es.lectortmo",
    "/api/v1/downloads/start",
    "/api/v1/settings/about",
    // GraphQL por GET (las mutaciones por GET serían CSRF puro).
    "/api/graphql",
    // Intentos de salirse del patrón.
    "/api/v1/manga/12/thumbnail/../library",
    "/api/v1/manga/abc/thumbnail",
    "/api/v1/manga/12/chapter/1/page/..",
    "/api/graphql/files/backup/../../etc/passwd",
    "/",
  ])("bloquea %s", (path) => {
    expect(checkProxyRequest({ method: "GET", path })).toMatchObject({ ok: false, status: 403 });
  });

  it("trata HEAD como GET", () => {
    expect(checkProxyRequest({ method: "HEAD", path: "/api/v1/manga/1/thumbnail" }).ok).toBe(true);
  });
});

describe("checkProxyRequest: POST", () => {
  it("permite GraphQL desde la propia web", () => {
    expect(checkProxyRequest({ method: "POST", path: "/api/graphql", ...sameOrigin })).toEqual({ ok: true });
  });

  it("bloquea GraphQL desde otra web (CSRF)", () => {
    expect(
      checkProxyRequest({ method: "POST", path: "/api/graphql", secFetchSite: "cross-site", origin: "https://malo.example", host: "localhost:4590" }),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("bloquea POST a cualquier otra ruta", () => {
    expect(checkProxyRequest({ method: "POST", path: "/api/v1/backup/import", ...sameOrigin })).toMatchObject({ ok: false, status: 403 });
  });

  it.each(["PUT", "PATCH", "DELETE", "OPTIONS"])("rechaza el método %s", (method) => {
    expect(checkProxyRequest({ method, path: "/api/graphql", ...sameOrigin })).toMatchObject({ ok: false, status: 405 });
  });

  it("no distingue mayúsculas en el método", () => {
    expect(checkProxyRequest({ method: "post", path: "/api/graphql", ...sameOrigin }).ok).toBe(true);
  });
});

describe("isSameOrigin", () => {
  it("se fía de Sec-Fetch-Site cuando está", () => {
    expect(isSameOrigin({ secFetchSite: "same-origin" })).toBe(true);
    expect(isSameOrigin({ secFetchSite: "same-site" })).toBe(false);
    expect(isSameOrigin({ secFetchSite: "cross-site" })).toBe(false);
    // Aunque Origin "coincida", manda lo que dice el navegador.
    expect(isSameOrigin({ secFetchSite: "cross-site", origin: "http://localhost:4590", host: "localhost:4590" })).toBe(false);
  });

  it("sin Sec-Fetch-Site compara Origin con Host o X-Forwarded-Host", () => {
    expect(isSameOrigin({ origin: "http://localhost:4590", host: "localhost:4590" })).toBe(true);
    expect(isSameOrigin({ origin: "https://manga.ejemplo.com", host: "web:3000", forwardedHost: "manga.ejemplo.com" })).toBe(true);
    expect(isSameOrigin({ origin: "https://malo.example", host: "localhost:4590" })).toBe(false);
    expect(isSameOrigin({ origin: "null", host: "localhost:4590" })).toBe(false);
  });

  it("sin cabeceras de navegador no hay riesgo de CSRF", () => {
    expect(isSameOrigin({ host: "localhost:4590" })).toBe(true);
  });
});
