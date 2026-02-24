import type { ApplicationStatus } from "@/features/gabaritos/types";

export function getApplicationStatusLabel(status: ApplicationStatus) {
  if (status === "ABSENT") return "Ausente";
  if (status === "FINALIZED") return "Finalizado";
  if (status === "RECOGNIZED") return "Em andamento";
  return "Sem respostas";
}

export function getApplicationStatusBadgeClass(status: ApplicationStatus) {
  if (status === "ABSENT") return "bg-amber-50 text-amber-700 border border-amber-100";
  if (status === "FINALIZED") return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (status === "RECOGNIZED") return "bg-indigo-50 text-indigo-700 border border-indigo-100";
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

export function summarizeQuestionPreview(title?: string | null, command?: string | null) {
  const text = (title || command || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "-";
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}...`;
}
