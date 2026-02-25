import type { ApplicationStatus } from "@/features/gabaritos/types";

export function getApplicationStatusLabel(status: ApplicationStatus) {
  if (status === "ABSENT") return "Ausente";
  if (status === "FINALIZED") return "Finalizado";
  if (status === "RECOGNIZED") return "Em andamento";
  return "Sem respostas";
}

export function getApplicationStatusBadgeClass(status: ApplicationStatus) {
  if (status === "ABSENT")
    return "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40";
  if (status === "FINALIZED")
    return "bg-emerald-50 text-brand-500 border border-emerald-100 dark:bg-brand-500/15 dark:text-brand-400 dark:border-brand-500/30";
  if (status === "RECOGNIZED")
    return "bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/35 dark:text-indigo-300 dark:border-indigo-700/40";
  return "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-surface-2 dark:text-slate-200 dark:border-borderDark";
}

export function summarizeQuestionPreview(title?: string | null, command?: string | null) {
  const text = (title || command || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "-";
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}...`;
}
