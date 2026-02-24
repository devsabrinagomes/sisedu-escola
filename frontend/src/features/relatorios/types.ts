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
  items_total: number;
  students_total: number;
  absent_count: number;
  finalized_count: number;
  in_progress_count: number;
  avg_correct: number;
  avg_correct_pct: number;
  distribution: ReportDistributionBucketDTO[];
  students: ReportStudentRowDTO[];
  items: ReportItemRowDTO[];
};
