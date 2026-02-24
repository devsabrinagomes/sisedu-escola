import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  HelpCircle,
  Info,
  FileText,
  Users,
  School,
  ClipboardCheck,
  LineChart,
} from "lucide-react";

type StepKey =
  | "questoes"
  | "caderno"
  | "ofertas"
  | "aplicacao"
  | "gabaritos"
  | "resultados";

type Tone = "red" | "yellow" | "green" | "blue" | "neutral";

type StepItem = {
  key: StepKey;
  titulo: React.ReactNode;
  tooltip: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
};

const steps: StepItem[] = [
  {
    key: "questoes",
    titulo: "Questões",
    tooltip: "Cadastre as questões que poderão ser usadas nas provas.",
    Icon: HelpCircle,
    tone: "blue",
  },
  {
    key: "caderno",
    titulo: "Caderno",
    tooltip: "Monte a prova escolhendo e ordenando questões.",
    Icon: FileText,
    tone: "yellow",
  },
  {
    key: "ofertas",
    titulo: (
      <>
        Turmas e<br />
        período
      </>
    ),
    tooltip: "Defina em quais turmas e datas a prova será aplicada.",
    Icon: Users,
    tone: "red",
  },
  {
    key: "aplicacao",
    titulo: (
      <>
        Aplicação<br />
        em sala
      </>
    ),
    tooltip: "A aplicação ocorre presencialmente com os estudantes.",
    Icon: School,
    tone: "neutral",
  },
  {
    key: "gabaritos",
    titulo: "Gabaritos",
    tooltip: "Insira as respostas dos alunos e realize a correção da avaliação.",
    Icon: ClipboardCheck,
    tone: "green",
  },
  {
    key: "resultados",
    titulo: "Resultados",
    tooltip: "Veja o desempenho por aluno, turma e questão.",
    Icon: LineChart,
    tone: "blue",
  },
];

type CardKey =
  | "criarQuestao"
  | "montarProva"
  | "definirTurmas"
  | "corrigir"
  | "verResultados";

const stepToCard: Partial<Record<StepKey, CardKey>> = {
  questoes: "criarQuestao",
  caderno: "montarProva",
  ofertas: "definirTurmas",
  gabaritos: "corrigir",
  resultados: "verResultados",
};

const stepToRoute: Partial<Record<StepKey, string>> = {
  questoes: "/questoes",
  caderno: "/cadernos",
  ofertas: "/ofertas",
  gabaritos: "/gabaritos",
  resultados: "/relatorios",
};

