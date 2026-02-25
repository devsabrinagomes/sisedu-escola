import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

const SUPPORT_PHONE = "558836951962";
const SUPPORT_LINK =
  "https://wa.me/558836951962?text=Olá!%20Preciso%20de%20ajuda%20no%20SISEDU%20Escola.";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function hasOpenDialog() {
  const dialogs = document.querySelectorAll<HTMLElement>(
    '[role="dialog"], [aria-modal="true"]',
  );
  return Array.from(dialogs).some((dialog) => {
    if (dialog.hidden) return false;
    if (dialog.getAttribute("aria-hidden") === "true") return false;
    if (dialog.closest("[aria-hidden='true']")) return false;

    const style = window.getComputedStyle(dialog);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (style.pointerEvents === "none") return false;
    if (Number(style.opacity) === 0) return false;

    return true;
  });
}

export default function WhatsAppSupportButton() {
  const phone = onlyDigits(SUPPORT_PHONE);
  const [hiddenByDialog, setHiddenByDialog] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const sync = () => setHiddenByDialog(hasOpenDialog());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-modal", "role", "class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const footer = document.querySelector("footer[role='contentinfo']");
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setFooterVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  if (!phone || hiddenByDialog) return null;

  const bottom = footerVisible ? (isMobile ? "7.5rem" : "6rem") : isMobile ? "5.5rem" : "1.5rem";

  return (
    <div className="pointer-events-none fixed right-4 z-30" style={{ bottom }}>
      <div className="group pointer-events-auto relative">
        <a
          href={SUPPORT_LINK}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar com o suporte pelo WhatsApp"
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-600/50 bg-emerald-600 text-white shadow-md transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-emerald-500/50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
        >
          <MessageCircle className="h-6 w-6" />
        </a>

        <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-borderDark dark:bg-surface-1 dark:text-slate-200">
          Suporte rápido
        </span>
      </div>
    </div>
  );
}
