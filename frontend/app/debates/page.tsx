"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listDebates, type DebateListItem } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { readMyDebateIds } from "@/lib/local-gallery";

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
  if (status === "completed") return "status.completed";
  if (status === "running") return "status.running";
  if (status === "failed") return "status.failed";
  if (status === "draft") return "status.draft";
  return status;
}

export default function DebatesPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<DebateListItem[]>([]);
  const [myDebateIds, setMyDebateIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMyDebateIds(readMyDebateIds());
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

  const myItems = items.filter((item) => myDebateIds.includes(item.id));
  const publicItems = items.filter((item) => !myDebateIds.includes(item.id));

  return (
    <main className="mx-auto min-h-[calc(100vh-70px)] w-full max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t("gallery.title")}</h1>
          <p className="mt-1 text-sm text-white/75">
            {loading ? t("gallery.subtitle_loading") : t("gallery.subtitle_ready")}
          </p>
        </div>
        <Link
          href="/debates/new"
          className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white/85 transition hover:bg-white/[0.08]"
        >
          {t("gallery.new_debate")}
        </Link>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-white/20 bg-white/[0.04] px-4 py-3 text-sm text-white/85">
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
        <div className="rounded-xl border border-white/15 bg-white/[0.04] p-8 text-sm text-white/75">
          {t("gallery.empty_all")}
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-matrix-green">{t("gallery.my_section")}</h2>
            {myItems.length === 0 ? (
              <div className="rounded-xl border border-white/15 bg-white/[0.04] p-5 text-sm text-white/70">
                {t("gallery.empty_my")}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {myItems.map((debate) => (
                  <Link
                    key={debate.id}
                    href={`/debates/${debate.id}`}
                    className="rounded-xl border border-white/15 bg-white/[0.04] p-4 transition hover:border-matrix-green/70 hover:bg-white/[0.07]"
                  >
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-matrix-dim">
                      {t(statusLabel(debate.status))}
                    </p>
                    <h2 className="mb-2 max-h-14 overflow-hidden text-lg font-bold text-white">
                      {debate.title}
                    </h2>
                    <p className="max-h-16 overflow-hidden text-sm leading-relaxed text-white/75">
                      {debate.question}
                    </p>
                    <p className="mt-4 text-xs text-white/60">
                      {new Date(debate.created_at).toLocaleString("pt-BR")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-matrix-green">{t("gallery.public_section")}</h2>
            {publicItems.length === 0 ? (
              <div className="rounded-xl border border-white/15 bg-white/[0.04] p-5 text-sm text-white/70">
                {t("gallery.empty_public")}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {publicItems.map((debate) => (
                  <Link
                    key={debate.id}
                    href={`/debates/${debate.id}`}
                    className="rounded-xl border border-white/15 bg-white/[0.04] p-4 transition hover:border-matrix-green/70 hover:bg-white/[0.07]"
                  >
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-matrix-dim">
                      {t(statusLabel(debate.status))}
                    </p>
                    <h2 className="mb-2 max-h-14 overflow-hidden text-lg font-bold text-white">
                      {debate.title}
                    </h2>
                    <p className="max-h-16 overflow-hidden text-sm leading-relaxed text-white/75">
                      {debate.question}
                    </p>
                    <p className="mt-4 text-xs text-white/60">
                      {new Date(debate.created_at).toLocaleString("pt-BR")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
