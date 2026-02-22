import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, Search, X } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AddToCadernoButton from "@/features/questoes/components/AddToCadernoButton";
import AddToCadernoModal from "@/features/questoes/components/AddToCadernoModal";
import QuestionActions from "@/features/questoes/components/QuestionActions";
import { useToast } from "@/components/ui/toast/useToast";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

function stripHtml(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

type CreatedAtPreset = "qualquer" | "hoje" | "7dias" | "mes" | "ano";
type SortKey = "code" | "title" | "subject";
type SortDir = "asc" | "desc";
type ActiveTab = "mine" | "public";

// ===== DTOs =====
type SubjectDTO = { id: number; name: string };

type QuestionOptionDTO = {
  id: number;
  letter: "A" | "B" | "C" | "D" | "E";
  option_text: string;
  option_image: string | null;
  correct: boolean;
};

type QuestionVersionDTO = {
  id: number;
  question: number;
  version_number: number;
  title: string;
  command: string;
  support_text: string;
  support_image: string | null;
  image_reference: string | null;
  subject: number;
  descriptor: number | null;
  skill: number | null;
  annulled: boolean;
  created_at: string;
  options?: QuestionOptionDTO[];
};

type QuestionDTO = {
  id: number;
  private: boolean;
  deleted: boolean;
  created_by:
    | number
    | string
    | {
        id?: number;
        name?: string | null;
        full_name?: string | null;
        username?: string | null;
      };
  created_by_name?: string | null;
  created_by_full_name?: string | null;
  created_by_username?: string | null;
  creator?: {
    id?: number;
    name?: string | null;
    full_name?: string | null;
    username?: string | null;
  } | null;
  created_at: string;
  subject_name?: string | null;
  versions?: QuestionVersionDTO[];
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function pickLatestVersion(versions?: QuestionVersionDTO[]) {
  if (!versions?.length) return null;
  return [...versions].sort((a, b) => {
    const an = a.version_number ?? 0;
    const bn = b.version_number ?? 0;
    if (bn !== an) return bn - an;
    return String(b.created_at).localeCompare(String(a.created_at));
  })[0];
}

export default function QuestoesList() {
  const nav = useNavigate();
  const auth = useAuth() as any;
  const { toast } = useToast();

  const userId = Number(auth?.userId ?? auth?.id);

  const [items, setItems] = useState<QuestionDTO[]>([]);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // busca
  const [q, setQ] = useState("");

  // filtros
  const [subjectId, setSubjectId] = useState<number | "todos">("todos");
  const [criadoEm, setCriadoEm] = useState<CreatedAtPreset>("qualquer");
  const [activeTab, setActiveTab] = useState<ActiveTab>("mine");
  const [page, setPage] = useState(1);

  // bottom sheet (mobile)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cadernoModalQuestionId, setCadernoModalQuestionId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filtersOpen]);

  const activeFiltersCount =
    (subjectId !== "todos" ? 1 : 0) + (criadoEm !== "qualquer" ? 1 : 0);

  // ordenação local por aba
  const [sortByTab, setSortByTab] = useState<
    Record<ActiveTab, { key: SortKey; dir: SortDir }>
  >({
    mine: { key: "code", dir: "asc" },
    public: { key: "code", dir: "asc" },
  });

  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  function buildParams(searchText: string) {
    const params: Record<string, any> = {};

    if (searchText.trim()) params.search = searchText.trim();
    if (subjectId !== "todos") params.subject = subjectId;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const isoToday = `${yyyy}-${mm}-${dd}`;

    if (criadoEm === "hoje") {
      params["created_at__date"] = isoToday;
    } else if (criadoEm === "7dias") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      params["created_at__gte"] = `${y}-${m}-${day}`;
    } else if (criadoEm === "mes") {
      params["created_at__year"] = String(yyyy);
      params["created_at__month"] = String(now.getMonth() + 1);
    } else if (criadoEm === "ano") {
      params["created_at__year"] = String(yyyy);
    }

    params.page = page;
    return params;
  }

  async function load(searchText: string, tab: ActiveTab = activeTab) {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setErr("");

    try {
      const { data } = await api.get<Paginated<QuestionDTO> | QuestionDTO[]>(
        "/questions/",
        { params: buildParams(searchText) },
      );

      if (reqId !== reqIdRef.current) return;

      const list = Array.isArray(data) ? data : (data?.results ?? []);
      setItems(list);
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      setItems([]);
      setErr(
        e?.response?.data?.detail || "Não foi possível carregar as questões.",
      );
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }

  // carrega subjects (suporta paginado OU array)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<Paginated<SubjectDTO> | SubjectDTO[]>(
          "/subjects/",
        );
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setSubjects(list);
      } catch {
        setSubjects([]);
      }
    })();
  }, []);

  // inicial
  useEffect(() => {
    load("", activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto search enquanto digita
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => load(q, activeTab), 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, activeTab]);

  // refaz ao mudar filtros
  useEffect(() => {
    load(q, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, criadoEm, page, activeTab]);

  function onTabChange(next: ActiveTab) {
    if (next === activeTab) return;
    setActiveTab(next);
    setPage(1);
  }

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      load(q, activeTab);
    }
  }

  function openAddToCadernoModal(questionId: number) {
    setCadernoModalQuestionId(questionId);
  }

  function closeAddToCadernoModal() {
    setCadernoModalQuestionId(null);
  }

  function toggleSort(key: SortKey) {
    setSortByTab((prev) => {
      const current = prev[activeTab];
      if (current.key === key) {
        return {
          ...prev,
          [activeTab]: {
            key,
            dir: current.dir === "asc" ? "desc" : "asc",
          },
        };
      }
      return {
        ...prev,
        [activeTab]: { key, dir: "asc" },
      };
    });
  }

  function getEnunciadoValue(it: QuestionDTO) {
    const enunciadoRaw =
      (it as any).title ??
      (it as any).enunciado ??
      (it as any).statement ??
      (it as any).text ??
      (it as any).prompt ??
      it?.versions?.[0]?.title ??
      (it as any)?.latest_version?.title ??
      "";
    return stripHtml(String(enunciadoRaw || ""));
  }

  function getSubjectValue(it: QuestionDTO) {
    const v = pickLatestVersion(it.versions);
    return (
      it.subject_name ||
      (v?.subject ? subjectNameById.get(v.subject) : null) ||
      (v?.subject ? `Disciplina #${v.subject}` : "-") ||
      "-"
    );
  }

  function getSortIcon(column: SortKey) {
    const active = sortByTab[activeTab].key === column;
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
    return sortByTab[activeTab].dir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  }

  function openDeleteDialog(questionId: number) {
    setSelectedQuestionId(questionId);
    setDeleteOpen(true);
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteOpen(false);
    setSelectedQuestionId(null);
  }

  async function onDeleteConfirm() {
    if (!selectedQuestionId) return;

    try {
      setDeleting(true);
      await api.delete(`/questions/${selectedQuestionId}/`);
      setItems((prev) => prev.filter((x) => x.id !== selectedQuestionId));
      setDeleteOpen(false);
      setSelectedQuestionId(null);
      toast({
        type: "success",
        title: "Questão removida com sucesso",
      });
    } catch (e: any) {
      toast({
        type: "error",
        title: "Erro ao remover questão",
        message: getApiErrorMessage(e),
      });
    } finally {
      setDeleting(false);
    }
  }

  async function onToggleAnnulled(it: QuestionDTO) {
    const latest = pickLatestVersion(it.versions);
    const nextAnnulled = !Boolean(latest?.annulled);

    try {
      await api.patch(`/questions/${it.id}/`, { annulled: nextAnnulled });

      setItems((prev) =>
        prev.map((qItem) => {
          if (qItem.id !== it.id) return qItem;
          const latestVersion = pickLatestVersion(qItem.versions);
          if (!latestVersion || !qItem.versions?.length) return qItem;
          return {
            ...qItem,
            versions: qItem.versions.map((version) =>
              version.id === latestVersion.id
                ? { ...version, annulled: nextAnnulled }
                : version,
            ),
          };
        }),
      );
      toast({
        type: "success",
        title: nextAnnulled ? "Questão anulada" : "Questão reativada",
      });
    } catch (e: any) {
      toast({
        type: "error",
        title: "Erro ao alterar status da questão",
        message: getApiErrorMessage(e),
      });
    }
  }

  const subjectNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of subjects) m.set(s.id, s.name);
    return m;
  }, [subjects]);

  const filteredByTab = useMemo(() => {
    return items.filter((q) => {
      if (activeTab === "mine") {
        return Number(q.created_by) === userId;
      }
      return !q.private;
    });
  }, [items, activeTab, userId]);

  const sortedItems = useMemo(() => {
    const { key, dir } = sortByTab[activeTab];
    const sorted = [...filteredByTab].sort((a, b) => {
      const av =
        key === "code"
          ? String(a.id ?? "")
          : key === "title"
            ? getEnunciadoValue(a)
            : String(getSubjectValue(a));
      const bv =
        key === "code"
          ? String(b.id ?? "")
          : key === "title"
            ? getEnunciadoValue(b)
            : String(getSubjectValue(b));
      return av.localeCompare(bv, "pt-BR", { sensitivity: "base" });
    });
    return dir === "asc" ? sorted : sorted.reverse();
  }, [filteredByTab, sortByTab, activeTab, subjectNameById]);

  const emptyMessage =
    activeTab === "mine"
      ? "Você ainda não criou questões."
      : "Não há questões públicas disponíveis.";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="lg:col-span-9 space-y-4 min-w-0">
        {/* Topo */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Tabs
            tabs={[
              { value: "mine", label: "Minhas" },
              { value: "public", label: "Públicas" },
            ]}
            active={activeTab}
            onChange={onTabChange}
            className="mb-4 inline-flex items-center rounded-xl !border-0 bg-slate-100 p-1 [&>button]:px-4 [&>button]:py-2 [&>button]:text-sm [&>button]:font-medium [&>button]:rounded-lg [&>button]:transition [&>button]:!border-0 [&>button[aria-selected='true']]:bg-white [&>button[aria-selected='true']]:text-slate-900 [&>button[aria-selected='true']]:shadow-sm [&>button[aria-selected='true']]:font-medium [&>button[aria-selected='false']]:text-slate-500 [&>button[aria-selected='false']]:hover:text-slate-700"
          />
          <label className="block text-xs font-medium text-slate-500">
            Buscar questões
          </label>

          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
                <Search className="h-4 w-4" />
              </span>

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onEnter}
                placeholder="Enunciado"
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-200"
              />

              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute inset-y-0 right-2 grid place-items-center rounded-md px-2 text-slate-400 hover:text-slate-700 transition"
                  aria-label="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => load(q, activeTab)}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
              type="button"
              aria-label="Buscar"
              title="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <Filter className="h-4 w-4" />
              <span>Filtros</span>

              {activeFiltersCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeTab === "mine" && (
              <Link
                to="/questoes/nova"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                + Nova questão
              </Link>
            )}
          </div>

          <div className="mt-3 hidden lg:flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {loading
                ? "Carregando…"
                : `${filteredByTab.length} ${filteredByTab.length === 1 ? "questão" : "questões"}`}
            </div>

            {activeTab === "mine" && (
              <Link
                to="/questoes/nova"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                + Nova questão
              </Link>
            )}
          </div>

          <div className="mt-3 text-xs text-slate-500 lg:hidden">
            {loading
              ? "Carregando…"
              : `${filteredByTab.length} ${filteredByTab.length === 1 ? "questão" : "questões"}`}
          </div>
        </div>

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {/* MOBILE: cards */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              Carregando…
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 text-center shadow-sm">
              {emptyMessage}
            </div>
          ) : (
            sortedItems.map((it) => {
              const v = pickLatestVersion(it.versions);
              const resumo = stripHtml(v?.title || "");
              const isMine = Number(it.created_by) === userId;

              const subjectLabel =
                it.subject_name ||
                (v?.subject ? subjectNameById.get(v.subject) : null) ||
                (v?.subject ? `Disciplina #${v.subject}` : "-");

              return (
                <div
                  key={it.id}
                  className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
                    activeTab === "mine" && v?.annulled ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="hidden md:block text-xs text-slate-500">
                        ID{" "}
                        <span className="text-slate-800 font-semibold">
                          #{it.id}
                        </span>
                      </div>

                      <Link
                        to={`/questoes/${it.id}`}
                        className="mt-1 block w-full whitespace-normal break-words line-clamp-2 cursor-pointer text-left text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                        title={resumo || ""}
                      >
                        {resumo || "—"}
                      </Link>
                      {activeTab === "mine" && v?.annulled && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          Anulada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {activeTab === "public" && (
                        <AddToCadernoButton
                          onClick={() => openAddToCadernoModal(it.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                        />
                      )}
                      {activeTab === "mine" && isMine && (
                        <QuestionActions
                          isMine={isMine}
                          annulled={Boolean(v?.annulled)}
                          onEdit={() => nav(`/questoes/${it.id}/editar`)}
                          onToggleAnnulled={() => onToggleAnnulled(it)}
                          onAddToCaderno={() => openAddToCadernoModal(it.id)}
                          canAddToCaderno={!Boolean(v?.annulled)}
                          onRemove={() => openDeleteDialog(it.id)}
                          variant="icons"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {subjectLabel}
                    </span>

                    {it.private ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                        Privada
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        Pública
                      </span>
                    )}

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP: tabela */}
        <div className="hidden lg:block rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              Carregando…
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="px-4 py-10 text-sm text-slate-500 text-center">
              {emptyMessage}
            </div>
          ) : (
            <table className="w-full table-auto border-collapse">
              <colgroup>
                <col className="w-20" />
                <col />
                <col className="w-28" />
                <col className="w-36" />
              </colgroup>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th
                    className="w-20 px-5 py-3 text-left text-xs font-semibold text-slate-600"
                    aria-sort={
                      sortByTab[activeTab].key === "code"
                        ? sortByTab[activeTab].dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("code")}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                      title="Ordenar"
                    >
                      Código
                      {getSortIcon("code")}
                    </button>
                  </th>
                  <th
                    className="w-full px-5 py-3 text-left text-xs font-semibold text-slate-600"
                    aria-sort={
                      sortByTab[activeTab].key === "title"
                        ? sortByTab[activeTab].dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("title")}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                      title="Ordenar"
                    >
                      Enunciado
                      {getSortIcon("title")}
                    </button>
                  </th>
                  <th
                    className="w-28 px-5 py-3 text-left text-xs font-semibold text-slate-600"
                    aria-sort={
                      sortByTab[activeTab].key === "subject"
                        ? sortByTab[activeTab].dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("subject")}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                      title="Ordenar"
                    >
                      Disciplina
                      {getSortIcon("subject")}
                    </button>
                  </th>
                  <th className="w-36 whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-slate-600">
                    {activeTab === "mine" ? (
                      "Ações"
                    ) : (
                      "Adicionar"
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((it) => {
                  const v = pickLatestVersion(it.versions);
                  const enunciado = getEnunciadoValue(it);

                  const subjectLabel = getSubjectValue(it);
                  const isMine = Number(it.created_by) === userId;
                  const isAnnulled = Boolean(v?.annulled);

                  return (
                    <tr
                      key={it.id}
                      className={`border-t border-slate-100 hover:bg-slate-50 transition ${
                        activeTab === "mine" && isAnnulled ? "opacity-60" : ""
                      }`}
                    >
                      <td className="w-20 px-5 py-3 align-middle text-sm text-slate-700">
                        {it.id}
                      </td>
                      <td className="w-full px-5 py-3 align-middle text-sm text-slate-700">
                        <Link
                          to={`/questoes/${it.id}`}
                          className="block w-full whitespace-normal break-words line-clamp-2 cursor-pointer text-slate-900 hover:text-emerald-700 hover:underline"
                          title={enunciado}
                        >
                          {enunciado || "—"}
                        </Link>
                        {activeTab === "mine" && isAnnulled && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            Anulada
                          </span>
                        )}
                      </td>
                      <td className="w-28 px-5 py-3 align-middle text-sm text-slate-700">
                        <span className="block truncate">{subjectLabel}</span>
                      </td>
                      <td className="w-36 whitespace-nowrap px-5 py-3 align-middle text-sm text-slate-700">
                        {activeTab === "mine" ? (
                          <QuestionActions
                            isMine={isMine}
                            annulled={isAnnulled}
                            onEdit={() => nav(`/questoes/${it.id}/editar`)}
                            onToggleAnnulled={() => onToggleAnnulled(it)}
                            onAddToCaderno={() => openAddToCadernoModal(it.id)}
                            canAddToCaderno={!isAnnulled}
                            onRemove={() => openDeleteDialog(it.id)}
                            variant="icons"
                          />
                        ) : (
                          <AddToCadernoButton
                            onClick={() => openAddToCadernoModal(it.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* FILTROS (desktop) */}
      <aside className="hidden lg:block lg:col-span-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filtros
          </div>

          <div className="mt-4 space-y-5 text-sm">
            <FilterGroup title="Por disciplina">
              <FilterLink
                active={subjectId === "todos"}
                onClick={() => setSubjectId("todos")}
              >
                Todos
              </FilterLink>

              {subjects.map((s) => (
                <FilterLink
                  key={s.id}
                  active={subjectId === s.id}
                  onClick={() => setSubjectId(s.id)}
                >
                  {s.name}
                </FilterLink>
              ))}
            </FilterGroup>

            <FilterGroup title="Por criado em">
              <FilterLink
                active={criadoEm === "qualquer"}
                onClick={() => setCriadoEm("qualquer")}
              >
                Qualquer data
              </FilterLink>
              <FilterLink
                active={criadoEm === "hoje"}
                onClick={() => setCriadoEm("hoje")}
              >
                Hoje
              </FilterLink>
              <FilterLink
                active={criadoEm === "7dias"}
                onClick={() => setCriadoEm("7dias")}
              >
                Últimos 7 dias
              </FilterLink>
              <FilterLink
                active={criadoEm === "mes"}
                onClick={() => setCriadoEm("mes")}
              >
                Este mês
              </FilterLink>
              <FilterLink
                active={criadoEm === "ano"}
                onClick={() => setCriadoEm("ano")}
              >
                Este ano
              </FilterLink>
            </FilterGroup>

            <button
              type="button"
              onClick={() => {
                setSubjectId("todos");
                setCriadoEm("qualquer");
                setQ("");
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </aside>

      {/* BOTTOM SHEET FILTROS (mobile) */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setFiltersOpen(false)}
            aria-label="Fechar filtros"
          />

          <div className="absolute inset-x-0 bottom-0">
            <div className="rounded-t-2xl bg-white shadow-2xl border-t border-slate-200">
              <div className="flex justify-center pt-3">
                <div className="h-1 w-12 rounded-full bg-slate-200" />
              </div>

              <div className="flex items-center justify-between px-5 pt-3 pb-4">
                <div className="text-sm font-semibold text-slate-900">
                  Filtros
                  {activeFiltersCount > 0 && (
                    <span className="ml-2 text-xs font-semibold text-emerald-700">
                      ({activeFiltersCount})
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="text-slate-500 hover:text-slate-700"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 pb-24 max-h-[70vh] overflow-auto">
                <div className="space-y-5 text-sm">
                  <FilterGroup title="Por disciplina">
                    <FilterLink
                      active={subjectId === "todos"}
                      onClick={() => setSubjectId("todos")}
                    >
                      Todos
                    </FilterLink>

                    {subjects.map((s) => (
                      <FilterLink
                        key={s.id}
                        active={subjectId === s.id}
                        onClick={() => setSubjectId(s.id)}
                      >
                        {s.name}
                      </FilterLink>
                    ))}
                  </FilterGroup>

                  <FilterGroup title="Por criado em">
                    <FilterLink
                      active={criadoEm === "qualquer"}
                      onClick={() => setCriadoEm("qualquer")}
                    >
                      Qualquer data
                    </FilterLink>
                    <FilterLink
                      active={criadoEm === "hoje"}
                      onClick={() => setCriadoEm("hoje")}
                    >
                      Hoje
                    </FilterLink>
                    <FilterLink
                      active={criadoEm === "7dias"}
                      onClick={() => setCriadoEm("7dias")}
                    >
                      Últimos 7 dias
                    </FilterLink>
                    <FilterLink
                      active={criadoEm === "mes"}
                      onClick={() => setCriadoEm("mes")}
                    >
                      Este mês
                    </FilterLink>
                    <FilterLink
                      active={criadoEm === "ano"}
                      onClick={() => setCriadoEm("ano")}
                    >
                      Este ano
                    </FilterLink>
                  </FilterGroup>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectId("todos");
                      setCriadoEm("qualquer");
                      setQ("");
                      setFiltersOpen(false);
                    }}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Limpar
                  </button>

                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AddToCadernoModal
        open={cadernoModalQuestionId !== null}
        questionId={cadernoModalQuestionId}
        onClose={closeAddToCadernoModal}
        onSuccess={() =>
          toast({
            type: "success",
            title: "Adicionada ao caderno",
          })
        }
        onError={(e) =>
          toast({
            type: "error",
            title: "Erro ao adicionar ao caderno",
            message: getApiErrorMessage(e),
          })
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Remover questão"
        description="Tem certeza que deseja remover essa questão? Essa ação não pode ser desfeita."
        confirmText={deleting ? "Removendo..." : "Remover"}
        loading={deleting}
        onClose={closeDeleteDialog}
        onConfirm={onDeleteConfirm}
      />

    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-700 mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FilterLink({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left rounded px-2 py-1 ${
        active
          ? "text-slate-900 font-semibold bg-slate-100"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

