"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listDebates, type DebateListItem } from "@/lib/api";

function DebateCardSkeleton() {
  return (
    <div className="rounded-xl border border-matrix-muted/60 bg-matrix-dark/70 p-4 animate-pulse">
      <div className="mb-3 h-4 w-2/3 rounded bg-matrix-muted/40" />
      <div className="mb-2 h-3 w-full rounded bg-matrix-muted/30" />
      <div className="mb-4 h-3 w-4/5 rounded bg-matrix-muted/30" />
      <div className="h-3 w-1/3 rounded bg-matrix-muted/30" />
    </div>
  );
}

function statusLabel(status: string): string {
  if (status === "completed") return "Concluído";
  if (status === "running") return "Em andamento";
  if (status === "failed") return "Falhou";
  if (status === "draft") return "Rascunho";
  return status;
}

export default function DebatesPage() {
  const [items, setItems] = useState<DebateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listDebates()
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-matrix-green">Meus debates</h1>
          <p className="mt-1 text-sm text-matrix-dim">
            {loading ? "Carregando debates..." : "Acompanhe o progresso e retome quando quiser."}
          </p>
        </div>
        <Link
          href="/debates/new"
          className="rounded-lg border border-matrix-dim bg-matrix-muted/20 px-4 py-2 text-sm font-bold text-matrix-dim transition hover:bg-matrix-muted/35"
        >
          Novo debate
        </Link>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-matrix-dim/60 bg-matrix-muted/20 px-4 py-3 text-sm text-matrix-dim">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <DebateCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-matrix-dim/50 bg-matrix-dark/60 p-8 text-sm text-matrix-dim">
          Nenhum debate ainda. Crie o primeiro para começar.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((debate) => (
            <Link
              key={debate.id}
              href={`/debates/${debate.id}`}
              className="rounded-xl border border-matrix-dim/50 bg-matrix-dark/70 p-4 transition hover:border-matrix-green/80 hover:bg-matrix-dark"
            >
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-matrix-dim">
                {statusLabel(debate.status)}
              </p>
              <h2 className="mb-2 max-h-14 overflow-hidden text-lg font-bold text-matrix-green">
                {debate.title}
              </h2>
              <p className="max-h-16 overflow-hidden text-sm leading-relaxed text-matrix-dim">
                {debate.question}
              </p>
              <p className="mt-4 text-xs text-matrix-dim/80">
                {new Date(debate.created_at).toLocaleString("pt-BR")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
