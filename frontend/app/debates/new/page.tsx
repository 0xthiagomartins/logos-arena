"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createDebate } from "@/lib/api";

export default function NewDebatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [simpleMode, setSimpleMode] = useState(false);
  const [rigorMode, setRigorMode] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !question.trim()) {
      setError("Preencha título e pergunta para continuar.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createDebate({
        title: title.trim(),
        question: question.trim(),
        config: {
          question: question.trim(),
          mediator_prefs: {
            explain_like_12yo: simpleMode,
            rigor_formal: rigorMode,
          },
        },
      });
      router.push(`/debates/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm text-matrix-dim underline">
          Voltar para home
        </Link>
      </div>
      <div className="rounded-2xl border border-matrix-dim/50 bg-matrix-dark/70 p-7 md:p-10">
        <h1 className="mb-2 text-3xl font-bold text-matrix-green">Novo debate</h1>
        <p className="mb-8 text-sm text-matrix-dim">
          Defina o tema e inicie o fluxo de rounds com mediação ao final.
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-bold text-matrix-dim">
              Título
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-matrix-muted/70 bg-matrix-black px-4 py-3 text-sm text-matrix-green outline-none transition focus:border-matrix-green"
              placeholder="Ex.: IA deve substituir provas tradicionais?"
            />
          </div>

          <div>
            <label htmlFor="question" className="mb-2 block text-sm font-bold text-matrix-dim">
              Pergunta / tese
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={submitting}
              rows={5}
              className="w-full rounded-lg border border-matrix-muted/70 bg-matrix-black px-4 py-3 text-sm leading-relaxed text-matrix-green outline-none transition focus:border-matrix-green"
              placeholder="Defina claramente a tese para os lados Pro e Con."
            />
          </div>

          <div className="grid gap-3 rounded-lg border border-matrix-muted/50 bg-matrix-black/70 p-4 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-matrix-dim">
              <input
                type="checkbox"
                checked={simpleMode}
                onChange={(e) => setSimpleMode(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4 accent-matrix-green"
              />
              Explicar de forma simples
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-matrix-dim">
              <input
                type="checkbox"
                checked={rigorMode}
                onChange={(e) => setRigorMode(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4 accent-matrix-green"
              />
              Rigor formal
            </label>
          </div>

          {error && (
            <div className="rounded-lg border border-matrix-dim/70 bg-matrix-muted/30 px-4 py-3 text-sm text-matrix-dim">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg border border-matrix-green bg-matrix-green/10 px-5 py-3 text-sm font-bold text-matrix-green transition hover:bg-matrix-green/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <span className="inline-block h-3 w-3 rounded-full bg-matrix-green animate-pulse" />
                Criando debate...
              </>
            ) : (
              "Criar debate"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
