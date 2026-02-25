import { useEffect, useState, type FormEvent } from "react";
import LoadingButton from "@/components/ui/LoadingButton";
import { useToast } from "@/components/ui/toast/useToast";
import BookletItemsEditor from "@/features/cadernos/components/BookletItemsEditor";
import QuestionVersionPickerModal from "@/features/cadernos/components/QuestionVersionPickerModal";
import type { BookletItemDraft } from "@/features/cadernos/types";
import { normalizeOrders } from "@/features/cadernos/utils";

const EMPTY_ITEMS: BookletItemDraft[] = [];

type BookletFormProps = {
  mode: "create" | "edit";
  initialName?: string;
  initialItems?: BookletItemDraft[];
  saving?: boolean;
  currentUserId?: number;
  onCancel: () => void;
  onSubmit: (payload: { name: string; items: BookletItemDraft[] }) => Promise<void>;
};

export default function BookletForm({
  mode,
  initialName = "",
  initialItems = EMPTY_ITEMS,
  saving = false,
  currentUserId,
  onCancel,
  onSubmit,
}: BookletFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [items, setItems] = useState<BookletItemDraft[]>(normalizeOrders(initialItems));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setItems(normalizeOrders(initialItems));
  }, [initialItems]);

  function handlePickerConfirm(selected: BookletItemDraft[]) {
    let duplicates = 0;
    const byVersionId = new Set(items.map((item) => item.question_version_id));
    const merged = [...items];

    for (const selectedItem of selected) {
      if (byVersionId.has(selectedItem.question_version_id)) {
        duplicates += 1;
        continue;
      }
      merged.push({
        ...selectedItem,
        local_id: `qv-${selectedItem.question_version_id}`,
      });
      byVersionId.add(selectedItem.question_version_id);
    }

    setItems(normalizeOrders(merged));
    setPickerOpen(false);

    if (duplicates > 0) {
      toast({
        type: "warning",
        title: "Algumas questões já estavam adicionadas",
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = name.trim();
    if (!normalizedName) {
      setNameError("O nome do caderno é obrigatório.");
      return;
    }
    setNameError("");
    await onSubmit({
      name: normalizedName,
      items: normalizeOrders(items),
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Digite o nome do caderno"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "booklet-name-error" : undefined}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-borderDark dark:bg-surface-1 dark:text-slate-100"
          />
          {nameError && (
            <p id="booklet-name-error" className="mt-1 text-sm text-red-600">
              {nameError}
            </p>
          )}
        </div>

        <BookletItemsEditor
          items={items}
          onChange={(nextItems) => setItems(normalizeOrders(nextItems))}
          onAddClick={() => setPickerOpen(true)}
        />

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-borderDark">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-borderDark dark:bg-surface-1 dark:text-slate-200 dark:hover:bg-surface-2"
          >
            Cancelar
          </button>
          <LoadingButton
            type="submit"
            loading={saving}
            className="rounded-lg btn-primary px-4 py-2 text-sm font-semibold"
          >
            {mode === "create" ? "Salvar caderno" : "Salvar alterações"}
          </LoadingButton>
        </div>
      </form>

      <QuestionVersionPickerModal
        open={pickerOpen}
        initialSelected={items}
        currentUserId={currentUserId}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
      />
    </>
  );
}
