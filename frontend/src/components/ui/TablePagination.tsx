type TablePaginationProps = {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  loading?: boolean;
  className?: string;
};

export default function TablePagination({
  page,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  loading = false,
  className,
}: TablePaginationProps) {
  return (
    <div className={className ?? "flex items-center justify-end gap-2"}>
      <button
        type="button"
        onClick={onPrevious}
        disabled={!hasPrevious || loading}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-borderDark dark:bg-surface-1 dark:text-slate-200 dark:hover:bg-surface-2"
      >
        Página anterior
      </button>
      <span className="text-sm text-slate-500 dark:text-slate-300">Página {page}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext || loading}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-borderDark dark:bg-surface-1 dark:text-slate-200 dark:hover:bg-surface-2"
      >
        Próxima página
      </button>
    </div>
  );
}
