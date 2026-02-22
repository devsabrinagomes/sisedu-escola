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
  if (!open) return null;

  const canClose = !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (!canClose) return;
          onClose();
        }}
      />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={() => {
              if (!canClose) return;
              onClose();
            }}
            disabled={!canClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {description && <p className="text-sm text-slate-700">{description}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (!canClose) return;
              onClose();
            }}
            disabled={!canClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
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
