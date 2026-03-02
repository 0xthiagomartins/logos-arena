"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type TouchEvent } from "react";
import MarkdownContent from "@/components/markdown-content";
import StepLoadingWidget from "@/components/step-loading-widget";
import {
  getDebate,
  getDebateReport,
  getDebateRounds,
  runDebateStepStream,
  type DebateResponse,
  type ReportResponse,
  type RoundResponse,
  type StepStreamEvent,
} from "@/lib/api";

type RunnerState = {
  debate: DebateResponse | null;
  rounds: RoundResponse[];
  roundSummaries: string[];
  report: ReportResponse | null;
};

type StreamingDraft = {
  roundIndex: number;
  roundType: string;
  pro: string;
  con: string;
  summary: string;
  report: string;
  phaseLabel: string;
};

type CarouselSlide =
  | { kind: "round"; round: RoundResponse; summary: string }
  | { kind: "draft"; draft: StreamingDraft };

type ParsedMediatorReport = {
  pro: string;
  con: string;
  analysis: string;
  conclusion: string;
  finalOutcome: "pro" | "con" | "inconclusivo" | "depende" | null;
};

type MediatorSectionKey = "pro" | "con" | "analysis" | "conclusion";

function RunnerSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <div className="mb-3 h-4 w-1/3 rounded bg-white/10" />
            <div className="mb-2 h-3 w-full rounded bg-white/10" />
            <div className="mb-2 h-3 w-[92%] rounded bg-white/10" />
            <div className="h-3 w-4/5 rounded bg-white/10" />
          </div>
        ))}
      </div>
      <div className="animate-pulse rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <div className="mb-4 h-4 w-1/2 rounded bg-white/10" />
        <div className="mb-2 h-3 w-full rounded bg-white/10" />
        <div className="mb-2 h-3 w-5/6 rounded bg-white/10" />
        <div className="h-3 w-4/5 rounded bg-white/10" />
      </div>
    </div>
  );
}

function normalizeStatus(status: string): string {
  if (status === "draft") return "Rascunho";
  if (status === "running") return "Em andamento";
  if (status === "completed") return "Concluído";
  if (status === "failed") return "Falhou";
  return status;
}

function phaseText(phase: string): string {
  if (phase === "round_start") return "Iniciando novo round...";
  if (phase === "summary_start") return "Mediador analisando a qualidade do round...";
  if (phase === "mediation_start") return "Mediador escrevendo o relatório final...";
  return "Processando step...";
}

function RoundCard({ round, summary }: { round: RoundResponse; summary: string }) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-matrix-dim">
        Round {round.index + 1} · {round.type}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">Pro</p>
          <MarkdownContent content={round.messages[0]?.content ?? ""} />
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">Con</p>
          <MarkdownContent content={round.messages[1]?.content ?? ""} />
        </div>
      </div>
      <details className="mt-4 rounded-lg border border-white/15 bg-white/[0.04] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-matrix-dim">
          <span>Clique para ver a síntese da rodada</span>
          <span className="expander-chevron text-sm">⌄</span>
        </summary>
        <div className="expander-grid mt-3">
          <div className="overflow-hidden">
            <MarkdownContent content={summary || "Resumo ainda não disponível para este round."} />
          </div>
        </div>
      </details>
    </article>
  );
}

function DraftCard({ draft }: { draft: StreamingDraft }) {
  return (
    <article className="rounded-xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-matrix-dim">
        Round {draft.roundIndex + 1} · {draft.roundType}
      </p>
      <p className="mb-4 text-sm text-white/75">{draft.phaseLabel}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">Pro</p>
          <MarkdownContent content={draft.pro || "_Gerando argumento..._"} />
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">Con</p>
          <MarkdownContent content={draft.con || "_Aguardando resposta..._"} />
        </div>
      </div>
      <details className="mt-4 rounded-lg border border-white/15 bg-white/[0.04] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-matrix-dim">
          <span>Clique para ver a síntese da rodada</span>
          <span className="expander-chevron text-sm">⌄</span>
        </summary>
        <div className="expander-grid mt-3">
          <div className="overflow-hidden">
            <MarkdownContent content={draft.summary || "_Mediador analisando..._"} />
          </div>
        </div>
      </details>
    </article>
  );
}

