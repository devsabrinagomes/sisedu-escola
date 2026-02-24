import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import CheckToggle from "@/components/ui/CheckToggle";
import { api } from "@/lib/api";
import type {
  BookletItemDraft,
  Paginated,
  QuestionDTO,
  SubjectDTO,
} from "@/features/cadernos/types";
import {
  normalizeOrders,
  toBookletDraftFromQuestion,
  toSubjectsMap,
} from "@/features/cadernos/utils";

type ActiveTab = "mine" | "public";

type QuestionVersionPickerModalProps = {
  open: boolean;
  initialSelected: BookletItemDraft[];
  onClose: () => void;
  onConfirm: (items: BookletItemDraft[]) => void;
  currentUserId?: number;
};

function mapsHaveSameKeys(
  a: Record<number, BookletItemDraft>,
  b: Record<number, BookletItemDraft>,
) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => key in b);
}

export default function QuestionVersionPickerModal({
  open,
  initialSelected,
  onClose,
  onConfirm,
  currentUserId,
}: QuestionVersionPickerModalProps) {
  const [q, setQ] = useState("");
  const [subjectId, setSubjectId] = useState<number | "todos">("todos");
  const [activeTab, setActiveTab] = useState<ActiveTab>("mine");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<QuestionDTO[]>([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [selectedByVersionId, setSelectedByVersionId] = useState<
    Record<number, BookletItemDraft>
  >({});
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const initialMap: Record<number, BookletItemDraft> = {};
    for (const item of initialSelected) {
      initialMap[item.question_version_id] = item;
    }
    setSelectedByVersionId((prev) => {
      if (mapsHaveSameKeys(prev, initialMap)) return prev;
      return initialMap;
    });
    // Intencional: sincroniza seleção apenas ao abrir o modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get<Paginated<SubjectDTO> | SubjectDTO[]>(
          "/subjects/",
        );
        if (!alive) return;
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setSubjects(list);
      } catch {
        if (!alive) return;
        setSubjects([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void loadQuestions();
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [open, q, subjectId, activeTab, page]);

  useEffect(() => {
    if (!open) return;
    setPage(1);
  }, [q, subjectId, activeTab, open]);

  async function loadQuestions() {
    try {
      setLoading(true);
      setError("");

      const params: Record<string, unknown> = { page };
      const searchTerm = q.trim();
      if (searchTerm) {
        if (/^\d+$/.test(searchTerm)) {
          params.id = Number(searchTerm);
        } else {
          params.search = searchTerm;
        }
      }
      if (subjectId !== "todos") params.subject = subjectId;

      const { data } = await api.get<Paginated<QuestionDTO> | QuestionDTO[]>(
        "/questions/",
        { params },
      );

      const isArray = Array.isArray(data);
      const list = isArray ? data : (data?.results ?? []);
      setItems(list);
      setCount(isArray ? list.length : data.count ?? list.length);
      setNext(isArray ? null : data.next);
      setPrevious(isArray ? null : data.previous);
    } catch (err: unknown) {
      setItems([]);
      setCount(0);
      setNext(null);
      setPrevious(null);
      setError("Não foi possível carregar as questões.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const subjectsById = useMemo(() => toSubjectsMap(subjects), [subjects]);

  const visibleItems = useMemo(() => {
    return items.filter((question) => {
      if (activeTab === "mine") {
        return Number(question.created_by) === Number(currentUserId);
      }
      return !question.private;
    });
  }, [items, activeTab, currentUserId]);

  const pageDrafts = useMemo(() => {
    return visibleItems
      .map((question) => toBookletDraftFromQuestion(question, subjectsById))
      .filter((item): item is BookletItemDraft => item !== null);
  }, [visibleItems, subjectsById]);

  const allPageSelected =
    pageDrafts.length > 0 &&
    pageDrafts.every((item) => Boolean(selectedByVersionId[item.question_version_id]));

  const selectedCount = Object.keys(selectedByVersionId).length;

  function toggleVersionSelection(item: BookletItemDraft) {
    setSelectedByVersionId((prev) => {
      const nextMap = { ...prev };
      if (nextMap[item.question_version_id]) {
        delete nextMap[item.question_version_id];
      } else {
        nextMap[item.question_version_id] = item;
      }
      return nextMap;
    });
  }

  function toggleSelectAllPage() {
    setSelectedByVersionId((prev) => {
      const nextMap = { ...prev };
      if (allPageSelected) {
        for (const item of pageDrafts) {
          delete nextMap[item.question_version_id];
        }
        return nextMap;
      }

      for (const item of pageDrafts) {
        nextMap[item.question_version_id] = item;
      }
      return nextMap;
    });
  }

  function handleConfirm() {
    const selected = normalizeOrders(Object.values(selectedByVersionId));
    onConfirm(selected);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Fechar modal"
      />

      <div className="relative mx-auto flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Adicionar questões
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Selecione uma ou mais questões para incluir no caderno.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              tabs={[
                { value: "mine", label: "Minhas" },
                { value: "public", label: "Públicas" },
              ]}
              active={activeTab}
              onChange={setActiveTab}
              className="inline-flex items-center rounded-xl !border-0 bg-slate-100 p-1 [&>button]:rounded-lg [&>button]:!border-0 [&>button]:px-4 [&>button]:py-2 [&>button]:text-sm [&>button[aria-selected='false']]:text-slate-500 [&>button[aria-selected='true']]:bg-white [&>button[aria-selected='true']]:font-medium [&>button[aria-selected='true']]:text-slate-900 [&>button[aria-selected='true']]:shadow-sm"
            />

            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="relative w-full sm:max-w-md">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por enunciado ou código"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-200"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="absolute inset-y-0 right-2 grid place-items-center rounded-md px-2 text-slate-400 hover:text-slate-700"
                    aria-label="Limpar busca"
                  >
                    ✕
                  </button>
                )}
              </div>
              <select
                value={subjectId}
                onChange={(e) =>
                  setSubjectId(
                    e.target.value === "todos" ? "todos" : Number(e.target.value),
                  )
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-200 sm:max-w-xs"
              >
                <option value="todos">Todas as disciplinas</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            {loading ? "Carregando..." : `${count} resultado(s) • ${selectedCount} selecionada(s)`}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {error && (
            <div className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="px-5 py-4">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                Carregando...
              </div>
            ) : pageDrafts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Nenhuma questão encontrada com os filtros atuais.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full table-auto border-collapse">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left">
                        <CheckToggle
                          checked={allPageSelected}
                          onChange={() => toggleSelectAllPage()}
                          shape="circle"
                          size="sm"
                          ariaLabel="Selecionar todos desta página"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                        Questão
                      </th>
                      <th className="w-56 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                        Disciplina
                      </th>
                      <th className="w-52 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                        Metadados
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageDrafts.map((item) => {
                      const checked = Boolean(
                        selectedByVersionId[item.question_version_id],
                      );
                      return (
                        <tr
                          key={item.question_version_id}
                          className="border-t border-slate-100 transition hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 align-top">
                            <CheckToggle
                              checked={checked}
                              onChange={() => toggleVersionSelection(item)}
                              shape="circle"
                              size="sm"
                              className="mt-1"
                              ariaLabel={`Selecionar versão ${item.question_version_id}`}
                            />
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-slate-800">
                            <div className="line-clamp-2">
                              {item.title || "Sem enunciado"}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-slate-700">
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                              {item.subject_name || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-xs text-slate-500">
                            <div>{item.descriptor_label || "-"}</div>
                            <div>{item.skill_label || "-"}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">{selectedCount} selecionada(s)</div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prevPage) => Math.max(1, prevPage - 1))}
                disabled={!previous || loading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Página anterior
              </button>
              <span className="text-xs text-slate-500">Página {page}</span>
              <button
                type="button"
                onClick={() => setPage((prevPage) => prevPage + 1)}
                disabled={!next || loading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Próxima página
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={selectedCount === 0}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Adicionar selecionadas
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
