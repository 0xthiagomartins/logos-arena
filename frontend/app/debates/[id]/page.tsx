"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  role: "debater_a" | "debater_b" | null;
  content: string;
  summary: string;
  report: string;
  phaseLabel: string;
};

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
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <div className="mb-3 h-3 w-32 rounded bg-white/10" />
          <div className="mb-2 h-3 w-full rounded bg-white/10" />
          <div className="h-3 w-4/5 rounded bg-white/10" />
        </div>
      ))}
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

function phaseLabel(phase: string, t: (key: string) => string): string {
  if (phase === "opening") return t("debate.phase.opening");
  if (phase === "rebuttal") return t("debate.phase.rebuttal");
  if (phase === "closing") return t("debate.phase.closing");
  return phase;
}

function roleLabel(role: string, t: (key: string) => string): string {
  if (role === "debater_a") return t("debate.side.pro");
  if (role === "debater_b") return t("debate.side.con");
  return role;
}

function parseMediatorReport(content: string): ParsedMediatorReport | null {
  const normalized = content.replace(/\r/g, "");
  const sections: Array<{ key: MediatorSectionKey; patterns: RegExp[] }> = [
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
    { key: "analysis", patterns: [/\*{0,2}\s*an[áa]lise cr[ií]tica\s*\*{0,2}\s*:?/i] },
    { key: "conclusion", patterns: [/\*{0,2}\s*conclus[aã]o\s*\*{0,2}\s*:?/i] },
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

function removeFinalOutcomeLine(text: string): string {
  return text
    .replace(/^\s*[-*]?\s*`?\s*final_outcome:\s*(pro|con|inconclusivo|depende)\s*`?\s*$/gim, "")
    .replace(/`?\s*final_outcome:\s*(pro|con|inconclusivo|depende)\s*`?/gim, "")
    .trim();
}

function firstParagraph(text: string): string {
  const cleaned = text.trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\n\s*\n/);
  return parts[0] ?? cleaned;
}

function outcomeMeaning(outcome: ParsedMediatorReport["finalOutcome"], t: (key: string) => string): string {
  if (outcome === "pro") return t("debate.outcome.pro_meaning");
  if (outcome === "con") return t("debate.outcome.con_meaning");
  if (outcome === "depende") return t("debate.outcome.depende_meaning");
  if (outcome === "inconclusivo") return t("debate.outcome.inconclusivo_meaning");
  return t("debate.outcome.none_meaning");
}

function shortOutcomeLabel(outcome: ParsedMediatorReport["finalOutcome"], t: (key: string) => string): string {
  if (outcome === "pro") return t("debate.outcome.badge.pro");
  if (outcome === "con") return t("debate.outcome.badge.con");
  if (outcome === "depende") return t("debate.outcome.badge.depende");
  if (outcome === "inconclusivo") return t("debate.outcome.badge.inconclusivo");
  return t("debate.outcome.badge.none");
}

function MediatorReportView({ content, t }: { content: string; t: (key: string) => string }) {
  const parsed = useMemo(() => parseMediatorReport(content), [content]);

  if (!parsed) return <MarkdownContent content={content} />;

  const cleanConclusion = removeFinalOutcomeLine(parsed.conclusion);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-matrix-green/50 bg-matrix-muted/25 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-matrix-dim">{shortOutcomeLabel(parsed.finalOutcome, t)}</p>
        {cleanConclusion ? <p className="mt-2 text-sm leading-relaxed text-white/90">{firstParagraph(cleanConclusion)}</p> : null}
      </div>

      <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-[0.15em] text-matrix-dim">{t("debate.mediator_summary")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-matrix-dim">{t("debate.side.pro")}</p>
            <MarkdownContent content={parsed.pro || t("debate.no_content")} />
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-matrix-dim">{t("debate.side.con")}</p>
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
              removeFinalOutcomeLine([parsed.analysis, cleanConclusion].filter(Boolean).join("\n\n")) || t("debate.no_content")
            }
          />
        </div>
      </details>
    </div>
  );
}

