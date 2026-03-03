"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const { t } = useI18n();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-70px)] w-full max-w-5xl flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-8 backdrop-blur-sm md:p-12">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-matrix-dim">{t("home.engine")}</p>
        <h1 className="mb-4 text-4xl font-bold text-white md:text-6xl">{t("home.title")}</h1>
        <p className="max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
          {t("home.subtitle")}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/debates/new"
            className="rounded-lg border border-matrix-green bg-matrix-green/15 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-matrix-green/25"
          >
            {t("home.new_debate")}
          </Link>
          <Link
            href="/debates"
            className="rounded-lg border border-white/15 bg-white/[0.04] px-5 py-3 text-center text-sm font-bold text-white/85 transition hover:bg-white/[0.08]"
          >
            {t("home.my_debates")}
          </Link>
        </div>
      </div>
    </main>
  );
}
