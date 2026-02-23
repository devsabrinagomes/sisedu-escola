import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { getBooklet, searchBooklets } from "@/features/cadernos/services/booklets";

export type BookletDTO = {
  id: number;
  name: string;
};

type Props = {
  value?: number;
  onChange: (bookletId: number | undefined) => void;
  disabled?: boolean;
};

export default function BookletCombobox({ value, onChange, disabled }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<BookletDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedName, setSelectedName] = useState("");

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      void loadOptions(query);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query, open]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [open]);

  useEffect(() => {
    if (typeof value !== "number") {
      setSelectedName("");
      return;
    }

    const found = options.find((item) => item.id === value);
    if (found) {
      setSelectedName(found.name);
      return;
    }

    void (async () => {
      try {
        const booklet = await getBooklet(value);
        setSelectedName(booklet.name);
      } catch {
        setSelectedName(`Caderno #${value}`);
      }
    })();
  }, [options, value]);

  async function loadOptions(searchText: string) {
    try {
      setLoading(true);
      const list = await searchBooklets({ search: searchText, page: 1 });
      const mapped = list.map((item) => ({ id: item.id, name: item.name }));
      setOptions(mapped);
      setHighlightedIndex(0);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
  }

  function closeDropdown() {
    setOpen(false);
  }

  function selectItem(item: BookletDTO) {
    onChange(item.id);
    setSelectedName(item.name);
    setQuery("");
    setOpen(false);
  }

  function clearSelection() {
    onChange(undefined);
    setSelectedName("");
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
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
      setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const current = options[highlightedIndex];
      if (current) selectItem(current);
    }
  }

  const selectedId = useMemo(() => value, [value]);
  const inputValue = open ? query : selectedName;

  return (
    <div ref={rootRef} className="relative">
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
          type="text"
          value={inputValue}
          disabled={disabled}
          onFocus={openDropdown}
          onClick={openDropdown}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Selecione um caderno"
          className="w-full bg-transparent outline-none placeholder:text-slate-400"
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
          aria-controls="booklet-combobox-list"
        />

        {selectedId ? (
          <button
            type="button"
            onClick={clearSelection}
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
        <div
          id="booklet-combobox-list"
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando cadernos...
            </div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              Nenhum caderno encontrado
            </div>
          ) : (
            options.map((option, index) => {
              const selected = selectedId === option.id;
              const highlighted = highlightedIndex === index;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectItem(option)}
                  className={[
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                    highlighted ? "bg-slate-100 text-slate-900" : "text-slate-700",
                  ].join(" ")}
                >
                  <span className="truncate">{option.name}</span>
                  {selected ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
