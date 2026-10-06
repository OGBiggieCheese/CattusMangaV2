"use client";
import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useToasts, type ToastKind } from "@/lib/toast";

const ICONS: Record<ToastKind, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle,
};
const COLORS: Record<ToastKind, string> = { info: "text-accent", success: "text-success", error: "text-danger" };

/**
 * Pila de avisos. Es un popover para estar en la capa superior del navegador: así se ve también
 * por encima de una ventana emergente abierta (que deja todo lo demás debajo de su fondo).
 */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      // Volver a mostrarlo lo sube por encima de cualquier diálogo abierto después.
      if (el.matches(":popover-open")) el.hidePopover();
      if (toasts.length) el.showPopover();
    } catch {
      // Navegadores sin soporte de popover: se queda como un elemento fijo normal.
    }
  }, [toasts]);

  return (
    <div
      ref={ref}
      popover="manual"
      className="fixed inset-auto bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 m-0 flex w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-visible border-0 bg-transparent p-0 text-fg md:bottom-6"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="toast-in flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-2xl"
          >
            <Icon className={`mt-0.5 size-4 shrink-0 ${COLORS[t.kind]}`} />
            <p className="min-w-0 flex-1 break-words">{t.message}</p>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
                className="-my-1 shrink-0 rounded-lg px-2 py-1 font-semibold text-accent hover:bg-accent-soft"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="-my-1 -mr-1.5 grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Cerrar aviso"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
