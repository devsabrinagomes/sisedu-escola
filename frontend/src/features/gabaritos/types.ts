import type { OfferDTO, OfferStatus, Paginated } from "@/features/ofertas/types";

export type { OfferDTO, OfferStatus, Paginated };

export type SchoolDTO = {
  school_ref: number;
  name: string;
};

export type ClassDTO = {
  class_ref: number;
  name: string;
  year: number;
};

export type StudentDTO = {
  student_ref: number;
  name: string;
};

export type ApplicationStatus =
  | "NONE"
  | "MANUAL"
  | "RECOGNIZED"
  | "ABSENT"
  | "FINALIZED";

export type ApplicationRowDTO = {
  application_id: number;
  student_ref: number;
  student_name: string;
  student_absent: boolean;
  finalized_at: string | null;
  correct: number;
  wrong: number;
  blank: number;
  status: ApplicationStatus;
};

export type OfferApplicationsSyncResponseDTO = {
  offer_id: number;
  class_ref: number;
  items_total: number;
  applications: ApplicationRowDTO[];
};

export type BookletItemQuestionVersionPreviewDTO = {
  id: number;
  question: number;
  version_number: number;
  title: string;
  command: string;
  subject: number | null;
  subject_name: string | null;
};

export type BookletItemAnswerDTO = {
  id: number;
  order: number;
  question_version: BookletItemQuestionVersionPreviewDTO;
};

export type AnswerDTO = {
  booklet_item: number;
  selected_option: string | null;
  is_correct: boolean;
};

export type AnswerSummaryDTO = {
  correct: number;
  wrong: number;
  blank: number;
  status: ApplicationStatus;
};

export type ApplicationAnswersResponseDTO = {
  application_id: number;
  offer_id: number;
  booklet_id: number;
  items_total: number;
  booklet_items: BookletItemAnswerDTO[];
  answers: AnswerDTO[];
  summary: AnswerSummaryDTO;
};
