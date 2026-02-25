import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type DatePickerInputProps = {
  value?: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseIsoDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(value?: string) {
  const date = parseIsoDate(value);
  if (!date) return "";
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function DatePickerInput({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  disabled = false,
}: DatePickerInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!selectedDate) return;
    setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(viewMonth),
    [viewMonth],
  );

  const days = useMemo(() => {
    const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startWeekday = start.getDay();
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return {
        date,
        inCurrentMonth: date.getMonth() === viewMonth.getMonth(),
      };
    });
  }, [viewMonth]);

  const today = new Date();

  function selectDate(date: Date) {
    onChange(formatIsoDate(date));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 outline-none transition hover:bg-slate-50 focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-borderDark dark:bg-surface-1 dark:text-slate-300 dark:hover:bg-surface-2"
      >
        <span className={value ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}>
          {formatDisplayDate(value) || placeholder}
        </span>
        <CalendarDays className="h-4 w-4 text-slate-500 dark:text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[290px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-borderDark dark:bg-surface-1">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                )
              }
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-surface-2 dark:hover:text-slate-200"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{monthLabel}</div>
            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                )
              }
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-surface-2 dark:hover:text-slate-200"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="py-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map(({ date, inCurrentMonth }) => {
              const isToday = isSameDay(date, today);
              const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => selectDate(date)}
                  className={[
                    "h-8 rounded-md text-sm transition",
                    isSelected
                      ? "bg-brand-600 text-white hover:bg-brand-600"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-2",
                    !inCurrentMonth && !isSelected ? "text-slate-300 dark:text-slate-600" : "",
                    isToday && !isSelected ? "ring-1 ring-brand-500/40" : "",
                  ].join(" ")}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-borderDark">
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-surface-2 dark:hover:text-slate-200"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => selectDate(today)}
              className="rounded-md px-2 py-1 text-xs font-medium text-brand-500 hover:bg-emerald-50 dark:text-brand-400 dark:hover:bg-brand-500/15"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
