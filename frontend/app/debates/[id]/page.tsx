"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const hasReport = Boolean(state.report?.content_md?.trim());
  const status = state.debate?.status ?? "draft";
  const canContinue = useMemo(() => {
    if (!state.debate) return false;
    if (stepLoading) return false;
    if (status === "failed" || status === "completed") return false;
    return !hasReport;
  }, [hasReport, state.debate, status, stepLoading]);

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
        round_index?: number;
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 pb-32 pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/debates" className="text-sm text-white/70 underline">
            Voltar para meus debates
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            {state.debate?.title ?? "Preparando debate..."}
          </h1>
          <p className="mt-1 text-sm text-white/70">
            {initialLoading ? "Preparando debate..." : normalizeStatus(status)}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-matrix-dim">Tese</p>
        <p className="text-base leading-relaxed text-white">
          {state.debate?.question ?? "Carregando pergunta do debate..."}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm text-white/90 backdrop-blur-sm">
          {error}
        </div>
      )}

      {initialLoading ? (
        <RunnerSkeleton />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2">
            {state.rounds.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-white/75 backdrop-blur-sm">
                Sem rounds ainda. Clique em <strong className="text-matrix-green">Continuar</strong> para
                iniciar.
              </div>
            ) : (
              state.rounds.map((round, idx) => (
                <article key={`${round.type}-${round.index}`} className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
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
                  <div className="mt-4 rounded-lg border border-white/15 bg-white/[0.04] p-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">
                      Resumo de qualidade
                    </p>
                    <MarkdownContent
                      content={state.roundSummaries[idx] ?? "Resumo ainda não disponível para este round."}
                    />
                  </div>
                </article>
              ))
            )}

            {streamingDraft && (
              <article className="rounded-xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-matrix-dim">
                  {streamingDraft.roundType
                    ? `Round ${streamingDraft.roundIndex + 1} · ${streamingDraft.roundType}`
                    : "Mediador"}
                </p>
                <p className="mb-4 text-sm text-white/75">{streamingDraft.phaseLabel}</p>
                {streamingDraft.roundType ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">Pro</p>
                        <MarkdownContent content={streamingDraft.pro || "_Gerando argumento..._"} />
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">Con</p>
                        <MarkdownContent content={streamingDraft.con || "_Aguardando resposta..._"} />
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg border border-white/15 bg-white/[0.04] p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">
                        Resumo de qualidade
                      </p>
                      <MarkdownContent content={streamingDraft.summary || "_Mediador analisando..._"} />
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <MarkdownContent content={streamingDraft.report || "_Gerando relatório final..._"} />
                  </div>
                )}
              </article>
            )}

            {stepLoading && <StepLoadingWidget roundCount={state.rounds.length} />}
          </section>

          <aside className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-matrix-dim">Mediador</p>
            {reportLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-full rounded bg-white/10" />
                <div className="h-3 w-[92%] rounded bg-white/10" />
                <div className="h-3 w-[85%] rounded bg-white/10" />
                <div className="h-3 w-[70%] rounded bg-white/10" />
              </div>
            ) : hasReport ? (
              <MarkdownContent content={state.report?.content_md ?? ""} />
            ) : (
              <p className="text-sm leading-relaxed text-white/75">
                Aguardando mediação final. Gere os rounds com o botão Continuar.
              </p>
            )}
          </aside>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-matrix-black/85 p-4 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <p className="hidden text-sm text-white/70 md:block">
            {stepLoading ? "Executando próximo step em tempo real..." : "Continue para avançar o debate."}
          </p>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg border border-matrix-green bg-matrix-green/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-matrix-green/25 disabled:cursor-not-allowed disabled:opacity-60"
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
    </main>
  );
}

