export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type QuestionVersionDTO = {
  id: number;
  question: number;
  version_number: number;
  title: string;
  command: string;
  support_text: string;
  support_image: string | null;
  image_reference: string | null;
  subject: number;
  descriptor: number | null;
  skill: number | null;
  annulled: boolean;
  created_at: string;
};

export type QuestionDTO = {
  id: number;
  private: boolean;
  deleted: boolean;
  created_by: number | string;
  created_at: string;
  subject_name?: string | null;
  versions?: QuestionVersionDTO[];
};

export type SubjectDTO = {
  id: number;
  name: string;
};

export type BookletItemQuestionVersionDTO = {
  id: number;
  question: number;
  version_number?: number;
  title?: string;
  command?: string;
  subject?: number;
  subject_name?: string | null;
  descriptor?: number | null;
  skill?: number | null;
  annulled?: boolean;
  created_at?: string;
};

export type BookletItemDTO = {
  id: number;
  booklet: number;
  question_version: number | BookletItemQuestionVersionDTO;
  question_version_data?: BookletItemQuestionVersionDTO | null;
  question_id?: number;
  order: number;
};

export type BookletDTO = {
  id: number;
  name: string;
  deleted: boolean;
  created_at: string;
  created_by: number;
  items?: BookletItemDTO[];
  items_count?: number;
};

export type BookletItemDraft = {
  local_id: string;
  persisted_item_id?: number;
  question_version_id: number;
  question_id?: number;
  order: number;
  title: string;
  subject_name?: string | null;
  descriptor_label?: string | null;
  skill_label?: string | null;
  annulled?: boolean;
};

export type BookletItemUpsertInput = {
  question_version: number;
  order: number;
};
