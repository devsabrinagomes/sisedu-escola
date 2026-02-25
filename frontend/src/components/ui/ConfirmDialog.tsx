import { useId } from "react";
import { X } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) return null;

  const canClose = !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (!canClose) return;
          onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-borderDark dark:bg-surface-1 sm:max-h-[calc(100dvh-4rem)]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!canClose) return;
              onClose();
            }}
            disabled={!canClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-surface-2 dark:hover:text-slate-100"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {description && (
          <p id={descriptionId} className="text-sm text-slate-700 dark:text-slate-300">
            {description}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (!canClose) return;
              onClose();
            }}
            disabled={!canClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-borderDark dark:bg-surface-1 dark:text-slate-300 dark:hover:bg-surface-2"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Processando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
