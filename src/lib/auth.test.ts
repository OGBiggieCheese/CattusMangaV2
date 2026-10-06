import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorized, safeEqual, sessionToken } from "./auth";

afterEach(() => vi.unstubAllEnvs());

describe("sessionToken", () => {
  it("es determinista y hexadecimal (HMAC-SHA256 = 64 caracteres)", async () => {
    const a = await sessionToken("secreto");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await sessionToken("secreto")).toBe(a);
  });

  it("cambia con la contraseña (cambiarla cierra todas las sesiones)", async () => {
    expect(await sessionToken("secreto")).not.toBe(await sessionToken("secreto2"));
  });

  it("no contiene la contraseña", async () => {
    expect(await sessionToken("mi-contraseña")).not.toContain("contrase");
  });
});

describe("safeEqual", () => {
  it("compara correctamente", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("", "a")).toBe(false);
  });
});

describe("isAuthorized", () => {
  it("sin CATTUS_PASSWORD la web queda abierta (modo desarrollo)", async () => {
    vi.stubEnv("CATTUS_PASSWORD", "");
    expect(await isAuthorized(undefined)).toBe(true);
  });

  it("con contraseña exige la cookie correcta", async () => {
    vi.stubEnv("CATTUS_PASSWORD", "secreto");
    expect(await isAuthorized(undefined)).toBe(false);
    expect(await isAuthorized("")).toBe(false);
    expect(await isAuthorized("secreto")).toBe(false); // la contraseña en claro no sirve como cookie
    expect(await isAuthorized(await sessionToken("otra"))).toBe(false);
    expect(await isAuthorized(await sessionToken("secreto"))).toBe(true);
  });
});