function parseMediatorReport(content: string): ParsedMediatorReport | null {
  const normalized = content.replace(/\r/g, "");
  const sections: Array<{
    key: MediatorSectionKey;
    patterns: RegExp[];
  }> = [
    {
      key: "pro",
      patterns: [
        /\*{0,2}\s*resumo dos argumentos do lado pro\s*\*{0,2}\s*:?/i,
        /\*{0,2}\s*resumo pro\s*\*{0,2}\s*:?/i,
      ],
    },
    {
      key: "con",
      patterns: [
        /\*{0,2}\s*resumo dos argumentos do lado contra\s*\*{0,2}\s*:?/i,
        /\*{0,2}\s*resumo contra\s*\*{0,2}\s*:?/i,
      ],
    },
    {
      key: "analysis",
      patterns: [/\*{0,2}\s*an[áa]lise cr[ií]tica\s*\*{0,2}\s*:?/i],
    },
    {
      key: "conclusion",
      patterns: [/\*{0,2}\s*conclus[aã]o\s*\*{0,2}\s*:?/i],
    },
  ];

  const starts = sections
    .map((section) => {
      const index = section.patterns
        .map((pattern) => normalized.search(pattern))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b)[0];
      return { key: section.key, index };
    })
    .filter((x): x is { key: MediatorSectionKey; index: number } => typeof x.index === "number");

  if (starts.length < 3) return null;
  starts.sort((a, b) => a.index - b.index);

  const contentByKey: Record<MediatorSectionKey, string> = {
    pro: "",
    con: "",
    analysis: "",
    conclusion: "",
  };

  const cutAtSectionMarker = (value: string): string => {
    const markers = [
      /\n\s*\*{0,2}an[áa]lise cr[ií]tica\*{0,2}:?/i,
      /\n\s*\*{0,2}conclus[aã]o\*{0,2}:?/i,
      /\n\s*final_outcome:/i,
    ];
    let nextCut = value.length;
    for (const marker of markers) {
      const match = value.match(marker);
      if (match?.index !== undefined) {
        nextCut = Math.min(nextCut, match.index);
      }
    }
    return value.slice(0, nextCut).trim();
  };

  for (let i = 0; i < starts.length; i += 1) {
    const current = starts[i];
    const next = starts[i + 1];
    const rawSlice = normalized.slice(current.index, next ? next.index : undefined).trim();
    const cleaned = rawSlice.replace(/^\*{0,2}[^\n:]+(?:\*{0,2})?:?\s*/i, "").trim();
    contentByKey[current.key] = cleaned;
  }

  contentByKey.pro = cutAtSectionMarker(contentByKey.pro);
  contentByKey.con = cutAtSectionMarker(contentByKey.con);

  const outcomeMatch = normalized.match(/final_outcome:\s*(pro|con|inconclusivo|depende)/i);
  const finalOutcome = outcomeMatch ? (outcomeMatch[1].toLowerCase() as ParsedMediatorReport["finalOutcome"]) : null;

  return {
    pro: contentByKey.pro,
    con: contentByKey.con,
    analysis: contentByKey.analysis,
    conclusion: contentByKey.conclusion,
    finalOutcome,
  };
}

function outcomeLabel(outcome: ParsedMediatorReport["finalOutcome"]): string {
  if (outcome === "pro") return "Resultado: PRO";
  if (outcome === "con") return "Resultado: CON";
  if (outcome === "depende") return "Resultado: DEPENDE";
  if (outcome === "inconclusivo") return "Resultado: INCONCLUSIVO";
  return "Resultado: sem classificação";
}

function firstParagraph(text: string): string {
  const cleaned = text.trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\n\s*\n/);
  return parts[0] ?? cleaned;
}

function removeFinalOutcomeLine(text: string): string {
  return text.replace(/^\s*final_outcome:\s*(pro|con|inconclusivo|depende)\s*$/gim, "").trim();
}

