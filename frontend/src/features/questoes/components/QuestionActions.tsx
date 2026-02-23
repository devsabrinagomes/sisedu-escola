import { Ban, Pencil, Plus, Trash2 } from "lucide-react";

type QuestionActionsProps = {
  isMine: boolean;
  annulled: boolean;
  onEdit: () => void;
  onToggleAnnulled: () => void;
  onAddToCaderno: () => void;
  canAddToCaderno: boolean;
  onRemove: () => void;
  variant?: "icons";
};

export default function QuestionActions({
  isMine,
  annulled,
  onEdit,
  onToggleAnnulled,
  onAddToCaderno,
  canAddToCaderno,
  onRemove,
}: QuestionActionsProps) {
  if (!isMine) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        className="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
        title="Editar"
        aria-label="Editar"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onToggleAnnulled}
        className={
          annulled
            ? "p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition"
            : "p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
        }
        title={annulled ? "Reativar questão" : "Anular questão"}
        aria-label={annulled ? "Reativar questão" : "Anular questão"}
      >
        <Ban className="h-4 w-4" />
      </button>

      {canAddToCaderno ? (
        <button
          type="button"
          onClick={onAddToCaderno}
          className="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
          title="Adicionar ao caderno"
          aria-label="Adicionar ao caderno"
        >
          <Plus className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          className="p-2 rounded-lg text-slate-300 cursor-not-allowed"
          title="Questão anulada não pode ser adicionada ao caderno"
          aria-label="Questão anulada não pode ser adicionada ao caderno"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
        title="Remover definitivamente"
        aria-label="Remover definitivamente"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