export default function Home() {
  // ✅ refs separados (desktop/mobile)
  const desktopContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileContainerRef = useRef<HTMLDivElement | null>(null);

  const desktopDotRefs = useRef<(HTMLDivElement | null)[]>(Array(steps.length).fill(null));
  const mobileDotRefs = useRef<(HTMLDivElement | null)[]>(Array(steps.length).fill(null));

  const [startX, setStartX] = useState(0);
  const [baseLength, setBaseLength] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const targetRatioRef = useRef(0);
  const animRatioRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const [, force] = useState(0);

  const setDesktopDotRef = useMemo(() => {
    return (idx: number) => (el: HTMLDivElement | null) => {
      desktopDotRefs.current[idx] = el;
    };
  }, []);

  const setMobileDotRef = useMemo(() => {
    return (idx: number) => (el: HTMLDivElement | null) => {
      mobileDotRefs.current[idx] = el;
    };
  }, []);

  function getMode() {
    return window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile";
  }

  function measureDotCenterX(idx: number) {
    const mode = getMode();
    const container =
      mode === "desktop" ? desktopContainerRef.current : mobileContainerRef.current;

    const dot =
      mode === "desktop" ? desktopDotRefs.current[idx] : mobileDotRefs.current[idx];

    if (!container || !dot) return null;

    const cRect = container.getBoundingClientRect();
    const dRect = dot.getBoundingClientRect();
    return dRect.left - cRect.left + dRect.width / 2;
  }

  function calcBaseLength() {
    const first = measureDotCenterX(0);
    const last = measureDotCenterX(steps.length - 1);
    if (first == null || last == null) return;

    setStartX(first);
    setBaseLength(Math.max(0, last - first));
  }

  function setTargetByStep(idx: number | null) {
    setHoveredIdx(idx);

    // sem hover: some a linha verde (cinza fica)
    if (idx == null || baseLength <= 0) {
      targetRatioRef.current = 0;
      startAnim();
      return;
    }

    const centerX = measureDotCenterX(idx);
    if (centerX == null) return;

    const px = Math.max(0, centerX - startX);
    const ratio = Math.max(0, Math.min(1, px / Math.max(1, baseLength)));

    targetRatioRef.current = ratio;
    startAnim();
  }

  function startAnim() {
    if (rafRef.current) return;

    const step = () => {
      const current = animRatioRef.current;
      const target = targetRatioRef.current;

      const next = current + (target - current) * 0.1;

      animRatioRef.current = next;
      force((v) => v + 1);

      if (Math.abs(target - next) < 0.001) {
        animRatioRef.current = target;
        rafRef.current = null;
        force((v) => v + 1);
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }

  // mede depois do layout “assentar”
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      calcBaseLength();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const onResize = () => {
      requestAnimationFrame(() => {
        calcBaseLength();
        if (hoveredIdx != null) setTargetByStep(hoveredIdx);
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredIdx, baseLength, startX]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const ratio = Math.max(0, Math.min(1, animRatioRef.current));

  const hoveredKey = hoveredIdx != null ? steps[hoveredIdx]?.key : null;
  const highlightedCard: CardKey | null = hoveredKey
    ? stepToCard[hoveredKey] ?? null
    : null;

  const LINE_Y = 32;

  return (
    <div className="max-w-7xl mx-auto">
      {/* ORIENTAÇÃO / TIMELINE */}
      <section className="mb-8">
        {/* ================= DESKTOP ================= */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6 overflow-hidden">
          <div className="mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-1">
              Ciclo de Avaliação 
            </h3>
            <p className="flex items-start gap-2 text-sm text-slate-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                A sequência abaixo é apenas uma recomendação. As funcionalidades podem ser acessadas de forma independente.
              </span>
            </p>
          </div>

          {/* Timeline */}
          <div ref={desktopContainerRef} className="relative overflow-hidden">
            {/* linha base */}
            {baseLength > 0 && (
              <div
                className="absolute bg-slate-300 z-0"
                style={{
                  left: startX,
                  top: LINE_Y,
                  height: 2,
                  width: baseLength,
                  transform: "translateY(-50%)",
                }}
              />
            )}

            {/* linha animada */}
            {baseLength > 0 && (
              <div
                className="absolute bg-emerald-500 z-0"
                style={{
                  left: startX,
                  top: LINE_Y,
                  height: 2,
                  width: baseLength,
                  transform: `translateY(-50%) scaleX(${ratio})`,
                  transformOrigin: "left",
                }}
              />
            )}

            <div className="relative z-10 flex items-start justify-between gap-6">
              {steps.map((s, idx) => (
                <FlowStep
                  key={s.key}
                  item={s}
                  to={stepToRoute[s.key]}
                  dotRef={setDesktopDotRef(idx)}
                  active={hoveredIdx === idx}
                  onEnter={() => setTargetByStep(idx)}
                  onLeave={() => setTargetByStep(null)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ================= MOBILE ================= */}
        <div className="md:hidden">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 overflow-hidden">
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Como funciona no sistema
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              Deslize para ver todas as etapas.
            </p>

            <div
              ref={mobileContainerRef}
              className="relative overflow-x-auto scrollbar-hide"
            >
              {/* indicador visual lateral */}
              <div className="absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white to-transparent pointer-events-none" />

              {baseLength > 0 && (
                <div
                  className="absolute bg-slate-300 z-0"
                  style={{
                    left: startX,
                    top: LINE_Y,
                    height: 2,
                    width: baseLength,
                    transform: "translateY(-50%)",
                  }}
                />
              )}

              {baseLength > 0 && (
                <div
                  className="absolute bg-emerald-500 z-0"
                  style={{
                    left: startX,
                    top: LINE_Y,
                    height: 2,
                    width: baseLength,
                    transform: `translateY(-50%) scaleX(${ratio})`,
                    transformOrigin: "left",
                  }}
                />
              )}

              <div className="relative z-10 flex items-start gap-6 min-w-max pr-10">
                {steps.map((s, idx) => (
                  <FlowStep
                    key={s.key}
                    item={s}
                    to={stepToRoute[s.key]}
                    dotRef={setMobileDotRef(idx)}
                    active={hoveredIdx === idx}
                    onEnter={() => setTargetByStep(idx)}
                    onLeave={() => setTargetByStep(null)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* CARDS */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ActionCard
            highlighted={highlightedCard === "criarQuestao"}
            icon={<HelpCircle className="w-5 h-5" style={{ color: "var(--blue-stroke)" }} />}
            iconBg="bg-[color:var(--blue-fill)]"
            title="Criar questão"
            desc="Cadastre novas questões para usar nas avaliações."
            to="/questoes/nova"
          />

          <ActionCard
            highlighted={highlightedCard === "montarProva"}
            icon={<FileText className="w-5 h-5" style={{ color: "var(--yellow-stroke)" }} />}
            iconBg="bg-[color:var(--yellow-fill)]"
            title="Montar prova"
            desc="Selecione e organize questões para compor uma prova."
            to="/cadernos"
          />

          <ActionCard
            highlighted={highlightedCard === "definirTurmas"}
            icon={<Users className="w-5 h-5" style={{ color: "var(--red-stroke)" }} />}
            iconBg="bg-[color:var(--red-fill)]"
            title="Definir turmas"
            desc="Escolha em quais turmas e período a prova será aplicada."
            to="/ofertas"
          />

          <ActionCard
            highlighted={highlightedCard === "corrigir"}
            icon={<ClipboardCheck className="w-5 h-5" style={{ color: "var(--green-stroke)" }} />}
            iconBg="bg-[color:var(--green-fill)]"
            title="Corrigir prova"
            desc="Insira as respostas dos alunos e realize a correção da avaliação."
            to="/gabaritos"
          />

          <ActionCard
            highlighted={highlightedCard === "verResultados"}
            icon={<LineChart className="w-5 h-5" style={{ color: "var(--blue-stroke)" }} />}
            iconBg="bg-[color:var(--blue-fill)]"
            title="Ver resultados"
            desc="Visualize o desempenho por aluno, turma e questão."
            to="/relatorios"
          />
        </div>
      </section>
    </div>
  );
}

function FlowStep({
  item,
  to,
  dotRef,
  active,
  onEnter,
  onLeave,
}: {
  item: StepItem;
  to?: string;
  dotRef: (el: HTMLDivElement | null) => void;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const Icon = item.Icon;
  const tooltipText = item.tooltip;

  const strokeVar =
    item.tone === "neutral" ? "#64748B" : `var(--${item.tone}-stroke)`;
  const fillVar =
    item.tone === "neutral" ? "#F1F5F9" : `var(--${item.tone}-fill)`;

  const handlers = {
    onMouseEnter: onEnter,
    onMouseLeave: onLeave,
    onFocus: onEnter,
    onBlur: onLeave,
  };

  const content = (
    <div className={["relative flex flex-col items-center group z-10 shrink-0", to ? "cursor-pointer" : "cursor-default"].join(" ")}>
      <div
        ref={dotRef}
        className="w-16 h-16 rounded-full border-2 flex items-center justify-center mb-3 transition-all duration-200"
        style={{
          background: active ? fillVar : "#F1F5F9",
          borderColor: active ? strokeVar : "#CBD5E1",
        }}
      >
        <Icon className="w-6 h-6" style={{ color: strokeVar }} />
      </div>

      <span
        className={[
          "text-sm text-center leading-tight transition-colors duration-200",
          active
            ? "font-semibold text-emerald-600"
            : "font-medium text-slate-700",
        ].join(" ")}
      >
        {item.titulo}
      </span>

      <div
        className={[
          "pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2",
          "bg-slate-900 text-white text-xs rounded-lg py-2 px-3 w-56 text-center shadow-md",
          "opacity-0 translate-y-1 transition-opacity transition-transform duration-200",
          "group-hover:opacity-100 group-hover:translate-y-0",
          "group-focus-within:opacity-100 group-focus-within:translate-y-0",
        ].join(" ")}
        role="tooltip"
      >
        {item.tooltip}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="outline-none rounded-xl focus:ring-2 focus:ring-emerald-200"
        aria-label={`${String(item.titulo).replace(/\s+/g, " ")}. ${item.tooltip}`}
        title={tooltipText}
        {...handlers}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className="outline-none rounded-xl"
      aria-label={`${String(item.titulo).replace(/\s+/g, " ")}. ${item.tooltip}`}
      title={tooltipText}
      {...handlers}
    >
      {content}
    </div>
  );
}

function ActionCard({
  title,
  desc,
  to,
  icon,
  iconBg,
  highlighted,
}: {
  title: string;
  desc: string;
  to: string;
  icon: React.ReactNode;
  iconBg: string;
  highlighted?: boolean;
}) {
  return (
    <Link
      to={to}
      className={[
        "block bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition",
        "hover:-translate-y-1 hover:shadow-md",
        "focus:outline-none focus:ring-2 focus:ring-emerald-200",
        highlighted ? "ring-2 ring-emerald-200 shadow-md" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div className={["w-12 h-12 rounded-lg flex items-center justify-center shrink-0", iconBg].join(" ")}>
          {icon}
        </div>

        <div className="flex-1">
          <h4 className="text-lg font-bold text-slate-900 mb-2">{title}</h4>
          <p className="text-sm text-slate-600">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
