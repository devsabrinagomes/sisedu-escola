type TabOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type TabsProps<T extends string> = {
  tabs: TabOption<T>[];
  active: T;
  onChange: (value: T) => void;
  className?: string;
};

export default function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className = "",
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label="Abas"
      className={`flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 ${className}`.trim()}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.value)}
            className={[
              "px-3 py-1.5 text-sm rounded-md transition border",
              isActive
                ? "bg-white border-slate-200 text-slate-900 font-semibold shadow-sm"
                : "bg-transparent border-transparent text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {tab.label}
            {typeof tab.count === "number" ? ` (${tab.count})` : ""}
          </button>
        );
      })}
    </div>
  );
}
