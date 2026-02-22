export function getApiErrorMessage(e: any): string {
  const data = e?.response?.data;
  return (
    data?.detail ||
    data?.message ||
    (typeof data === "string" ? data : "") ||
    "Não foi possível concluir a ação."
  );
}

