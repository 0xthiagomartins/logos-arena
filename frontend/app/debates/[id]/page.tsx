"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type TouchEvent } from "react";
import MarkdownContent from "@/components/markdown-content";
import StepLoadingWidget from "@/components/step-loading-widget";
import { useI18n } from "@/lib/i18n";
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

function normalizeStatus(status: string, t: (key: string) => string): string {
  if (status === "draft") return t("status.draft");
  if (status === "running") return t("status.running");
  if (status === "completed") return t("status.completed");
  if (status === "failed") return t("status.failed");
  return status;
}

function phaseText(phase: string, t: (key: string) => string): string {
  if (phase === "round_start") return t("debate.phase.round_start");
  if (phase === "summary_start") return t("debate.phase.summary_start");
  if (phase === "mediation_start") return t("debate.phase.mediation_start");
  return t("debate.phase.default");
}

function RoundCard({
  round,
  summary,
  t,
}: {
  round: RoundResponse;
  summary: string;
  t: (key: string) => string;
}) {
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
          <span>{t("debate.show_round_summary")}</span>
          <span className="expander-chevron text-sm">⌄</span>
        </summary>
        <div className="expander-grid mt-3">
          <div className="overflow-hidden">
            <MarkdownContent content={summary || t("debate.round_summary_fallback")} />
          </div>
        </div>
      </details>
    </article>
  );
}

function DraftCard({ draft, t }: { draft: StreamingDraft; t: (key: string) => string }) {
  return (
    <article className="rounded-xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-matrix-dim">
        Round {draft.roundIndex + 1} · {draft.roundType}
      </p>
      <p className="mb-4 text-sm text-white/75">{draft.phaseLabel}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">Pro</p>
          <MarkdownContent content={draft.pro || t("debate.streaming_generating_argument")} />
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">Con</p>
          <MarkdownContent content={draft.con || t("debate.streaming_waiting_response")} />
        </div>
      </div>
      <details className="mt-4 rounded-lg border border-white/15 bg-white/[0.04] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-matrix-dim">
          <span>{t("debate.show_round_summary")}</span>
          <span className="expander-chevron text-sm">⌄</span>
        </summary>
        <div className="expander-grid mt-3">
          <div className="overflow-hidden">
            <MarkdownContent content={draft.summary || t("debate.streaming_mediator_analyzing")} />
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

function outcomeLabel(outcome: ParsedMediatorReport["finalOutcome"], t: (key: string) => string): string {
  if (outcome === "pro") return t("debate.mediator_result_pro");
  if (outcome === "con") return t("debate.mediator_result_con");
  if (outcome === "depende") return t("debate.mediator_result_depende");
  if (outcome === "inconclusivo") return t("debate.mediator_result_inconclusivo");
  return t("debate.mediator_result_none");
}

function firstParagraph(text: string): string {
  const cleaned = text.trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\n\s*\n/);
  return parts[0] ?? cleaned;
}

function removeFinalOutcomeLine(text: string): string {
  return text
    .replace(/^\s*[-*]?\s*`?\s*final_outcome:\s*(pro|con|inconclusivo|depende)\s*`?\s*$/gim, "")
    .replace(/`?\s*final_outcome:\s*(pro|con|inconclusivo|depende)\s*`?/gim, "")
    .trim();
}

function MediatorReportView({ content, t }: { content: string; t: (key: string) => string }) {
  const parsed = useMemo(() => parseMediatorReport(content), [content]);

  if (!parsed) {
    return <MarkdownContent content={content} />;
  }

  const cleanConclusion = removeFinalOutcomeLine(parsed.conclusion);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-matrix-green/50 bg-matrix-muted/25 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-matrix-dim">
          {outcomeLabel(parsed.finalOutcome, t)}
        </p>
        {cleanConclusion && (
          <p className="mt-2 text-sm leading-relaxed text-white/90">{firstParagraph(cleanConclusion)}</p>
        )}
      </div>

      <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-[0.15em] text-matrix-dim">{t("debate.mediator_summary")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-matrix-dim">Pro</p>
            <MarkdownContent content={parsed.pro || t("debate.no_content")} />
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-matrix-dim">Con</p>
            <MarkdownContent content={parsed.con || t("debate.no_content")} />
          </div>
        </div>
      </section>

      <details className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.15em] text-matrix-dim">
          {t("debate.mediator_analysis_logic")}
        </summary>
        <div className="mt-3">
          <MarkdownContent
            content={
              removeFinalOutcomeLine([parsed.analysis, cleanConclusion].filter(Boolean).join("\n\n")) ||
              t("debate.no_content")
            }
          />
        </div>
      </details>
    </div>
  );
}

function shortOutcomeLabel(outcome: ParsedMediatorReport["finalOutcome"], t: (key: string) => string): string {
  if (outcome === "pro") return t("debate.outcome.badge.pro");
  if (outcome === "con") return t("debate.outcome.badge.con");
  if (outcome === "depende") return t("debate.outcome.badge.depende");
  if (outcome === "inconclusivo") return t("debate.outcome.badge.inconclusivo");
  return t("debate.outcome.badge.none");
}

