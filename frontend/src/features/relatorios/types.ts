import type { OfferDTO, OfferFilters, OfferStatus, Paginated } from "@/features/ofertas/types";

export type { OfferDTO, OfferFilters, OfferStatus, Paginated };

export type ReportStudentStatus = "NONE" | "RECOGNIZED" | "ABSENT" | "FINALIZED";

export type ReportDistributionBucketDTO = {
  correct: number;
  count: number;
};

export type ReportStudentRowDTO = {
  student_ref: number;
  name: string;
  class_ref: number;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  correct_pct: number;
  status: ReportStudentStatus;
};

export type ReportItemRowDTO = {
  booklet_item_id: number;
  order: number;
  question_id: number;
  subject_name: string | null;
  correct_pct: number;
  wrong_pct: number;
  blank_pct: number;
  most_marked_option: string | null;
  total_answered: number;
  question_detail_url: string | null;
};

export type ReportSummaryDTO = {
  totals?: {
    students_total: number;
    absent: number;
    finalized: number;
    in_progress: number;
  };
  items_total: number;
  students_total: number;
  absent_count: number;
  finalized_count: number;
  in_progress_count: number;
  avg_correct: number;
  avg_correct_pct: number;
  accuracy_buckets?: Array<{
    range: string;
    count_students: number;
    pct_students: number;
  }>;
  distribution: ReportDistributionBucketDTO[];
  students: ReportStudentRowDTO[];
  items: ReportItemRowDTO[];
};

export type ReportsOverviewTopOfferDTO = {
  offer_id: number;
  label: string;
  finalized_pct: number;
};

export type ReportsOverviewBucketDTO = {
  range: string;
  pct_students: number;
  count_students: number;
};

export type ReportsOverviewRecentOfferDTO = {
  offer_id: number;
  label: string;
  booklet_name: string;
  start_date: string;
  end_date: string;
  created_at: string;
};

export type ReportsOverviewDTO = {
  offers_active: number;
  offers_closed: number;
  offers_total: number;
  applications_total: number;
  answered_total: number;
  finalized_total: number;
  absent_total: number;
  finalization_rate_pct: number;
  top_offers_finalization: ReportsOverviewTopOfferDTO[];
  accuracy_buckets_overall: ReportsOverviewBucketDTO[];
  recent_offers: ReportsOverviewRecentOfferDTO[];
};

export type ReportByClassRowDTO = {
  class_id: number;
  class_name: string;
  total_students: number;
  accuracy_percent: number;
  absent_count: number;
  absent_percent: number;
};
