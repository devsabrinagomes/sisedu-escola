import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HELP_CONTENT, searchHelpItem } from "@/components/help/helpContent";

type HelpDrawerProps = {
  open: boolean;
  onClose: () => void;
};

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
}

export default function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previousFocusedRef = useRef<HTMLElement | null>(null);

  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const quickItems = useMemo(
    () => HELP_CONTENT.filter((item) => item.principal).slice(0, 6),
    [],
  );

  const results = useMemo(
    () => quickItems.filter((item) => searchHelpItem(item, query)),
    [quickItems, query],
  );

  function toggleItem(id: string) {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => {
    if (!open) return;
    previousFocusedRef.current = document.activeElement as HTMLElement | null;
    setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusables = getFocusableElements(drawerRef.current);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !drawerRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (open) return;
    previousFocusedRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Fechar ajuda"
      />

      <aside
        id="help-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-drawer-title"
        className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-slate-200 bg-white shadow-xl dark:border-borderDark dark:bg-surface-1"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-borderDark">
            <div className="flex items-start justify-between gap-3">
              <h2 id="help-drawer-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Ajuda
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-slate-300 dark:hover:bg-surface-2 dark:hover:text-slate-100"
                aria-label="Fechar painel de ajuda"
              >
                ✕
              </button>
            </div>

            <div className="mt-3">
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="text"
                aria-label="Buscar na ajuda"
                placeholder="Como podemos ajudar?"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-borderDark dark:bg-surface-1 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p aria-live="polite" className="mb-3 text-xs text-slate-500 dark:text-slate-300">
              {results.length} pergunta(s) principal(is)
            </p>

            {results.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 dark:border-borderDark dark:bg-surface-2 dark:text-slate-300">
                Nenhum conteúdo encontrado para o termo pesquisado.
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((item) => {
                  const expanded = Boolean(openItems[item.id]);
                  const contentId = `help-item-${item.id}`;
                  return (
                    <article key={item.id} className="rounded-lg border border-slate-200 dark:border-borderDark">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={contentId}
                        onClick={() => toggleItem(item.id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-surface-2"
                      >
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                            {item.categoria}
                          </div>
                          <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">{item.pergunta}</div>
                        </div>
                        <span className="text-slate-500 dark:text-slate-300">{expanded ? "−" : "+"}</span>
                      </button>

                      <div id={contentId} hidden={!expanded} className="border-t border-slate-200 px-3 py-3 dark:border-borderDark">
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
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 px-5 py-4 dark:border-borderDark">
            <Link
              to="/ajuda"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-lg btn-primary px-4 py-2 text-sm font-semibold"
            >
              Abrir Central de Ajuda completa
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
