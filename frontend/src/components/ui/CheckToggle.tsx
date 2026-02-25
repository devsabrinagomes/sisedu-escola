import { Check } from "lucide-react";

type CheckToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  shape?: "circle" | "square";
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

const sizeMap = {
  sm: { box: "h-5 w-5", icon: "h-3.5 w-3.5" },
  md: { box: "h-6 w-6", icon: "h-4 w-4" },
};

export default function CheckToggle({
  checked,
  onChange,
  shape = "circle",
  size = "sm",
  className = "",
  disabled = false,
  ariaLabel,
}: CheckToggleProps) {
  const sizeClass = sizeMap[size];

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "inline-flex items-center justify-center border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        sizeClass.box,
        shape === "circle" ? "rounded-full" : "rounded",
        checked
          ? "border-emerald-500 bg-emerald-500"
          : "border-slate-300 bg-white dark:border-borderDark dark:bg-surface-1",
        className,
      ].join(" ")}
    >
      <Check
        className={[
          sizeClass.icon,
          "text-white transition-all duration-200",
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
        ].join(" ")}
      />
    </button>
  );
}
