import { useEffect, useRef, useState } from "react";

const DEFAULT_DELAY_MS = 250;
const DEFAULT_MIN_VISIBLE_MS = 400;

export function useDelayedLoading(
  isLoading: boolean,
  delayMs = DEFAULT_DELAY_MS,
  minVisibleMs = DEFAULT_MIN_VISIBLE_MS,
) {
  const [visible, setVisible] = useState(false);
  const showAtRef = useRef<number | null>(null);
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (showTimeoutRef.current) {
      window.clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (isLoading) {
      showTimeoutRef.current = window.setTimeout(() => {
        showAtRef.current = Date.now();
        setVisible(true);
      }, delayMs);
      return;
    }

    if (!visible) {
      showAtRef.current = null;
      return;
    }

    const shownAt = showAtRef.current ?? Date.now();
    const elapsed = Date.now() - shownAt;
    const remaining = Math.max(0, minVisibleMs - elapsed);

    hideTimeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      showAtRef.current = null;
    }, remaining);
  }, [delayMs, isLoading, minVisibleMs, visible]);

  useEffect(
    () => () => {
      if (showTimeoutRef.current) window.clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    },
    [],
  );

  return visible;
}

export default useDelayedLoading;
