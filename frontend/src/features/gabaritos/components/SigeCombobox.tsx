import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

type Option = {
  value: number;
  label: string;
};

type SigeComboboxProps = {
  label: ReactNode;
  placeholder: string;
  value?: number;
  options: Option[];
  loading?: boolean;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
  emptyText?: string;
};

export default function SigeCombobox({
  label,
  placeholder,
  value,
  options,
  loading = false,
  disabled = false,
  onChange,
  emptyText = "Nenhum resultado encontrado",
}: SigeComboboxProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, query]);

  const selected = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function selectOption(option: Option) {
    onChange(option.value);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const current = filtered[highlightedIndex];
      if (current) selectOption(current);
    }
  }

  return (
    <div ref={rootRef}>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <div className="relative">
        <div
          className={[
            "flex w-full items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700",
            "focus-within:ring-2 focus-within:ring-emerald-200",
            disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : "",
          ].join(" ")}
        >
          <Search className="mr-2 h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={open ? query : selected?.label || ""}
            disabled={disabled}
            onFocus={() => !disabled && setOpen(true)}
            onClick={() => !disabled && setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!open) setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent outline-none placeholder:text-slate-400"
          />

          {selected ? (
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                close();
              }}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Limpar seleção"
              aria-label="Limpar seleção"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <ChevronDown className="ml-1 h-4 w-4 text-slate-400" />
        </div>

        {open ? (
          <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            {loading ? (
              <div className="px-3 py-2 text-sm text-slate-500">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">{emptyText}</div>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value;
                const highlighted = highlightedIndex === index;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectOption(option)}
                    className={[
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                      highlighted ? "bg-slate-100 text-slate-900" : "text-slate-700",
                    ].join(" ")}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
