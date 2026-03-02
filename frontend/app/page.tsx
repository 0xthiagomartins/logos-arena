import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-8 backdrop-blur-sm md:p-12">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-matrix-dim">debate engine</p>
        <h1 className="mb-4 text-4xl font-bold text-white md:text-6xl">LogosArena</h1>
        <p className="max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
          Debates estruturados com IA, rounds rastreáveis e mediação explicável em um fluxo claro:
          criar, acompanhar, concluir.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/debates/new"
            className="rounded-lg border border-matrix-green bg-matrix-green/15 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-matrix-green/25"
          >
            Novo debate
          </Link>
          <Link
            href="/debates"
            className="rounded-lg border border-white/15 bg-white/[0.04] px-5 py-3 text-center text-sm font-bold text-white/85 transition hover:bg-white/[0.08]"
          >
            Meus debates
          </Link>
        </div>
      </div>
    </main>
  );
}
