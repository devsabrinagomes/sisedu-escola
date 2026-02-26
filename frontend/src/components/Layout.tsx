import { Link, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { CircleHelp, Menu, Moon, Sun } from "lucide-react";
import logo from "../assets/images/logo/logo.png";
import { useTheme } from "@/shared/hooks/useTheme";
import VLibrasWidget from "@/components/accessibility/VLibrasWidget";
import HelpDrawer from "@/components/help/HelpDrawer";
import WhatsAppSupportButton from "@/components/support/WhatsAppSupportButton";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const vlibrasEnabled = (import.meta.env.VITE_VLIBRAS_ENABLED ?? "true") !== "false";

  // fecha ao apertar ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-darkbg dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      {/* HEADER */}
      <header className="sticky top-0 z-20 h-auto border-b border-green-500 bg-white shadow-md dark:border-borderDark dark:bg-surface-1">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Botão sanduíche: só no mobile */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 lg:hidden dark:text-slate-100 dark:hover:bg-surface-2 dark:focus-visible:ring-brand-500/40"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link to="/" aria-label="Ir para o Dashboard" className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
              <img
                src={logo}
                alt="SISEDU Escola"
                className="h-20 w-auto"
              />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={helpOpen}
              aria-controls="help-drawer"
              aria-label="Abrir ajuda"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:w-auto sm:gap-2 sm:px-3 dark:border-borderDark dark:bg-surface-2 dark:text-slate-100 dark:hover:bg-surface-2"
            >
              <CircleHelp className="h-4 w-4" />
              <span className="hidden sm:inline">Ajuda</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-borderDark dark:bg-surface-2 dark:text-[var(--yellow-stroke)] dark:hover:bg-surface-2"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* DRAWER MOBILE */}
      <div
        className={cx(
          "fixed inset-0 z-40 lg:hidden transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* backdrop */}
        <div
          className={cx(
            "absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />

        {/* painel animado */}
        <div
          className={cx(
            "absolute left-4 top-4 w-[86%] max-w-[320px] max-h-[calc(100dvh-2rem)] overflow-y-auto",
            "transition-all duration-300 ease-out",
            open
              ? "translate-x-0 opacity-100"
              : "-translate-x-8 opacity-0"
          )}
          role="dialog"
          aria-modal="true"
          aria-hidden={!open}
        >
          <Sidebar
            onNavigate={() => setOpen(false)}
            showTitle
            headerRight={
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition dark:text-slate-300 dark:hover:bg-surface-2 dark:hover:text-slate-100"
                aria-label="Fechar"
              >
                ✕
              </button>
            }
          />
        </div>
      </div>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />


      {/* CONTEÚDO */}
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex gap-6">
          {/* Sidebar fixa: só desktop */}
          <div className="hidden w-64 shrink-0 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
            <Sidebar />
          </div>

          <section className="min-w-0 flex-1">
            <Outlet />
          </section>
        </div>
      </main>
      <Footer />
      <WhatsAppSupportButton />
      <VLibrasWidget enabled={vlibrasEnabled} />
    </div>
  );
}
