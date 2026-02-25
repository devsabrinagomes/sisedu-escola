import { useEffect, useState } from "react";
import type { OfferFilters, Paginated } from "@/features/ofertas/types";

type UseOfferListDataParams<TOffer> = {
  initialFilters: OfferFilters;
  loadOffers: (filters: OfferFilters) => Promise<Paginated<TOffer>>;
  loadErrorMessage: string;
};

export function useOfferListData<TOffer extends { deleted?: boolean }>(
  params: UseOfferListDataParams<TOffer>,
) {
  const { initialFilters, loadOffers, loadErrorMessage } = params;
  const [items, setItems] = useState<TOffer[]>([]);
  const [count, setCount] = useState(0);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [previousPage, setPreviousPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filters, setFilters] = useState<OfferFilters>(initialFilters);

  useEffect(() => {
    void reload();
  }, [filters]);

  async function reload() {
    try {
      setLoading(true);
      setErr("");
      const data = await loadOffers(filters);
      setItems(data.results.filter((offer) => !offer.deleted));
      setCount(data.count);
      setNextPage(data.next);
      setPreviousPage(data.previous);
    } catch {
      setItems([]);
      setCount(0);
      setNextPage(null);
      setPreviousPage(null);
      setErr(loadErrorMessage);
    } finally {
      setLoading(false);
    }
  }

  return {
    items,
    setItems,
    count,
    nextPage,
    previousPage,
    loading,
    err,
    filters,
    setFilters,
    reload,
  };
}
