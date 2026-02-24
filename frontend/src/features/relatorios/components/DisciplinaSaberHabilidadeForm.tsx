import { useEffect, useMemo, useState } from "react";
import { useDisciplinas } from "@/features/relatorios/hooks/useDisciplinas";
import { useHabilidades } from "@/features/relatorios/hooks/useHabilidades";
import { useSaberes } from "@/features/relatorios/hooks/useSaberes";

type Props = {
  topicoId?: number;
  serie?: number;
  nivel?: number;
};

function SelectField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  options,
}: {
  label: string;
  value?: number;
  onChange: (next?: number) => void;
  disabled?: boolean;
  placeholder: string;
  options: Array<{ value: number; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DisciplinaSaberHabilidadeForm({ topicoId, serie, nivel }: Props) {
  const [disciplinaId, setDisciplinaId] = useState<number | undefined>(undefined);
  const [saberId, setSaberId] = useState<number | undefined>(undefined);
  const [habilidadeId, setHabilidadeId] = useState<number | undefined>(undefined);

  const disciplinas = useDisciplinas();
  const saberes = useSaberes({ disciplinaId, topicoId });
  const habilidades = useHabilidades({ disciplinaId, serie, nivel });

  useEffect(() => {
    setSaberId(undefined);
    setHabilidadeId(undefined);
  }, [disciplinaId]);

  useEffect(() => {
    setHabilidadeId(undefined);
  }, [saberId]);

  const disciplinaOptions = useMemo(
    () => disciplinas.data.map((item) => ({ value: item.id, label: item.nome })),
    [disciplinas.data],
  );
  const saberOptions = useMemo(
    () =>
      saberes.data.map((item) => ({
        value: item.id,
        label: item.codigo ? `${item.codigo} - ${item.nome}` : item.nome,
      })),
    [saberes.data],
  );
  const habilidadeOptions = useMemo(
    () =>
      habilidades.data.map((item) => ({
        value: item.id,
        label: item.codigo ? `${item.codigo} - ${item.nome}` : item.nome,
      })),
    [habilidades.data],
  );

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">Disciplina, saber e habilidade (Sisedu)</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SelectField
          label="Disciplina"
          placeholder={disciplinas.loading ? "Carregando..." : "Selecione"}
          value={disciplinaId}
          onChange={setDisciplinaId}
          options={disciplinaOptions}
        />
        <SelectField
          label="Saber"
          placeholder={saberes.loading ? "Carregando..." : "Selecione"}
          value={saberId}
          onChange={setSaberId}
          disabled={!disciplinaId}
          options={saberOptions}
        />
        <SelectField
          label="Habilidade"
          placeholder={habilidades.loading ? "Carregando..." : "Selecione"}
          value={habilidadeId}
          onChange={setHabilidadeId}
          disabled={!disciplinaId}
          options={habilidadeOptions}
        />
      </div>

      {disciplinas.error && <div className="text-xs text-red-700">Erro em disciplinas: {disciplinas.error}</div>}
      {saberes.error && <div className="text-xs text-red-700">Erro em saberes: {saberes.error}</div>}
      {habilidades.error && <div className="text-xs text-red-700">Erro em habilidades: {habilidades.error}</div>}

      {disciplinas.empty && <div className="text-xs text-slate-500">Nenhuma disciplina encontrada.</div>}
      {saberes.empty && <div className="text-xs text-slate-500">Nenhum saber encontrado para o filtro informado.</div>}
      {habilidades.empty && (
        <div className="text-xs text-slate-500">Nenhuma habilidade encontrada para o filtro informado.</div>
      )}
    </div>
  );
}
