import { useEffect } from "react";

declare global {
  interface Window {
    VLibras?: {
      Widget: new (url: string) => unknown;
    };
    __vlibrasWidgetInstance?: unknown;
    __vlibrasMountCount?: number;
    __vlibrasInitPromise?: Promise<void>;
  }
}

const VLIBRAS_SCRIPT_ID = "vlibras-plugin-script";
const VLIBRAS_ROOT_ID = "vlibras-plugin-root";

function ensureVlibrasMarkup() {
  let root = document.getElementById(VLIBRAS_ROOT_ID);
  if (root) return root;

  root = document.createElement("div");
  root.id = VLIBRAS_ROOT_ID;

  const wrapper = document.createElement("div");
  wrapper.setAttribute("vw", "");
  wrapper.className = "enabled";

  const accessButton = document.createElement("div");
  accessButton.setAttribute("vw-access-button", "");
  accessButton.className = "active";

  const pluginWrapper = document.createElement("div");
  pluginWrapper.setAttribute("vw-plugin-wrapper", "");

  const topWrapper = document.createElement("div");
  topWrapper.className = "vw-plugin-top-wrapper";

  pluginWrapper.appendChild(topWrapper);
  wrapper.appendChild(accessButton);
  wrapper.appendChild(pluginWrapper);
  root.appendChild(wrapper);

  document.body.appendChild(root);
  return root;
}

function loadScriptOnce() {
  if (window.__vlibrasInitPromise) return window.__vlibrasInitPromise;

  window.__vlibrasInitPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(VLIBRAS_SCRIPT_ID) as HTMLScriptElement | null;

    const onReady = () => resolve();
    const onError = () => reject(new Error("Falha ao carregar script do VLibras"));

    if (existing) {
      if (window.VLibras?.Widget) {
        resolve();
        return;
      }
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = VLIBRAS_SCRIPT_ID;
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener("error", onError, { once: true });
    document.body.appendChild(script);
  });

  return window.__vlibrasInitPromise;
}

function initWidgetOnce() {
  if (window.__vlibrasWidgetInstance || !window.VLibras?.Widget) return;
  window.__vlibrasWidgetInstance = new window.VLibras.Widget("https://vlibras.gov.br/app");
}

type VLibrasWidgetProps = {
  enabled: boolean;
};

export default function VLibrasWidget({ enabled }: VLibrasWidgetProps) {
  useEffect(() => {
    if (!enabled) return;

    window.__vlibrasMountCount = (window.__vlibrasMountCount || 0) + 1;
    ensureVlibrasMarkup();

    void loadScriptOnce()
      .then(() => {
        initWidgetOnce();
      })
      .catch(() => {
        // Intencional: falha do widget não deve quebrar a aplicação.
      });

    return () => {
      window.__vlibrasMountCount = Math.max((window.__vlibrasMountCount || 1) - 1, 0);
      if (window.__vlibrasMountCount > 0) return;

      document.getElementById(VLIBRAS_SCRIPT_ID)?.remove();
      document.getElementById(VLIBRAS_ROOT_ID)?.remove();
      window.__vlibrasWidgetInstance = undefined;
      window.__vlibrasInitPromise = undefined;
    };
  }, [enabled]);

  return null;
}
