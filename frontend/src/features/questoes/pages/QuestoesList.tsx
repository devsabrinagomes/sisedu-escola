import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { Disciplina, Questao } from "@/types/core";
import { useAuth } from "@/auth/AuthContext";

function stripHtml(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

type CreatedAtPreset = "qualquer" | "hoje" | "7dias" | "mes" | "ano";
type SortKey =
  | "id"
  | "enunciado"
  | "disciplina"
  | "privacidade"
  | "criado_por"
  | "created_at";
type SortDir = "asc" | "desc";

const COLSPAN: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
};

export default function QuestoesList() {
  const nav = useNavigate();
  const { username: me } = useAuth();

  const [items, setItems] = useState<Questao[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState(true);

  // busca
  const [q, setQ] = useState("");

  // filtros
  const [disciplinaId, setDisciplinaId] = useState<number | "todos">("todos");
  const [criadoEm, setCriadoEm] = useState<CreatedAtPreset>("qualquer");

  // bottom sheet (mobile)
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!filtersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filtersOpen]);

  const activeFiltersCount =
    (disciplinaId !== "todos" ? 1 : 0) + (criadoEm !== "qualquer" ? 1 : 0);

  // ordenação
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  function buildParams(searchText: string) {
    const params: Record<string, any> = {};

    if (searchText.trim()) params.search = searchText.trim();
    if (disciplinaId !== "todos") params.disciplina = disciplinaId;

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

    params.ordering = toOrdering(sortKey, sortDir);
    return params;
  }

  async function load(searchText: string) {
    const reqId = ++reqIdRef.current;
    setLoading(true);

    try {
      const { data } = await api.get("/questoes/", {
        params: buildParams(searchText),
      });

      if (reqId !== reqIdRef.current) return;

      const list = Array.isArray(data) ? data : (data.results ?? []);
      setItems(list);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }

  // carrega disciplinas
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<Disciplina[]>("/disciplinas/");
        setDisciplinas(data);
      } catch {
        // ok
      }
    })();
  }, []);

  // inicial
  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto search enquanto digita
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => load(q), 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // refaz ao mudar filtros/ordenação
  useEffect(() => {
    load(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disciplinaId, criadoEm, sortKey, sortDir]);

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      load(q);
    }
  }

  function openQuestao(it: Questao) {
    const isMine =
      (it.criado_por || "").toLowerCase() === (me || "").toLowerCase();
    if (isMine) nav(`/questoes/${it.id}/editar`);
    else nav(`/questoes/${it.id}`);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function onDelete(it: Questao) {
    const isMine =
      (it.criado_por || "").toLowerCase() === (me || "").toLowerCase();
    if (!isMine) return;

    const ok = window.confirm(
      `Tem certeza que deseja excluir a questão #${it.id}? Essa ação não pode ser desfeita.`
    );
    if (!ok) return;

    try {
      await api.delete(`/questoes/${it.id}/`);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch (e: any) {
      window.alert(
        e?.response?.data?.detail ||
          "Não foi possível excluir. (Talvez não seja sua questão.)"
      );
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="lg:col-span-9 space-y-4 min-w-0">
        {/* Topo */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-xs font-medium text-slate-500">
            Buscar questões
          </label>

          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35m1.6-4.15a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onEnter}
                placeholder="Enunciado ou autor da questão"
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
              onClick={() => load(q)}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
              type="button"
              aria-label="Buscar"
              title="Buscar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m1.6-4.15a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5h18M6 12h12M10 19h4"
                />
              </svg>
              <span>Filtros</span>

              {activeFiltersCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <Link
              to="/questoes/nova"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              + Nova questão
            </Link>
          </div>

          <div className="mt-3 hidden lg:flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {loading
                ? "Carregando…"
                : `${items.length} ${items.length === 1 ? "questão" : "questões"}`}
            </div>

            <Link
              to="/questoes/nova"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              + Nova questão
            </Link>
          </div>

          <div className="mt-3 text-xs text-slate-500 lg:hidden">
            {loading
              ? "Carregando…"
              : `${items.length} ${items.length === 1 ? "questão" : "questões"}`}
          </div>
        </div>

        {/* MOBILE: cards */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              Carregando…
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 text-center shadow-sm">
              Nenhuma questão encontrada.
            </div>
          ) : (
            items.map((it) => {
              const resumo = stripHtml(it.enunciado_html || "");
              const isMine =
                (it.criado_por || "").toLowerCase() ===
                (me || "").toLowerCase();

              return (
                <div
                  key={it.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">
                        ID <span className="text-slate-800 font-semibold">#{it.id}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => openQuestao(it)}
                        className="mt-1 text-left text-sm font-semibold text-slate-900 hover:underline line-clamp-2"
                        title={isMine ? "Editar questão" : "Ver detalhes"}
                      >
                        {resumo || "(Sem enunciado)"}
                      </button>
                    </div>

                    {isMine && (
                      <button
                        type="button"
                        onClick={() => onDelete(it)}
                        className="rounded-md p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                        title="Excluir questão"
                        aria-label="Excluir questão"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {(it as any).disciplina_nome ?? (it as any).disciplina}
                    </span>

                    {(it as any).is_private ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                        Privada
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        Pública
                      </span>
                    )}

                    <span className="text-xs text-slate-500">
                      por <span className="text-slate-700">{(it as any).criado_por ?? "-"}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP: tabela */}
        <div className="hidden lg:block rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <div className="min-w-[600px]">
            {/* 12 colunas certinhas: 1 + 5 + 2 + 2 + 1 + 1 = 12 */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-slate-600 bg-slate-50 border-b border-slate-200">
              <Th
                colSpan={1}
                label="Código"
                active={sortKey === "id"}
                dir={sortDir}
                onClick={() => toggleSort("id")}
              />
              <Th
                colSpan={5}
                label="Enunciado"
                active={sortKey === "enunciado"}
                dir={sortDir}
                onClick={() => toggleSort("enunciado")}
              />
              <Th
                colSpan={2}
                label="Disciplina"
                active={sortKey === "disciplina"}
                dir={sortDir}
                onClick={() => toggleSort("disciplina")}
              />
              <Th
                colSpan={2}
                label="Visibilidade"
                align="center"
                active={sortKey === "privacidade"}
                dir={sortDir}
                onClick={() => toggleSort("privacidade")}
              />
              <Th
                colSpan={2}
                label="Criado por"
                align="left"
                active={sortKey === "criado_por"}
                dir={sortDir}
                onClick={() => toggleSort("criado_por")}
              />
              {/* <div className="col-span-1 flex items-center justify-center text-center">
                Ações
              </div> */}
            </div>

            {loading ? (
              <div className="px-4 py-8 text-sm text-slate-500">Carregando…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-sm text-slate-500 text-center">
                Nenhuma questão encontrada.
              </div>
            ) : (
              items.map((it) => {
                const resumo = stripHtml(it.enunciado_html || "");
                const isMine =
                  (it.criado_por || "").toLowerCase() ===
                  (me || "").toLowerCase();

                return (
                  <div
                    key={it.id}
                    className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-slate-200 text-sm items-center hover:bg-slate-50 transition"
                  >
                    <div className="col-span-1 text-slate-700">{it.id}</div>

                    <button
                      type="button"
                      onClick={() => openQuestao(it)}
                      className="col-span-5 text-left text-slate-900 hover:underline"
                      title={isMine ? "Editar questão" : "Ver detalhes"}
                    >
                      {resumo || "(Sem enunciado)"}
                    </button>

                    <div className="col-span-2 text-slate-700 truncate">
                      {(it as any).disciplina_nome ?? (it as any).disciplina}
                    </div>

                    <div className="col-span-2 flex justify-center">
                      {(it as any).is_private ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">
                          Privada
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
                          Pública
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 text-left text-slate-700 truncate">
                      {(it as any).criado_por ?? "-"}
                    </div>

                    {/* <div className="col-span-1 flex justify-center">
                      {isMine ? (
                        <button
                          type="button"
                          onClick={() => onDelete(it)}
                          className="rounded-md p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                          title="Excluir questão"
                          aria-label="Excluir questão"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </div> */}
                  </div>
                );
              })
            )}
          </div>
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
                active={disciplinaId === "todos"}
                onClick={() => setDisciplinaId("todos")}
              >
                Todos
              </FilterLink>

              {disciplinas.map((d) => (
                <FilterLink
                  key={d.id}
                  active={disciplinaId === d.id}
                  onClick={() => setDisciplinaId(d.id)}
                >
                  {d.nome}
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
                setDisciplinaId("todos");
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
                  ✕
                </button>
              </div>

              <div className="px-5 pb-24 max-h-[70vh] overflow-auto">
                <div className="space-y-5 text-sm">
                  <FilterGroup title="Por disciplina">
                    <FilterLink
                      active={disciplinaId === "todos"}
                      onClick={() => setDisciplinaId("todos")}
                    >
                      Todos
                    </FilterLink>

                    {disciplinas.map((d) => (
                      <FilterLink
                        key={d.id}
                        active={disciplinaId === d.id}
                        onClick={() => setDisciplinaId(d.id)}
                      >
                        {d.nome}
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
                      setDisciplinaId("todos");
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
    </div>
  );
}

function toOrdering(key: SortKey, dir: SortDir) {
  const field =
    key === "id"
      ? "id"
      : key === "enunciado"
        ? "enunciado_html"
        : key === "disciplina"
          ? "disciplina__nome"
          : key === "privacidade"
            ? "is_private"
            : key === "criado_por"
              ? "created_by__username"
              : "created_at";

  return dir === "desc" ? `-${field}` : field;
}

function Th({
  colSpan,
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  colSpan: number;
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "center" | "right";
}) {
  const justify =
    align === "center"
      ? "justify-center text-center"
      : align === "right"
        ? "justify-end text-right"
        : "justify-start text-left";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${COLSPAN[colSpan] ?? "col-span-1"} hover:underline flex items-center gap-1 ${justify}`}
      title="Ordenar"
    >
      <span>{label}</span>
      {active && (
        <span className="text-[10px] opacity-70">{dir === "asc" ? "▲" : "▼"}</span>
      )}
    </button>
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
