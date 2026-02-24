import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

export function useTableSort<TSortKey extends string>(initialSort: {
  key: TSortKey;
  dir: SortDir;
}) {
  const [sort, setSort] = useState<{ key: TSortKey; dir: SortDir }>(initialSort);

  function toggleSort(key: TSortKey) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }

  function getSortIcon(column: TSortKey) {
    const active = sort.key === column;
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
    return sort.dir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  }

  return {
    sort,
    setSort,
    toggleSort,
    getSortIcon,
  };
}