function outcomeMeaning(outcome: ParsedMediatorReport["finalOutcome"], t: (key: string) => string): string {
  if (outcome === "pro") return t("debate.outcome.pro_meaning");
  if (outcome === "con") return t("debate.outcome.con_meaning");
  if (outcome === "depende") return t("debate.outcome.depende_meaning");
  if (outcome === "inconclusivo") return t("debate.outcome.inconclusivo_meaning");
  return t("debate.outcome.none_meaning");
}

export default function DebateRunnerPage() {
  const { t } = useI18n();
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
  const debateFinished = status === "completed" || status === "failed";
  const finishedByStructure = state.rounds.length >= 3 && (hasReport || debateFinished);
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
    if (finishedByStructure) return false;
    return !hasReport;
  }, [finishedByStructure, hasReport, state.debate, status, stepLoading]);

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
      setError(err instanceof Error ? err.message : t("debate.load_error"));
    } finally {
      setReportLoading(false);
      setInitialLoading(false);
    }
  }, [debateId, t]);

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
          phaseLabel: phaseText(ev.data.phase, t),
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
        phaseLabel: prev?.phaseLabel ?? t("debate.generating_content"),
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
          phaseLabel: t("debate.generating_content"),
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
      setError(ev.data.detail ?? t("debate.stream_fail"));
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
      // Hard sync after each step to avoid stale local status/report state.
      const debate = await getDebate(debateId);
      const roundsPayload = await getDebateRounds(debateId);
      let report: ReportResponse | null = null;
      if (debate.status === "completed" || debate.current_round_index >= 3) {
        report = await getDebateReport(debateId);
      }
      setState((prev) => ({
        ...prev,
        debate,
        rounds: roundsPayload.rounds,
        roundSummaries: roundsPayload.round_summaries,
        report: report ?? prev.report,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("debate.advance_error"));
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
              {t("debate.back_to_gallery")}
            </Link>
            <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl md:text-3xl">
              {state.debate?.title ?? t("debate.preparing")}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {initialLoading ? t("debate.preparing") : normalizeStatus(status, t)}
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:mb-6 sm:p-5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-matrix-dim">{t("debate.thesis")}</p>
            {reportLoading ? (
              <div className="h-6 w-28 animate-pulse rounded-full bg-white/10" />
            ) : hasReport ? (
              <button
                type="button"
                onClick={() => setIsMediatorModalOpen(true)}
                title={outcomeMeaning(parsedReport?.finalOutcome ?? null, t)}
                className="rounded-full border border-matrix-green/70 bg-matrix-green/10 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-white transition hover:bg-matrix-green/20"
              >
                {shortOutcomeLabel(parsedReport?.finalOutcome ?? null, t)}
              </button>
            ) : (
              <span className="rounded-full border border-white/20 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-white/70">
                {t("debate.no_result")}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-white sm:text-base">
            {state.debate?.question ?? t("debate.loading_question")}
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
              stepLoading ? null : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/75 backdrop-blur-sm sm:p-6">
                  {t("debate.rounds_empty_prefix")}{" "}
                  <strong className="text-matrix-green">{t("debate.continue")}</strong>{" "}
                  {t("debate.rounds_empty_suffix")}
                </div>
              )
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
                          <RoundCard round={slide.round} summary={slide.summary} t={t} />
                        ) : (
                          <DraftCard draft={slide.draft} t={t} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {stepLoading && <StepLoadingWidget roundCount={state.rounds.length} />}
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-matrix-black/85 p-3 backdrop-blur-md sm:p-4">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-2 sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={goPrevSlide}
            disabled={slides.length === 0 || activeSlide <= 0}
            aria-label={t("debate.prev")}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xl leading-none text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ←
          </button>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/75 sm:text-sm">
            {t("debate.round_of")
              .replace("{current}", String(slides.length === 0 ? 0 : activeSlide + 1))
              .replace("{total}", String(slides.length))}
          </span>
          <button
            type="button"
            onClick={goNextSlide}
            disabled={slides.length === 0 || activeSlide >= slides.length - 1}
            aria-label={t("debate.next")}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xl leading-none text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            →
          </button>

          {finishedByStructure ? (
            <span className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/[0.04] px-5 py-2 text-sm font-bold text-white/80 sm:min-w-44">
              {t("debate.finished_badge")}
            </span>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              disabled={!canContinue}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-matrix-green bg-matrix-green/15 px-5 py-2 text-sm font-bold text-white transition hover:bg-matrix-green/25 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-44"
            >
              {stepLoading ? (
                <>
                  <span className="inline-block h-3 w-3 rounded-full bg-matrix-green animate-pulse" />
                  {t("debate.rendering_step")}
                </>
              ) : (
                t("debate.continue")
              )}
            </button>
          )}
        </div>
      </div>

      {isMediatorModalOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-30 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("debate.mediator_modal_title")}
          onClick={() => setIsMediatorModalOpen(false)}
        >
          <div
            className="modal-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-white/15 bg-matrix-black p-4 sm:rounded-2xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-white">{t("debate.mediator_modal_title")}</h2>
              <button
                type="button"
                onClick={() => setIsMediatorModalOpen(false)}
                className="rounded-md border border-white/20 px-3 py-1 text-sm text-white/85 transition hover:bg-white/10"
              >
                {t("debate.close")}
              </button>
            </div>
            <MediatorReportView content={state.report?.content_md ?? ""} t={t} />
          </div>
        </div>
      )}
    </main>
  );
}