function ChatBubble({ round, summary, t }: { round: RoundResponse; summary: string; t: (key: string) => string }) {
  const message = round.messages[0];
  const isPro = message?.role === "debater_a";

  return (
    <article className="space-y-2">
      <div className={["flex", isPro ? "justify-end" : "justify-start"].join(" ")}>
        <div
          className={[
            "w-full max-w-3xl rounded-2xl border px-4 py-3 backdrop-blur-sm",
            isPro
              ? "border-matrix-green/35 bg-matrix-green/[0.10] text-white"
              : "border-white/20 bg-white/[0.06] text-white/95",
          ].join(" ")}
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-white/70">
            <span>{roleLabel(message?.role ?? "", t)}</span>
            <span>
              {t("debate.turn")} {round.index + 1} · {phaseLabel(round.type, t)}
            </span>
          </div>
          <MarkdownContent content={message?.content ?? ""} />
        </div>
      </div>
      <details className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm">
        <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.16em] text-matrix-dim">
          {t("debate.show_round_summary")}
        </summary>
        <div className="mt-2 rounded-md bg-black/20 p-3">
          <MarkdownContent content={summary || t("debate.round_summary_fallback")} />
        </div>
      </details>
    </article>
  );
}

function DraftBubble({ draft, t }: { draft: StreamingDraft; t: (key: string) => string }) {
  const isPro = draft.role === "debater_a";
  const content = draft.content || t("debate.streaming_generating_argument");

  return (
    <article className="space-y-2">
      <p className="text-xs text-white/65">{draft.phaseLabel}</p>
      <div className={["flex", isPro ? "justify-end" : "justify-start"].join(" ")}>
        <div
          className={[
            "w-full max-w-3xl rounded-2xl border px-4 py-3 backdrop-blur-sm",
            isPro ? "border-matrix-green/35 bg-matrix-green/[0.10]" : "border-white/20 bg-white/[0.06]",
          ].join(" ")}
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-white/70">
            <span>{roleLabel(draft.role ?? "", t)}</span>
            <span>
              {t("debate.turn")} {draft.roundIndex + 1} · {phaseLabel(draft.roundType, t)}
            </span>
          </div>
          <MarkdownContent content={content} />
        </div>
      </div>
      <details className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm" open={Boolean(draft.summary)}>
        <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.16em] text-matrix-dim">
          {t("debate.show_round_summary")}
        </summary>
        <div className="mt-2 rounded-md bg-black/20 p-3">
          <MarkdownContent content={draft.summary || t("debate.streaming_mediator_analyzing")} />
        </div>
      </details>
    </article>
  );
}

