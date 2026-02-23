import { api } from "@/lib/api";
import { getOffer, listOffers } from "@/features/ofertas/services/offers";
import type { OfferFilters } from "@/features/ofertas/types";
import type {
  ApplicationAnswersResponseDTO,
  ClassDTO,
  OfferApplicationsSyncResponseDTO,
  SchoolDTO,
  StudentDTO,
} from "@/features/gabaritos/types";

export async function listGabaritoOffers(filters?: OfferFilters) {
  return listOffers(filters);
}

export async function getGabaritoOffer(offerId: number) {
  return getOffer(offerId);
}

export async function listMockSigeSchools() {
  const { data } = await api.get<SchoolDTO[]>("/mock/sige/schools/");
  return data;
}

export async function listMockSigeSchoolClasses(schoolRef: number) {
  const { data } = await api.get<ClassDTO[]>(`/mock/sige/schools/${schoolRef}/classes/`);
  return data;
}

export async function listMockSigeClassStudents(classRef: number) {
  const { data } = await api.get<StudentDTO[]>(`/mock/sige/classes/${classRef}/students/`);
  return data;
}

export async function syncOfferApplications(
  offerId: number,
  classRef: number,
  students: StudentDTO[],
) {
  const { data } = await api.post<OfferApplicationsSyncResponseDTO>(
    `/offers/${offerId}/applications/sync/`,
    {
      class_ref: classRef,
      students: students.map((student) => ({
        student_ref: student.student_ref,
        name: student.name,
      })),
    },
  );
  return data;
}

export async function getApplicationAnswers(applicationId: number) {
  const { data } = await api.get<ApplicationAnswersResponseDTO>(
    `/applications/${applicationId}/answers/`,
  );
  return data;
}

export async function saveApplicationAnswers(
  applicationId: number,
  answers: Array<{ booklet_item: number; selected_option: string | null }>,
) {
  const { data } = await api.put<ApplicationAnswersResponseDTO>(
    `/applications/${applicationId}/answers/`,
    { answers },
  );
  return data;
}

export async function patchApplicationAbsent(applicationId: number, studentAbsent: boolean) {
  const { data } = await api.patch<{
    application_id: number;
    student_absent: boolean;
    finalized_at: string | null;
    correct: number;
    wrong: number;
    blank: number;
    status: string;
  }>(`/applications/${applicationId}/absent/`, {
    student_absent: studentAbsent,
  });
  return data;
}
