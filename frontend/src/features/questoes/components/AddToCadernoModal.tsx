import { useEffect, useState } from "react";
import EqualizerLoader from "@/components/ui/EqualizerLoader";
import useDelayedLoading from "@/shared/hooks/useDelayedLoading";
import { api } from "@/lib/api";

type CadernoDTO = {
  id: number;
  name?: string | null;
  title?: string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type AddToCadernoModalProps = {
  open: boolean;
  questionId: number | null;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (e: any) => void;
};

export default function AddToCadernoModal({
  open,
  questionId,
  onClose,
  onSuccess,
  onError,
}: AddToCadernoModalProps) {
  const [cadernos, setCadernos] = useState<CadernoDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCadernoId, setSelectedCadernoId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const showLoading = useDelayedLoading(loading);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get<Paginated<CadernoDTO> | CadernoDTO[]>("/cadernos/");
        if (!alive) return;
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setCadernos(list);
        setSelectedCadernoId(list[0]?.id ?? null);
      } catch (e: any) {
        if (!alive) return;
        setCadernos([]);
        setError(e?.response?.data?.detail || "Não foi possível carregar os cadernos.");
        onError?.(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open]);

  async function onConfirm() {
    if (!questionId || !selectedCadernoId) return;
    setAdding(true);
    setError("");

    const payload = { caderno: selectedCadernoId, question: questionId };
    const endpoints = ["/caderno-itens/", "/cadernos-itens/", "/caderno-items/"];

    let lastError: any;
    for (const endpoint of endpoints) {
      try {
        await api.post(endpoint, payload);
        onSuccess();
        onClose();
        setAdding(false);
        return;
      } catch (e: any) {
        lastError = e;
        if (e?.response?.status !== 404) break;
      }
    }

    setError(lastError?.response?.data?.detail || "Não foi possível adicionar ao caderno.");
    onError?.(lastError);
    setAdding(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={() => !adding && onClose()}
        aria-label="Fechar modal"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-booklet-title"
        className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-borderDark dark:bg-surface-1 sm:max-h-[calc(100dvh-4rem)]"
      >
        <h3 id="add-to-booklet-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Adicionar ao caderno
        </h3>

        <div className="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-3" aria-busy="true">
              {showLoading ? <EqualizerLoader size={16} /> : null}
            </div>
          ) : cadernos.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Nenhum caderno encontrado.</div>
          ) : (
            cadernos.map((c) => {
              const label = c.name || c.title || `Caderno #${c.id}`;
              const isSelected = selectedCadernoId === c.id;
              return (
                <label
                  key={c.id}
                  className={[
                    "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-200",
                    isSelected
                      ? "border-brand-500/40 bg-brand-600/10 dark:border-brand-500/50 dark:bg-brand-500/15"
                      : "border-slate-200 hover:bg-slate-50 dark:border-borderDark dark:hover:bg-surface-2",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="caderno"
                    value={c.id}
                    checked={selectedCadernoId === c.id}
                    onChange={() => setSelectedCadernoId(c.id)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  <span
                    className={[
                      "text-sm",
                      isSelected
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-slate-800 dark:text-slate-200",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={adding}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-borderDark dark:bg-surface-1 dark:text-slate-300 dark:hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!selectedCadernoId || adding}
            className="rounded-lg btn-primary px-3 py-2 text-sm font-semibold"
          >
            {adding ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
