import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import { getDisciplinas, type Disciplina } from "@/features/relatorios/services/siseduReports";

export function useDisciplinas() {
  const [data, setData] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const rows = await getDisciplinas();
      setData(rows);
    } catch (e: unknown) {
      setData([]);
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    loading,
    error,
    empty: !loading && !error && data.length === 0,
    reload: load,
  };
}

