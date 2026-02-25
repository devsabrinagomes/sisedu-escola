import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import EqualizerLoader from "@/components/ui/EqualizerLoader";
import useDelayedLoading from "@/shared/hooks/useDelayedLoading";

type Option = {
  value: number;
  label: string;
};

type SigeMultiComboboxProps = {
  label: ReactNode;
  placeholder: string;
  values: number[];
  options: Option[];
  loading?: boolean;
  disabled?: boolean;
  onChange: (values: number[]) => void;
  emptyText?: string;
  selectAllLabel?: string;
};

export default function SigeMultiCombobox({
  label,
  placeholder,
  values,
  options,
  loading = false,
  disabled = false,
  onChange,
  emptyText = "Nenhum resultado encontrado",
  selectAllLabel = "Selecionar todas",
}: SigeMultiComboboxProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const showLoading = useDelayedLoading(loading);

  const normalizedValues = useMemo(() => Array.from(new Set(values)), [values]);
  const selectedSet = useMemo(() => new Set(normalizedValues), [normalizedValues]);
  const uniqueOptions = useMemo(() => {
    const map = new Map<number, Option>();
    options.forEach((option) => {
      if (!map.has(option.value)) map.set(option.value, option);
    });
    return Array.from(map.values());
  }, [options]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return uniqueOptions;
    return uniqueOptions.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [query, uniqueOptions]);

  const allSelected = uniqueOptions.length > 0 && normalizedValues.length === uniqueOptions.length;

  const selectedOptions = useMemo(
    () =>
      normalizedValues.map((value) => {
        const option = uniqueOptions.find((opt) => opt.value === value);
        return {
          value,
          label: option?.label || String(value),
        };
      }),
    [normalizedValues, uniqueOptions],
  );

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
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

  function toggleValue(nextValue: number) {
    if (selectedSet.has(nextValue)) {
      onChange(normalizedValues.filter((value) => value !== nextValue));
      return;
    }
    onChange(Array.from(new Set([...normalizedValues, nextValue])));
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
      return;
    }
    onChange(uniqueOptions.map((option) => option.value));
  }

  return (
    <div ref={rootRef}>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      <div className="relative">
        <div
          className={[
            "flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-borderDark dark:bg-surface-1 dark:text-slate-300",
            "focus-within:ring-2 focus-within:ring-brand-500/40",
            disabled ? "cursor-not-allowed bg-slate-50 text-slate-400 dark:bg-surface-2 dark:text-slate-500" : "",
          ].join(" ")}
        >
          <Search className="h-4 w-4 text-slate-400" />
          {selectedOptions.map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:border-borderDark dark:bg-surface-2 dark:text-slate-300"
            >
              <button
                type="button"
                onClick={() => toggleValue(option.value)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                title={`Remover ${option.label}`}
                aria-label={`Remover ${option.label}`}
              >
                <X className="h-3 w-3" />
              </button>
              <span className="truncate">{option.label}</span>
            </span>
          ))}
          <input
            ref={inputRef}
            value={query}
            disabled={disabled}
            onFocus={() => !disabled && setOpen(true)}
            onClick={() => !disabled && setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!open) setOpen(true);
            }}
            placeholder={selectedOptions.length === 0 ? placeholder : ""}
            className="min-w-[10ch] flex-1 bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />

          {normalizedValues.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setQuery("");
              }}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-surface-2 dark:hover:text-slate-200"
              title="Limpar seleção"
              aria-label="Limpar seleção"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </div>

        {open ? (
          <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-borderDark dark:bg-surface-1">
            {loading ? (
              <div className="flex items-center justify-center px-3 py-3" aria-busy="true">
                {showLoading ? <EqualizerLoader size={16} /> : null}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-2"
                >
                  <span>{selectAllLabel}</span>
                  {allSelected ? <Check className="h-4 w-4 text-brand-500 dark:text-brand-400" /> : null}
                </button>
                {filtered.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{emptyText}</div>
                ) : (
                  filtered.map((option) => {
                    const isSelected = selectedSet.has(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleValue(option.value)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-2"
                      >
                        <span className="truncate">{option.label}</span>
                        {isSelected ? <Check className="h-4 w-4 text-brand-500 dark:text-brand-400" /> : null}
                      </button>
                    );
                  })
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
