import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageCard from "@/components/layout/PageCard";
import CheckToggle from "@/components/ui/CheckToggle";
import { useToast } from "@/components/ui/toast/useToast";
import {
  getApplicationAnswers,
  getGabaritoOffer,
  listMockSigeClassStudents,
  listMockSigeSchoolClasses,
  listMockSigeSchools,
  patchApplicationAbsent,
  syncOfferApplications,
} from "@/features/gabaritos/services/gabaritos";
import type {
  ApplicationRowDTO,
  ApplicationStatus,
  ClassDTO,
  OfferDTO,
  SchoolDTO,
  StudentDTO,
} from "@/features/gabaritos/types";
import {
  getApplicationStatusBadgeClass,
  getApplicationStatusLabel,
} from "@/features/gabaritos/utils";
import SigeCombobox from "@/features/gabaritos/components/SigeCombobox";
import AnswersDrawer from "@/features/gabaritos/components/AnswersDrawer";
import { formatDate, getBookletName, getOfferStatus, getOfferStatusBadgeClass, getOfferStatusLabel } from "@/features/ofertas/utils";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

export default function GabaritoOfertaGestao() {
  const { offerId } = useParams();
  const parsedOfferId = Number(offerId);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [offer, setOffer] = useState<OfferDTO | null>(null);
  const [offerLoading, setOfferLoading] = useState(true);
  const [offerError, setOfferError] = useState("");

  const [schools, setSchools] = useState<SchoolDTO[]>([]);
  const [classes, setClasses] = useState<ClassDTO[]>([]);
  const [students, setStudents] = useState<StudentDTO[]>([]);
  const [applications, setApplications] = useState<ApplicationRowDTO[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);

  const [schoolRef, setSchoolRef] = useState<number | undefined>(undefined);
  const [classRef, setClassRef] = useState<number | undefined>(undefined);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  const [formError, setFormError] = useState("");
  const [drawerApplication, setDrawerApplication] = useState<ApplicationRowDTO | null>(null);

  useEffect(() => {
    if (!parsedOfferId) return;
    void loadOffer();
    void loadSchools();
  }, [parsedOfferId]);

  useEffect(() => {
    if (!schoolRef) {
      setClasses([]);
      setClassRef(undefined);
      return;
    }
    void loadClasses(schoolRef);
  }, [schoolRef]);

  const selectedClassName = useMemo(() => {
    if (!classRef) return "";
    return classes.find((cls) => cls.class_ref === classRef)?.name || "";
  }, [classes, classRef]);

  const schoolOptions = useMemo(
    () => schools.map((school) => ({ value: school.school_ref, label: school.name })),
    [schools],
  );
  const classOptions = useMemo(
    () => classes.map((cls) => ({ value: cls.class_ref, label: `${cls.name} (${cls.year})` })),
    [classes],
  );

  async function loadOffer() {
    try {
      setOfferLoading(true);
      setOfferError("");
      const data = await getGabaritoOffer(parsedOfferId);
      setOffer(data);
    } catch {
      setOffer(null);
      setOfferError("Não foi possível carregar a oferta.");
    } finally {
      setOfferLoading(false);
    }
  }

  async function loadSchools() {
    try {
      setLoadingSchools(true);
      const list = await listMockSigeSchools();
      setSchools(list);
    } catch (error: unknown) {
      setSchools([]);
      toast({
        type: "error",
        title: "Erro ao carregar escolas",
        message: getApiErrorMessage(error),
      });
    } finally {
      setLoadingSchools(false);
    }
  }

  async function loadClasses(nextSchoolRef: number) {
    try {
      setLoadingClasses(true);
      setClassRef(undefined);
      setStudents([]);
      setApplications([]);
      const list = await listMockSigeSchoolClasses(nextSchoolRef);
      setClasses(list);
    } catch (error: unknown) {
      setClasses([]);
      toast({
        type: "error",
        title: "Erro ao carregar turmas",
        message: getApiErrorMessage(error),
      });
    } finally {
      setLoadingClasses(false);
    }
  }

  async function onLoadStudents() {
    if (!schoolRef || !classRef) {
      setFormError("Selecione escola e turma para carregar os alunos.");
      return;
    }

    setFormError("");
    try {
      setLoadingStudents(true);
      setSyncing(true);
      const classStudents = await listMockSigeClassStudents(classRef);
      setStudents(classStudents);
      const synced = await syncOfferApplications(parsedOfferId, classRef, classStudents);
      setItemsTotal(synced.items_total);
      setApplications(synced.applications);
    } catch (error: unknown) {
      setApplications([]);
      toast({
        type: "error",
        title: "Erro ao carregar alunos",
        message: getApiErrorMessage(error),
      });
    } finally {
      setLoadingStudents(false);
      setSyncing(false);
    }
  }

  async function onToggleAbsent(application: ApplicationRowDTO, nextAbsent: boolean) {
    try {
      setStatusUpdatingId(application.application_id);
      const response = await patchApplicationAbsent(application.application_id, nextAbsent);
      const nextStatus = response.status as ApplicationStatus;
      setApplications((prev) =>
        prev.map((row) =>
          row.application_id === application.application_id
            ? {
                ...row,
                student_absent: response.student_absent,
                finalized_at: response.finalized_at,
                correct: response.correct,
                wrong: response.wrong,
                blank: response.blank,
                status: nextStatus,
              }
            : row,
        ),
      );
      toast({
        type: "success",
        title: nextAbsent ? "Aluno marcado como ausente" : "Ausência removida",
      });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao atualizar ausência",
        message: getApiErrorMessage(error),
      });
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function onOpenDrawer(application: ApplicationRowDTO) {
    if (application.student_absent) return;
    setDrawerApplication(application);
    try {
      const response = await getApplicationAnswers(application.application_id);
      setApplications((prev) =>
        prev.map((row) =>
          row.application_id === application.application_id
            ? {
                ...row,
                correct: response.summary.correct,
                wrong: response.summary.wrong,
                blank: response.summary.blank,
                status: response.summary.status,
              }
            : row,
        ),
      );
    } catch {
      // evita bloquear abertura do drawer; o componente interno já trata loading/erro da própria chamada.
    }
  }

  const offerStatus = useMemo(() => (offer ? getOfferStatus(offer) : "upcoming"), [offer]);

  if (offerLoading) return <div className="text-sm text-slate-500">Carregando...</div>;

  return (
    <PageCard
      breadcrumb={[
        { label: "Gabaritos", to: "/gabaritos" },
        { label: "Gerenciar oferta" },
      ]}
      title="Gerenciar gabaritos"
      subtitle="Selecione escola e turma para lançar respostas dos alunos."
      onBack={() => navigate("/gabaritos")}
    >
      {offerError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {offerError}
        </div>
      )}

      {!offerError && offer ? (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="text-xs font-semibold text-slate-700">Resumo da oferta</div>
            </div>
            <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-xs font-semibold text-slate-600">Oferta</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {offer.description?.trim() || `Oferta #${offer.id}`}
                </div>
                <div className="mt-1 text-xs text-slate-500">Oferta #{offer.id}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Caderno</div>
                <div className="mt-1 text-sm text-slate-800">
                  <Link
                    to={`/cadernos/${typeof offer.booklet === "number" ? offer.booklet : offer.booklet.id}`}
                    className="hover:text-emerald-700 hover:underline"
                  >
                    {getBookletName(offer)}
                  </Link>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Período</div>
                <div className="mt-1 text-sm text-slate-800">
                  {formatDate(offer.start_date)} - {formatDate(offer.end_date)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Status</div>
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getOfferStatusBadgeClass(offerStatus)}`}
                >
                  {getOfferStatusLabel(offerStatus)}
                </span>
              </div>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
              Quantidade de questões: <span className="font-semibold">{itemsTotal || "-"}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Selecionar turma</div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <SigeCombobox
                  label="Escola"
                  placeholder="Selecione uma escola"
                  value={schoolRef}
                  options={schoolOptions}
                  loading={loadingSchools}
                  onChange={(value) => {
                    setSchoolRef(value);
                    setClasses([]);
                    setClassRef(undefined);
                    setStudents([]);
                    setApplications([]);
                  }}
                />
              </div>
              <div className="lg:col-span-5">
                <SigeCombobox
                  label="Turma"
                  placeholder="Selecione uma turma"
                  value={classRef}
                  options={classOptions}
                  loading={loadingClasses}
                  disabled={!schoolRef}
                  onChange={(value) => {
                    setClassRef(value);
                    setStudents([]);
                    setApplications([]);
                  }}
                />
              </div>
              <div className="lg:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={() => void onLoadStudents()}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  disabled={loadingStudents || syncing}
                >
                  {loadingStudents || syncing ? "Carregando..." : "Carregar alunos"}
                </button>
              </div>
            </div>
            {formError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Alunos</div>
            </div>
            {loadingStudents ? (
              <div className="px-4 py-8 text-sm text-slate-500">Carregando alunos...</div>
            ) : applications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                Selecione escola e turma para carregar os alunos.
              </div>
            ) : (
              <table className="w-full table-auto border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Aluno</th>
                    <th className="w-32 px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                    <th className="w-56 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                      Acertos / Erros / Brancos / Total
                    </th>
                    <th className="w-64 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr
                      key={application.application_id}
                      className="border-t border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-sm text-slate-800">{application.student_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getApplicationStatusBadgeClass(application.status)}`}
                        >
                          {getApplicationStatusLabel(application.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {application.correct} / {application.wrong} / {application.blank} / {itemsTotal}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => void onOpenDrawer(application)}
                            disabled={application.student_absent}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Responder
                          </button>
                          <button
                            type="button"
                            disabled
                            title="Em breve"
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400"
                          >
                            Enviar foto
                          </button>
                          <div className="flex items-center gap-2">
                            <CheckToggle
                              checked={application.student_absent}
                              onChange={(next) => {
                                void onToggleAbsent(application, next);
                              }}
                              disabled={statusUpdatingId === application.application_id}
                              shape="square"
                              ariaLabel="Marcar ausência"
                            />
                            <span className="text-xs text-slate-600">Ausente</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      <AnswersDrawer
        open={Boolean(drawerApplication)}
        application={drawerApplication}
        className={selectedClassName}
        onClose={() => setDrawerApplication(null)}
        onSaved={(applicationId, summary) => {
          setApplications((prev) =>
            prev.map((row) =>
              row.application_id === applicationId
                ? {
                    ...row,
                    correct: summary.correct,
                    wrong: summary.wrong,
                    blank: summary.blank,
                    status: summary.status,
                  }
                : row,
            ),
          );
        }}
      />
    </PageCard>
  );
}
