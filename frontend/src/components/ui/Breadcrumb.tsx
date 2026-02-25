import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  showBackButton?: boolean;
};

export default function Breadcrumb({
  items,
  showBackButton = true,
}: BreadcrumbProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    const fallbackTo = [...items].reverse().find((item) => item.to)?.to;
    if (fallbackTo) {
      navigate(fallbackTo);
      return;
    }
    navigate(-1);
  };

  const lastIndex = items.length - 1;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
      {showBackButton && (
        <button
          type="button"
          onClick={handleBack}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-2"
          aria-label="Voltar"
          title="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}

      {items.map((item, index) => {
        const isLast = index === lastIndex;

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {isLast ? (
              <span aria-current="page">{item.label}</span>
            ) : item.to ? (
              <Link to={item.to} className="hover:text-slate-800 dark:hover:text-slate-100">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}

            {!isLast && <span className="text-slate-300 dark:text-slate-500">/</span>}
          </div>
        );
      })}
    </nav>
  );
}
