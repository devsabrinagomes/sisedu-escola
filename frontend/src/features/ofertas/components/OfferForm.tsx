import { useEffect, useMemo, useState } from "react";
import BookletCombobox from "@/components/BookletCombobox";
import DatePickerInput from "@/components/ui/DatePickerInput";
import SigeCombobox from "@/features/gabaritos/components/SigeCombobox";
import {
  listOfferSchoolClasses,
  listOfferSchools,
  type OfferClassDTO,
  type OfferSchoolDTO,
} from "@/features/ofertas/services/offers";
import type { OfferDTO, OfferPayload } from "@/features/ofertas/types";
import { normalizeDescription, validateOfferDates } from "@/features/ofertas/utils";

type OfferFormProps = {
  mode: "create" | "edit";
  saving?: boolean;
  initialData?: OfferDTO | null;
  onCancel: () => void;
  onSubmit: (payload: OfferPayload) => Promise<void>;
};

function getInitialBookletId(initialData?: OfferDTO | null) {
  if (!initialData) return "";
  return String(
    typeof initialData.booklet === "number"
      ? initialData.booklet
      : initialData.booklet.id,
  );
}

function getSeriesFromClassName(name: string) {
  const match = name.match(/(\d+)\s*[ºoª]?\s*ano/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function getSeriesNumber(cls: OfferClassDTO) {
  const fromEtapa = Number(String(cls.etapa_aplicacao ?? "").replace(/\D/g, ""));
  if (Number.isFinite(fromEtapa) && fromEtapa > 0) return fromEtapa;

  const fromSerie = Number(String(cls.serie ?? "").replace(/\D/g, ""));
  if (Number.isFinite(fromSerie) && fromSerie > 0) return fromSerie;

  return getSeriesFromClassName(cls.name);
}

export default function OfferForm({
  mode,
  saving = false,
  initialData,
  onCancel,
  onSubmit,
}: OfferFormProps) {
  const [bookletId, setBookletId] = useState(getInitialBookletId(initialData));
  const [startDate, setStartDate] = useState(initialData?.start_date || "");
  const [endDate, setEndDate] = useState(initialData?.end_date || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [schools, setSchools] = useState<OfferSchoolDTO[]>([]);
  const [classes, setClasses] = useState<OfferClassDTO[]>([]);
  const [schoolRef, setSchoolRef] = useState<number | undefined>(undefined);
  const [seriesYear, setSeriesYear] = useState<number | undefined>(undefined);
  const [classRef, setClassRef] = useState<number | undefined>(undefined);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const descriptionLeft = useMemo(
    () => 500 - description.length,
    [description.length],
  );
  const schoolOptions = useMemo(
    () => schools.map((school) => ({ value: school.school_ref, label: school.name })),
    [schools],
  );
  const seriesOptions = useMemo(() => {
    const seriesList = Array.from(
      new Set(
        classes
          .map((cls) => getSeriesNumber(cls))
          .filter((series): series is number => series !== null),
      ),
    ).sort((a, b) => a - b);
    return seriesList.map((series) => ({ value: series, label: `${series}ª série` }));
  }, [classes]);
  const classOptions = useMemo(
    () =>
      classes
        .filter((cls) => (seriesYear ? getSeriesNumber(cls) === seriesYear : true))
        .map((cls) => ({ value: cls.class_ref, label: cls.name })),
    [classes, seriesYear],
  );

  useEffect(() => {
    if (mode !== "create") return;
    void loadSchools();
  }, [mode]);

  async function loadSchools() {
    try {
      setLoadingSchools(true);
      const list = await listOfferSchools();
      setSchools(list);
    } catch {
      setSchools([]);
    } finally {
      setLoadingSchools(false);
    }
  }

  async function loadClasses(nextSchoolRef: number) {
    try {
      setLoadingClasses(true);
      const list = await listOfferSchoolClasses(nextSchoolRef);
      setClasses(list);
    } catch {
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    const normalizedDescription = normalizeDescription(description);

    if (!normalizedDescription) nextErrors.description = "Informe o nome/título da oferta.";
    if (!bookletId) nextErrors.booklet = "Selecione o caderno.";
    if (!startDate) nextErrors.start_date = "Informe a data de início.";
    if (!endDate) nextErrors.end_date = "Informe a data de fim.";

    if (startDate && endDate && !validateOfferDates(startDate, endDate)) {
      nextErrors.end_date = "A data de fim deve ser maior ou igual à data de início.";
    }

    if (description.length > 500) {
      nextErrors.description = "Descrição deve ter no máximo 500 caracteres.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    await onSubmit({
      booklet: Number(bookletId),
      start_date: startDate,
      end_date: endDate,
      description: normalizeDescription(description),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">
                Descrição <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-slate-500">{description.length}/500</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Nome ou título da oferta"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-200"
            />
            {errors.description ? (
              <p className="mt-1 text-xs text-red-600">{errors.description}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                {descriptionLeft >= 0
                  ? `${descriptionLeft} caracteres restantes`
                  : "Limite de 500 caracteres excedido"}
              </p>
            )}
          </div>

          {mode === "create" ? (
            <>
              <div className="md:col-span-2">
                <SigeCombobox
                  label="Escola"
                  placeholder="Selecione uma escola"
                  value={schoolRef}
                  options={schoolOptions}
                  loading={loadingSchools}
                  disabled={saving}
                  onChange={(value) => {
                    setSchoolRef(value);
                    setSeriesYear(undefined);
                    setClassRef(undefined);
                    setClasses([]);
                    if (value) void loadClasses(value);
                  }}
                />
              </div>
              <div>
                <SigeCombobox
                  label="Série"
                  placeholder="Selecione uma série"
                  value={seriesYear}
                  options={seriesOptions}
                  loading={loadingClasses}
                  disabled={saving || !schoolRef}
                  onChange={(value) => {
                    setSeriesYear(value);
                    setClassRef(undefined);
                  }}
                />
              </div>
              <div>
                <SigeCombobox
                  label="Turma"
                  placeholder="Selecione uma turma"
                  value={classRef}
                  options={classOptions}
                  loading={loadingClasses}
                  disabled={saving || !schoolRef || !seriesYear}
                  onChange={setClassRef}
                />
              </div>
            </>
          ) : null}

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Caderno <span className="text-red-500">*</span>
            </label>
            <BookletCombobox
              value={bookletId ? Number(bookletId) : undefined}
              onChange={(id) => setBookletId(id ? String(id) : "")}
              disabled={saving}
            />
            {errors.booklet && (
              <p className="mt-1 text-xs text-red-600">{errors.booklet}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Data início <span className="text-red-500">*</span>
            </label>
            <DatePickerInput
              value={startDate}
              onChange={setStartDate}
              disabled={saving}
            />
            {errors.start_date && (
              <p className="mt-1 text-xs text-red-600">{errors.start_date}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Data fim <span className="text-red-500">*</span>
            </label>
            <DatePickerInput
              value={endDate}
              onChange={setEndDate}
              disabled={saving}
            />
            {errors.end_date && (
              <p className="mt-1 text-xs text-red-600">{errors.end_date}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving
            ? mode === "create"
              ? "Salvando..."
              : "Atualizando..."
            : mode === "create"
              ? "Salvar oferta"
              : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
