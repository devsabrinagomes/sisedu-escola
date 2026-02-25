import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  XCircle,
} from "lucide-react";
import type { ToastItem, ToastType } from "./useToast";

type ToastViewportProps = {
  items: ToastItem[];
  onClose: (id: string) => void;
};

function toastTone(type: ToastType) {
  if (type === "success") {
    return {
      icon: CheckCircle,
      className:
        "bg-emerald-50 border-emerald-200 text-brand-600 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-400",
    };
  }
  if (type === "error") {
    return {
      icon: XCircle,
      className:
        "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-300",
    };
  }
  if (type === "warning") {
    return {
      icon: AlertTriangle,
      className:
        "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-300",
    };
  }
  return {
    icon: Info,
    className:
      "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/35 dark:border-blue-700/40 dark:text-blue-300",
  };
}

function ToastCard({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: (id: string) => void;
}) {
  const [entered, setEntered] = useState(false);
  const tone = toastTone(item.type);
  const Icon = tone.icon;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={[
        "rounded-xl border shadow-md px-4 py-3 flex gap-3 items-start",
        "transition-all duration-200",
        tone.className,
        entered && !item.closing
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{item.title}</div>
        {item.message && <div className="mt-1 text-sm opacity-90">{item.message}</div>}
      </div>
      <button
        type="button"
        onClick={() => onClose(item.id)}
        className="rounded-md p-1 opacity-70 hover:opacity-100 transition"
        aria-label="Fechar notificação"
        title="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ToastViewport({ items, onClose }: ToastViewportProps) {
  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 space-y-2 sm:left-auto sm:right-4 sm:translate-x-0">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastCard item={item} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}
