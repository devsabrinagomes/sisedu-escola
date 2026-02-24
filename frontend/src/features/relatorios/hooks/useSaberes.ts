import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import { getSaberes, type Saber } from "@/features/relatorios/services/siseduReports";

type Filters = {
  disciplinaId?: number;
  topicoId?: number;
};

export function useSaberes(filters: Filters) {
  const [data, setData] = useState<Saber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!filters.disciplinaId) {
      setData([]);
      setError("");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const rows = await getSaberes({
        disciplinaId: filters.disciplinaId,
        topicoId: filters.topicoId,
      });
      setData(rows);
    } catch (e: unknown) {
      setData([]);
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filters.disciplinaId, filters.topicoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    loading,
    error,
    empty: Boolean(filters.disciplinaId) && !loading && !error && data.length === 0,
    reload: load,
  };
}
