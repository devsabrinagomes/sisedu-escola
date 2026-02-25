import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  HELP_CATEGORIES,
  HELP_CONTENT,
  type HelpCategory,
  searchHelpItem,
} from "@/components/help/helpContent";

type CategoryFilter = (typeof HELP_CATEGORIES)[number];

function isCategory(value: string | null): value is CategoryFilter {
  if (!value) return false;
  return HELP_CATEGORIES.includes(value as CategoryFilter);
}

export default function Ajuda() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get("categoria");
  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const category: CategoryFilter = isCategory(urlCategory) ? urlCategory : "Tudo";

  function setCategory(next: CategoryFilter) {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "Tudo") {
      nextParams.delete("categoria");
    } else {
      nextParams.set("categoria", next);
    }
    setSearchParams(nextParams, { replace: true });
  }

  const results = useMemo(() => {
    return HELP_CONTENT.filter((item) => {
      if (category !== "Tudo" && item.categoria !== category) return false;
      return searchHelpItem(item, query);
    });
  }, [category, query]);

  function toggleItem(id: string) {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-borderDark dark:bg-surface-1">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Central de Ajuda</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          FAQ e passo a passo completo do sistema.
        </p>

        <div className="mt-4">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar perguntas e passos da ajuda"
            placeholder="Buscar por pergunta, passo ou erro comum"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-borderDark dark:bg-surface-1 dark:text-slate-100"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {HELP_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                category === cat
                  ? "bg-brand-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-borderDark dark:bg-surface-1 dark:text-slate-200 dark:hover:bg-surface-2",
              ].join(" ")}
            >
              {cat}
            </button>
          ))}
        </div>

        <p aria-live="polite" className="mt-3 text-xs text-slate-500 dark:text-slate-300">
          {results.length} resultado(s)
        </p>
      </div>

      <div className="space-y-2">
        {results.map((item) => {
          const expanded = Boolean(openItems[item.id]);
          const contentId = `help-page-item-${item.id}`;
          return (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white dark:border-borderDark dark:bg-surface-1">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={contentId}
                onClick={() => toggleItem(item.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-surface-2"
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    {item.categoria}
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">{item.pergunta}</div>
                </div>
                <span className="text-slate-500 dark:text-slate-300">{expanded ? "−" : "+"}</span>
              </button>

              <div id={contentId} hidden={!expanded} className="border-t border-slate-200 px-4 py-3 dark:border-borderDark">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                  {item.passos.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>

                {item.dicas?.length ? (
                  <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                    <span className="font-semibold">Dica:</span> {item.dicas.join(" ")}
                  </div>
                ) : null}

                {item.errosComuns?.length ? (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200">
                    <span className="font-semibold">Erros comuns:</span> {item.errosComuns.join(" ")}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}

        {results.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 dark:border-borderDark dark:bg-surface-1 dark:text-slate-300">
            Nenhum conteúdo encontrado para os filtros atuais.
          </div>
        ) : null}
      </div>
    </section>
  );
}
