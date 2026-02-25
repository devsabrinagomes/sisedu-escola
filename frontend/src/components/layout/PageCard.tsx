import { ArrowLeft } from "lucide-react";
import Breadcrumb from "@/components/ui/Breadcrumb";

type BreadcrumbItem = { label: string; to?: string };

type PageCardProps = {
  breadcrumb: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
};

export default function PageCard({
  breadcrumb,
  title,
  subtitle,
  onBack,
  rightSlot,
  children,
}: PageCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-borderDark dark:bg-surface-1 sm:p-6">
      <div className="mb-4 border-b border-slate-100 pb-4 dark:border-borderDark">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-surface-2 dark:hover:text-slate-200"
                  aria-label="Voltar"
                  title="Voltar"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <Breadcrumb items={breadcrumb} showBackButton={false} />
            </div>

            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>}
            </div>
          </div>

          {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        </div>
      </div>

      {children}
    </div>
  );
}