export default function DebateRunnerPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const debateId = params.id;

  const [state, setState] = useState<RunnerState>({ debate: null, rounds: [], roundSummaries: [], report: null });
  const [initialLoading, setInitialLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);
  const [streamingDraft, setStreamingDraft] = useState<StreamingDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMediatorModalOpen, setIsMediatorModalOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const status = state.debate?.status ?? "draft";
  const hasReport = Boolean(state.report?.content_md?.trim());
  const debateFinished = status === "completed" || status === "failed" || hasReport;
  const parsedReport = useMemo(
    () => (hasReport ? parseMediatorReport(state.report?.content_md ?? "") : null),
    [hasReport, state.report?.content_md],
  );

  const hasDraftRenderableContent = Boolean(
    streamingDraft && (streamingDraft.content.trim() || streamingDraft.summary.trim() || streamingDraft.report.trim()),
  );

  const canRunStep = Boolean(state.debate) && !stepLoading && !debateFinished;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.rounds.length, streamingDraft?.content, streamingDraft?.summary]);

  useEffect(() => {
    if (!isMediatorModalOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMediatorModalOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
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
      if (debate.status === "completed") {
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
      setStreamingDraft((prev) => ({
        roundIndex: ev.data.round_index ?? prev?.roundIndex ?? state.rounds.length,
        roundType: ev.data.round_type ?? prev?.roundType ?? "opening",
        role: prev?.role ?? null,
        content: prev?.content ?? "",
        summary: prev?.summary ?? "",
        report: prev?.report ?? "",
        phaseLabel: phaseText(ev.data.phase, t),
      }));
      return;
    }

    if (ev.event === "message_start") {
      setStreamingDraft((prev) => {
        const role = ev.data.target === "debater_a" || ev.data.target === "debater_b" ? ev.data.target : prev?.role ?? null;
        return {
          roundIndex: ev.data.round_index ?? prev?.roundIndex ?? state.rounds.length,
          roundType: ev.data.round_type ?? prev?.roundType ?? "opening",
          role,
          content: prev?.content ?? "",
          summary: prev?.summary ?? "",
          report: prev?.report ?? "",
          phaseLabel: prev?.phaseLabel ?? t("debate.generating_content"),
        };
      });
      return;
    }

    if (ev.event === "message_chunk") {
      setStreamingDraft((prev) => {
        const draft =
          prev ??
          ({
            roundIndex: state.rounds.length,
            roundType: "opening",
            role: null,
            content: "",
            summary: "",
            report: "",
            phaseLabel: t("debate.generating_content"),
          } satisfies StreamingDraft);

        if (ev.data.target === "debater_a" || ev.data.target === "debater_b") {
          return { ...draft, role: ev.data.target, content: `${draft.content}${ev.data.chunk}` };
        }
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
        const nextRound = payload.round as RoundResponse;
        setState((prev) => ({
          ...prev,
          rounds: [...prev.rounds, nextRound],
          roundSummaries: [...prev.roundSummaries, payload.step_summary ?? ""],
          debate: prev.debate
            ? { ...prev.debate, status: "running", current_round_index: prev.rounds.length + 1 }
            : prev.debate,
        }));
      } else if (payload.step_type === "mediation") {
        setState((prev) => ({
          ...prev,
          report: payload.report ?? { content_md: streamingDraft?.report ?? "" },
          debate: prev.debate ? { ...prev.debate, status: (payload.status ?? "completed") as DebateResponse["status"] } : prev.debate,
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

  async function onAction(action: "extend" | "next") {
    if (!debateId || !canRunStep) return;
    setStepLoading(true);
    setError(null);
    setStreamingDraft(null);
    try {
      await runDebateStepStream(debateId, applyStreamEvent, { action });
      const debate = await getDebate(debateId);
      const roundsPayload = await getDebateRounds(debateId);
      const report = debate.status === "completed" ? await getDebateReport(debateId) : null;
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

  return (
    <main className="min-h-screen px-3 pb-32 pt-6 sm:px-4 sm:pt-8 md:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-5 space-y-2">
          <Link href="/debates" className="text-sm text-white/70 underline">
            {t("debate.back_to_gallery")}
          </Link>
          <h1 className="text-xl font-bold text-white sm:text-2xl md:text-3xl">{state.debate?.title ?? t("debate.preparing")}</h1>
          <p className="text-sm text-white/70">{initialLoading ? t("debate.preparing") : normalizeStatus(status, t)}</p>
        </header>

        <section className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
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
          <p className="text-sm leading-relaxed text-white sm:text-base">{state.debate?.question ?? t("debate.loading_question")}</p>
        </section>

        {error ? (
          <div className="mb-5 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm text-white/90 backdrop-blur-sm">
            {error}
          </div>
        ) : null}

        {initialLoading ? (
          <RunnerSkeleton />
        ) : (
          <section className="space-y-4">
            {state.rounds.length === 0 && !hasDraftRenderableContent && !stepLoading ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/75 backdrop-blur-sm">
                {t("debate.rounds_empty_prefix")} <strong className="text-matrix-green">{t("debate.next_claim")}</strong>{" "}
                {t("debate.rounds_empty_suffix")}
              </div>
            ) : null}

            <div className="space-y-4">
              {state.rounds.map((round, idx) => (
                <ChatBubble key={`${round.index}-${idx}`} round={round} summary={state.roundSummaries[idx] ?? ""} t={t} />
              ))}

              {hasDraftRenderableContent && streamingDraft ? <DraftBubble draft={streamingDraft} t={t} /> : null}

              <div ref={bottomRef} />
            </div>
          </section>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-matrix-black/85 p-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-stretch gap-2">
          <div className="min-h-[42px] flex-1">{stepLoading ? <StepLoadingWidget roundCount={state.rounds.length} compact /> : null}</div>

          {debateFinished ? (
            <span className="inline-flex min-w-44 items-center justify-center rounded-lg border border-white/20 bg-white/[0.04] px-5 py-2 text-sm font-bold text-white/80">
              {t("debate.finished_badge")}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAction("extend")}
                disabled={!canRunStep}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("debate.open_continue")}
              </button>

              <button
                type="button"
                onClick={() => onAction("next")}
                disabled={!canRunStep}
                className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg border border-matrix-green bg-matrix-green/15 px-5 py-2 text-sm font-bold text-white transition hover:bg-matrix-green/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stepLoading ? (
                  <>
                    <span className="inline-block h-3 w-3 rounded-full bg-matrix-green animate-pulse" />
                    {t("debate.rendering_step")}
                  </>
                ) : (
                  t("debate.next_claim")
                )}
              </button>
            </div>
          )}
        </div>
      </footer>

      {isMediatorModalOpen ? (
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
      ) : null}
    </main>
  );
}
