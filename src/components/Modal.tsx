"use client";
// Ventana emergente accesible basada en <dialog> nativo (showModal):
//  - El navegador bloquea el resto de la página (foco atrapado, lectores de pantalla) y Esc la cierra.
//  - Tocar fuera la cierra. En el móvil aparece como hoja inferior, cerca del pulgar.
//  - Al cerrarse devuelve el foco al elemento que la abrió.
// Para enfocar un elemento concreto al abrir, márcalo con `data-autofocus`.
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Position = "center" | "top";

let openCount = 0;
/** Bloquea el scroll de la página mientras haya alguna ventana abierta (pueden apilarse). */
function lockScroll() {
  if (openCount++ === 0) document.documentElement.style.overflow = "hidden";
  return () => {
    if (--openCount === 0) document.documentElement.style.overflow = "";
  };
}

/** ¿Hay alguna ventana emergente abierta? Útil para que los atajos de teclado globales se aparten. */
export const isModalOpen = () => typeof document !== "undefined" && !!document.querySelector("dialog[open]");

export function Modal({
  open,
  onClose,
  title,
  description,
  hideTitle,
  position = "center",
  width = "sm",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  /** Oculta la cabecera visualmente (el título sigue disponible para lectores de pantalla). */
  hideTitle?: boolean;
  /** "top" la coloca arriba (buscador); "center" es una hoja inferior en móvil y centrada en escritorio. */
  position?: Position;
  width?: "sm" | "md" | "lg";
  children: React.ReactNode;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <ModalInner onClose={onClose} title={title} description={description} hideTitle={hideTitle} position={position} width={width}>
      {children}
    </ModalInner>,
    document.body,
  );
}

const WIDTHS = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg" };

function ModalInner({
  onClose,
  title,
  description,
  hideTitle,
  position,
  width,
  children,
}: {
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  hideTitle?: boolean;
  position: Position;
  width: "sm" | "md" | "lg";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    (dialog.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current)?.focus({ preventScroll: true });
    const unlock = lockScroll();
    return () => {
      unlock();
      if (dialog.open) dialog.close();
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  const top = position === "top";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      // Esc (o el gesto "atrás" de Android) cierra el diálogo: se avisa al padre para que lo desmonte.
      onClose={() => onCloseRef.current()}
      onClick={(e) => {
        // El <dialog> ocupa toda la pantalla: un clic directo sobre él es un clic fuera del panel.
        if (e.target === e.currentTarget) onCloseRef.current();
        // Evita que el clic llegue a los componentes que contienen la ventana (p. ej. un enlace).
        e.stopPropagation();
      }}
      className={`fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none justify-center bg-transparent p-0 text-fg backdrop:bg-black/60 ${
        top ? "items-start px-3 pt-[max(1rem,10vh)]" : "items-end sm:items-center sm:px-4"
      }`}
    >
      <div
        ref={panel}
        tabIndex={-1}
        className={`modal-panel flex max-h-[85dvh] w-full flex-col overflow-hidden border border-border bg-surface shadow-2xl outline-none ${WIDTHS[width]} ${
          top ? "max-w-lg rounded-2xl" : "rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:rounded-2xl sm:pb-0"
        }`}
      >
        {!top && <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />}
        <div className={hideTitle ? "sr-only" : "flex items-start gap-3 px-5 pb-1 pt-4"}>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="line-clamp-2 text-base font-bold">
              {title}
            </h2>
            {description && (
              <div id={descId} className="mt-1 text-sm text-muted">
                {description}
              </div>
            )}
          </div>
          {!hideTitle && (
            <button
              type="button"
              onClick={() => onCloseRef.current()}
              className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto ${hideTitle ? "" : "px-5 pb-5 pt-3"}`}>{children}</div>
      </div>
    </dialog>
  );
}
