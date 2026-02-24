import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, TriangleAlert } from "lucide-react";
import PageCard from "@/components/layout/PageCard";
import CheckToggle from "@/components/ui/CheckToggle";
import { useToast } from "@/components/ui/toast/useToast";
import {
  getApplicationAnswers,
  getGabaritoOffer,
  listMockSigeSchoolClasses,
  listMockSigeClassStudents,
  patchApplicationAbsent,
  syncOfferApplications,
} from "@/features/gabaritos/services/gabaritos";
import type {
  ApplicationRowDTO,
  ApplicationStatus,
  OfferDTO,
} from "@/features/gabaritos/types";
import {
  getApplicationStatusBadgeClass,
  getApplicationStatusLabel,
} from "@/features/gabaritos/utils";
import AnswersDrawer from "@/features/gabaritos/components/AnswersDrawer";
import {
  formatDate,
  getBookletName,
  getOfferSigeSelection,
  getOfferStatus,
  getOfferStatusBadgeClass,
  getOfferStatusLabel,
  type OfferSigeSelection,
} from "@/features/ofertas/utils";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

type ApplicationRowWithClass = ApplicationRowDTO & {
  class_ref: number;
  class_name?: string;
  school_name?: string;
};

export default function GabaritoOfertaGestao() {
  const { offerId } = useParams();
  const parsedOfferId = Number(offerId);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [offer, setOffer] = useState<OfferDTO | null>(null);
  const [offerLoading, setOfferLoading] = useState(true);
  const [offerError, setOfferError] = useState("");

  const [applications, setApplications] = useState<ApplicationRowWithClass[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [sigeSelection, setSigeSelection] = useState<OfferSigeSelection | null>(null);

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [openByClassRef, setOpenByClassRef] = useState<Record<number, boolean>>({});

  const [syncError, setSyncError] = useState("");
  const [drawerApplication, setDrawerApplication] = useState<ApplicationRowWithClass | null>(null);

  const groupedBySchoolAndClass = useMemo(() => {
    const schoolMap = new Map<
      string,
      Map<number, { classRef: number; className: string; rows: ApplicationRowWithClass[] }>
    >();

    applications.forEach((row) => {
      const schoolName = row.school_name || "Escola não identificada";
      if (!schoolMap.has(schoolName)) {
        schoolMap.set(schoolName, new Map());
      }
      const classMap = schoolMap.get(schoolName)!;
      if (!classMap.has(row.class_ref)) {
        classMap.set(row.class_ref, {
          classRef: row.class_ref,
          className: row.class_name || `Turma ${row.class_ref}`,
          rows: [],
        });
      }
      classMap.get(row.class_ref)!.rows.push(row);
    });

    return Array.from(schoolMap.entries()).map(([schoolName, classMap]) => ({
      schoolName,
      classes: Array.from(classMap.values()),
    }));
  }, [applications]);

  useEffect(() => {
    if (!parsedOfferId) return;
    void loadOffer();
  }, [parsedOfferId]);

  async function loadOffer() {
    try {
      setOfferLoading(true);
      setOfferError("");
      const data = await getGabaritoOffer(parsedOfferId);
      setOffer(data);
      const selection = getOfferSigeSelection(parsedOfferId);
      setSigeSelection(selection);
      await loadApplicationsFromOffer(selection);
    } catch {
      setOffer(null);
      setOfferError("Não foi possível carregar a oferta.");
    } finally {
      setOfferLoading(false);
    }
  }

  async function loadApplicationsFromOffer(selection: OfferSigeSelection | null) {
    const classRefs = Array.from(new Set((selection?.class_refs || []).filter((value) => Number.isFinite(value))));
    if (classRefs.length === 0) {
      setApplications([]);
      setItemsTotal(0);
      setSyncError("Esta oferta não possui turmas configuradas.");
      return;
    }

    setSyncError("");
    try {
      setLoadingStudents(true);
      const schoolRefs = selection?.school_refs || [];
      const schoolNames = selection?.school_names || [];
      const classNames = selection?.class_names || [];
      const schoolNameByClassRef = new Map<number, string>();

      await Promise.all(
        schoolRefs.map(async (schoolRef, index) => {
          const classes = await listMockSigeSchoolClasses(schoolRef);
          const schoolName = schoolNames[index] || `Escola ${schoolRef}`;
          classes.forEach((cls) => {
            schoolNameByClassRef.set(cls.class_ref, schoolName);
          });
        }),
      );

      const responses: Array<{
        classRef: number;
        className: string;
        synced: Awaited<ReturnType<typeof syncOfferApplications>>;
      }> = [];
      for (let index = 0; index < classRefs.length; index += 1) {
        const classRef = classRefs[index];
        const classStudents = await listMockSigeClassStudents(classRef);
        const synced = await syncOfferApplications(parsedOfferId, classRef, classStudents);
        responses.push({
          classRef,
          className: classNames[index] || `Turma ${classRef}`,
          synced,
        });
      }

      const mergedByApplicationId = new Map<number, ApplicationRowWithClass>();
      responses.forEach((entry) => {
        entry.synced.applications.forEach((application) => {
          mergedByApplicationId.set(application.application_id, {
            ...application,
            class_ref: entry.classRef,
            class_name: entry.className,
            school_name: schoolNameByClassRef.get(entry.classRef),
          });
        });
      });

      setItemsTotal(Math.max(...responses.map((entry) => entry.synced.items_total), 0));
      const mergedRows = Array.from(mergedByApplicationId.values());
      setApplications(mergedRows);
      const nextOpen: Record<number, boolean> = {};
      classRefs.forEach((ref, index) => {
        nextOpen[ref] = index === 0;
      });
      setOpenByClassRef(nextOpen);
    } catch (error: unknown) {
      setApplications([]);
      setOpenByClassRef({});
      setSyncError("Não foi possível carregar alunos das turmas da oferta.");
      toast({
        type: "error",
        title: "Erro ao carregar alunos",
        message: getApiErrorMessage(error),
      });
    } finally {
      setLoadingStudents(false);
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

  async function onOpenDrawer(application: ApplicationRowWithClass) {
    if (offerStatus !== "open") return;
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
  const canFillAnswers = offerStatus === "open";

  if (offerLoading) return <div className="text-sm text-slate-500">Carregando...</div>;

  return (
    <PageCard
      breadcrumb={[
        { label: "Gabaritos", to: "/gabaritos" },
        { label: "Gerenciar gabaritos" },
      ]}
      title="Gerenciar gabaritos"
      subtitle="Alunos carregados automaticamente com base nas turmas da oferta."
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
            <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2">
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
                <div className="text-xs font-semibold text-slate-600">Escola</div>
                <div className="mt-1 text-sm text-slate-800">
                  {sigeSelection?.school_names?.length
                    ? sigeSelection.school_names.join(", ")
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Série</div>
                <div className="mt-1 text-sm text-slate-800">
                  {sigeSelection?.series_years?.length
                    ? sigeSelection.series_years.map((year) => `${year}ª série`).join(", ")
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Turma</div>
                <div className="mt-1 text-sm text-slate-800">
                  {sigeSelection?.class_names?.length
                    ? sigeSelection.class_names.join(", ")
                    : "-"}
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

          {!canFillAnswers && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              O preenchimento do gabarito só é permitido com a oferta aberta.
            </div>
          )}

          {syncError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {syncError}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Alunos</div>
            </div>
            {loadingStudents ? (
              <div className="px-4 py-8 text-sm text-slate-500">Carregando alunos...</div>
            ) : applications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                Nenhum aluno encontrado nas turmas da oferta.
              </div>
            ) : (
              <div className="space-y-4 px-4 py-4">
                {groupedBySchoolAndClass.map((schoolGroup) => (
                  <div key={schoolGroup.schoolName} className="rounded-lg border border-slate-200">
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
                      {schoolGroup.schoolName}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {schoolGroup.classes.map((classGroup) => {
                        const isOpen = Boolean(openByClassRef[classGroup.classRef]);
                        return (
                          <div key={classGroup.classRef}>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenByClassRef((prev) => ({
                                  ...prev,
                                  [classGroup.classRef]: !prev[classGroup.classRef],
                                }))
                              }
                              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                            >
                              <div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {classGroup.className}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {classGroup.rows.length} aluno(s)
                                </div>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                              />
                            </button>

                            {isOpen ? (
                              <table className="w-full table-auto border-collapse">
                                <thead className="border-t border-slate-100 bg-slate-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Aluno</th>
                                    <th className="w-40 px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                                    <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                                      Resp./Total
                                    </th>
                                    <th className="w-64 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                                      Ações
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {classGroup.rows.map((application) => (
                                    <tr
                                      key={application.application_id}
                                      className="border-t border-slate-100 transition hover:bg-slate-50"
                                    >
                                      <td className="min-w-[280px] px-4 py-3 text-sm text-slate-800">{application.student_name}</td>
                                      <td className="px-4 py-3 text-sm text-slate-700">
                                        <span
                                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${getApplicationStatusBadgeClass(application.status)}`}
                                        >
                                          {getApplicationStatusLabel(application.status)}
                                        </span>
                                      </td>
                                      <td className="w-28 whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                                        {application.correct + application.wrong} / {itemsTotal}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-700">
                                        <div className="flex items-center gap-3">
                                          <button
                                            type="button"
                                            onClick={() => void onOpenDrawer(application)}
                                            disabled={!canFillAnswers || application.student_absent}
                                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            Responder
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
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <AnswersDrawer
        open={Boolean(drawerApplication)}
        application={drawerApplication}
        className={drawerApplication?.class_name || ""}
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
