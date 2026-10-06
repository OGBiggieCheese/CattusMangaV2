"use client";
// Avisos flotantes (toasts). Se pueden lanzar desde cualquier sitio, también fuera de React:
//   toast.error("No se pudo guardar")   toast.success("Hecho", { action: { label: "Deshacer", run } })
import { create } from "zustand";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; run: () => void };
}

interface ToastOptions {
  action?: Toast["action"];
  /** Si ya hay un aviso con esta clave, se reemplaza en vez de apilar otro igual. */
  key?: string;
  /** Milisegundos hasta que desaparece (0 = no desaparece solo). */
  duration?: number;
}

interface ToastStore {
  toasts: (Toast & { key?: string })[];
  dismiss: (id: number) => void;
}

const MAX_VISIBLE = 4;
const DEFAULT_DURATION: Record<ToastKind, number> = { info: 4000, success: 4000, error: 7000 };

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToasts = create<ToastStore>()((set) => ({
  toasts: [],
  dismiss: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

function show(kind: ToastKind, message: string, opts: ToastOptions = {}) {
  const { toasts, dismiss } = useToasts.getState();
  const previous = opts.key ? toasts.find((t) => t.key === opts.key) : undefined;
  if (previous) dismiss(previous.id);

  const id = nextId++;
  const next = [...useToasts.getState().toasts, { id, kind, message, action: opts.action, key: opts.key }];
  // Si se acumulan demasiados, se descartan los más antiguos.
  for (const old of next.slice(0, Math.max(0, next.length - MAX_VISIBLE))) dismiss(old.id);
  useToasts.setState({ toasts: next.slice(-MAX_VISIBLE) });

  const duration = opts.duration ?? DEFAULT_DURATION[kind];
  if (duration > 0) timers.set(id, setTimeout(() => useToasts.getState().dismiss(id), duration));
  return id;
}

export const toast = {
  info: (message: string, opts?: ToastOptions) => show("info", message, opts),
  success: (message: string, opts?: ToastOptions) => show("success", message, opts),
  error: (message: string, opts?: ToastOptions) => show("error", message, opts),
  dismiss: (id: number) => useToasts.getState().dismiss(id),
};

/** Mensaje legible de cualquier error. */
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "Algo salió mal.";
