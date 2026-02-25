import type { ReportStudentStatus } from "@/features/relatorios/types";

export function formatPct(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export function getReportStudentStatusLabel(status: ReportStudentStatus) {
  if (status === "ABSENT") return "Ausente";
  if (status === "FINALIZED") return "Finalizado";
  if (status === "RECOGNIZED") return "Em andamento";
  return "Sem respostas";
}

export function getReportStudentStatusBadgeClass(status: ReportStudentStatus) {
  if (status === "ABSENT")
    return "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40";
  if (status === "FINALIZED")
    return "bg-emerald-50 text-brand-500 border border-emerald-100 dark:bg-brand-500/15 dark:text-brand-400 dark:border-brand-500/30";
  if (status === "RECOGNIZED")
    return "bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/35 dark:text-indigo-300 dark:border-indigo-700/40";
  return "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-surface-2 dark:text-slate-200 dark:border-borderDark";
}

export function parseBucketRange(range: string) {
  const match = String(range).match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

export function isInBucketRange(correctPct: number, range: string) {
  const parsed = parseBucketRange(range);
  if (!parsed) return false;
  if (parsed.max >= 100) return correctPct >= parsed.min && correctPct <= parsed.max;
  return correctPct >= parsed.min && correctPct < parsed.max;
}
