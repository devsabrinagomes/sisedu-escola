import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/toast/useToast";
import {
  getApplicationAnswers,
  saveApplicationAnswers,
} from "@/features/gabaritos/services/gabaritos";
import type {
  AnswerSummaryDTO,
  ApplicationAnswersResponseDTO,
  ApplicationRowDTO,
} from "@/features/gabaritos/types";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import { summarizeQuestionPreview } from "@/features/gabaritos/utils";

type AnswersDrawerProps = {
  open: boolean;
  application: ApplicationRowDTO | null;
  className: string;
  onClose: () => void;
  onSaved: (applicationId: number, summary: AnswerSummaryDTO) => void;
};

const OPTIONS = ["A", "B", "C", "D", "E"] as const;

export default function AnswersDrawer({
  open,
  application,
  className,
  onClose,
  onSaved,
}: AnswersDrawerProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState<ApplicationAnswersResponseDTO | null>(null);
  const [answers, setAnswers] = useState<Record<number, string | null>>({});

  useEffect(() => {
    if (!open || !application) return;
    void loadAnswers(application.application_id);
  }, [open, application?.application_id]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function loadAnswers(applicationId: number) {
    try {
      setLoading(true);
      setErr("");
      const data = await getApplicationAnswers(applicationId);
      setPayload(data);
      const next: Record<number, string | null> = {};
      data.answers.forEach((ans) => {
        next[ans.booklet_item] = ans.selected_option || null;
      });
      setAnswers(next);
    } catch (error: unknown) {
      setPayload(null);
      setErr(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const currentSummary = useMemo(() => payload?.summary, [payload?.summary]);

  function setAnswer(bookletItemId: number, selectedOption: string | null) {
    setAnswers((prev) => ({ ...prev, [bookletItemId]: selectedOption }));
  }

  async function onSave(closeAfterSave: boolean) {
    if (!application || !payload) return;

    try {
      setSaving(true);
      const response = await saveApplicationAnswers(
        application.application_id,
        payload.booklet_items.map((item) => ({
          booklet_item: item.id,
          selected_option: answers[item.id] ?? null,
        })),
      );
      setPayload(response);
      onSaved(application.application_id, response.summary);
      toast({ type: "success", title: "Respostas salvas com sucesso" });
      if (closeAfterSave) onClose();
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao salvar respostas",
        message: getApiErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  if (!open || !application) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl border-l border-slate-200 bg-white shadow-xl">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{application.student_name}</h3>
              <p className="mt-1 text-sm text-slate-500">{className}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="px-5 py-6 text-sm text-slate-500">Carregando respostas...</div>
          ) : err ? (
            <div className="p-5">
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {err}
              </div>
            </div>
          ) : payload ? (
            <>
              <div className="border-b border-slate-100 px-5 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Resumo:</span>{" "}
                {currentSummary?.correct ?? 0} acertos • {currentSummary?.wrong ?? 0} erros •{" "}
                {currentSummary?.blank ?? 0} brancos • {payload.items_total} total
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  {payload.booklet_items.map((item) => {
                    const selectedOption = answers[item.id] ?? null;
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="mb-2 text-sm font-semibold text-slate-900">
                          Questão {String(item.order).padStart(2, "0")}
                        </div>
                        <div className="mb-3 text-sm text-slate-600">
                          {summarizeQuestionPreview(
                            item.question_version?.title,
                            item.question_version?.command,
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {OPTIONS.map((option) => {
                            const checked = selectedOption === option;
                            return (
                              <label
                                key={option}
                                className={[
                                  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                                  checked
                                    ? "border-emerald-200 bg-emerald-50 text-brand-500"
                                    : "border-slate-200 text-slate-700 hover:bg-slate-50",
                                ].join(" ")}
                              >
                                <input
                                  type="radio"
                                  name={`booklet-item-${item.id}`}
                                  value={option}
                                  checked={checked}
                                  onChange={() => setAnswer(item.id, option)}
                                  className="h-3.5 w-3.5 accent-emerald-600"
                                />
                                {option}
                              </label>
                            );
                          })}
                          <label
                            className={[
                              "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                              selectedOption === null
                                ? "border-slate-300 bg-slate-100 text-slate-800"
                                : "border-slate-200 text-slate-700 hover:bg-slate-50",
                            ].join(" ")}
                          >
                            <input
                              type="radio"
                              name={`booklet-item-${item.id}`}
                              value="blank"
                              checked={selectedOption === null}
                              onChange={() => setAnswer(item.id, null)}
                              className="h-3.5 w-3.5 accent-emerald-600"
                            />
                            Em branco
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 px-5 py-4">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSave(false)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    disabled={saving}
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSave(true)}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                    disabled={saving}
                  >
                    {saving ? "Salvando..." : "Salvar e voltar"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="px-5 py-6 text-sm text-slate-500">Nenhum dado disponível.</div>
          )}
        </div>
      </aside>
    </div>
  );
}
