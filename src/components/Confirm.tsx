"use client";
// Confirmación antes de acciones destructivas, sin el confirm() del navegador:
//   if (await confirmAction({ title: "¿Borrar…?", confirmLabel: "Borrar", danger: true })) …
import { create } from "zustand";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui";

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta el botón de confirmar en rojo (acciones que borran o no se pueden deshacer). */
  danger?: boolean;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const useConfirmStore = create<{ pending: Pending | null }>()(() => ({ pending: null }));

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // Si ya había una pregunta abierta, se da por cancelada.
    useConfirmStore.getState().pending?.resolve(false);
    useConfirmStore.setState({ pending: { ...options, resolve } });
  });
}

/** Se monta una sola vez (en Providers). */
export function ConfirmHost() {
  const pending = useConfirmStore((s) => s.pending);

  const finish = (ok: boolean) => {
    if (!pending || useConfirmStore.getState().pending !== pending) return;
    useConfirmStore.setState({ pending: null });
    pending.resolve(ok);
  };

  return (
    <Modal open={!!pending} onClose={() => finish(false)} title={pending?.title ?? ""} description={pending?.message}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {/* El foco empieza en "Cancelar": pulsar Enter sin querer no borra nada. */}
        <Button data-autofocus className="h-11 sm:h-10" onClick={() => finish(false)}>
          {pending?.cancelLabel ?? "Cancelar"}
        </Button>
        <Button
          variant={pending?.danger ? "dangerSolid" : "primary"}
          className="h-11 sm:h-10"
          onClick={() => finish(true)}
        >
          {pending?.confirmLabel ?? "Aceptar"}
        </Button>
      </div>
    </Modal>
  );
}
