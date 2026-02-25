import type { ButtonHTMLAttributes, ReactNode } from "react";
import EqualizerLoader from "@/components/ui/EqualizerLoader";
import useDelayedLoading from "@/shared/hooks/useDelayedLoading";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading: boolean;
  children: ReactNode;
  loadingText?: string;
  loaderSize?: number;
};

export default function LoadingButton({
  loading,
  children,
  loadingText = "Salvando...",
  loaderSize = 16,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  const showLoader = useDelayedLoading(loading);

  return (
    <button
      {...props}
      disabled={loading || disabled}
      aria-busy={loading}
      className={className}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          {showLoader ? <EqualizerLoader size={loaderSize} /> : null}
          <span>{showLoader ? loadingText : children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
