export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type BookletOptionDTO = {
  id: number;
  name: string;
};

export type OfferBookletRef =
  | number
  | {
      id: number;
      name: string;
    };

export type OfferDTO = {
  id: number;
  booklet: OfferBookletRef;
  booklet_name?: string | null;
  created_by_name?: string | null;
  start_date: string;
  end_date: string;
  description?: string | null;
  deleted: boolean;
  created_at: string;
  created_by: number;
};

export type OfferStatus = "upcoming" | "open" | "closed";

export type OfferFilters = {
  search?: string;
  booklet?: number | "all";
  status?: OfferStatus | "all";
  start_date?: string;
  end_date?: string;
  page?: number;
};

export type OfferPayload = {
  booklet: number;
  start_date: string;
  end_date: string;
  description: string;
};