function MediatorReportView({ content }: { content: string }) {
  const parsed = useMemo(() => parseMediatorReport(content), [content]);

  if (!parsed) {
    return <MarkdownContent content={content} />;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-matrix-green/50 bg-matrix-muted/25 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-matrix-dim">{outcomeLabel(parsed.finalOutcome)}</p>
        {parsed.conclusion && (
          <p className="mt-2 text-sm leading-relaxed text-white/90">{firstParagraph(parsed.conclusion)}</p>
        )}
      </div>

      <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-[0.15em] text-matrix-dim">Resumo</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-matrix-dim">Pro</p>
            <MarkdownContent content={parsed.pro || "_Sem conteúdo._"} />
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-matrix-dim">Con</p>
            <MarkdownContent content={parsed.con || "_Sem conteúdo._"} />
          </div>
        </div>
      </section>

      <details className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.15em] text-matrix-dim">
          Análise Crítica / Lógica
        </summary>
        <div className="mt-3">
          <MarkdownContent
            content={
              removeFinalOutcomeLine([parsed.analysis, parsed.conclusion].filter(Boolean).join("\n\n")) ||
              "_Sem conteúdo._"
            }
          />
        </div>
      </details>
    </div>
  );
}

function shortOutcomeLabel(outcome: ParsedMediatorReport["finalOutcome"]): string {
  if (outcome === "pro") return "PRO";
  if (outcome === "con") return "CON";
  if (outcome === "depende") return "DEPENDE";
  if (outcome === "inconclusivo") return "INCONCLUSIVO";
  return "SEM RESULTADO";
}

function outcomeMeaning(outcome: ParsedMediatorReport["finalOutcome"]): string {
  if (outcome === "pro") return "O mediador avaliou que os argumentos do lado Pro foram mais fortes.";
  if (outcome === "con") return "O mediador avaliou que os argumentos do lado Con foram mais fortes.";
  if (outcome === "depende") return "O mediador concluiu que a resposta depende de premissas ou contexto adotado.";
  if (outcome === "inconclusivo") return "O mediador concluiu que não há evidência argumentativa suficiente para decidir.";
  return "Resultado ainda não definido.";
}

