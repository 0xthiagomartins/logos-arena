"use client";

import { useEffect, useMemo, useState } from "react";

type StepLoadingWidgetProps = {
  roundCount: number;
};

const ROUND_MESSAGES = [
  "Convocando estrategistas do lado Pro e Con...",
  "Pesando premissas e contra-argumentos...",
  "Refinando lógica, clareza e consistência...",
  "Mediador auditando possíveis falhas...",
];

const MEDIATION_MESSAGES = [
  "Mediador compilando os três rounds...",
  "Comparando forças e fraquezas finais...",
  "Gerando veredito explicável em Markdown...",
  "Quase pronto: estruturando a conclusão...",
];

export default function StepLoadingWidget({ roundCount }: StepLoadingWidgetProps) {
  const messages = useMemo(
    () => (roundCount >= 3 ? MEDIATION_MESSAGES : ROUND_MESSAGES),
    [roundCount],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [messages]);

  return (
    <div className="rounded-xl border border-matrix-dim/50 bg-matrix-dark/70 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm text-matrix-dim">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-matrix-green animate-pulse" />
        <span>{messages[index]}</span>
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-matrix-muted/40">
        <div className="h-full w-1/3 rounded-full bg-matrix-green step-indeterminate" />
      </div>

      <div className="flex gap-1 opacity-80">
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="matrix-rain-glyph text-[10px] text-matrix-dim"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            {i % 3 === 0 ? "01" : i % 3 === 1 ? "10" : "11"}
          </span>
        ))}
      </div>
    </div>
  );
}

