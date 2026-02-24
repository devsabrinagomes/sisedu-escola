import { useRef, useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast/useToast";
import type { BookletItemDraft } from "@/features/cadernos/types";
import { normalizeOrders } from "@/features/cadernos/utils";

type BookletItemsEditorProps = {
  items: BookletItemDraft[];
  onChange: (items: BookletItemDraft[]) => void;
  onAddClick: () => void;
};

export default function BookletItemsEditor({
  items,
  onChange,
  onAddClick,
}: BookletItemsEditorProps) {
  const { toast } = useToast();
  const draggingIdRef = useRef("");
  const [removeTarget, setRemoveTarget] = useState<BookletItemDraft | null>(null);

  function removeItem(localId: string) {
    const nextItems = items.filter((item) => item.local_id !== localId);
    onChange(normalizeOrders(nextItems));
  }

  function moveItem(fromLocalId: string, toLocalId: string) {
    if (!fromLocalId || !toLocalId || fromLocalId === toLocalId) return;
    const fromIndex = items.findIndex((item) => item.local_id === fromLocalId);
    const toIndex = items.findIndex((item) => item.local_id === toLocalId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    onChange(normalizeOrders(reordered));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Questões adicionadas</h3>
          <p className="text-xs text-slate-500">
            Arraste para reordenar. O salvamento respeita a ordem exibida.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Adicionar questões
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <p className="text-sm text-slate-500">Nenhuma questão adicionada ainda.</p>
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full table-auto border-collapse">
            <colgroup>
              <col className="w-16" />
              <col />
              <col className="w-44" />
              <col className="w-16" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-14 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Ordem
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Questão
                </th>
                <th className="w-44 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Metadados
                </th>
                <th className="w-16 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={item.local_id}
                  draggable
                  onDragStart={(event) => {
                    draggingIdRef.current = item.local_id;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.local_id);
                    event.currentTarget.classList.add("opacity-60");
                  }}
                  onDragEnd={(event) => {
                    draggingIdRef.current = "";
                    event.currentTarget.classList.remove("opacity-60");
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    event.currentTarget.classList.add("bg-emerald-50");
                  }}
                  onDragLeave={(event) => {
                    event.currentTarget.classList.remove("bg-emerald-50");
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.currentTarget.classList.remove("bg-emerald-50");
                    const fromId =
                      event.dataTransfer.getData("text/plain") || draggingIdRef.current;
                    moveItem(fromId, item.local_id);
                  }}
                  className="border-t border-slate-100 transition hover:bg-slate-50"
                >
                  <td className="px-4 py-3 align-top text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Arrastar para reordenar"
                        aria-label="Arrastar para reordenar"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <span>{index + 1}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-slate-800">
                    <div className="line-clamp-2">{item.title || "Sem enunciado"}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-slate-500">
                    <div>{item.subject_name || "-"}</div>
                    <div>{item.descriptor_label || "-"}</div>
                    <div>{item.skill_label || "-"}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(item)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      title="Remover"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remover questão do caderno"
        description="Tem certeza que deseja remover esta questão do caderno?"
        confirmText="Remover"
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          removeItem(removeTarget.local_id);
          setRemoveTarget(null);
          toast({
            type: "success",
            title: "Questão removida do caderno",
          });
        }}
      />
    </div>
  );
}