export default function DebateRunnerPage() {
  const params = useParams<{ id: string }>();
  const debateId = params.id;
  const [state, setState] = useState<RunnerState>({
    debate: null,
    rounds: [],
    roundSummaries: [],
    report: null,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [stepLoading, setStepLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingDraft, setStreamingDraft] = useState<StreamingDraft | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isMediatorModalOpen, setIsMediatorModalOpen] = useState(false);

  const hasReport = Boolean(state.report?.content_md?.trim());
  const parsedReport = useMemo(
    () => (hasReport ? parseMediatorReport(state.report?.content_md ?? "") : null),
    [hasReport, state.report?.content_md],
  );
  const status = state.debate?.status ?? "draft";
  const hasDraftRenderableContent = Boolean(
    streamingDraft &&
      (streamingDraft.pro.trim() ||
        streamingDraft.con.trim() ||
        streamingDraft.summary.trim() ||
        streamingDraft.report.trim()),
  );
  const showDraftSlide = Boolean(streamingDraft?.roundType && hasDraftRenderableContent);
  const canContinue = useMemo(() => {
    if (!state.debate) return false;
    if (stepLoading) return false;
    if (status === "failed" || status === "completed") return false;
    return !hasReport;
  }, [hasReport, state.debate, status, stepLoading]);

  const slides: CarouselSlide[] = useMemo(() => {
    const roundSlides: CarouselSlide[] = state.rounds.map((round, idx) => ({
      kind: "round",
      round,
      summary: state.roundSummaries[idx] ?? "",
    }));
    if (showDraftSlide && streamingDraft) {
      roundSlides.push({ kind: "draft", draft: streamingDraft });
    }
    return roundSlides;
  }, [state.rounds, state.roundSummaries, showDraftSlide, streamingDraft]);

  useEffect(() => {
    if (state.rounds.length > 0) {
      setActiveSlide(state.rounds.length - 1);
    } else {
      setActiveSlide(0);
    }
  }, [state.rounds.length]);

  useEffect(() => {
    if (showDraftSlide) {
      setActiveSlide(state.rounds.length);
    }
  }, [showDraftSlide, state.rounds.length]);

  useEffect(() => {
    setActiveSlide((prev) => {
      if (slides.length === 0) return 0;
      return Math.min(prev, slides.length - 1);
    });
  }, [slides.length]);

  useEffect(() => {
    if (!isMediatorModalOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMediatorModalOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMediatorModalOpen]);

  const loadData = useCallback(async () => {
    if (!debateId) return;
    setInitialLoading(true);
    setError(null);
    try {
      const [debate, roundsPayload] = await Promise.all([getDebate(debateId), getDebateRounds(debateId)]);
      setState((prev) => ({
        ...prev,
        debate,
        rounds: roundsPayload.rounds,
        roundSummaries: roundsPayload.round_summaries,
      }));
      if (debate.current_round_index >= 3 || debate.status === "completed") {
        setReportLoading(true);
        const report = await getDebateReport(debateId);
        setState((prev) => ({ ...prev, report }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar. Tente novamente.");
    } finally {
      setReportLoading(false);
      setInitialLoading(false);
    }
  }, [debateId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function applyStreamEvent(ev: StepStreamEvent) {
    if (ev.event === "phase") {
      setStreamingDraft((prev) => {
        const roundIndex = ev.data.round_index ?? prev?.roundIndex ?? state.rounds.length;
        const roundType = ev.data.round_type ?? prev?.roundType ?? "";
        return {
          roundIndex,
          roundType,
          pro: prev?.pro ?? "",
          con: prev?.con ?? "",
          summary: prev?.summary ?? "",
          report: prev?.report ?? "",
          phaseLabel: phaseText(ev.data.phase),
        };
      });
      return;
    }

    if (ev.event === "message_start") {
      setStreamingDraft((prev) => ({
        roundIndex: ev.data.round_index ?? prev?.roundIndex ?? state.rounds.length,
        roundType: ev.data.round_type ?? prev?.roundType ?? "",
        pro: prev?.pro ?? "",
        con: prev?.con ?? "",
        summary: prev?.summary ?? "",
        report: prev?.report ?? "",
        phaseLabel: prev?.phaseLabel ?? "Gerando conteúdo...",
      }));
      return;
    }

    if (ev.event === "message_chunk") {
      setStreamingDraft((prev) => {
        const draft = prev ?? {
          roundIndex: state.rounds.length,
          roundType: "",
          pro: "",
          con: "",
          summary: "",
          report: "",
          phaseLabel: "Gerando conteúdo...",
        };
        if (ev.data.target === "debater_a") return { ...draft, pro: `${draft.pro}${ev.data.chunk}` };
        if (ev.data.target === "debater_b") return { ...draft, con: `${draft.con}${ev.data.chunk}` };
        if (ev.data.target === "step_summary") return { ...draft, summary: `${draft.summary}${ev.data.chunk}` };
        if (ev.data.target === "report") return { ...draft, report: `${draft.report}${ev.data.chunk}` };
        return draft;
      });
      return;
    }

    if (ev.event === "step_done") {
      const payload = ev.data as {
        step_type: "round" | "mediation";
        round?: RoundResponse;
        step_summary?: string;
        report?: ReportResponse;
        status?: DebateResponse["status"];
      };
      if (payload.step_type === "round" && payload.round) {
        setState((prev) => ({
          ...prev,
          rounds: [...prev.rounds, payload.round as RoundResponse],
          roundSummaries: [...prev.roundSummaries, payload.step_summary ?? ""],
          debate: prev.debate
            ? {
                ...prev.debate,
                status: "running",
                current_round_index: prev.rounds.length + 1,
              }
            : prev.debate,
        }));
      } else if (payload.step_type === "mediation") {
        setState((prev) => ({
          ...prev,
          report: (payload.report as ReportResponse | undefined) ?? {
            content_md: streamingDraft?.report ?? "",
          },
          debate: prev.debate
            ? { ...prev.debate, status: (payload.status ?? "completed") as DebateResponse["status"] }
            : prev.debate,
        }));
      }
      setStreamingDraft(null);
      return;
    }

    if (ev.event === "error") {
      setError(ev.data.detail ?? "Falha ao processar stream.");
      setStreamingDraft(null);
      setStepLoading(false);
    }
  }

  async function onContinue() {
    if (!debateId || !canContinue) return;
    setStepLoading(true);
    setError(null);
    setStreamingDraft(null);
    try {
      await runDebateStepStream(debateId, applyStreamEvent);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível avançar o debate.");
    } finally {
      setStepLoading(false);
    }
  }

  function goNextSlide() {
    setActiveSlide((prev) => Math.min(prev + 1, Math.max(slides.length - 1, 0)));
  }

  function goPrevSlide() {
    setActiveSlide((prev) => Math.max(prev - 1, 0));
  }

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;
    if (delta > 60) {
      goNextSlide();
    } else if (delta < -60) {
      goPrevSlide();
    }
    setTouchStartX(null);
  }

  return (
    <main className="min-h-screen px-3 pb-36 pt-6 sm:px-4 sm:pt-8 md:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:mb-7">
          <div>
            <Link href="/debates" className="text-sm text-white/70 underline">
              Voltar para meus debates
            </Link>
            <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl md:text-3xl">
              {state.debate?.title ?? "Preparando debate..."}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {initialLoading ? "Preparando debate..." : normalizeStatus(status)}
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:mb-6 sm:p-5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-matrix-dim">Tese</p>
            {reportLoading ? (
              <div className="h-6 w-28 animate-pulse rounded-full bg-white/10" />
            ) : hasReport ? (
              <button
                type="button"
                onClick={() => setIsMediatorModalOpen(true)}
                title={outcomeMeaning(parsedReport?.finalOutcome ?? null)}
                className="rounded-full border border-matrix-green/70 bg-matrix-green/10 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-white transition hover:bg-matrix-green/20"
              >
                {shortOutcomeLabel(parsedReport?.finalOutcome ?? null)}
              </button>
            ) : (
              <span className="rounded-full border border-white/20 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-white/70">
                SEM RESULTADO
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-white sm:text-base">
            {state.debate?.question ?? "Carregando pergunta do debate..."}
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm text-white/90 backdrop-blur-sm sm:mb-6">
            {error}
          </div>
        )}

        {initialLoading ? (
          <RunnerSkeleton />
        ) : (
          <section className="space-y-4">
            {slides.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/75 backdrop-blur-sm sm:p-6">
                Sem rounds ainda. Clique em <strong className="text-matrix-green">Continuar</strong> para
                iniciar.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                  <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{
                      width: `${Math.max(slides.length, 1) * 100}%`,
                      transform: `translateX(-${activeSlide * (100 / Math.max(slides.length, 1))}%)`,
                    }}
                  >
                    {slides.map((slide, idx) => (
                      <div
                        key={`${slide.kind}-${idx}`}
                        className="shrink-0 px-0.5 sm:px-1"
                        style={{ width: `${100 / Math.max(slides.length, 1)}%` }}
                      >
                        {slide.kind === "round" ? (
                          <RoundCard round={slide.round} summary={slide.summary} />
                        ) : (
                          <DraftCard draft={slide.draft} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                  <button
                    type="button"
                    onClick={goPrevSlide}
                    disabled={activeSlide <= 0}
                    className="rounded-md border border-white/15 px-3 py-1 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Anterior
                  </button>
                  <p className="text-xs text-white/70">
                    Round {activeSlide + 1} de {slides.length}
                  </p>
                  <button
                    type="button"
                    onClick={goNextSlide}
                    disabled={activeSlide >= slides.length - 1}
                    className="rounded-md border border-white/15 px-3 py-1 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Próximo →
                  </button>
                </div>
              </div>
            )}

            {stepLoading && <StepLoadingWidget roundCount={state.rounds.length} />}
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-matrix-black/85 p-3 backdrop-blur-md sm:p-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs text-white/70 sm:text-sm">
            {stepLoading ? "Executando próximo step em tempo real..." : "Continue para avançar o debate."}
          </p>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-matrix-green bg-matrix-green/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-matrix-green/25 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-44"
          >
            {stepLoading ? (
              <>
                <span className="inline-block h-3 w-3 rounded-full bg-matrix-green animate-pulse" />
                Renderizando step...
              </>
            ) : (
              "Continuar"
            )}
          </button>
        </div>
      </div>

      {isMediatorModalOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Análise do mediador"
          onClick={() => setIsMediatorModalOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-white/15 bg-matrix-black p-4 sm:rounded-2xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-white">Análise do mediador</h2>
              <button
                type="button"
                onClick={() => setIsMediatorModalOpen(false)}
                className="rounded-md border border-white/20 px-3 py-1 text-sm text-white/85 transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>
            <MediatorReportView content={state.report?.content_md ?? ""} />
          </div>
        </div>
      )}
    </main>
  );
}
