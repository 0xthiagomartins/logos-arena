"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import RequireAuthModal from "@/components/require-auth-modal";
import { createDebate } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { hasAnonymousTrialUsed, markAnonymousTrialUsed, saveMyDebateId } from "@/lib/local-gallery";

type ToggleCardProps = {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

function InfoHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 bg-white/[0.04] text-[10px] font-bold text-white/70 transition hover:border-matrix-green/60 hover:text-white"
    >
      i
    </span>
  );
}

function ToggleCard({ id, title, description, checked, disabled, onChange }: ToggleCardProps) {
  return (
    <label
      htmlFor={id}
      className={[
        "block cursor-pointer rounded-md px-0 py-1 transition-colors",
        disabled ? "cursor-not-allowed opacity-70" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 accent-matrix-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matrix-green/80 focus-visible:ring-offset-2 focus-visible:ring-offset-matrix-black"
        />
        <p className={checked ? "text-sm font-semibold text-white" : "text-sm font-semibold text-white/65"}>
          {title}
          <InfoHint text={description} />
        </p>
      </div>
    </label>
  );
}

export default function NewDebatePage() {
  const { t } = useI18n();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [simpleMode, setSimpleMode] = useState(false);
  const [rigorMode, setRigorMode] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn && hasAnonymousTrialUsed()) {
      setShowAuthModal(true);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (isSignedIn) {
      setShowAuthModal(false);
    }
  }, [isSignedIn]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded) return;
    if (!isSignedIn && hasAnonymousTrialUsed()) {
      setShowAuthModal(true);
      return;
    }

    const nextTitle = title.trim();
    const nextQuestion = question.trim();

    const nextTitleError = nextTitle ? null : t("new.validation.title_required");
    const nextQuestionError = nextQuestion ? null : t("new.validation.question_required");

    setTitleError(nextTitleError);
    setQuestionError(nextQuestionError);
    if (nextTitleError || nextQuestionError) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = isSignedIn ? await getToken() : null;
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
      }, { token });
      saveMyDebateId(created.id);
      if (!isSignedIn) {
        markAnonymousTrialUsed();
      }
      router.push(`/debates/${created.id}`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : t("new.validation.submit_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-70px)] w-full max-w-3xl px-4 py-8 sm:py-10">
      <section className="rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-5 shadow-xl shadow-black/25 backdrop-blur-sm sm:p-7 md:p-8">
        <div className="mb-7 rounded-xl border border-matrix-green/35 bg-matrix-green/[0.08] px-4 py-4 sm:px-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-matrix-dim">{t("new.badge")}</p>
          <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">{t("new.title")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/80">{t("new.subtitle")}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-7">
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-semibold text-white/90">
              {t("new.field.title")}
              <InfoHint text={t("new.field.title_help")} />
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
                "w-full rounded-lg border bg-matrix-black/70 px-4 py-3 text-sm text-white outline-none transition",
                "placeholder:text-matrix-dim/80",
                "focus-visible:border-matrix-green focus-visible:ring-2 focus-visible:ring-matrix-green/80 focus-visible:ring-offset-2 focus-visible:ring-offset-matrix-black",
                titleError ? "border-red-400/70" : "border-matrix-dim/40",
              ].join(" ")}
              placeholder={t("new.field.title_placeholder")}
            />
            {titleError && <p className="mt-1 text-xs text-red-400">{titleError}</p>}
          </div>

          <div>
            <label htmlFor="question" className="mb-2 block text-sm font-semibold text-white/90">
              {t("new.field.question")}
              <InfoHint text={t("new.field.question_help")} />
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
                "w-full rounded-lg border bg-matrix-black/70 px-4 py-3 text-sm leading-relaxed text-white outline-none transition",
                "placeholder:text-matrix-dim/80",
                "focus-visible:border-matrix-green focus-visible:ring-2 focus-visible:ring-matrix-green/80 focus-visible:ring-offset-2 focus-visible:ring-offset-matrix-black",
                questionError ? "border-red-400/70" : "border-matrix-dim/40",
              ].join(" ")}
              placeholder={t("new.field.question_placeholder")}
            />
            {questionError && <p className="mt-1 text-xs text-red-400">{questionError}</p>}
          </div>

          <div className="space-y-1">
            <div className="grid gap-2">
              <ToggleCard
                id="simple-mode"
                title={t("new.mediator.simple_title")}
                description={t("new.mediator.simple_desc")}
                checked={simpleMode}
                disabled={submitting}
                onChange={setSimpleMode}
              />
              <ToggleCard
                id="rigor-mode"
                title={t("new.mediator.rigor_title")}
                description={t("new.mediator.rigor_desc")}
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
              className="inline-flex min-w-44 items-center justify-center gap-2 rounded-full border border-matrix-green bg-matrix-green/10 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-matrix-green hover:text-matrix-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matrix-green focus-visible:ring-offset-2 focus-visible:ring-offset-matrix-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-matrix-green border-t-transparent animate-spin" />
                  {t("new.cta.loading")}
                </>
              ) : (
                t("new.cta.default")
              )}
            </button>
          </div>
        </form>
      </section>
      <RequireAuthModal open={showAuthModal} mandatory />
    </main>
  );
}
