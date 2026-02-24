import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import { getHabilidades, type Habilidade } from "@/features/relatorios/services/siseduReports";

type Filters = {
  disciplinaId?: number;
  serie?: number;
  nivel?: number;
};

export function useHabilidades(filters: Filters) {
  const [data, setData] = useState<Habilidade[]>([]);
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
      const rows = await getHabilidades({
        disciplinaId: filters.disciplinaId,
        serie: filters.serie,
        nivel: filters.nivel,
      });
      setData(rows);
    } catch (e: unknown) {
      setData([]);
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filters.disciplinaId, filters.nivel, filters.serie]);

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
