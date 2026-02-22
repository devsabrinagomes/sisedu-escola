import { useCallback, useMemo, useRef, useState } from "react";
import ToastViewport from "./ToastViewport";
import { ToastContext, type ToastInput, type ToastItem } from "./useToast";

const DEFAULT_DURATION = 3500;
const EXIT_ANIMATION_MS = 220;

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const remove = useCallback((id: string) => {
    const timer = timersRef.current[id];
    if (timer) {
      window.clearTimeout(timer);
      delete timersRef.current[id];
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, closing: true } : item)),
      );
      window.setTimeout(() => remove(id), EXIT_ANIMATION_MS);
    },
    [remove],
  );

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const duration = input.duration ?? DEFAULT_DURATION;

      setItems((prev) => [...prev, { ...input, id, duration }]);

      timersRef.current[id] = window.setTimeout(() => {
        dismiss(id);
      }, duration);

      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onClose={dismiss} />
    </ToastContext.Provider>
  );
}

