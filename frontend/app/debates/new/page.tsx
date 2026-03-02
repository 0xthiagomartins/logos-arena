"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createDebate } from "@/lib/api";

type ToggleCardProps = {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleCard({ id, title, description, checked, disabled, onChange }: ToggleCardProps) {
  return (
    <label
      htmlFor={id}
      className={[
        "block cursor-pointer rounded-xl border px-4 py-3 transition-colors",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-matrix-green/80 focus-within:ring-offset-2 focus-within:ring-offset-matrix-black",
        checked ? "border-matrix-green bg-matrix-muted/40" : "border-matrix-dim/40 bg-matrix-dark/40 hover:border-matrix-dim/70",
        disabled ? "cursor-not-allowed opacity-70" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mt-1 h-4 w-4 accent-matrix-green"
        />
        <div>
          <p className={checked ? "text-sm font-semibold text-matrix-green" : "text-sm font-semibold text-matrix-dim"}>
            {title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/75">{description}</p>
        </div>
      </div>
    </label>
  );
}

export default function NewDebatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [simpleMode, setSimpleMode] = useState(false);
  const [rigorMode, setRigorMode] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    const nextQuestion = question.trim();

    const nextTitleError = nextTitle ? null : "Preencha o título do debate.";
    const nextQuestionError = nextQuestion ? null : "Preencha a pergunta / tese do debate.";

    setTitleError(nextTitleError);
    setQuestionError(nextQuestionError);
    if (nextTitleError || nextQuestionError) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createDebate({
        title: nextTitle,
        question: nextQuestion,
        config: {
          question: nextQuestion,
          mediator_prefs: {
            explain_like_12yo: simpleMode,
            rigor_formal: rigorMode,
          },
        },
      });
      router.push(`/debates/${created.id}`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao criar. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm text-matrix-dim underline">
          Voltar para home
        </Link>
      </div>
      <div className="rounded-2xl border border-matrix-dim/30 bg-matrix-dark/70 p-6 md:p-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-matrix-green md:text-4xl">Novo debate</h1>
          <p className="text-sm leading-relaxed text-matrix-dim">
            Preencha os campos abaixo para iniciar um debate estruturado com Pro, Con e mediação.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-8">
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-semibold text-matrix-dim">
              Título
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
              disabled={submitting}
              className={[
                "w-full rounded-lg border bg-matrix-black/60 px-4 py-3 text-sm text-white outline-none transition",
                "placeholder:text-matrix-dim/80",
                "focus-visible:border-matrix-green focus-visible:ring-2 focus-visible:ring-matrix-green/80 focus-visible:ring-offset-2 focus-visible:ring-offset-matrix-black",
                titleError ? "border-red-400/70" : "border-matrix-dim/40",
              ].join(" ")}
              placeholder="Ex.: Cristo vegano (ético)?"
            />
            <p className="mt-2 text-xs text-matrix-dim">
              Use um título curto e direto para facilitar a leitura na galeria.
            </p>
            {titleError && <p className="mt-1 text-xs text-red-400">{titleError}</p>}
          </div>

          <div>
            <label htmlFor="question" className="mb-2 block text-sm font-semibold text-matrix-dim">
              Pergunta / tese
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (questionError) setQuestionError(null);
              }}
              disabled={submitting}
              rows={5}
              className={[
                "w-full rounded-lg border bg-matrix-black/60 px-4 py-3 text-sm leading-relaxed text-white outline-none transition",
                "placeholder:text-matrix-dim/80",
                "focus-visible:border-matrix-green focus-visible:ring-2 focus-visible:ring-matrix-green/80 focus-visible:ring-offset-2 focus-visible:ring-offset-matrix-black",
                questionError ? "border-red-400/70" : "border-matrix-dim/40",
              ].join(" ")}
              placeholder="Ex.: Cristo era vegano em sentido ético?"
            />
            <p className="mt-2 text-xs leading-relaxed text-matrix-dim">
              Essa frase guia todo o debate. Quanto mais clara a tese, melhor a qualidade dos argumentos.
            </p>
            {questionError && <p className="mt-1 text-xs text-red-400">{questionError}</p>}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-matrix-green">Modo de explicação / rigor</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleCard
                id="simple-mode"
                title="Explicar de forma simples"
                description="Deixa a linguagem mais acessível, como se fosse para alguém de 12 anos."
                checked={simpleMode}
                disabled={submitting}
                onChange={setSimpleMode}
              />
              <ToggleCard
                id="rigor-mode"
                title="Rigor formal"
                description="Pede que o modelo deixe claro premissas, passos lógicos e conclusão."
                checked={rigorMode}
                disabled={submitting}
                onChange={setRigorMode}
              />
            </div>
          </div>

          {submitError && (
            <div className="rounded-lg border border-red-400/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              {submitError}
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-w-44 items-center justify-center gap-2 rounded-full border border-matrix-green px-6 py-2 text-sm font-semibold text-matrix-green transition-colors hover:bg-matrix-green hover:text-matrix-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matrix-green focus-visible:ring-offset-2 focus-visible:ring-offset-matrix-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-matrix-green border-t-transparent animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar debate"
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
