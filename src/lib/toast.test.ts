import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorMessage, toast, useToasts } from "./toast";

const messages = () => useToasts.getState().toasts.map((t) => t.message);

beforeEach(() => {
  vi.useFakeTimers();
  for (const t of useToasts.getState().toasts) toast.dismiss(t.id);
});
afterEach(() => vi.useRealTimers());

describe("toast", () => {
  it("muestra y quita avisos solos tras su duración", () => {
    toast.success("Hecho");
    toast.error("Falló");
    expect(messages()).toEqual(["Hecho", "Falló"]);
    vi.advanceTimersByTime(4000);
    expect(messages()).toEqual(["Falló"]); // los errores duran más
    vi.advanceTimersByTime(3000);
    expect(messages()).toEqual([]);
  });

  it("con la misma clave reemplaza en vez de apilar", () => {
    toast.error("Sin conexión 1", { key: "progreso" });
    toast.error("Sin conexión 2", { key: "progreso" });
    expect(messages()).toEqual(["Sin conexión 2"]);
  });

  it("no acumula más de 4", () => {
    for (let i = 1; i <= 6; i++) toast.info(`Aviso ${i}`);
    expect(messages()).toEqual(["Aviso 3", "Aviso 4", "Aviso 5", "Aviso 6"]);
  });

  it("duration 0 no desaparece sola; dismiss la quita", () => {
    const id = toast.info("Fijo", { duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(messages()).toEqual(["Fijo"]);
    toast.dismiss(id);
    expect(messages()).toEqual([]);
  });
});

describe("errorMessage", () => {
  it("saca un texto legible de cualquier error", () => {
    expect(errorMessage(new Error("x"))).toBe("x");
    expect(errorMessage("y")).toBe("y");
    expect(errorMessage({})).toBe("Algo salió mal.");
  });
});
