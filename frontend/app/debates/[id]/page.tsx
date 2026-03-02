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
  runDebateStep,
  type DebateResponse,
  type ReportResponse,
  type RoundResponse,
} from "@/lib/api";

type RunnerState = {
  debate: DebateResponse | null;
  rounds: RoundResponse[];
  roundSummaries: string[];
  report: ReportResponse | null;
};

function RunnerSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-matrix-muted/60 bg-matrix-dark/70 p-4 animate-pulse"
          >
            <div className="mb-3 h-4 w-1/3 rounded bg-matrix-muted/40" />
            <div className="mb-2 h-3 w-full rounded bg-matrix-muted/30" />
            <div className="mb-2 h-3 w-[92%] rounded bg-matrix-muted/30" />
            <div className="h-3 w-4/5 rounded bg-matrix-muted/30" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-matrix-muted/60 bg-matrix-dark/70 p-4 animate-pulse">
        <div className="mb-4 h-4 w-1/2 rounded bg-matrix-muted/40" />
        <div className="mb-2 h-3 w-full rounded bg-matrix-muted/30" />
        <div className="mb-2 h-3 w-5/6 rounded bg-matrix-muted/30" />
        <div className="h-3 w-4/5 rounded bg-matrix-muted/30" />
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

  async function onContinue() {
    if (!debateId || !canContinue) return;
    setStepLoading(true);
    setError(null);
    try {
      const step = await runDebateStep(debateId);
      if (step.step_type === "round") {
        setState((prev) => ({
          ...prev,
          rounds: [...prev.rounds, step.round],
          roundSummaries: [...prev.roundSummaries, step.step_summary],
          debate: prev.debate
            ? {
                ...prev.debate,
                status: "running",
                current_round_index: prev.rounds.length + 1,
              }
            : prev.debate,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          report: step.report,
          debate: prev.debate ? { ...prev.debate, status: "completed" } : prev.debate,
        }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível avançar o debate.");
    } finally {
      setStepLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/debates" className="text-sm text-matrix-dim underline">
            Voltar para meus debates
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-matrix-green md:text-3xl">
            {state.debate?.title ?? "Preparando debate..."}
          </h1>
          <p className="mt-1 text-sm text-matrix-dim">
            {initialLoading ? "Preparando debate..." : normalizeStatus(status)}
          </p>
        </div>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg border border-matrix-green bg-matrix-green/10 px-5 py-3 text-sm font-bold text-matrix-green transition hover:bg-matrix-green/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {stepLoading ? (
            <>
              <span className="inline-block h-3 w-3 rounded-full bg-matrix-green animate-pulse" />
              Processando step...
            </>
          ) : (
            "Continuar"
          )}
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-matrix-dim/40 bg-matrix-dark/70 p-5">
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-matrix-dim">Tese</p>
        <p className="text-sm leading-relaxed text-matrix-green">
          {state.debate?.question ?? "Carregando pergunta do debate..."}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-matrix-dim/70 bg-matrix-muted/30 px-4 py-3 text-sm text-matrix-dim">
          {error}
        </div>
      )}

      {initialLoading ? (
        <RunnerSkeleton />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2">
            {state.rounds.length === 0 ? (
              <div className="rounded-xl border border-matrix-dim/40 bg-matrix-dark/60 p-6 text-sm text-matrix-dim">
                Sem rounds ainda. Clique em <strong className="text-matrix-green">Continuar</strong> para
                iniciar.
              </div>
            ) : (
              state.rounds.map((round, idx) => (
                <article key={`${round.type}-${round.index}`} className="rounded-xl border border-matrix-dim/50 bg-matrix-dark/75 p-5">
                  <p className="mb-3 text-xs uppercase tracking-[0.2em] text-matrix-dim">
                    Round {round.index + 1} · {round.type}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-matrix-dim/30 bg-matrix-black/50 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">Pro</p>
                      <MarkdownContent content={round.messages[0]?.content ?? ""} />
                    </div>
                    <div className="rounded-lg border border-matrix-dim/30 bg-matrix-black/50 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-matrix-dim">Con</p>
                      <MarkdownContent content={round.messages[1]?.content ?? ""} />
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-matrix-dim/50 bg-matrix-muted/20 p-4">
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

            {stepLoading && <StepLoadingWidget roundCount={state.rounds.length} />}
          </section>

          <aside className="rounded-xl border border-matrix-dim/50 bg-matrix-dark/75 p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-matrix-dim">Mediador</p>
            {reportLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-full rounded bg-matrix-muted/30" />
                <div className="h-3 w-[92%] rounded bg-matrix-muted/30" />
                <div className="h-3 w-[85%] rounded bg-matrix-muted/30" />
                <div className="h-3 w-[70%] rounded bg-matrix-muted/30" />
              </div>
            ) : hasReport ? (
              <MarkdownContent content={state.report?.content_md ?? ""} />
            ) : (
              <p className="text-sm leading-relaxed text-matrix-dim">
                Aguardando mediação final. Gere os rounds com o botão Continuar.
              </p>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

