import type { OfferDTO, OfferStatus } from "@/features/ofertas/types";

export type OfferSigeSelection = {
  school_refs?: number[];
  school_names?: string[];
  series_years?: number[];
  class_refs?: number[];
  class_names?: string[];
};

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(dt);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
    .format(dt)
    .replace(",", " às");
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function getOfferStatus(offer: Pick<OfferDTO, "start_date" | "end_date">): OfferStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = dateOnly(offer.start_date);
  const end = dateOnly(offer.end_date);

  if (today < start) return "upcoming";
  if (today > end) return "closed";
  return "open";
}

export function getOfferStatusLabel(status: OfferStatus) {
  if (status === "upcoming") return "Em breve";
  if (status === "open") return "Aberta";
  return "Encerrada";
}

export function getOfferStatusBadgeClass(status: OfferStatus) {
  if (status === "upcoming") {
    return "bg-amber-50 text-amber-700 border border-amber-100";
  }
  if (status === "open") {
    return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

export function getBookletId(offer: OfferDTO) {
  return typeof offer.booklet === "number" ? offer.booklet : offer.booklet.id;
}

export function getBookletName(offer: OfferDTO) {
  if (typeof offer.booklet !== "number") return offer.booklet.name;
  return offer.booklet_name || `Caderno #${offer.booklet}`;
}

export function normalizeDescription(value: string) {
  return value.trim();
}

export function validateOfferDates(startDate: string, endDate: string) {
  if (!startDate || !endDate) return true;
  return endDate >= startDate;
}

function bookletKitPendingKey(bookletId: number) {
  return `booklet:kit:pending:${bookletId}`;
}

export function setBookletKitPending(bookletId: number, pending: boolean) {
  if (pending) {
    localStorage.setItem(bookletKitPendingKey(bookletId), "1");
    return;
  }
  localStorage.removeItem(bookletKitPendingKey(bookletId));
}

export function isBookletKitPending(bookletId: number) {
  return localStorage.getItem(bookletKitPendingKey(bookletId)) === "1";
}

function offerSigeSelectionKey(offerId: number) {
  return `offer:sige:selection:${offerId}`;
}

export function setOfferSigeSelection(offerId: number, selection: OfferSigeSelection) {
  const hasAny =
    (selection.school_refs?.length || 0) > 0 ||
    (selection.school_names?.length || 0) > 0 ||
    (selection.series_years?.length || 0) > 0 ||
    (selection.class_refs?.length || 0) > 0 ||
    (selection.class_names?.length || 0) > 0;

  if (!hasAny) {
    localStorage.removeItem(offerSigeSelectionKey(offerId));
    return;
  }

  localStorage.setItem(offerSigeSelectionKey(offerId), JSON.stringify(selection));
}

export function getOfferSigeSelection(offerId: number): OfferSigeSelection | null {
  const raw = localStorage.getItem(offerSigeSelectionKey(offerId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as
      | OfferSigeSelection
      | {
          school_ref?: number;
          school_name?: string;
          series_year?: number;
          class_ref?: number;
          class_name?: string;
        };

    // Backward compatibility: migrate formato antigo (single) para novo (multi)
    if ("school_ref" in parsed || "class_ref" in parsed || "series_year" in parsed) {
      const legacy = parsed as {
        school_ref?: number;
        school_name?: string;
        series_year?: number;
        class_ref?: number;
        class_name?: string;
      };
      const normalized: OfferSigeSelection = {
        school_refs: legacy.school_ref ? [legacy.school_ref] : [],
        school_names: legacy.school_name ? [legacy.school_name] : [],
        series_years: legacy.series_year ? [legacy.series_year] : [],
        class_refs: legacy.class_ref ? [legacy.class_ref] : [],
        class_names: legacy.class_name ? [legacy.class_name] : [],
      };
      return normalized;
    }

    return parsed as OfferSigeSelection;
  } catch {
    return null;
  }
}
