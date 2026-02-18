import React, { useLayoutEffect, useRef, useState } from "react";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export default function Accordion({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number>(defaultOpen ? 0 : 0);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    if (open) {
      setHeight(el.scrollHeight);
      const ro = new ResizeObserver(() => setHeight(el.scrollHeight));
      ro.observe(el);
      return () => ro.disconnect();
    }
    setHeight(0);
  }, [open]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
        aria-expanded={open}
      >
        <div className="min-w-0 text-left">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle && (
            <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
          )}
        </div>

        <svg
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div
        className="px-5"
        style={{
          height: open ? height : 0,
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-4px)",
          transition:
            "height 220ms ease, opacity 220ms ease, transform 220ms ease",
          overflow: "hidden",
        }}
      >
        <div ref={contentRef} className="pb-5 pt-1">
          {children}
        </div>
      </div>
    </div>
  );
}
