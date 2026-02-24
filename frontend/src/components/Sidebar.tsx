import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  HelpCircle,
  FileText,
  BadgePercent,
  ClipboardCheck,
  LineChart,
} from "lucide-react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Tone = "red" | "yellow" | "green" | "blue";

export const links: Array<{
  to: string;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    style?: React.CSSProperties;
    className?: string;
  }>;
  tone: Tone;
}> = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, tone: "green" },
  { to: "/questoes", label: "Questões", icon: HelpCircle, tone: "blue" },
  { to: "/cadernos", label: "Cadernos", icon: FileText, tone: "yellow" },
  { to: "/ofertas", label: "Ofertas", icon: BadgePercent, tone: "red" },
  { to: "/gabaritos", label: "Gabaritos", icon: ClipboardCheck, tone: "green" },
  { to: "/relatorios", label: "Relatórios", icon: LineChart, tone: "blue" },
];

export default function Sidebar({
  onNavigate,
  showTitle = true,
  headerRight,
}: {
  onNavigate?: () => void;
  showTitle?: boolean;
  headerRight?: React.ReactNode;
}) {
  return (
    <aside className="w-full">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-borderDark dark:bg-surface-1">
        {(showTitle || headerRight) && (
          <div className="flex items-center justify-between">
            {showTitle ? (
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Navegação
              </div>
            ) : (
              <span />
            )}

            {headerRight}
          </div>
        )}

        <nav className={showTitle || headerRight ? "mt-4 space-y-1" : "space-y-1"}>
          {links.map((l) => {
            const Icon = l.icon;
            const fillVar = `var(--${l.tone}-fill)`;
            const strokeVar = `var(--${l.tone}-stroke)`;

            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cx(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors duration-200",
                    isActive
                      ? "bg-brand-500 text-white hover:bg-brand-600 dark:bg-brand-500/15 dark:text-brand-400 dark:hover:bg-brand-500/25"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-surface-2"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        "grid h-8 w-8 place-items-center rounded-lg border transition-colors duration-200",
                        isActive
                          ? "border-white/25 bg-white/15 dark:border-brand-500/25 dark:bg-brand-500/10"
                          : "border-slate-200 dark:border-borderDark"
                      )}
                      style={{ background: isActive ? undefined : fillVar }}
                      aria-hidden
                    >
                      <Icon
                        size={18}
                        strokeWidth={2}
                        className={isActive ? "text-white dark:text-brand-400" : undefined}
                        style={isActive ? undefined : { color: strokeVar }}
                      />
                    </span>

                    <span className="leading-tight">{l.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
