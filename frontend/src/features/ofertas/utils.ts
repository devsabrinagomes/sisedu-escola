import type { OfferDTO, OfferStatus } from "@/features/ofertas/types";

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

function offerKitPendingKey(offerId: number) {
  return `offer:kit:pending:${offerId}`;
}

export function setOfferKitPending(offerId: number, pending: boolean) {
  if (pending) {
    localStorage.setItem(offerKitPendingKey(offerId), "1");
    return;
  }
  localStorage.removeItem(offerKitPendingKey(offerId));
}

export function isOfferKitPending(offerId: number) {
  return localStorage.getItem(offerKitPendingKey(offerId)) === "1";
}
