export function getApiErrorMessage(e: any): string {
  const data = e?.response?.data;
  if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      if (key === "detail" || key === "message") continue;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === "string" && first.trim()) return first;
      }
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return (
    data?.detail ||
    data?.message ||
    (typeof data === "string" ? data : "") ||
    "Não foi possível concluir a ação."
  );
}
