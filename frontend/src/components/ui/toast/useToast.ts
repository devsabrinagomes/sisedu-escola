import { createContext, useContext } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastInput = {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
};

export type ToastItem = ToastInput & {
  id: string;
  closing?: boolean;
};

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}

